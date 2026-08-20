import type { DownloadEvent, Update } from "@tauri-apps/plugin-updater";
import type { HardwareMonitorData } from "./types";
import { HardwareType, SensorType } from "./types";

/**
 * What the browser preview (`npm run dev`) pretends the sidecar is sending.
 *
 * The preview has no Tauri runtime and therefore no HardwareMonitor, so every
 * sensor listener stays silent: the settings UI renders with no readings, no
 * sensor options in any picker, and a "Monitoring not connected" banner once
 * the startup grace expires. None of that is the UI we design against.
 *
 * This snapshot is a two-GPU laptop (an RTX 3050 alongside Intel integrated
 * graphics), because the GPU picker in the GPU section only appears when a
 * machine reports more than one GPU, and that is not a machine we can sit at.
 * Hardware order, sensor names, identifiers, sensor types and values are
 * transcribed from a running sidecar's dump on that machine (the same payload
 * the `stores/settings-store.gpu.test.ts` wire test asserts against), not
 * invented here. A preview that disagrees with the wire would teach us the
 * wrong layout.
 *
 * Deliberately static: the same numbers on every tick, so a screenshot taken
 * for a Figma comparison is reproducible.
 *
 * Exported as functions rather than constants so nothing here runs at module
 * load. A top-level call is a possible side effect as far as the bundler is
 * concerned, and it kept the whole fixture in the production bundle even with
 * its only caller dead-code-eliminated; a function body is droppable.
 */

function sensor(
  hardwareIdentifier: string,
  identifier: string,
  name: string,
  sensorType: SensorType,
  value: number,
) {
  return { name, identifier, hardwareIdentifier, sensorType, value };
}

export function previewSensorData(): HardwareMonitorData {
  return {
    lastPollTime: 0,
    hardwares: [
      {
        name: "NVIDIA GeForce RTX 3050 Laptop GPU",
        identifier: "/gpu-nvidia/0",
        hardwareType: HardwareType.GpuNvidia,
      },
      {
        name: "Intel R UHD Graphics",
        identifier: "/gpu-intel/0",
        hardwareType: HardwareType.GpuIntel,
      },
      { name: "Intel Core i5 11400H", identifier: "/intelcpu/0", hardwareType: HardwareType.Cpu },
      { name: "Total Memory", identifier: "/ram", hardwareType: HardwareType.Memory },
      { name: "Ethernet", identifier: "/nic/0", hardwareType: HardwareType.Network },
    ],
    sensors: [
      // Discrete GPU. Note the temperature is named "GPU Core" here and on the
      // Intel GPU below, and nothing but the hardware identifier separates them,
      // which is the whole reason the readings are pinned to one GPU.
      sensor("/gpu-nvidia/0", "/gpu-nvidia/0/load/0", "GPU Core", SensorType.Load, 42),
      sensor("/gpu-nvidia/0", "/gpu-nvidia/0/load/1", "GPU Memory Controller", SensorType.Load, 12),
      sensor("/gpu-nvidia/0", "/gpu-nvidia/0/load/3", "GPU Memory", SensorType.Load, 30),
      sensor("/gpu-nvidia/0", "/gpu-nvidia/0/temperature/0", "GPU Core", SensorType.Temperature, 61),
      sensor("/gpu-nvidia/0", "/gpu-nvidia/0/temperature/1", "GPU Hot Spot", SensorType.Temperature, 73),
      sensor("/gpu-nvidia/0", "/gpu-nvidia/0/power/0", "GPU Package", SensorType.Power, 55),
      sensor("/gpu-nvidia/0", "/gpu-nvidia/0/smalldata/1", "GPU Memory Used", SensorType.SmallData, 2048),
      sensor("/gpu-nvidia/0", "/gpu-nvidia/0/smalldata/2", "GPU Memory Total", SensorType.SmallData, 4096),
      sensor("/gpu-nvidia/0", "/gpu-nvidia/0/smalldata/9", "D3D Dedicated Memory Used", SensorType.SmallData, 2048),

      // Integrated GPU: load through D3D engine nodes, and its only "memory
      // total" is system memory it may borrow.
      sensor("/gpu-intel/0", "/gpu-intel/0/load/0", "D3D 3D", SensorType.Load, 7),
      sensor("/gpu-intel/0", "/gpu-intel/0/load/1", "D3D Video Decode", SensorType.Load, 3),
      sensor("/gpu-intel/0", "/gpu-intel/0/temperature/0", "GPU Core", SensorType.Temperature, 45),
      sensor("/gpu-intel/0", "/gpu-intel/0/power/0", "GPU Power", SensorType.Power, 4),
      sensor("/gpu-intel/0", "/gpu-intel/0/smalldata/0", "D3D Shared Memory Total", SensorType.SmallData, 16384),
      sensor("/gpu-intel/0", "/gpu-intel/0/smalldata/1", "D3D Shared Memory Used", SensorType.SmallData, 900),

      sensor("/intelcpu/0", "/intelcpu/0/load/0", "CPU Total", SensorType.Load, 33),
      sensor("/intelcpu/0", "/intelcpu/0/temperature/0", "CPU Package", SensorType.Temperature, 52),
      sensor("/intelcpu/0", "/intelcpu/0/power/0", "CPU Package", SensorType.Power, 65),

      sensor("/ram", "/ram/load/0", "Memory Used", SensorType.Load, 48),

      sensor("/nic/0", "/nic/0/throughput/7", "Download Speed", SensorType.Throughput, 1234),
      sensor("/nic/0", "/nic/0/throughput/8", "Upload Speed", SensorType.Throughput, 567),

      sensor("/presentmon", "/presentmon/presented", "Presented", SensorType.Load, 144),
      sensor("/presentmon", "/presentmon/frametime", "Frametime", SensorType.Load, 6.94),
    ],
  };
}

/** Something for the FPS app picker to list. */
export function previewPresentMonApps(): string[] {
  return ["Cyberpunk2077.exe", "cs2.exe"];
}

/**
 * A pending update, so the download banner is reachable in the preview.
 *
 * There is no updater in a browser, and the real one only answers when a
 * release newer than this build exists on the feed, so the banner was
 * unreachable outside a shipped build going stale.
 *
 * Structural, not a real Update: the store reads `version` and calls
 * `downloadAndInstall`, and nothing else on the instance. The download is
 * simulated at a visible pace so the available, downloading and installing
 * states can all be looked at. It ends in "installing" and stays there, since
 * relaunching is a no-op without a Tauri runtime.
 */
const PREVIEW_UPDATE_BYTES = 42 * 1024 * 1024;
const PREVIEW_UPDATE_CHUNKS = 21;
const PREVIEW_CHUNK_MS = 90;

// The endpoint the real updater reads is configured in
// src-tauri/tauri.conf.json, and its manifest is a release asset, which a
// browser cannot read across origins. The releases API can be read, and it
// names the same release, so the preview offers the version the packaged app
// would actually offer rather than a number invented here.
const PREVIEW_RELEASES_API =
  "https://api.github.com/repos/SupaStellar/Cleanmeter/releases/latest";

// Deliberately implausible: it only shows when the API cannot be reached
// (offline, rate limited), and a number that looks real would hide that.
const PREVIEW_FALLBACK_VERSION = "0.0.0";

let cachedPreviewVersion: string | null = null;

async function latestReleaseVersion(): Promise<string> {
  if (cachedPreviewVersion) return cachedPreviewVersion;
  try {
    const response = await fetch(PREVIEW_RELEASES_API, {
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!response.ok) throw new Error(`releases API returned ${response.status}`);
    const body = (await response.json()) as { tag_name?: string };
    // Tags carry a leading v; the updater manifest and the pill both want it
    // bare, since the pill renders its own.
    cachedPreviewVersion =
      (body.tag_name ?? "").replace(/^v/, "") || PREVIEW_FALLBACK_VERSION;
  } catch {
    cachedPreviewVersion = PREVIEW_FALLBACK_VERSION;
  }
  return cachedPreviewVersion;
}

export async function previewUpdate(): Promise<Update> {
  const download = async (onEvent?: (event: DownloadEvent) => void) => {
    onEvent?.({ event: "Started", data: { contentLength: PREVIEW_UPDATE_BYTES } });
    for (let sent = 0; sent < PREVIEW_UPDATE_CHUNKS; sent++) {
      await new Promise((resolve) => setTimeout(resolve, PREVIEW_CHUNK_MS));
      onEvent?.({
        event: "Progress",
        data: { chunkLength: PREVIEW_UPDATE_BYTES / PREVIEW_UPDATE_CHUNKS },
      });
    }
    onEvent?.({ event: "Finished" });
  };

  return {
    version: await latestReleaseVersion(),
    download,
    // Nothing to install, but not instant either: the pill shows an installing
    // state for as long as this takes, and zero would make it unviewable.
    install: () => new Promise<void>((resolve) => setTimeout(resolve, 1200)),
    downloadAndInstall: download,
  } as unknown as Update;
}
