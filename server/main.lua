---Send a notification to one player.
---@param source number player server id
---@param data string|table
local function notify(source, data)
    TriggerClientEvent('w2f-notfy:notify', source, data)
end

---Send a notification to every player.
---@param data string|table
local function notifyAll(data)
    TriggerClientEvent('w2f-notfy:notify', -1, data)
end

exports('Notify', notify)
exports('NotifyAll', notifyAll)

exports('Hide', function(source, id)
    TriggerClientEvent('w2f-notfy:hide', source, id)
end)

exports('Clear', function(source)
    TriggerClientEvent('w2f-notfy:clear', source)
end)
