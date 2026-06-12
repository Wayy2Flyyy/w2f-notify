# w2f-notfy

A sleek, modern, fully animated notification system for FiveM.
Standalone with drop-in bridges for **Qbox**, **ESX** and **QBCore** — every notification renders as a smooth animation.

<img width="3200" height="1800" alt="previewtypes" src="https://github.com/user-attachments/assets/2cf94bac-f481-4dad-a668-5268ea405bb4" />
<img width="3200" height="1800" alt="previewpositions" src="https://github.com/user-attachments/assets/e30de83a-a881-4dff-9556-9b9a7ed0e2df" />
<img width="900" height="506" alt="previewanimations" src="https://github.com/user-attachments/assets/76c8ef8f-5216-44df-96f8-ca98a1e4c27f" />


## ✨ Features

- **6 animation styles** — `slide` (direction-aware), `pop`, `bounce`, `flip`, `glitch`, `fade` — independently configurable for enter & exit, globally or per notification
- **Glassmorphism design** — blurred glass cards, accent glow, animated SVG icon stroke-draw, pulsing icon ring, gradient progress bar
- **9 screen positions** — any corner, edge or center, per notification
- **Framework bridges** — auto-detects `qbx_core`, `qb-core` or `es_extended` and transparently re-renders their default notifications (`ox_lib:notify`, `QBCore:Notify`, `esx:showNotification`)
- **Smart stacking** — max-visible limit with overflow queueing and buttery height-collapse restacking
- **Live updates** — update or hide a visible notification by id (great for progress/status flows)
- **Markdown** — `**bold**`, `*italic*` and newlines in titles & descriptions
- **Custom icons** — built-in icon set, any inline `<svg>`, or an image URL
- **Per-type sounds** — GTA frontend sounds per notification type, fully configurable
- **Zero dependencies** — pure Lua + vanilla JS/CSS

## 📦 Installation

1. Drop the resource into your `resources` folder as `w2f-notfy`
2. Add to your `server.cfg`:
   ```cfg
   ensure w2f-notfy
   ```
3. (Optional) tweak `config.lua` — framework, position, animations, theme, types, sounds

That's it. With `Config.OverrideNotifications = true` your framework's existing notifications instantly use the new design — no script edits needed.

## 🚀 Usage

### Client

```lua
-- simple
exports['w2f-notfy']:Notify('Money received!')

-- full control
exports['w2f-notfy']:Notify({
    type        = 'success',            -- success | error | info | warning | police
    title       = 'Bank',
    description = 'You received **$5,000**',
    duration    = 6000,                 -- ms, 0 = persistent until Hide()
    position    = 'top-right',
    animation   = { enter = 'glitch', exit = 'fade' },
    icon        = 'bell',               -- built-in name, '<svg .../>' or image url
    color       = '#34d399',            -- override the accent color
    progress    = true,
})

-- shorthands
exports['w2f-notfy']:Success('Vehicle stored')
exports['w2f-notfy']:Error('Not enough money')
exports['w2f-notfy']:Info('Press E to interact')
exports['w2f-notfy']:Warning('Engine overheating')

-- live updates (Notify returns the id)
local id = exports['w2f-notfy']:Notify({ title = 'Crafting', description = 'Working…', duration = 0 })
exports['w2f-notfy']:Update(id, { type = 'success', title = 'Crafting', description = 'Done!', duration = 3000 })
exports['w2f-notfy']:Hide(id)
exports['w2f-notfy']:Clear()
```

### Server

```lua
exports['w2f-notfy']:Notify(source, { type = 'info', title = 'Server', description = 'Welcome!' })
exports['w2f-notfy']:NotifyAll({ type = 'warning', description = 'Restart in **5 minutes**' })
```

### Events

```lua
-- client
TriggerEvent('w2f-notfy:notify', { type = 'success', description = 'Done' })

-- server → client
TriggerClientEvent('w2f-notfy:notify', source, { type = 'error', description = 'Denied' })
```

## 🎬 Animations

| Style | Enter | Exit |
|---|---|---|
| `slide` | Slides in from the nearest screen edge with a soft spring | Slides back out |
| `pop` | Springy overshoot scale-up | Quick scale-down |
| `bounce` | Drops in with a playful bounce | Hops up, falls away |
| `flip` | 3D flip on the X axis | Flips closed |
| `glitch` | Cyberpunk clip-path tear with hue shift | Tears apart |
| `fade` | Clean opacity fade | Fades out |

Error notifications additionally shake their icon, all icons stroke-draw on entry, and the progress bar glows in the accent color.

## 🧪 Preview in game

With `Config.Debug = true`:

```
/notfy                  → showcase all five types
/notfy success          → single notification
/notfy info glitch      → preview a specific animation
```

## ⚙️ Framework integration

`Config.OverrideNotifications = true` makes w2f-notfy listen to your framework's notification **events** (`ox_lib:notify`, `QBCore:Notify`, `esx:showNotification`). The framework's own UI may still render those events too — to fully *replace* it, redirect the framework's notify function at the source and set `Config.OverrideNotifications = false`:

### QBCore
Replace the body of `QBCore.Functions.Notify` in `qb-core/client/functions.lua`:

```lua
function QBCore.Functions.Notify(text, textType, length)
    if type(text) == 'table' then
        exports['w2f-notfy']:Notify({ title = text.caption, description = text.text, type = textType, duration = length })
    else
        exports['w2f-notfy']:Notify({ description = text, type = textType, duration = length })
    end
end
```

### ESX
Replace the body of `ESX.ShowNotification` in `es_extended/client/functions.lua` (or point `esx_notify` at the export):

```lua
function ESX.ShowNotification(message, notifyType, length)
    exports['w2f-notfy']:Notify({ description = message, type = notifyType, duration = length })
end
```

### Qbox / ox_lib
Server-sent notifications travel over the `ox_lib:notify` event, which w2f-notfy picks up automatically — but ox_lib renders its own UI for the same event, so you'd see both. Either keep ox_lib's visuals (set `Config.OverrideNotifications = false`), or redirect `lib.notify` by editing `ox_lib/resource/interface/client/notify.lua` to forward to `exports['w2f-notfy']:Notify`.

### Standalone
Set `Config.Framework = 'standalone'` (or leave `auto` with no framework running) and use the exports/events directly.
