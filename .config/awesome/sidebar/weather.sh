#!/usr/bin/env bash

key=$1
loc=$(curl -sf https://ipinfo.io/geo | grep loc | awk -F '[^-0-9.]+' '{ print "lat=" $2 "&lon=" $3 }')
weather=$(curl -sf "api.openweathermap.org/data/2.5/weather?units=metric&appid=$key&$loc")
echo $weather
