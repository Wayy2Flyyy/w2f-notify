const ICONS = {
    check: '<svg viewBox="0 0 24 24"><polyline points="4.5 12.5 9.5 17.5 19.5 6.5"/></svg>',
    cross: '<svg viewBox="0 0 24 24"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>',
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
    'center':        { x: '0', y: '-140%' },
    'bottom-center': { x: '0', y: '140%' },
};

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

function applyTheme(theme) {
    if (!theme) return;
    const root = document.documentElement.style;
    if (theme.background) root.setProperty('--nf-bg', theme.background);
    if (theme.blur != null) root.setProperty('--nf-blur', `${theme.blur}px`);
    if (theme.radius != null) root.setProperty('--nf-radius', `${theme.radius}px`);
    if (theme.width != null) root.setProperty('--nf-width', `${theme.width}px`);
    if (theme.titleColor) root.setProperty('--nf-title-color', theme.titleColor);
    if (theme.bodyColor) root.setProperty('--nf-body-color', theme.bodyColor);
    if (theme.fontTitle) root.setProperty('--nf-font-title', theme.fontTitle);
    if (theme.fontBody) root.setProperty('--nf-font-body', theme.fontBody);
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

// minimal markdown: **bold**, *italic*, newlines
function formatText(str) {
    return escapeHtml(str)
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/\n/g, '<br>');
}

// parse any CSS color to [r, g, b] — avoids color-mix(), which older CEF builds lack
const colorCtx = document.createElement('canvas').getContext('2d');
function parseColor(color) {
    colorCtx.fillStyle = '#60a5fa';
    colorCtx.fillStyle = color;
    const v = colorCtx.fillStyle;
    if (v.startsWith('#')) {
        return [parseInt(v.slice(1, 3), 16), parseInt(v.slice(3, 5), 16), parseInt(v.slice(5, 7), 16)];
    }
    const m = v.match(/[\d.]+/g);
    return m ? [+m[0], +m[1], +m[2]] : [96, 165, 250];
}

function applyAccent(el, color) {
    const [r, g, b] = parseColor(color);
    el.style.setProperty('--nf-accent', `rgb(${r}, ${g}, ${b})`);
    el.style.setProperty('--nf-accent-soft', `rgba(${r}, ${g}, ${b}, 0.14)`);
    el.style.setProperty('--nf-accent-border', `rgba(${r}, ${g}, ${b}, 0.35)`);
    el.style.setProperty('--nf-accent-glow', `rgba(${r}, ${g}, ${b}, 0.16)`);
    const mix = (c) => Math.round(c + (255 - c) * 0.45);
    el.style.setProperty('--nf-accent-bright', `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`);
}

function renderIcon(icon, accent, iconColor) {
    const wrap = document.createElement('div');
    wrap.className = 'notfy-icon';
    if (iconColor) wrap.style.setProperty('--nf-icon-color', iconColor);

    if (icon && ICONS[icon]) {
        wrap.innerHTML = ICONS[icon];
    } else if (icon && icon.trim().startsWith('<svg')) {
        wrap.innerHTML = icon;
    } else if (icon && /^(https?:|nui:|data:)/.test(icon)) {
        const img = document.createElement('img');
        img.src = icon;
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

    if (data.theme && data.theme.accentGlow) card.classList.add('has-glow');
    if (data.type === 'error') card.classList.add('nf-shake');

    const icon = renderIcon(data.icon, data.color, data.iconColor);
    if (data.theme && data.theme.iconPulse) icon.classList.add('has-pulse');
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

function show(data) {
    if (!SLIDE_VECTORS[data.position]) data.position = 'top-right';
    applyTheme(data.theme);
    maxVisible = data.maxVisible || maxVisible;
    newestFirst = (data.newest || 'top') === 'top';

    getContainer(data.position);

    if (visibleCount[data.position] >= maxVisible) {
        queues[data.position].push(data);
        return;
    }
    mount(data);
}

function mount(data) {
    const container = getContainer(data.position);

    // replace an existing notification with the same id
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

function updateCard(data) {
    const entry = active.get(data.id);
    if (!entry) return;

    const fresh = buildCard(data);
    fresh.classList.remove(`nf-enter-${data.animation.enter}`);
    fresh.classList.add('nf-enter-fade');
    entry.wrap.replaceChild(fresh, entry.card);
    entry.card = fresh;
    entry.data = data;

    if (entry.timer) clearTimeout(entry.timer);
    if (data.duration > 0) {
        entry.timer = setTimeout(() => dismiss(data.id), data.duration);
    }
}

function dismiss(id) {
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
            const next = queues[data.position].shift();
            if (next) mount(next);
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
            if (active.has(msg.data.id)) updateCard(msg.data);
            break;
        case 'hide':
            dismiss(msg.data.id);
            break;
        case 'clear':
            clearAll();
            break;
    }
});
