local RESOURCE_EVENT = 'w2f-notify'
local LEGACY_EVENT = 'w2f-notfy'

local function targetOrAll(target)
    return target or -1
end

---Send a notification to one player.
---@param target number player server id
---@param data string|table
local function notify(target, data)
    TriggerClientEvent(RESOURCE_EVENT .. ':notify', targetOrAll(target), data)
end

---Send a notification to every player.
---@param data string|table
local function notifyAll(data)
    TriggerClientEvent(RESOURCE_EVENT .. ':notify', -1, data)
end

---Update a visible notification for one player.
---@param target number player server id
---@param id string notification id
---@param data string|table fields to change
local function update(target, id, data)
    if not id then return end
    TriggerClientEvent(RESOURCE_EVENT .. ':update', targetOrAll(target), id, data)
end

---Hide a notification for one player.
---@param target number player server id
---@param id string notification id
local function hide(target, id)
    if not id then return end
    TriggerClientEvent(RESOURCE_EVENT .. ':hide', targetOrAll(target), id)
end

---Clear visible and queued notifications for one player.
---@param target number player server id
local function clear(target)
    TriggerClientEvent(RESOURCE_EVENT .. ':clear', targetOrAll(target))
end

exports('Notify', notify)
exports('NotifyAll', notifyAll)
exports('Update', update)
exports('Hide', hide)
exports('Clear', clear)

-- Backward-compatible typo aliases from the original release.
RegisterNetEvent(LEGACY_EVENT .. ':notify', function(data)
    notify(source, data)
end)

RegisterNetEvent(LEGACY_EVENT .. ':update', function(id, data)
    update(source, id, data)
end)

RegisterNetEvent(LEGACY_EVENT .. ':hide', function(id)
    hide(source, id)
end)

RegisterNetEvent(LEGACY_EVENT .. ':clear', function()
    clear(source)
end)
