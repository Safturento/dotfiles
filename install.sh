#!/usr/bin/env bash
# Symlinks files from this repo into $HOME. Idempotent — safe to re-run.
# Backs up any existing non-symlink at the target to <path>.bak.

set -euo pipefail

DOTFILES="$(cd "$(dirname "$0")" && pwd)"

# Stable absolute node path. fnm's per-shell multishell symlink dies when its
# originating shell exits; aliases/default persists. Falls back to PATH.
NODE_BIN="$( [ -x "$HOME/.local/share/fnm/aliases/default/bin/node" ] \
  && echo "$HOME/.local/share/fnm/aliases/default/bin/node" || command -v node )"

link() {
  local src="$1" dst="$2"
  mkdir -p "$(dirname "$dst")"
  if [ -L "$dst" ]; then
    # Already a symlink — repoint silently if wrong target
    [ "$(readlink "$dst")" = "$src" ] || ln -sfn "$src" "$dst"
    echo "  ok   $dst"
  elif [ -e "$dst" ]; then
    mv "$dst" "$dst.bak"
    ln -s "$src" "$dst"
    echo "  bak  $dst  (existing moved to $dst.bak)"
  else
    ln -s "$src" "$dst"
    echo "  new  $dst"
  fi
}

# Idempotently register a SessionStart hook command in ~/.claude/settings.json.
# settings.json stays machine-local (not tracked); this keeps the registration
# reproducible without publishing it. Mirrors the delta include.path block below.
ensure_session_start_hook() {
  local cmd="$1"
  local settings="$HOME/.claude/settings.json"
  [ -f "$settings" ] || { echo "  skip SessionStart hook (no settings.json)"; return; }
  "$NODE_BIN" -e '
    const fs=require("fs"), p=process.argv[2], cmd=process.argv[3];
    const s=JSON.parse(fs.readFileSync(p,"utf8"));
    s.hooks=s.hooks||{}; s.hooks.SessionStart=s.hooks.SessionStart||[];
    const has=s.hooks.SessionStart.some(g=>(g.hooks||[]).some(h=>h.command===cmd));
    if(!has){s.hooks.SessionStart.push({hooks:[{type:"command",command:cmd}]});
      fs.writeFileSync(p,JSON.stringify(s,null,2)+"\n");console.log("  new  SessionStart hook");}
    else{console.log("  ok   SessionStart hook");}
  ' "$settings" "$cmd"
}

echo "Linking dotfiles from $DOTFILES"
link "$DOTFILES/zsh/.zshrc"                            "$HOME/.zshrc"
link "$DOTFILES/starship/starship.toml"                "$HOME/.config/starship.toml"
link "$DOTFILES/ghostty/config"                        "$HOME/.config/ghostty/config"
link "$DOTFILES/atuin/config.toml"                     "$HOME/.config/atuin/config.toml"
link "$DOTFILES/atuin/themes/catppuccin-mocha.toml"    "$HOME/.config/atuin/themes/catppuccin-mocha.toml"
link "$DOTFILES/tealdeer/config.toml"                  "$HOME/.config/tealdeer/config.toml"
link "$DOTFILES/claude/themes/catppuccin-mocha.json"   "$HOME/.claude/themes/catppuccin-mocha.json"
link "$DOTFILES/claude/skills/establishing-a-new-project" "$HOME/.claude/skills/establishing-a-new-project"
link "$DOTFILES/claude/skills/readme-freshness-check"     "$HOME/.claude/skills/readme-freshness-check"
link "$DOTFILES/claude/conventions/project-scaffolding.md" "$HOME/.claude/conventions/project-scaffolding.md"
link "$DOTFILES/claude/hooks/doc-parity-gate.sh"          "$HOME/.claude/hooks/doc-parity-gate.sh"
link "$DOTFILES/claude/CLAUDE.md"                         "$HOME/.claude/CLAUDE.md"
link "$DOTFILES/claude/conventions/code-quality.md"          "$HOME/.claude/conventions/code-quality.md"
link "$DOTFILES/claude/conventions/crew-dispatch.md"         "$HOME/.claude/conventions/crew-dispatch.md"
link "$DOTFILES/claude/conventions/designer-collaboration.md" "$HOME/.claude/conventions/designer-collaboration.md"
link "$DOTFILES/claude/conventions/documentation.md"        "$HOME/.claude/conventions/documentation.md"
link "$DOTFILES/claude/conventions/figma.md"                "$HOME/.claude/conventions/figma.md"
link "$DOTFILES/claude/conventions/line-endings.md"         "$HOME/.claude/conventions/line-endings.md"
link "$DOTFILES/claude/conventions/node.md"                 "$HOME/.claude/conventions/node.md"
link "$DOTFILES/claude/conventions/self-improvement.md"     "$HOME/.claude/conventions/self-improvement.md"
link "$DOTFILES/claude/skills/agents-doc-parity-check"         "$HOME/.claude/skills/agents-doc-parity-check"
link "$DOTFILES/claude/skills/bruno-collection-maintenance"    "$HOME/.claude/skills/bruno-collection-maintenance"
link "$DOTFILES/claude/skills/figma-design-system-propagation" "$HOME/.claude/skills/figma-design-system-propagation"
link "$DOTFILES/claude/skills/figma-screen-migration"         "$HOME/.claude/skills/figma-screen-migration"
link "$DOTFILES/claude/skills/mumen"                          "$HOME/.claude/skills/mumen"
link "$DOTFILES/claude/skills/reaching-for-backend-patterns"  "$HOME/.claude/skills/reaching-for-backend-patterns"
link "$DOTFILES/claude/skills/reaching-for-frontend-libraries" "$HOME/.claude/skills/reaching-for-frontend-libraries"
link "$DOTFILES/claude/skills/visual-fidelity-check"          "$HOME/.claude/skills/visual-fidelity-check"
link "$DOTFILES/claude/hooks/reminder-checkin.mjs"        "$HOME/.claude/hooks/reminder-checkin.mjs"
link "$DOTFILES/claude/reminders"                         "$HOME/.claude/reminders"

# Register the reminder check-in as a SessionStart hook (settings.json stays local)
ensure_session_start_hook "$NODE_BIN $HOME/.claude/hooks/reminder-checkin.mjs"

# ── Git: include delta config ──────────────────────────────────────
# Delta lives in its own gitconfig fragment to avoid clobbering the
# user's ~/.gitconfig identity/aliases. Add an include.path entry once.
DELTA_INCLUDE="$DOTFILES/git/delta.gitconfig"
if ! git config --global --get-all include.path 2>/dev/null | grep -qF "$DELTA_INCLUDE"; then
  git config --global --add include.path "$DELTA_INCLUDE"
  echo "  new  ~/.gitconfig  (added include for delta config)"
else
  echo "  ok   ~/.gitconfig  (delta include already present)"
fi

# ── Zsh plugins ────────────────────────────────────────────────────
# Clone (or fast-forward) plugins into ~/.local/share/zsh/plugins so
# .zshrc can source them. Kept outside the dotfiles repo so we don't
# vendor third-party code.
echo
echo "Zsh plugins"
ZSH_PLUGIN_DIR="$HOME/.local/share/zsh/plugins"
mkdir -p "$ZSH_PLUGIN_DIR"
clone_or_pull() {
  local repo="$1"
  local name="$2"
  local dst="$ZSH_PLUGIN_DIR/$name"
  # -c core.autocrlf=false: zsh chokes on CRLF (^M parse errors). Forced
  # regardless of the user's global git config so plugins always stay LF.
  if [ -d "$dst/.git" ]; then
    git -C "$dst" -c core.autocrlf=false pull --quiet --ff-only \
      && echo "  ok   $name"
  else
    git -c core.autocrlf=false clone --quiet --depth 1 "$repo" "$dst" \
      && echo "  new  $name"
  fi
}
clone_or_pull https://github.com/zsh-users/zsh-autosuggestions zsh-autosuggestions
clone_or_pull https://github.com/zsh-users/zsh-completions     zsh-completions
clone_or_pull https://github.com/Aloxaf/fzf-tab                fzf-tab

# ── tealdeer: install latest upstream binary ───────────────────────
# Ubuntu's apt-shipped tealdeer (v1.6.x) hardcodes a stale archive URL
# that now 404s — `tldr --update` fails with "invalid Zip archive".
# Drop the latest release binary into ~/.local/bin so it shadows /usr/bin.
echo
echo "Tealdeer (tldr)"
TLDR_BIN="$HOME/.local/bin/tldr"
mkdir -p "$HOME/.local/bin"
arch="$(uname -m)"
case "$arch" in
  x86_64)  asset="tealdeer-linux-x86_64-musl" ;;
  aarch64) asset="tealdeer-linux-aarch64-musl" ;;
  *) echo "  skip  unsupported arch: $arch"; asset="" ;;
esac
if [ -n "$asset" ]; then
  if [ -f "$TLDR_BIN" ] && "$TLDR_BIN" --version 2>/dev/null | grep -qE 'tealdeer (1\.[7-9]|[2-9])'; then
    echo "  ok   $($TLDR_BIN --version)"
  else
    curl -fsSL -o "$TLDR_BIN" \
      "https://github.com/tealdeer-rs/tealdeer/releases/latest/download/$asset"
    chmod +x "$TLDR_BIN"
    echo "  new  $($TLDR_BIN --version)"
  fi
  # Prime the cache so `tldr <cmd>` works immediately
  "$TLDR_BIN" --update >/dev/null 2>&1 && echo "  ok   cache primed"
fi

# ── bat: Catppuccin Mocha theme ────────────────────────────────────
# bat doesn't ship community themes. Download the tmTheme from upstream,
# then rebuild bat's theme cache so BAT_THEME="Catppuccin Mocha" resolves.
# delta inherits this for syntax highlighting in git diff.
echo
echo "Bat theme"
BAT_THEME_DIR="$HOME/.config/bat/themes"
BAT_THEME_FILE="$BAT_THEME_DIR/Catppuccin Mocha.tmTheme"
mkdir -p "$BAT_THEME_DIR"
if [ -f "$BAT_THEME_FILE" ]; then
  echo "  ok   Catppuccin Mocha.tmTheme"
else
  curl -fsSL -o "$BAT_THEME_FILE" \
    "https://github.com/catppuccin/bat/raw/main/themes/Catppuccin%20Mocha.tmTheme"
  echo "  new  Catppuccin Mocha.tmTheme"
fi
# Ubuntu ships bat as `batcat`. Fall back to `bat` on distros that use it.
if command -v batcat >/dev/null; then
  batcat cache --build >/dev/null && echo "  ok   bat cache rebuilt"
elif command -v bat >/dev/null; then
  bat cache --build >/dev/null && echo "  ok   bat cache rebuilt"
fi

# ── Fonts ──────────────────────────────────────────────────────────
# Extract any font zips found in fonts/ to a sibling dir of the same
# name. Done on ext4 (Linux side) so the .ttf files never inherit
# Windows Mark-of-the-Web (Zone.Identifier) streams. Install on
# Windows by browsing to \\wsl$\Ubuntu\<this-path>\fonts\<NAME>\.
# Only relevant to the WSL/Windows workflow, where font zips are staged
# into fonts/ for extraction. On macOS fonts come from Homebrew, so this
# directory won't exist — skip the whole block.
if [ -d "$DOTFILES/fonts" ]; then
  echo
  echo "Fonts"
  shopt -s nullglob
  for zip in "$DOTFILES"/fonts/*.zip; do
    name="$(basename "$zip" .zip)"
    dir="$DOTFILES/fonts/$name"
    if [ -d "$dir" ] && [ -n "$(ls -A "$dir" 2>/dev/null)" ]; then
      echo "  ok   $dir"
    else
      mkdir -p "$dir"
      unzip -oq "$zip" -d "$dir"
      echo "  new  $dir  (extracted from $(basename "$zip"))"
    fi
  done

  # Defensive: scrub any :Zone.Identifier ADS streams that crept in via
  # Windows-side copy. No-op on a fresh Linux extract.
  zi_count=$(find "$DOTFILES/fonts" -type f -name '*:Zone.Identifier' -print -delete 2>/dev/null | wc -l)
  [ "$zi_count" -gt 0 ] && echo "  swept $zi_count Zone.Identifier file(s)"

  distro="${WSL_DISTRO_NAME:-Ubuntu}"
  win_path="\\\\wsl\$\\${distro}${DOTFILES//\//\\}\\fonts"
  echo "Install fonts on Windows from: $win_path"
fi

echo
echo "Done. Open a new shell to pick up the changes."
