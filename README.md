# Safturento's Dotfiles (Ubuntu)

## Libaries
```
sudo apt install git autoconf xutils-dev xcb libxcb1-dev libxcb-keysyms1-dev libpango1.0-dev libxcb-util0-dev libxcb-icccm4-dev libyajl-dev libstartup-notification0-dev libxcb-randr0-dev libev-dev libxcb-cursor-dev libxcb-composite0 libxcb-xinerama0-dev libxcb-xkb-dev libxkbcommon-dev libxkbcommon-x11-dev autoconf libxcb-xrm0 libxcb-xrm-dev automake cmake cmake-data libcairo2-dev libxcb-ewmh-dev libxcb-image0-dev pkg-config python-xcbgen xcb-proto libasound2-dev libmpdclient-dev libiw-dev libcurl4-openssl-dev acpi clang
```

## Other stuff
```
sudo apt install htop neofetch w3m w3m-img rofi rxvt-unicode fonts-font-awesome thunar i3lock scrot nitrogen light dropbox dunst

## i3-gaps
https://github.com/Airblader/i3/wiki/Compiling-&-Installing
```
cd /path/where/you/want/the/repository

# clone the repository
git clone https://www.github.com/Airblader/i3 i3-gaps
cd i3-gaps

# compile & install
autoreconf --force --install
rm -rf build/
mkdir -p build && cd build/

# Disabling sanitizers is important for release versions!
# The prefix and sysconfdir are, obviously, dependent on the distribution.
../configure --prefix=/usr --sysconfdir=/etc --disable-sanitizers
make
sudo make install

```

## polybar
https://github.com/jaagr/polybar/wiki/Compiling
```
git clone --recursive https://github.com/jaagr/polybar
mkdir polybar/build
cd polybar/build
cmake -DCMAKE_C_COMPILER="clang" -DCMAKE_CXX_COMPILER="clang++" ..
sudo make install
```

## fonts
Download envypn from tar.gz here
https://aur.archlinux.org/packages/envypn-font/
```
sudo rm /etc/fonts/conf.d/70-no-bitmaps.conf
sudo ln /etc/fonts/conf.avail/70-yes-bitmaps.conf /etc/fonts/conf.d/
sudo rm /etc/fonts/conf.d/10-scale-bitmap-fonts.conf
```

## compton
```
sudo apt-add-repository ppa:richardgv/compton
sudo apt-get update
sudo apt-get install compton
```


## sublime-text-dev
https://www.sublimetext.com/docs/3/linux_repositories.html
https://packagecontrol.io/docs/syncing
```
wget -qO - https://download.sublimetext.com/sublimehq-pub.gpg | sudo apt-key add -
sudo apt-get install apt-transport-https
echo "deb https://download.sublimetext.com/ apt/dev/" | sudo tee /etc/apt/sources.list.d/sublime-text.list
sudo apt-get update
sudo apt-get install sublime-text
```

## google-chrome
```
wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | sudo apt-key add - 
sudo sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list'
sudo apt-get update 
sudo apt-get install google-chrome-stable
```

## teiler
in teiler repo directory cloned from https://github.com/carnager/teiler
```
sudo apt install  ffmpeg xininfo xclip maim slop libjpeg-dev libgl1-mesa-dev
sudo make
sudo make install
```

# paper icon theme https://snwh.org/paper/download
```
sudo add-apt-repository ppa:snwh/
sudo apt update
sudo apt install paper-icon-theme paper-cursor-theme paper-gtk-theme
```

# light (backlight utility)
```
git clone https://github.com/haikarainen/light
apt install help2man
sudo make
sudo make install
```