// Short isolated cues can reach the Windows mixer yet disappear on an idle
// HDMI output. Keep its audio session ready while the settings UI is in use.
// This low-level 20Hz signal was listening-tested on the affected output; it
// is not an ambient sound asset. Never run it while muted or in the background.
export function createAudioSession(createContext: () => AudioContext) {
  let active: { context: AudioContext; source: OscillatorNode; gain: GainNode } | undefined;

  function stop() {
    const previous = active;
    active = undefined;
    if (!previous) return;
    previous.source.stop();
    previous.source.disconnect();
    previous.gain.disconnect();
    void previous.context.close().catch(() => {});
  }

  return {
    setActive(wanted: boolean) {
      if (!wanted) { stop(); return; }
      if (active) {
        if (active.context.state === "suspended") void active.context.resume().catch(() => {});
        return;
      }
      let context: AudioContext | undefined;
      try {
        context = createContext();
        const source = context.createOscillator();
        const gain = context.createGain();
        source.frequency.value = 20;
        gain.gain.setValueAtTime(0, context.currentTime);
        gain.gain.linearRampToValueAtTime(0.0005, context.currentTime + 0.05);
        source.connect(gain).connect(context.destination);
        source.start();
        active = { context, source, gain };
        void context.resume().catch(() => {});
      } catch {
        // Output readiness must not prevent a setting change or cue playback.
        if (context) void context.close().catch(() => {});
      }
    },
    stop,
  };
}

export function installAudioReadiness(isEnabled: () => boolean) {
  // The workaround is scoped to the Windows desktop settings window.
  if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window) ||
      !navigator.userAgent.includes("Windows") || window.location.pathname.includes("overlay")) {
    return { sync() {}, dispose() {} };
  }
  const session = createAudioSession(() => new AudioContext({ latencyHint: "interactive" }));
  const sync = () => session.setActive(isEnabled() && document.visibilityState === "visible" && document.hasFocus());
  const stop = () => session.stop();
  window.addEventListener("focus", sync);
  window.addEventListener("blur", stop);
  window.addEventListener("pagehide", stop);
  // Retry a context blocked by autoplay policy within the next user gesture.
  window.addEventListener("pointerdown", sync, true);
  window.addEventListener("keydown", sync, true);
  document.addEventListener("visibilitychange", sync);
  sync();
  return {
    sync,
    dispose() {
      window.removeEventListener("focus", sync);
      window.removeEventListener("blur", stop);
      window.removeEventListener("pagehide", stop);
      window.removeEventListener("pointerdown", sync, true);
      window.removeEventListener("keydown", sync, true);
      document.removeEventListener("visibilitychange", sync);
      stop();
    },
  };
}
