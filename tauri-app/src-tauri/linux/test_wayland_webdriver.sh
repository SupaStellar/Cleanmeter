#!/bin/sh
set -eu
: "${CLEANMETER_TEST_BINARY:?Set the absolute path to the built executable}"
script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
if [ "${1:-}" != '--session' ]; then
    exec dbus-run-session -- sh "$0" --session
fi
export XDG_RUNTIME_DIR=$(mktemp -d /tmp/cleanmeter-wayland.XXXXXX)
mkdir -p "$XDG_RUNTIME_DIR"
chmod 700 "$XDG_RUNTIME_DIR"
export XDG_CONFIG_HOME="$XDG_RUNTIME_DIR/config" XDG_DATA_HOME="$XDG_RUNTIME_DIR/data" XDG_CACHE_HOME="$XDG_RUNTIME_DIR/cache"
cat > "$XDG_RUNTIME_DIR/sway.conf" <<CONF
output HEADLESS-1 mode 1280x800 position 0 0
output HEADLESS-2 mode 1920x1080 position 1280 0 scale 1.5
seat seat0 fallback true
CONF
WLR_BACKENDS=headless WLR_RENDERER=pixman WLR_HEADLESS_OUTPUTS=2 sway -c "$XDG_RUNTIME_DIR/sway.conf" > "$XDG_RUNTIME_DIR/sway.log" 2>&1 &
compositor=$!
python3 "$script_dir/test_shortcuts_portal.py" > "$XDG_RUNTIME_DIR/portal.log" 2>&1 &
portal=$!
trap 'kill "$compositor" "$portal" ${driver:-} 2>/dev/null || true; echo "Wayland test logs: $XDG_RUNTIME_DIR"' EXIT
sleep 2
export WAYLAND_DISPLAY=$(basename "$(find "$XDG_RUNTIME_DIR" -maxdepth 1 -type s -name 'wayland-*' | head -1)")
export SWAYSOCK=$(find "$XDG_RUNTIME_DIR" -maxdepth 1 -type s -name 'sway-ipc*' | head -1)
unset DISPLAY
export GDK_BACKEND="${CLEANMETER_TEST_GDK_BACKEND:-wayland}" WEBKIT_DISABLE_COMPOSITING_MODE=1 CLEANMETER_TEST_WAYLAND=1
swaymsg -t get_outputs > "$XDG_RUNTIME_DIR/outputs.json"
tauri-driver > "$XDG_RUNTIME_DIR/driver.log" 2>&1 &
driver=$!
sleep 2
python3 "$script_dir/test_native_webdriver.py"
