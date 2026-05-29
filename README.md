# dotfiles

Selective, symlink-based dotfiles. Files live in this repo; `install.sh`
symlinks them out to `~`. Nothing is added to git unless you explicitly
`git add <file>` — never `git add -A`.

## Layout

```
dotfiles/
├── zsh/.zshrc                       → ~/.zshrc            (cross-platform: macOS + WSL/Linux)
├── starship/starship.toml           → ~/.config/starship.toml
├── ghostty/config                   → ~/.config/ghostty/config
├── windows-terminal/                  manual-merge reference
│   └── settings-snippets.jsonc
├── windows/
│   └── install.ps1                    Windows-side: fonts + WT settings
├── fonts/                             staging only (gitignored)
└── install.sh                         creates the symlinks
```

The terminal emulator is [Ghostty](https://ghostty.org) (macOS + Linux),
themed Catppuccin Mocha with FiraCode Nerd Font Mono. On Windows proper,
the Windows Terminal snippets below cover the same theme/font.

## Install on a new machine

### Linux / WSL (Ubuntu/Debian)

```bash
# 1. system packages
sudo apt update && sudo apt install -y zsh eza bat fzf zoxide fd-find unzip

# 2. starship (no sudo, installs to ~/.local/bin)
curl -sS https://starship.rs/install.sh | sh -s -- --yes -b ~/.local/bin

# 3. clone + symlink
git clone <repo-url> ~/dotfiles
~/dotfiles/install.sh

# 4. set zsh as default shell (needs password)
chsh -s "$(which zsh)"
```

### macOS (Homebrew)

```bash
# 1. CLI tools + terminal + font
brew install starship eza bat fd fzf zoxide
brew install --cask ghostty font-fira-code-nerd-font

# 2. clone + symlink (zsh is already the default shell on macOS)
git clone <repo-url> ~/dotfiles
~/dotfiles/install.sh
```

Then open a new shell — `~/.zshrc` is symlinked, starship is on PATH,
prompt is themed. The `.zshrc` auto-detects the OS, so the same file
drives both macOS and WSL/Linux; machine-specific bits go in
`~/.zshrc.local` (see below).

## Windows side — fonts + terminal

The terminal lives on Windows, so the fonts and Windows Terminal settings
have to be set up there. Two paths:

### Automated (recommended)

Open a regular (non-admin) Windows PowerShell window and run:

```powershell
& '\\wsl$\Ubuntu-24.04\home\safturento\dotfiles\windows\install.ps1'
```

The script:
1. Installs every `.ttf` from `fonts/<family>/` into your per-user fonts
   dir (no admin needed), and registers them in `HKCU` so apps see them.
2. Backs up Windows Terminal's `settings.json` to `settings.json.bak.<timestamp>`,
   then merges in the Catppuccin Mocha color scheme and FiraCode Nerd
   Font defaults. Idempotent — safe to re-run.

Optional flags:

- `-SkipFonts` / `-SkipTerminal` — run only one half.
- `-ApplyZoneInfoTweak` — also sets `HKCU\…\Attachments\SaveZoneInformation = 1`
  so future downloads aren't Mark-of-the-Web tagged (see the note below).

If you've never opened Windows Terminal, do that once first (it creates
the settings.json the script patches).

### Manual

If you'd rather do it by hand:

- Browse to `\\wsl$\Ubuntu-24.04\home\safturento\dotfiles\fonts\FiraCode\` in
  Explorer, select all `.ttf` files, right-click → **Install for all users**.
- Open Windows Terminal → Settings → "Open JSON file" → merge the three
  blocks from `windows-terminal/settings-snippets.jsonc` (color scheme
  into `schemes[]`, font + theme into `profiles.defaults`).

## Mark-of-the-Web cleanup

`install.sh` extracts font zips on the Linux side (ext4 has no NTFS
alternate data streams), so the resulting `.ttf` files are MotW-free
from the start. The script also runs a defensive `:Zone.Identifier`
sweep over `fonts/` in case files crept in from a Windows copy.

To stop future downloads from being tagged in the first place, run the
Windows installer with `-ApplyZoneInfoTweak`. **Tradeoff**: the
SmartScreen "this file came from the internet" warning goes away
system-wide for your user — fine for a developer machine, not
recommended elsewhere.

## Local overrides

Anything machine-specific (work tokens, employer-specific env) goes in
`~/.zshrc.local` — sourced by `.zshrc` if present, gitignored by
convention.

## Convention

This repo is **add-only-when-needed**. New configs are staged into the
appropriate subdir, but `git add` is always explicit and per-file. Keeps
the history clean and prevents leaking machine state.
