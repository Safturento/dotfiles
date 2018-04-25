#!/bin/bash

# Restart compton
killall -q compton; compton --config ~/.config/.compton.conf -b

# Set random wallpaper and update color scheme
~/.local/bin/wal -i "/home/safturento/Dropbox/Photos/Wallpapers/caxUR.jpg" --backend colorthief

# Update sublime theme to match wal
~/.config/sublime-text-3/Packages/wal/base16-wal-tmTheme.sh > ~/.config/sublime-text-3/Packages/wal/base16-wal.tmTheme &

# Terminate already running bar instances
killall -q polybar

# Wait until the processes have been shut down
while pgrep -x polybar > /dev/null;
	do sleep .5;
done

polybar main &
echo "Bars launched..."

source "${HOME}/.cache/wal/colors.sh"

pkill dunst

while pgrep -x dunst > /dev/null;
	do sleep .5;
done

dunst \
	-fn "envypn 11" \
	-lb "${color0:=#FF0000}" \
	-nb "${color0:=#FF0000}" \
	-cb "${color0:=#FF0000}" \
	-lf "${color4:=#000000}" \
	-bf "${color4:=#000000}" \
	-cf "${color4:=#000000}" \
	-nf "${color4:=#000000}" \
	-geometry "${DUNST_SIZE:-300x30-40+70}"

# # Alternate monitors for different computers
# # desktop
# if [ "$HOSTNAME" = Safturento ]
# then
# 		exit
# else #laptop
#   	if ((xrandr | grep "HDMI-1 connected" > /dev/null))
#   	then
#   		xrandr --output LVDS-1 --auto --output HDMI-1 --left-of LVDS-1 --auto &
#   	else
#   		xrandr --auto &
# 		fi
# fi