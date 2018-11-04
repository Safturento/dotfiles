#!/bin/bash

# Restart compton
killall -q compton;
compton --config ~/.config/.compton.conf -b

# Set random wallpaper and update color scheme
# ~/.local/bin/wal -i "/home/safturento/Dropbox/Photos/Wallpapers/Cyberpunk/32 - 71ZKyaT.jpg" --backend colorthief -b '#161616' 
~/.local/bin/wal -R

# Update sublime theme to match wal
python3 ~/Github/sublime-wal/scheme.py

source "${HOME}/.cache/wal/colors.sh"

# restart bar
pkill -f stbar; 
while pgrep -x stbar > /dev/null;
	do sleep .5;
done
~/.local/bin/stbar

# restart dunst
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
