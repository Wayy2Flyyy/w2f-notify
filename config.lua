Config = {}

--[[ ────────────────────────────────────────────────────────────────────
    FRAMEWORK
    'auto'       → detects qbx_core / qb-core / es_extended automatically
    'standalone' → no framework bridge, exports/events only
    'qbox'       → bridge ox_lib notifications  (ox_lib:notify)
    'qb'         → bridge QBCore notifications  (QBCore:Notify)
    'esx'        → bridge ESX notifications     (esx:showNotification)
──────────────────────────────────────────────────────────────────── ]]
Config.Framework = 'auto'

-- Listen to the framework's default notification events and render them
-- through w2f-notfy as well. NOTE: the framework's own UI may still draw
-- those events too — see the "Framework integration" section of the README
-- to fully replace it (then set this to false to avoid double rendering).
Config.OverrideNotifications = true

--[[ ────────────────────────────────────────────────────────────────────
    GENERAL
──────────────────────────────────────────────────────────────────── ]]
-- Default screen anchor for notifications:
-- 'top-left' | 'top-center' | 'top-right'
-- 'center-left' | 'center' | 'center-right'
-- 'bottom-left' | 'bottom-center' | 'bottom-right'
Config.Position = 'top-right'

Config.Duration   = 5000  -- default visible time in ms (0 = stays until hidden by script)
Config.MaxVisible = 6     -- max notifications shown per position, extras are queued
Config.Progress   = true  -- show the animated lifetime progress bar
Config.Newest     = 'top' -- 'top' = newest stacks closest to the anchor, 'bottom' = oldest

--[[ ────────────────────────────────────────────────────────────────────
    ANIMATIONS
    enter / exit styles (each notification can override these per-call):
      'slide'  → direction-aware slide + fade (slides from the nearest edge)
      'pop'    → springy overshoot scale
      'bounce' → playful drop-in bounce
      'flip'   → 3D flip on the X axis
      'glitch' → cyberpunk clip-path glitch
      'fade'   → simple opacity fade
──────────────────────────────────────────────────────────────────── ]]
Config.Animation = {
    enter = 'slide',
    exit  = 'slide',
}

--[[ ────────────────────────────────────────────────────────────────────
    THEME
──────────────────────────────────────────────────────────────────── ]]
Config.Theme = {
    background  = 'rgba(13, 15, 22, 0.82)', -- card background (glassmorphism)
    blur        = 14,                        -- backdrop blur in px (0 disables)
    radius      = 14,                        -- corner radius in px
    width       = 340,                       -- card width in px
    fontTitle   = '"Archivo", "Segoe UI", sans-serif',
    fontBody    = '"Inter", "Segoe UI", sans-serif',
    titleColor  = '#f4f6fb',
    bodyColor   = '#aab1c2',
    accentGlow  = true,                      -- soft colored glow behind the card
    iconPulse   = true,                      -- pulsing ring animation around the icon
}

--[[ ────────────────────────────────────────────────────────────────────
    NOTIFICATION TYPES
    color → accent color (icon, progress bar, glow)
    icon  → built-in: 'check' | 'cross' | 'info' | 'warning' | 'bell' | 'police'
            or any custom inline <svg> string / image url per-call
    sound → frontend sound played with the notification (set false to mute)
──────────────────────────────────────────────────────────────────── ]]
Config.Types = {
    success = {
        color = '#34d399',
        icon  = 'check',
        sound = { name = 'CHECKPOINT_PERFECT', ref = 'HUD_MINI_GAME_SOUNDSET' },
    },
    error = {
        color = '#f87171',
        icon  = 'cross',
        sound = { name = 'CHECKPOINT_MISSED', ref = 'HUD_MINI_GAME_SOUNDSET' },
    },
    info = {
        color = '#60a5fa',
        icon  = 'info',
        sound = { name = 'NAV_UP_DOWN', ref = 'HUD_FRONTEND_DEFAULT_SOUNDSET' },
    },
    warning = {
        color = '#fbbf24',
        icon  = 'warning',
        sound = { name = 'TIMER_STOP', ref = 'HUD_MINI_GAME_SOUNDSET' },
    },
    police = {
        color = '#818cf8',
        icon  = 'police',
        sound = { name = 'NAV_UP_DOWN', ref = 'HUD_FRONTEND_DEFAULT_SOUNDSET' },
    },
}

Config.Sounds = true -- master toggle for notification sounds

--[[ ────────────────────────────────────────────────────────────────────
    DEBUG
    Adds the /notfy command to preview every type & animation in game.
──────────────────────────────────────────────────────────────────── ]]
Config.Debug = true
