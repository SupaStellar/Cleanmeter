#!/bin/sh
# Run against a built binary as a normal user, with an isolated profile.
set -eu
: "${CLEANMETER_TEST_BINARY:?Set the absolute path to the built Cleanmeter executable}"
case "$CLEANMETER_TEST_BINARY" in /*) ;; *) echo 'Binary path must be absolute' >&2; exit 2;; esac
script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
if [ "${1:-}" != '--session' ]; then
    profile=$(mktemp -d)
    trap 'rm -rf -- "$profile"' EXIT
    export XDG_CONFIG_HOME="$profile/config" XDG_DATA_HOME="$profile/data"
    export XDG_CACHE_HOME="$profile/cache" XDG_RUNTIME_DIR="$profile/runtime"
    mkdir -p "$XDG_RUNTIME_DIR"
    chmod 700 "$XDG_RUNTIME_DIR"
    xvfb-run -a -s '-screen 0 1280x800x24' dbus-run-session -- sh "$0" --session
    exit
fi
openbox > "$XDG_RUNTIME_DIR/openbox.log" 2>&1 &
wm=$!
xcompmgr > "$XDG_RUNTIME_DIR/compositor.log" 2>&1 &
compositor=$!
GDK_BACKEND=x11 WEBKIT_DISABLE_COMPOSITING_MODE=1 tauri-driver > "$XDG_RUNTIME_DIR/driver.log" 2>&1 &
driver=$!
trap 'kill "$driver" "$wm" "$compositor" 2>/dev/null || true' EXIT
sleep 2
python3 "$script_dir/test_native_webdriver.py" || {
    cat "$XDG_RUNTIME_DIR/driver.log"
    exit 1
}
