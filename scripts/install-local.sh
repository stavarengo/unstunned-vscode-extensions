#!/usr/bin/env bash
#
# Install the packaged extension VSIX into the locally reachable VS Code.
#
# Works in two environments:
#   * Host shell — uses `code` on PATH (the normal VS Code CLI install).
#   * VS Code devcontainer — uses the server's remote-cli, which routes the
#     install back to the host VS Code via the Remote-Containers bridge.
#     Some devcontainers ship a ~/.local/bin/code wrapper that looks for
#     <server>/bin/code, but the real binary lives at
#     <server>/bin/remote-cli/code; we locate it directly.

set -euo pipefail

VSIX="${1:-extension.vsix}"

if [[ ! -f "$VSIX" ]]; then
  printf 'error: VSIX not found at %s\n' "$VSIX" >&2
  exit 1
fi

find_code_cli() {
  # 1) Devcontainer: derive the server root from VS Code's own env vars.
  local node_path="${VSCODE_GIT_EDITOR_NODE:-${VSCODE_GIT_ASKPASS_NODE:-}}"
  if [[ -n "$node_path" ]]; then
    local server_root="${node_path%/node}"
    if [[ -x "$server_root/bin/remote-cli/code" ]]; then
      printf '%s\n' "$server_root/bin/remote-cli/code"
      return 0
    fi
  fi

  # 2) Devcontainer fallback: scan known server install paths.
  shopt -s nullglob
  local candidates=(
    /vscode/vscode-server/bin/*/bin/remote-cli/code
    "$HOME"/.vscode-server/bin/*/bin/remote-cli/code
  )
  shopt -u nullglob
  local candidate
  for candidate in "${candidates[@]}"; do
    if [[ -x "$candidate" ]]; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done

  # 3) Host: a working `code` on PATH.
  if command -v code >/dev/null 2>&1 && code --version >/dev/null 2>&1; then
    command -v code
    return 0
  fi

  return 1
}

if ! CODE_BIN="$(find_code_cli)"; then
  cat >&2 <<'MSG'
error: could not locate a working VS Code CLI.
  Tried (in order):
    1) VS Code Server's remote-cli derived from $VSCODE_GIT_EDITOR_NODE
    2) /vscode/vscode-server/bin/*/bin/remote-cli/code
       $HOME/.vscode-server/bin/*/bin/remote-cli/code
    3) `code` on PATH

  On the host: install the `code` CLI via VS Code's
    Command Palette > "Shell Command: Install 'code' command in PATH".
  In a devcontainer: open this folder in VS Code at least once so the
  server provisions its remote-cli, then retry.
MSG
  exit 1
fi

printf 'Installing %s via %s\n' "$VSIX" "$CODE_BIN"
exec "$CODE_BIN" --install-extension "$VSIX" --force
