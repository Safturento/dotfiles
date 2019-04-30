local awful = require('awful')
local wibox = require('wibox')
local fa = require('font-awesome')

local file_explorer = 'thunar'

local dropbox = awful.widget.button({ image = fa('brands', 'dropbox') })
dropbox.resize = true
dropbox.forced_width = 40
dropbox.forced_height = 40

local finder = awful.widget.button({ image = fa('solid', 'folder') })
finder.forced_height = 40
-- finder.text('Thunar')

filesystem = wibox.widget {
	dropbox,
	finder,
	layout = wibox.layout.fixed.horizontal
}

return filesystem