#  ──────────────────────────────────────────────────────────────────
#  zshrc — managed via ~/dotfiles (symlinked)
#  ──────────────────────────────────────────────────────────────────

# PATH — local bins (starship installs here, plus user scripts)
export PATH="$HOME/.local/bin:$PATH"

# History
HISTFILE=~/.zsh_history
HISTSIZE=50000
SAVEHIST=50000
setopt HIST_IGNORE_ALL_DUPS    # drop older dup when a new one comes in
setopt HIST_IGNORE_SPACE       # leading space = don't record
setopt HIST_REDUCE_BLANKS
setopt SHARE_HISTORY           # live-share history across panes
setopt EXTENDED_HISTORY        # timestamp entries
setopt INC_APPEND_HISTORY

# Shell behavior
setopt AUTO_CD                 # `cd` optional when path is given
setopt AUTO_PUSHD              # cd pushes onto dir stack
setopt PUSHD_IGNORE_DUPS
setopt CORRECT                 # gentle command typo correction
setopt INTERACTIVE_COMMENTS    # allow # comments at prompt
setopt NO_BEEP

# Completion
autoload -Uz compinit && compinit
zstyle ':completion:*' menu select
zstyle ':completion:*' matcher-list 'm:{a-zA-Z}={A-Za-z}' 'r:|=*' 'l:|=* r:|=*'
zstyle ':completion:*' list-colors "${(s.:.)LS_COLORS}"

# Key bindings — emacs (default) with a couple of niceties
bindkey -e
bindkey '^[[1;5C' forward-word    # Ctrl-Right
bindkey '^[[1;5D' backward-word   # Ctrl-Left

# ─── Tools ──────────────────────────────────────────────────────────

# starship prompt
command -v starship >/dev/null && eval "$(starship init zsh)"

# zoxide — smart cd. `z foo` jumps, `zi foo` interactive
command -v zoxide >/dev/null && eval "$(zoxide init zsh)"

# fzf — Ctrl-R history, Ctrl-T file picker, Alt-C cd picker
[ -f /usr/share/doc/fzf/examples/key-bindings.zsh ] && source /usr/share/doc/fzf/examples/key-bindings.zsh
[ -f /usr/share/doc/fzf/examples/completion.zsh ]   && source /usr/share/doc/fzf/examples/completion.zsh

# Catppuccin Mocha theme for fzf
export FZF_DEFAULT_OPTS=" \
--color=bg+:#313244,bg:#1e1e2e,spinner:#f5e0dc,hl:#f38ba8 \
--color=fg:#cdd6f4,header:#f38ba8,info:#cba6f7,pointer:#f5e0dc \
--color=marker:#b4befe,fg+:#cdd6f4,prompt:#cba6f7,hl+:#f38ba8 \
--color=selected-bg:#45475a \
--multi"

# Use fd for fzf if available — respects .gitignore, faster
if command -v fdfind >/dev/null; then
  export FZF_DEFAULT_COMMAND='fdfind --type f --hidden --follow --exclude .git'
  export FZF_CTRL_T_COMMAND="$FZF_DEFAULT_COMMAND"
  export FZF_ALT_C_COMMAND='fdfind --type d --hidden --follow --exclude .git'
fi

# bat — syntax-highlighted cat
export BAT_THEME="Catppuccin Mocha"

# lesspipe — make less friendly with archives, PDFs, etc.
[ -x /usr/bin/lesspipe ] && eval "$(SHELL=/bin/sh lesspipe)"

# ─── WSL / GUI ──────────────────────────────────────────────────────

# WSLg uses /tmp/.X11-unix/X0; older WSL2 + external X server falls back
# to the nameserver IP. Set DISPLAY accordingly so GUI apps just work.
if [ -S /tmp/.X11-unix/X0 ]; then
  export DISPLAY=:0
else
  export DISPLAY="$(awk '/nameserver / {print $2; exit}' /etc/resolv.conf 2>/dev/null):0"
  export LIBGL_ALWAYS_INDIRECT=1
fi

# ─── Language toolchains ────────────────────────────────────────────

# fnm — Node version manager
FNM_PATH="$HOME/.local/share/fnm"
if [ -d "$FNM_PATH" ]; then
  export PATH="$FNM_PATH:$PATH"
  eval "$(fnm env --shell zsh)"
fi

# bun — JS runtime
export BUN_INSTALL="$HOME/.bun"
[ -d "$BUN_INSTALL/bin" ] && export PATH="$BUN_INSTALL/bin:$PATH"

# Personal scripts directory
[ -d "$HOME/scripts" ] && export PATH="$HOME/scripts:$PATH"

# ─── Secrets ────────────────────────────────────────────────────────
# Project-scoped (crew) and home-level secret env files. Not tracked.
[ -f ~/.config/crew/.secrets.env ] && source ~/.config/crew/.secrets.env
[ -f ~/.secrets.env ] && source ~/.secrets.env

# ─── Aliases ────────────────────────────────────────────────────────

# Ubuntu installs these under non-canonical names; alias to expected
command -v batcat >/dev/null && alias bat='batcat'
command -v fdfind >/dev/null && alias fd='fdfind'

# eza — modern ls. icons need a Nerd Font in the terminal
if command -v eza >/dev/null; then
  alias ls='eza --group-directories-first --icons=auto'
  alias ll='eza -lh  --group-directories-first --icons=auto --git'
  alias la='eza -lah --group-directories-first --icons=auto --git'
  alias lt='eza --tree --level=2 --icons=auto'
fi

# Misc quality-of-life
alias g='git'
alias gs='git status'
alias gd='git diff'
alias gl='git log --oneline --graph --decorate -20'
alias ..='cd ..'
alias ...='cd ../..'
alias mkdir='mkdir -pv'

# Reload config
alias zshreload='source ~/.zshrc'

# ─── Local overrides ────────────────────────────────────────────────
# Anything machine-specific (work tokens, employer-specific env) lives
# in ~/.zshrc.local and is NOT tracked in the dotfiles repo.
[ -f ~/.zshrc.local ] && source ~/.zshrc.local
