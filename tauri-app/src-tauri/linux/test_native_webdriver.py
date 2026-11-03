import json, time, urllib.request, urllib.error, subprocess, os, signal

base = 'http://127.0.0.1:4444'
def request(method, path, data=None):
    body = None if data is None else json.dumps(data).encode()
    req = urllib.request.Request(base + path, data=body, method=method, headers={'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=40) as response:
            value = json.load(response)['value']
    except urllib.error.HTTPError as error:
        raise RuntimeError(error.read().decode()) from error
    if isinstance(value, dict) and 'error' in value:
        raise RuntimeError(value)
    return value

wayland = os.environ.get('CLEANMETER_TEST_WAYLAND') == '1'

def portal_call(method, *args):
    subprocess.run(['gdbus', 'call', '--session', '--dest', 'org.freedesktop.portal.Desktop', '--object-path', '/org/freedesktop/portal/desktop', '--method', 'org.cleanmeter.Test.' + method, *args], check=True)

game = None
session = request('POST', '/session', {'capabilities': {'alwaysMatch': {'tauri:options': {'application': os.environ['CLEANMETER_TEST_BINARY']}}}})['sessionId']
prefix = '/session/' + session
def js(script, args=[]):
    return request('POST', prefix + '/execute/sync', {'script': script, 'args': args})
def invoke(command, args={}):
    js('window.__testResult=null; window.__TAURI_INTERNALS__.invoke(arguments[0],arguments[1]).then(value=>window.__testResult={value}, error=>window.__testResult={error:String(error)}); return true;', [command,args])
    for _ in range(100):
        value = js('return window.__testResult')
        if value is not None: break
        time.sleep(0.05)
    assert value is not None, command
    assert 'error' not in value, value
    return value.get('value')
try:
    time.sleep(4)
    print('handles', request('GET', prefix + '/window/handles'), flush=True)
    print('body', js('return document.body.innerText').replace('\n', ' ')[:2000], flush=True)
    platform = invoke('get_platform_info')
    print('capabilities', platform, flush=True)
    if wayland:
        assert platform['displayBackend'] == 'wayland' and platform['canPositionOverlay'] and platform['globalShortcuts'], platform
    callback = js('window.__sensors=[]; return window.__TAURI_INTERNALS__.transformCallback(e=>window.__sensors=e.payload.sensors)')
    invoke('plugin:event|listen', {'event': 'sensor-data', 'target': {'kind': 'Any'}, 'handler': callback})
    if os.environ.get('CLEANMETER_TEST_LIVE_FPS') == '1':
        game = subprocess.Popen([os.environ['CLEANMETER_TEST_BINARY'], '--run', 'vkcube'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)
        for _ in range(40):
            time.sleep(0.5)
            lows = js("return window.__sensors.filter(s=>s.identifier.includes('percentlow'))")
            if len(lows) == 2 and all(s['value'] > 0 for s in lows): break
        assert len(lows) == 2 and all(s['value'] > 0 for s in lows), lows
        print('PASS live Vulkan per-frame lows reaching native UI:', lows, flush=True)
    settings = invoke('get_settings')
    callback = js('window.__recording=[]; return window.__TAURI_INTERNALS__.transformCallback(e=>window.__recording.push(e.payload))')
    invoke('plugin:event|listen', {'event': 'recording-changed', 'target': {'kind': 'Any'}, 'handler': callback})
    for _ in range(3):
        if wayland: portal_call('Activate', 'recording')
        else: subprocess.run(['xdotool', 'key', '--clearmodifiers', 'alt+F11'], check=True)
        time.sleep(6 if game is not None and _ == 0 else 0.4)
        if game is not None and _ == 1:
            # Wait for the monitor to publish the frozen result after the hotkey.
            time.sleep(2)
            before = js("return window.__sensors.filter(s=>s.identifier.includes('percentlow')).map(s=>s.value)")
            assert len(before) == 2 and all(v > 0 for v in before), before
            os.killpg(game.pid, signal.SIGTERM)
            game.wait(timeout=10)
            game = None
            time.sleep(4)
            after = js("return window.__sensors.filter(s=>s.identifier.includes('percentlow')).map(s=>s.value)")
            assert after == before, (before, after)
            print('PASS frozen lows survive game exit and telemetry expiry', flush=True)
    assert js('return window.__recording') == ['recording','frozen','live'], js('return window.__recording')
    print('PASS global recording shortcut cycle', flush=True)
    if wayland:
        portal_call('Rebind')
        time.sleep(0.3)
        assert invoke('get_platform_info')['shortcutDescriptions']['recording'] == 'CTRL+F9'
        portal_call('EndSession')
        time.sleep(0.3)
        assert not invoke('get_platform_info')['shortcutDescriptions']
        # A settings change creates a new session after desktop revocation.
        invoke('save_settings', {'settings': dict(settings, recordingShortcut='Control+F10')})
        time.sleep(0.5)
        invoke('save_settings', {'settings': settings})
        time.sleep(0.5)
        assert invoke('get_platform_info')['shortcutDescriptions']
        print('PASS portal desktop rebind, revocation and new session', flush=True)
    changed = dict(settings, pixelShift=True, opacity=0.8, pollingRate=500)
    invoke('save_settings', {'settings': changed})
    saved = invoke('get_settings')
    assert saved['pixelShift'] and saved['opacity'] == 0.8 and saved['pollingRate'] == 500, saved
    invoke('save_settings', {'settings': settings})
    prefs = invoke('get_preferences')
    invoke('save_preferences', {'prefs': dict(prefs, soundEffects=False)})
    assert invoke('get_preferences')['soundEffects'] is False
    invoke('save_preferences', {'prefs': prefs})
    original_start = invoke('get_auto_start')
    invoke('set_auto_start', {'enabled': True})
    assert invoke('get_auto_start') is True
    invoke('set_auto_start', {'enabled': False})
    assert invoke('get_auto_start') is False
    invoke('set_auto_start', {'enabled': original_start})
    monitors = invoke('get_monitors')
    assert monitors and monitors[0]['width'] > 0, monitors
    invoke('set_overlay_visible', {'visible': False})
    invoke('set_overlay_visible', {'visible': True})
    print('PASS native settings/preferences/autostart/monitor/overlay commands', flush=True)
    for name in ['Style', 'Settings', 'Help', 'Stats']:
        element = request('POST', prefix + '/element', {'using': 'xpath', 'value': "//*[@role='tab' and normalize-space(.)='" + name + "']"})
        element_id = element['element-6066-11e4-a52e-4f735466cecf']
        request('POST', prefix + '/element/' + element_id + '/click', {})
        time.sleep(0.3)
        assert js('return document.documentElement.scrollWidth <= window.innerWidth')
    print('PASS native tab navigation without horizontal overflow', flush=True)
    if wayland:
        assert len(monitors) == 2, monitors
        invoke('save_settings', {'settings': dict(settings, selectedDisplayIndex=1)})
        invoke('set_overlay_position', {'x': monitors[1]['x'] + 100, 'y': monitors[1]['y'] + 80})
        subprocess.run(['swaymsg', 'output', 'HEADLESS-2', 'scale', '1'], check=True)
        for _ in range(30):
            time.sleep(0.2)
            resized = invoke('get_monitors')
            if resized[1]['width'] != monitors[1]['width']: break
        assert resized[1]['width'] != monitors[1]['width'], resized
        subprocess.run(['swaymsg', 'output', 'HEADLESS-2', 'scale', '1.5'], check=True)
        time.sleep(0.5)
        invoke('save_settings', {'settings': settings})
        print('PASS mixed-scale monitor selection and runtime scale change', flush=True)
finally:
    if game is not None:
        if game.poll() is None: os.killpg(game.pid, signal.SIGTERM)
        game.wait(timeout=10)
    request('DELETE', prefix)
