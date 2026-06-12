local counter = 0

local RESOURCE_EVENT = 'w2f-notify'
local LEGACY_EVENT = 'w2f-notfy'

local VALID_POSITIONS = {
    ['top-left'] = true,
    ['top-center'] = true,
    ['top-right'] = true,
    ['center-left'] = true,
    center = true,
    ['center-right'] = true,
    ['bottom-left'] = true,
    ['bottom-center'] = true,
    ['bottom-right'] = true,
}

local VALID_ANIMATIONS = {
    slide = true,
    pop = true,
    bounce = true,
    flip = true,
    glitch = true,
    fade = true,
}

local function shallowCopy(value)
    if type(value) ~= 'table' then return value end

    local copy = {}
    for key, item in pairs(value) do
        copy[key] = item
    end
    return copy
end

local function asNumber(value, fallback, minimum)
    local number = tonumber(value)
    if not number then return fallback end
    if minimum and number < minimum then return minimum end
    return math.floor(number)
end

local function normalizeAnimation(animation)
    local enter = Config.Animation and Config.Animation.enter or 'slide'
    local exit = Config.Animation and Config.Animation.exit or 'slide'

    if type(animation) == 'string' then
        enter = animation
        exit = animation
    elseif type(animation) == 'table' then
        enter = animation.enter or enter
        exit = animation.exit or exit
    end

    if not VALID_ANIMATIONS[enter] then enter = 'slide' end
    if not VALID_ANIMATIONS[exit] then exit = 'slide' end

    return { enter = enter, exit = exit }
end

local function normalizePosition(position)
    position = position or Config.Position or 'top-right'
    return VALID_POSITIONS[position] and position or 'top-right'
end

local function normalizeType(nType)
    if type(nType) ~= 'string' or nType == '' then return 'info' end
    return Config.Types[nType] and nType or 'info'
end

---Normalise any supported call signature into a full notification payload.
---@param data string|table|nil message string or notification table
---@return table payload, table typeDef
local function buildPayload(data)
    if type(data) == 'string' or type(data) == 'number' or type(data) == 'boolean' then
        data = { description = tostring(data) }
    elseif type(data) == 'table' then
        data = shallowCopy(data)
    else
        data = { description = '' }
    end

    local nType = normalizeType(data.type)
    local typeDef = Config.Types[nType] or Config.Types.info or {}

    counter = counter + 1
    local id = data.id or ('w2f_%d'):format(counter)

    return {
        id          = tostring(id),
        type        = nType,
        title       = data.title,
        description = data.description or data.message or data.text or data.caption or '',
        duration    = asNumber(data.duration or data.length, Config.Duration or 5000, 0),
        position    = normalizePosition(data.position),
        color       = data.color or typeDef.color or '#60a5fa',
        icon        = data.icon or typeDef.icon or 'bell',
        iconColor   = data.iconColor,
        animation   = normalizeAnimation(data.animation),
        progress    = data.progress == nil and Config.Progress or data.progress == true,
        maxVisible  = asNumber(data.maxVisible or Config.MaxVisible, Config.MaxVisible or 6, 1),
        newest      = data.newest == 'bottom' and 'bottom' or (Config.Newest == 'bottom' and 'bottom' or 'top'),
        theme       = Config.Theme or {},
    }, typeDef
end

---Show a notification.
---@param data string|table|nil
---@return string id notification id, usable with Hide / Update
local function notify(data)
    local payload, typeDef = buildPayload(data)

    SendNUIMessage({ action = 'notify', data = payload })

    local sound = (type(data) == 'table' and data.sound ~= nil) and data.sound or typeDef.sound
    if Config.Sounds and type(sound) == 'table' and sound.name and sound.ref then
        PlaySoundFrontend(-1, sound.name, sound.ref, true)
    end

    return payload.id
end

---Update the contents of a visible notification in place.
---@param id string
---@param data table|string fields to change (title, description, type, color, icon, duration ...)
local function update(id, data)
    if not id then return end

    data = type(data) == 'table' and shallowCopy(data) or { description = data }
    data.id = id

    local payload = buildPayload(data)
    SendNUIMessage({ action = 'update', data = payload })
end

---Hide a notification early.
---@param id string
local function hide(id)
    if not id then return end
    SendNUIMessage({ action = 'hide', data = { id = tostring(id) } })
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
    data = type(data) == 'table' and shallowCopy(data) or { description = data }
    data.type = 'success'
    return notify(data)
end)

exports('Error', function(data)
    data = type(data) == 'table' and shallowCopy(data) or { description = data }
    data.type = 'error'
    return notify(data)
end)

exports('Info', function(data)
    data = type(data) == 'table' and shallowCopy(data) or { description = data }
    data.type = 'info'
    return notify(data)
end)

exports('Warning', function(data)
    data = type(data) == 'table' and shallowCopy(data) or { description = data }
    data.type = 'warning'
    return notify(data)
end)

exports('Police', function(data)
    data = type(data) == 'table' and shallowCopy(data) or { description = data }
    data.type = 'police'
    return notify(data)
end)

RegisterNetEvent(RESOURCE_EVENT .. ':notify', notify)
RegisterNetEvent(RESOURCE_EVENT .. ':update', update)
RegisterNetEvent(RESOURCE_EVENT .. ':hide', hide)
RegisterNetEvent(RESOURCE_EVENT .. ':clear', clear)

-- Backward-compatible typo aliases from the original release.
RegisterNetEvent(LEGACY_EVENT .. ':notify', notify)
RegisterNetEvent(LEGACY_EVENT .. ':update', update)
RegisterNetEvent(LEGACY_EVENT .. ':hide', hide)
RegisterNetEvent(LEGACY_EVENT .. ':clear', clear)

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
            data = type(data) == 'table' and data or { description = data }
            notify({
                id          = data.id,
                title       = data.title,
                description = data.description,
                type        = oxTypeMap[data.type] or data.type or 'info',
                duration    = data.duration,
                position    = data.position,
                icon        = data.icon,
            })
        end)
    elseif framework == 'qb' then
        RegisterNetEvent('QBCore:Notify', function(text, textType, length)
            local title, description
            if type(text) == 'table' then
                title = text.caption
                description = text.text or text.description
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
        print(('^2[w2f-notify]^7 started — framework bridge: ^3%s^7'):format(framework))
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
            title = 'w2f-notify',
            description = anim
                and ('Animation preview: **%s**'):format(anim)
                or 'Single notification preview.',
            animation = anim and { enter = anim, exit = anim } or nil,
        })
    end, false)
end
