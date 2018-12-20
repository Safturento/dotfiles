#!/bin/bash

# Restart compton
killall -q compton;
compton --config ~/.config/.compton.conf -b

# Set random wallpaper and update color scheme
# ~/conda/bin/wal -i "/home/safturento/Dropbox/Photos/Wallpapers/9azphebdx3i01.jpg" --backend colorthief -b '#1f1f1f' 
~/conda/bin/wal -Rq
xrdb -merge ~/.cache/wal/colors.Xresources
# Set file source for dunst below
source "${HOME}/.cache/wal/colors.sh"

# Update sublime theme to match wal
# python ~/Github/sublime-wal/scheme.py


# restart bar
# pkill -f stbar; 
# while pgrep -x stbar > /dev/null;
# 	do sleep .5;
# done
# stbar

# restart dunst
pkill dunst
while pgrep -x dunst > /dev/null;
	do sleep .5;
done
dunst \
	-frame_width 1 \
	-sep_height 1 \
	-shrink \
	-lb "${color0:=#FF0000}" \
	-nb "${color0:=#FF0000}" \
	-cb "${color0:=#FF0000}" \
	-lf "${color7:=#00FFFF}" \
	-bf "${color7:=#00FFFF}" \
	-cf "${color7:=#00FFFF}" \
	-nf "${color7:=#00FFFF}" \
	-sep_color "${color3:=#00FFFF}" \
	-geometry "300x5-30+30" \
	-fn "envypn 8" \
	-frame_color "${color3:=#00FFFF}" & notify-send "Reloaded scheme"