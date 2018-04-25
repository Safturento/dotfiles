#!/bin/bash


source ~/.cache/wal/colors.sh

# Taken from 
# https://www.reddit.com/r/unixporn/comments/7df2wz/i3lock_minimal_lockscreen_pretty_indicator/

# # Suspend dunst and lock, then resume dunst when unlocked.
pkill -u $USER -USR1 dunst

# Generate a blurred image of desktop
IMAGE=/tmp/i3lock.png
SCREENSHOT="scrot $IMAGE" # 0.46s

# All options are here: http://www.imagemagick.org/Usage/blur/#blur_args
BLURTYPE="0x5" # 7.52s
# BLURTYPE="0x2" # 4.39s
# BLURTYPE="5x2" # 3.80s
# BLURTYPE="2x8" # 2.90s
# BLURTYPE="2x3" # 2.92s

# Get the screenshot, add the blur and lock the screen with it
$SCREENSHOT
# convert $IMAGE -blur $BLURTYPE $IMAGE
convert $IMAGE -scale 20% -scale 500% $IMAGE
[[ -f $1 ]] && convert $IMAGE $1 -gravity center -composite -matte $IMAGE

A=ff
# Lock it up
i3lock -n -i $IMAGE \
	--insidecolor=$color0$A \
	--ringcolor=$color1$A \
	--ringvercolor=$color3$A \
	--insidevercolor=$color3$A \
	--ringwrongcolor=$color5$A \
	--insidewrongcolor=$color5$A \
	--keyhlcolor=$color0$A \
	--bshlcolor=$color0$A \
	--separatorcolor=00000000 \
	--linecolor=00000000 \
	--ring-width=10 \
	--radius=20 \
	--veriftext="" \
	--wrongtext="" \
	--indpos="x+86:y+1003"

rm $IMAGE

pkill -u $USER -USR2 dunst