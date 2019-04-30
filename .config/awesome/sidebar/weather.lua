local awful = require('awful')
local wibox = require('wibox')
local cjson = require('cjson')
local api = require('api_keys').openweathermap
local fa = require('font-awesome')

local units = 'metric'
local symbol = '°C'

local interval = 600 --sec

local icon_codes = {
	['01d'] = fa('solid', 'sun'),
	['02d'] = fa('solid', 'cloud-sun'),
	['03d'] = fa('solid', 'cloud'),
	['04d'] = fa('solid', 'cloud'),
	['09d'] = fa('solid', 'cloud-rain'),
	['10d'] = fa('solid', 'cloud-sun-rain'),
	['11d'] = fa('solid', 'bolt'),
	['13d'] = fa('solid', 'snowflake'),
	['50d'] = fa('solid', 'water'),
	['01n'] = fa('solid', 'moon'),
	['02n'] = fa('solid', 'cloud-moon'),
	['03n'] = fa('solid', 'cloud'),
	['04n'] = fa('solid', 'cloud'),
	['09n'] = fa('solid', 'cloud-rain'),
	['10n'] = fa('solid', 'cloud-moon-rain'),
	['11n'] = fa('solid', 'bolt'),
	['13n'] = fa('solid', 'snowflake'),
	['50n'] = fa('solid', 'water')
}

local icon = {
	['01d'] = fa('solid', ''),
	['02d'] = fa('solid', 'cloud-sun'),
	['03d'] = fa('solid', ''),
	['04d'] = fa('solid', ''),
	['09d'] = fa('solid', ''),
	['10d'] = fa('solid', 'cloud-sun-rain'),
	['11d'] = fa('solid', ''),
	['13d'] = fa('solid', ''),
	['50d'] = fa('solid', 'water'),
	['01n'] = fa('solid', ''),
	['02n'] = fa('solid', 'cloud-moon'),
	['03n'] = fa('solid', ''),
	['04n'] = fa('solid', ''),
	['09n'] = fa('solid', ''),
	['10n'] = fa('solid', ''),
	['11n'] = fa('solid', ''),
	['13n'] = fa('solid', ''),
	['50n'] = fa('solid', 'water')
}

local temp_text = wibox.widget {
	text = '?? '..symbol,
	align = 'center',
	valign = 'center',
	font = 'Roboto Slab 30',
	widget = wibox.widget.textbox
}

local icon = wibox.widget.imagebox(icon_codes['01d'])
icon.resize = true
icon.forced_width = 40
icon.forced_height = 40

local text_icon = wibox.widget {
	text = '',
	align = 'center',
	valing = 'center',
	font = 'FontAwesome 30',
	widget = wibox.widget.textbox
}

local desc_text = wibox.widget {
	text = 'dunno',
	align = 'center',
	valign = 'center',
	font = 'Roboto Slab Light 15',
	widget = wibox.widget.textbox
}

local weather = wibox.widget {
	temp_text,
	{
		desc_text,
		text_icon,
		layout = wibox.layout.fixed.horizontal
	},
	layout = wibox.layout.fixed.vertical
}

local function update(widget, stdout, stderr, exitreason, exitcode)
	local info = cjson.decode(stdout)
	local temp = info.main.temp
	local icon_id = info.weather[1].icon
	local desc = info.weather[1].description
	
	temp_text.text = string.format ("%s %s", temp, symbol)
	desc_text.text = desc
end

local api_call = os.getenv('HOME').."/.config/awesome/sidebar/weather.sh "..api.key
awful.widget.watch("bash "..api_call, interval, update)

return weather