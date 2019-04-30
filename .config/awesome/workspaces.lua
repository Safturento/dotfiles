local awful = require('awful')
local l = awful.layout.suit

workspaces = {}

local mods = require('mods')

workspaces.workspaces = {
	[1] = { name = '', key = 'q', layout = l.tile },
	[2] = { name = '', key = 'c', layout = l.tile },
	[3] = { name = '', key = 's', layout = l.tile },
	[4] = { name = '', key = 'g', layout = l.tile },
	[5] = { name = '', key = 'e', layout = l.tile },
	[6] = { name = '', key = 'm', layout = l.tile }
}

workspaces.toggle_mod = mods.ctrl
workspaces.move_mod = mods.shift

return workspaces