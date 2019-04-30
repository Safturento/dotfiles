local gears = require('gears')
local awful = require('awful')
local hotkeys_popup = require("awful.hotkeys_popup").widget
local keys = {}

local m = require('mods')
local super, alt, ctrl, shift = m.super, m.alt, m.ctrl, m.shift

keys.globalkeys = gears.table.join(
	awful.key({ super }, "h",
		hotkeys_popup.show_help,
		{description="show help", group="awesome"}),
	awful.key({ super }, 'd', 
		function() awful.spawn("rofi -show drun") end,
		{description="launch rofi", group="launcher"}),
	awful.key({ super }, "Return", 
		function() awful.spawn('urxvt') end,
		{description = "open a terminal", group = "launcher"}),
	awful.key({ super, alt }, "r",
		awesome.restart,
		{description = "reload awesome", group = "awesome"}),
	awful.key({ super }, "l", 
		function() awful.tag.incmwfact( 0.05) end,
		{description = "increase width", group = "layout"}),
	awful.key({ super }, "j", 
		function() awful.tag.incmwfact(-0.05) end,
	{description = "decrease width", group = "layout"}),
	awful.key({ super }, 'Tab', function()
		sidebar.visible = not sidebar.visible
		sidebar.toggled = sidebar.visible
	end,
	{description = "toggle sidebar", group="launcher"}),
	awful.key({super, shift}, 'l',
		function() awful.spawn(os.getenv('HOME')..'/.config/i3/scripts/i3lock.sh') end,
		{description = "lock screen", group="awesome"})
)

local workspaces = require('workspaces')
for i, ws in pairs(workspaces.workspaces) do
	keys.globalkeys = gears.table.join(keys.globalkeys,
		-- switch to workspace
		awful.key({ super }, ws.key,
			function()
				local tag = awful.screen.focused().tags[i]
				if tag then tag:view_only() end
			end,
			{description = "switch to "..ws.name, group = "tag"}
		),
		-- toggle workspace
		awful.key({ super, ctrl }, ws.key,
			function()
				local tag = awful.screen.focused().tags[i]
				if tag then awful.tag.viewtoggle(tag) end
			end,
			{description = "toggle "..ws.name, group = "tag"}
		),
		-- move client to workspace
		awful.key({ super, alt }, ws.key,
			function()
				if client.focus then
					local tag = client.focus.screen.tags[i]
					if tag then client.focus:move_to_tag(tag) end
				end
			end,
			{description = "toggle "..ws.name, group = "tag"}
		)
	)
end

keys.clientkeys = gears.table.join(
	awful.key({ super }, "f",
		function(c) c.fullscreen = not c.fullscreen c:raise() end,
		{description = "toggle fullscreen", group = "client"}),
	awful.key({ super, alt }, "f",
		function(c)
			c.maximized_vertical = false
			c.maximized_horizontal = false
			c.maximized = not c.maximized
			c:raise()
		end,
		{description = "toggle maximized", group = "client"}),
	awful.key({ super, shift }, "q",
		function(c) c:kill() end,
		{description = "close", group = "client"}),
	awful.key({ super, alt }, "space",  awful.client.floating.toggle,
		{description = "toggle floating", group = "client"})	
)

return keys