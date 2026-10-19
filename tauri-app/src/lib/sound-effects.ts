import { play, setEnabled, setVolume, unlock, type SoundName, type PlayOptions } from "cuelume";
import { play as playLegacy, setEnabled as enableLegacy, setVolume as volumeLegacy } from "cuelume-legacy";
import { useSettingsStore } from "@/stores/settings-store";
import { installAudioReadiness } from "./audio-session";

// Explicit calls from UI actions only: never bind all clicks or store updates.
// Coalesce synchronous multi-sensor changes from one section switch, but let
// each subsequent input event play, even when it arrives less than 90ms later.
let playedThisTurn = false;
let muteGeneration = 0;
const enabled = () => {
  const state = useSettingsStore.getState();
  return state.preferencesLoaded && state.preferences.soundEffects;
};

setVolume(0.35);
volumeLegacy(0.35);
setEnabled(enabled());
enableLegacy(enabled());
const readiness = installAudioReadiness(enabled);
const unsubscribe = useSettingsStore.subscribe((state, previous) => {
  if (state.preferences.soundEffects !== previous.preferences.soundEffects ||
      state.preferencesLoaded !== previous.preferencesLoaded) {
    setEnabled(enabled()); // Also silences voices already ringing.
    enableLegacy(enabled());
    readiness.sync();
    if (!enabled()) muteGeneration++;
    playedThisTurn = false;
  }
});
if (import.meta.hot) import.meta.hot.dispose(() => { unsubscribe(); readiness.dispose(); });

export function prepareSound() {
  if (enabled()) void unlock();
}

// Capture at the gesture: muting during an async request cancels its cue,
// including when sound is enabled again before that request completes.
export function beginSoundAction() {
  const audible = enabled();
  const generation = muteGeneration;
  prepareSound();
  return (sound: SoundName | "press", direction: "forward" | "back" = "forward") => {
    if (audible && generation === muteGeneration) playSound(sound, direction);
  };
}

export function playSound(sound: SoundName | "press", direction: "forward" | "back" = "forward", options: Pick<PlayOptions, "volume" | "emphasis"> = {}) {
  if (!enabled()) return;
  if (playedThisTurn) return;
  try {
    if (sound === "toggle" || sound === "press") {
      // Original Legacy recipes; 0.2.2 uses the same cue in both directions.
      playLegacy(sound, { volume: options.volume });
    } else {
      play(sound, { ...options, direction });
    }
    playedThisTurn = true;
    queueMicrotask(() => { playedThisTurn = false; });
  } catch {
    // Audio failure must never interrupt changing a setting.
  }
}
