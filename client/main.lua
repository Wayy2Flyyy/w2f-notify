local counter = 0

-- ──────────────────────────────────────────────────────────────────────
-- Core
-- ──────────────────────────────────────────────────────────────────────

---Normalise any supported call signature into a full notification payload.
---@param data string|table message string or notification table
---@return table payload, table typeDef
local function buildPayload(data)
    if type(data) == 'string' then
        data = { description = data }
    end

    local nType = data.type or 'info'
    local typeDef = Config.Types[nType] or Config.Types.info

    counter += 1
    local id = data.id or ('w2f_%d'):format(counter)

    return {
        id          = id,
        type        = nType,
        title       = data.title,
        description = data.description or data.message or data.text,
        duration    = data.duration or Config.Duration,
        position    = data.position or Config.Position,
        color       = data.color or typeDef.color,
        icon        = data.icon or typeDef.icon,
        iconColor   = data.iconColor,
        animation   = {
            enter = (data.animation and data.animation.enter) or Config.Animation.enter,
            exit  = (data.animation and data.animation.exit) or Config.Animation.exit,
        },
        progress    = data.progress == nil and Config.Progress or data.progress,
        maxVisible  = Config.MaxVisible,
        newest      = Config.Newest,
        theme       = Config.Theme,
    }, typeDef
end

---Show a notification.
---@param data string|table
---@return string id notification id, usable with Hide / Update
local function notify(data)
    local payload, typeDef = buildPayload(data)

    SendNUIMessage({ action = 'notify', data = payload })

    local sound = (type(data) == 'table' and data.sound ~= nil) and data.sound or typeDef.sound
    if Config.Sounds and sound then
        PlaySoundFrontend(-1, sound.name, sound.ref, true)
    end

    return payload.id
end

---Update the contents of a visible notification in place.
---@param id string
---@param data table fields to change (title, description, type, color, icon, duration ...)
local function update(id, data)
    data = type(data) == 'table' and data or { description = data }
    data.id = id
    local payload = buildPayload(data)
    SendNUIMessage({ action = 'update', data = payload })
end

---Hide a notification early.
---@param id string
local function hide(id)
    SendNUIMessage({ action = 'hide', data = { id = id } })
end

---Clear every visible & queued notification.
local function clear()
    SendNUIMessage({ action = 'clear' })
end

-- ──────────────────────────────────────────────────────────────────────
-- Exports & events
-- ──────────────────────────────────────────────────────────────────────

exports('Notify', notify)
exports('Update', update)
exports('Hide', hide)
exports('Clear', clear)

exports('Success', function(data)
    data = type(data) == 'table' and data or { description = data }
    data.type = 'success'
    return notify(data)
end)

exports('Error', function(data)
    data = type(data) == 'table' and data or { description = data }
    data.type = 'error'
    return notify(data)
end)

exports('Info', function(data)
    data = type(data) == 'table' and data or { description = data }
    data.type = 'info'
    return notify(data)
end)

exports('Warning', function(data)
    data = type(data) == 'table' and data or { description = data }
    data.type = 'warning'
    return notify(data)
end)

RegisterNetEvent('w2f-notfy:notify', notify)
RegisterNetEvent('w2f-notfy:hide', hide)
RegisterNetEvent('w2f-notfy:clear', clear)

-- ──────────────────────────────────────────────────────────────────────
-- Framework bridge
-- ──────────────────────────────────────────────────────────────────────

local function detectFramework()
    if Config.Framework ~= 'auto' then return Config.Framework end

    local function started(resource)
        local state = GetResourceState(resource)
        return state == 'started' or state == 'starting'
    end

    if started('qbx_core') then return 'qbox' end
    if started('qb-core') then return 'qb' end
    if started('es_extended') then return 'esx' end
    return 'standalone'
end

local oxTypeMap = {
    inform  = 'info',
    success = 'success',
    error   = 'error',
    warning = 'warning',
}

local qbTypeMap = {
    primary = 'info',
    success = 'success',
    error   = 'error',
    police  = 'police',
    ambulance = 'error',
}

CreateThread(function()
    if not Config.OverrideNotifications then return end

    local framework = detectFramework()

    if framework == 'qbox' then
        -- qbox routes everything through ox_lib's notify event
        RegisterNetEvent('ox_lib:notify', function(data)
            notify({
                id          = data.id,
                title       = data.title,
                description = data.description,
                type        = oxTypeMap[data.type] or data.type or 'info',
                duration    = data.duration,
                position    = data.position,
            })
        end)
    elseif framework == 'qb' then
        RegisterNetEvent('QBCore:Notify', function(text, textType, length)
            local title, description
            if type(text) == 'table' then
                title = text.caption
                description = text.text
            else
                description = text
            end
            notify({
                title       = title,
                description = description,
                type        = qbTypeMap[textType or 'primary'] or textType or 'info',
                duration    = length,
            })
        end)
    elseif framework == 'esx' then
        RegisterNetEvent('esx:showNotification', function(message, nType, length)
            notify({
                description = message,
                type        = nType == 'inform' and 'info' or nType or 'info',
                duration    = length,
            })
        end)
        RegisterNetEvent('esx:showAdvancedNotification', function(sender, subject, message)
            notify({
                title       = subject or sender,
                description = message,
                type        = 'info',
            })
        end)
    end

    if Config.Debug then
        print(('^2[w2f-notfy]^7 started — framework bridge: ^3%s^7'):format(framework))
    end
end)

-- ──────────────────────────────────────────────────────────────────────
-- Debug command: /notfy [type] [animation]
-- ──────────────────────────────────────────────────────────────────────

if Config.Debug then
    RegisterCommand('notfy', function(_, args)
        local nType = args[1]
        local anim = args[2]

        if not nType then
            -- showcase every type
            local types = { 'success', 'error', 'info', 'warning', 'police' }
            for i, t in ipairs(types) do
                SetTimeout(i * 350, function()
                    notify({
                        type = t,
                        title = t:sub(1, 1):upper() .. t:sub(2),
                        description = ('This is a **%s** notification preview.'):format(t),
                    })
                end)
            end
            return
        end

        notify({
            type = nType,
            title = 'w2f-notfy',
            description = anim
                and ('Animation preview: **%s**'):format(anim)
                or 'Single notification preview.',
            animation = anim and { enter = anim, exit = anim } or nil,
        })
    end, false)
end
