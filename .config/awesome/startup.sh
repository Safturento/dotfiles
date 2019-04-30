#!/usr/bin/env bash

setxkbmap -option caps:hyper
xset fp+ /usr/share/fonts/envypn
xset fp rehash

killall -q compton;
compton --config ~/.config/.compton.conf -b