const ICONS = {
    check: '<svg viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg>',
    cross: '<svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    info: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><line x1="12" y1="11" x2="12" y2="16.5"/><line x1="12" y1="7.5" x2="12" y2="7.6"/></svg>',
    warning: '<svg viewBox="0 0 24 24"><path d="M12 3.5 21.5 20h-19L12 3.5z"/><line x1="12" y1="10" x2="12" y2="14.5"/><line x1="12" y1="17" x2="12" y2="17.1"/></svg>',
    bell: '<svg viewBox="0 0 24 24"><path d="M18 9a6 6 0 1 0-12 0c0 6-2.5 7.5-2.5 7.5h17S18 15 18 9"/><path d="M10 20a2.2 2.2 0 0 0 4 0"/></svg>',
    police: '<svg viewBox="0 0 24 24"><path d="M12 3l8 3v5.5c0 4.7-3.2 8-8 9.5-4.8-1.5-8-4.8-8-9.5V6l8-3z"/></svg>',
};

const SLIDE_VECTORS = {
    'top-left':      { x: '-110%', y: '0' },
    'center-left':   { x: '-110%', y: '0' },
    'bottom-left':   { x: '-110%', y: '0' },
    'top-right':     { x: '110%', y: '0' },
    'center-right':  { x: '110%', y: '0' },
    'bottom-right':  { x: '110%', y: '0' },
    'top-center':    { x: '0', y: '-140%' },
    center:          { x: '0', y: '-140%' },
    'bottom-center': { x: '0', y: '140%' },
};

const ANIMATIONS = new Set(['slide', 'pop', 'bounce', 'flip', 'glitch', 'fade']);
const containers = {};
const active = new Map();   // id → { wrap, card, data, timer }
const queues = {};          // position → pending payloads
const visibleCount = {};    // position → number

let maxVisible = 6;
let newestFirst = true;

function getContainer(position) {
    if (!containers[position]) {
        const el = document.createElement('div');
        el.className = 'notfy-container';
        el.dataset.pos = position;
        document.body.appendChild(el);
        containers[position] = el;
        queues[position] = [];
        visibleCount[position] = 0;
    }
    return containers[position];
}

function clampNumber(value, fallback, min, max) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.min(max, Math.max(min, Math.floor(number)));
}

function normalizeAnimation(animation) {
    let enter = 'slide';
    let exit = 'slide';

    if (typeof animation === 'string') {
        enter = animation;
        exit = animation;
    } else if (animation && typeof animation === 'object') {
        enter = animation.enter || enter;
        exit = animation.exit || exit;
    }

    return {
        enter: ANIMATIONS.has(enter) ? enter : 'slide',
        exit: ANIMATIONS.has(exit) ? exit : 'slide',
    };
}

function normalizePayload(payload) {
    const data = payload && typeof payload === 'object' ? payload : { description: String(payload ?? '') };
    const position = SLIDE_VECTORS[data.position] ? data.position : 'top-right';
    const duration = clampNumber(data.duration, 5000, 0, 86_400_000);

    return {
        id: String(data.id || `nui_${Date.now()}_${Math.random().toString(16).slice(2)}`),
        type: String(data.type || 'info'),
        title: data.title == null ? '' : String(data.title),
        description: data.description == null ? '' : String(data.description),
        duration,
        position,
        color: typeof data.color === 'string' ? data.color : '#60a5fa',
        icon: data.icon == null ? 'bell' : String(data.icon),
        iconColor: data.iconColor == null ? '' : String(data.iconColor),
        animation: normalizeAnimation(data.animation),
        progress: data.progress !== false,
        maxVisible: clampNumber(data.maxVisible, maxVisible, 1, 20),
        newest: data.newest === 'bottom' ? 'bottom' : 'top',
        theme: data.theme && typeof data.theme === 'object' ? data.theme : {},
    };
}

function applyTheme(theme) {
    if (!theme || typeof theme !== 'object') return;
    const root = document.documentElement.style;
    if (typeof theme.background === 'string') root.setProperty('--nf-bg', theme.background);
    if (theme.blur != null) root.setProperty('--nf-blur', `${clampNumber(theme.blur, 14, 0, 64)}px`);
    if (theme.radius != null) root.setProperty('--nf-radius', `${clampNumber(theme.radius, 14, 0, 48)}px`);
    if (theme.width != null) root.setProperty('--nf-width', `${clampNumber(theme.width, 340, 220, 720)}px`);
    if (typeof theme.titleColor === 'string') root.setProperty('--nf-title-color', theme.titleColor);
    if (typeof theme.bodyColor === 'string') root.setProperty('--nf-body-color', theme.bodyColor);
    if (typeof theme.fontTitle === 'string') root.setProperty('--nf-font-title', theme.fontTitle);
    if (typeof theme.fontBody === 'string') root.setProperty('--nf-font-body', theme.fontBody);
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// minimal markdown: **bold**, *italic*, newlines
function formatText(str) {
    return escapeHtml(str)
        .replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>')
        .replace(/(^|\s)\*([^*]+?)\*/g, '$1<em>$2</em>')
        .replace(/\n/g, '<br>');
}

// parse any CSS color to [r, g, b] — avoids color-mix(), which older CEF builds lack
const colorCtx = document.createElement('canvas').getContext('2d');
function parseColor(color) {
    if (!colorCtx || typeof color !== 'string') return [96, 165, 250];
    colorCtx.fillStyle = '#60a5fa';
    colorCtx.fillStyle = color;
    const value = colorCtx.fillStyle;
    if (value.startsWith('#') && value.length === 7) {
        return [parseInt(value.slice(1, 3), 16), parseInt(value.slice(3, 5), 16), parseInt(value.slice(5, 7), 16)];
    }
    const match = value.match(/[\d.]+/g);
    return match ? [+match[0], +match[1], +match[2]] : [96, 165, 250];
}

function applyAccent(el, color) {
    const [r, g, b] = parseColor(color);
    el.style.setProperty('--nf-accent', `rgb(${r}, ${g}, ${b})`);
    el.style.setProperty('--nf-accent-soft', `rgba(${r}, ${g}, ${b}, 0.14)`);
    el.style.setProperty('--nf-accent-border', `rgba(${r}, ${g}, ${b}, 0.35)`);
    el.style.setProperty('--nf-accent-glow', `rgba(${r}, ${g}, ${b}, 0.16)`);
    const mix = (channel) => Math.round(channel + (255 - channel) * 0.45);
    el.style.setProperty('--nf-accent-bright', `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`);
}

function isImageUrl(icon) {
    return /^(https?:|nui:|data:image\/)/i.test(icon);
}

function renderIcon(icon, iconColor) {
    const wrap = document.createElement('div');
    wrap.className = 'notfy-icon';
    if (iconColor) wrap.style.setProperty('--nf-icon-color', iconColor);

    if (ICONS[icon]) {
        wrap.innerHTML = ICONS[icon];
    } else if (icon.trim().startsWith('<svg') && icon.trim().endsWith('</svg>')) {
        wrap.innerHTML = icon;
    } else if (isImageUrl(icon)) {
        const img = document.createElement('img');
        img.src = icon;
        img.alt = '';
        wrap.appendChild(img);
    } else {
        wrap.innerHTML = ICONS.bell;
    }
    return wrap;
}

function buildCard(data) {
    const card = document.createElement('div');
    card.className = `notfy nf-enter-${data.animation.enter}`;
    applyAccent(card, data.color);

    const vec = SLIDE_VECTORS[data.position] || SLIDE_VECTORS['top-right'];
    card.style.setProperty('--slide-x', vec.x);
    card.style.setProperty('--slide-y', vec.y);

    if (data.theme.accentGlow) card.classList.add('has-glow');
    if (data.type === 'error') card.classList.add('nf-shake');

    const icon = renderIcon(data.icon, data.iconColor);
    if (data.theme.iconPulse) icon.classList.add('has-pulse');
    card.appendChild(icon);

    const content = document.createElement('div');
    content.className = 'notfy-content';
    if (data.title) {
        const title = document.createElement('div');
        title.className = 'notfy-title';
        title.innerHTML = formatText(data.title);
        content.appendChild(title);
    }
    if (data.description) {
        const desc = document.createElement('div');
        desc.className = 'notfy-desc';
        desc.innerHTML = formatText(data.description);
        content.appendChild(desc);
    }
    if (!data.title && !data.description) {
        const desc = document.createElement('div');
        desc.className = 'notfy-desc';
        desc.textContent = 'Notification';
        content.appendChild(desc);
    }
    card.appendChild(content);

    if (data.progress && data.duration > 0) {
        const progress = document.createElement('div');
        progress.className = 'notfy-progress';
        const bar = document.createElement('div');
        bar.className = 'notfy-progress-bar';
        bar.style.animationDuration = `${data.duration}ms`;
        progress.appendChild(bar);
        card.appendChild(progress);
    }

    return card;
}

function dequeue(position) {
    const next = queues[position] && queues[position].shift();
    if (next) mount(next);
}

function removeQueued(id) {
    for (const position of Object.keys(queues)) {
        const index = queues[position].findIndex((item) => item.id === id);
        if (index !== -1) return queues[position].splice(index, 1)[0];
    }
    return null;
}

function show(payload) {
    const data = normalizePayload(payload);
    applyTheme(data.theme);
    maxVisible = data.maxVisible;
    newestFirst = data.newest === 'top';

    getContainer(data.position);

    if (active.has(data.id)) {
        updateCard(data);
        return;
    }

    const queued = removeQueued(data.id);
    if (queued) Object.assign(queued, data);

    if (visibleCount[data.position] >= maxVisible) {
        queues[data.position].push(data);
        return;
    }
    mount(data);
}

function mount(data) {
    const container = getContainer(data.position);

    if (active.has(data.id)) {
        updateCard(data);
        return;
    }

    const wrap = document.createElement('div');
    wrap.className = 'notfy-wrap';
    const card = buildCard(data);
    wrap.appendChild(card);

    const isBottom = data.position.startsWith('bottom');
    // newest closest to the anchor edge: top anchors prepend, bottom anchors append
    if (newestFirst === !isBottom) {
        container.prepend(wrap);
    } else {
        container.appendChild(wrap);
    }

    visibleCount[data.position]++;

    const entry = { wrap, card, data, timer: null };
    active.set(data.id, entry);

    if (data.duration > 0) {
        entry.timer = setTimeout(() => dismiss(data.id), data.duration);
    }
}

function updateCard(payload) {
    const data = normalizePayload(payload);
    const entry = active.get(data.id);
    if (!entry) {
        const queued = removeQueued(data.id);
        if (queued) Object.assign(queued, data);
        return;
    }

    const fresh = buildCard(data);
    fresh.classList.remove(`nf-enter-${data.animation.enter}`);
    fresh.classList.add('nf-enter-fade');
    entry.wrap.replaceChild(fresh, entry.card);
    entry.card = fresh;
    entry.data = data;

    if (entry.timer) clearTimeout(entry.timer);
    entry.timer = null;
    if (data.duration > 0) {
        entry.timer = setTimeout(() => dismiss(data.id), data.duration);
    }
}

function dismiss(id) {
    id = String(id || '');
    if (!id) return;

    const queued = removeQueued(id);
    if (queued) return;

    const entry = active.get(id);
    if (!entry) return;
    active.delete(id);
    if (entry.timer) clearTimeout(entry.timer);

    const { wrap, card, data } = entry;
    card.className = card.className.replace(/nf-enter-\S+/, '');
    card.classList.add(`nf-exit-${data.animation.exit}`);

    let finished = false;
    const finish = () => {
        if (finished) return;
        finished = true;
        // collapse the reserved space so siblings restack smoothly
        wrap.style.overflow = 'hidden';
        wrap.style.height = `${wrap.offsetHeight}px`;
        wrap.offsetHeight; // force reflow
        wrap.style.height = '0';
        wrap.style.opacity = '0';
        wrap.style.marginTop = '-10px'; // cancel the flex gap

        setTimeout(() => {
            wrap.remove();
            visibleCount[data.position] = Math.max(0, visibleCount[data.position] - 1);
            dequeue(data.position);
        }, 300);
    };

    card.addEventListener('animationend', finish, { once: true });
    setTimeout(finish, 700); // safety net if animationend never fires
}

function clearAll() {
    for (const id of [...active.keys()]) dismiss(id);
    for (const pos of Object.keys(queues)) queues[pos] = [];
}

window.addEventListener('message', ({ data: msg }) => {
    if (!msg || !msg.action) return;
    switch (msg.action) {
        case 'notify':
            show(msg.data);
            break;
        case 'update':
            if (msg.data && msg.data.id) updateCard(msg.data);
            break;
        case 'hide':
            if (msg.data && msg.data.id) dismiss(msg.data.id);
            break;
        case 'clear':
            clearAll();
            break;
        default:
            break;
    }
});
