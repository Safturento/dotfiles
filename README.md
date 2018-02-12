# Safturento's Dotfiles


## Arch
Required install
```
sudo pacman -S compton
sudo pacman -S i3-gaps
sudo pacman -S htop
sudo pacman -S yaourt
yaourt ttf-font-awesome
yaourt envypn-font
yaourt polybar
```
Optional install
```
yaourt dropbox-cli
yaourt nvidia-smi
yaourt sublime-text-dev
yaourt teiler
yaourt neofetch
yaourt w3m
yaourt google-chrome
yaourt discord
yaourt nitrogen
yaourt arc-gtk-theme
yaourt paper-icon-theme
```

## Ubuntu
```
sudo apt install git autoconf xutils-dev xcb libxcb1-dev libxcb-keysyms1-dev libpango1.0-dev libxcb-util0-dev libxcb-icccm4-dev libyajl-dev libstartup-notification0-dev libxcb-randr0-dev libev-dev libxcb-cursor-dev libxcb-xinerama0-dev libxcb-xkb-dev libxkbcommon-dev libxkbcommon-x11-dev autoconf libxcb-xrm0 libxcb-xrm-dev automake cmake cmake-data libcairo2-dev libxcb-ewmh-dev libxcb-image0-dev pkg-config python-xcbgen xcb-proto libasound2-dev libmpdclient-dev libiw-dev libcurl4-openssl-dev acpi
```

installing polybar
https://github.com/jaagr/polybar/wiki/Compiling

Other stuff
```
sudo apt install compton htop neofetch w3m w3m-img rofi rxvt-unicode fonts-font-awesome thunar sudo apt install i3lock scrot nitrogen xbacklight

# paper icon theme https://snwh.org/paper/download
sudo add-apt-repository ppa:snwh/pulp

# chrome
wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | sudo apt-key add - 
sudo sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list'
```



## Enabling bitmap fonts
```
sudo rm /etc/fonts/conf.d/70-no-bitmaps.conf
sudo ln /etc/fonts/conf.avail/70-yes-bitmaps.conf /etc/fonts/conf.d/
sudo rm /etc/fonts/conf.d/10-scale-bitmap-fonts.conf
```