# Safturento's Dotfiles

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
```
Enabling bitmap fonts
```
sudo rm /etc/fonts/conf.d/70-no-bitmaps.conf
sudo ln /etc/fonts/conf.avail/70-yes-bitmaps.conf /etc/fonts/conf.d/
sudo rm /etc/fonts/conf.d/10-scale-bitmap-fonts.conf
```