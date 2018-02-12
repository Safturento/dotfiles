#!/bin/bash

# Terminate already running bar instances
killall -q polybar

# Wait until the processes have been shut down
while pgrep -x polybar >/dev/null; do sleep 1; done


while true; do
	source "/home/safturento/.cache/wal/colors.sh"
	if [[ $color15 ]]; then
		polybar main &
		exit 1
	fi
	sleep 0.1
	echo "waiting"
done
echo "Bars launched..."