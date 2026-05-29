#!/usr/bin/env bash
# Symlinks files from this repo into $HOME. Idempotent — safe to re-run.
# Backs up any existing non-symlink at the target to <path>.bak.

set -euo pipefail

DOTFILES="$(cd "$(dirname "$0")" && pwd)"

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

echo "Linking dotfiles from $DOTFILES"
link "$DOTFILES/zsh/.zshrc"              "$HOME/.zshrc"
link "$DOTFILES/starship/starship.toml"  "$HOME/.config/starship.toml"
link "$DOTFILES/ghostty/config"          "$HOME/.config/ghostty/config"

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
