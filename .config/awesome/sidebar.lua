local awful = require('awful')
local wibox = require('wibox')

local mouse = false

sidebar = awful.wibox({
	position = 'left',
	width = 300,
	height = awful.screen.focused().geometry.height,
	ontop = true,
	visible = false,
	type = 'dock',
	expand = 'none'
})

function hpad(n)
	s = ''
	for i=1, n do
		s = s..' '
	end
	return wibox.widget.textbox(s)
end

function vpad(n)
	s = ''
	for i=1, n do
		s = s..'\n '
	end
	return wibox.widget.textbox(s)
end

local pad = hpad(1)

local time = awful.widget.textclock("%H.%M")
time.align = 'center'
time.valign = 'center'
time.font = 'Roboto Slab 50'

local date = wibox.widget.textclock("%A, %B %d")
date.align = "center"
date.valign = "center"
date.font = "Roboto Slab Light 15"

local weather = require('sidebar/weather')
local filesystem = require('sidebar/filesystem')

function sidebar:init(beautiful, taglist)
	self.bg = beautiful.bg_normal .. '99'

	if mouse then
		local toggle_frame = wibox({
			width=1,
			position=self.position,
			height = self.height,
			ontop = true,
			visible = true,
			opacity = 0
		})

		toggle_frame:connect_signal('mouse::enter', function()
			if not self.toggled then
				self.visible = true
				self.floating = true
			end
		end)
		self:connect_signal('mouse::leave', function()
			if not self.toggled then
				self.visible = false
				self.floating = false
			end
		end) 
	end

	
	local top = {
		layout = wibox.layout.fixed.vertical,
		vpad(2),
		time,
		date,
		vpad(2),
		weather
	}
	
	local middle = {
		layout = wibox.layout.fixed.vertical,
		
	}


	local bottom = {
		vpad(40),
		{
			hpad(16), taglist,
			layout = wibox.layout.fixed.horizontal,
		},
		layout = wibox.layout.fixed.vertical,
	}
	
	self:setup {
		expand = 'none',
		top,
		middle,
		bottom,
		layout = wibox.layout.fixed.vertical,
	}
end

return sidebar