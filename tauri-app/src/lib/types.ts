export enum HardwareType {
  Motherboard = 0,
  SuperIO = 1,
  Cpu = 2,
  Memory = 3,
  GpuNvidia = 4,
  GpuAmd = 5,
  GpuIntel = 6,
  Storage = 7,
  Network = 8,
  Cooler = 9,
  EmbeddedController = 10,
  Psu = 11,
  Battery = 12,
  Unknown = 13,
}

export enum SensorType {
  Voltage = 0,
  Current = 1,
  Power = 2,
  Clock = 3,
  Temperature = 4,
  Load = 5,
  Frequency = 6,
  Fan = 7,
  Flow = 8,
  Control = 9,
  Level = 10,
  Factor = 11,
  Data = 12,
  SmallData = 13,
  Throughput = 14,
  TimeSpan = 15,
  Energy = 16,
  Noise = 17,
  Unknown = 18,
}

export type ProgressType = "circular" | "bar" | "none";

export interface Boundaries {
  low: number;
  medium: number;
  high: number;
}

export interface SensorConfig {
  isEnabled: boolean;
  customReadingId: string;
}

export interface GraphSensorConfig extends SensorConfig {
  boundaries: Boundaries;
}

export interface SensorsConfig {
  framerate: SensorConfig;
  frametime: SensorConfig;
  cpuTemp: GraphSensorConfig;
  cpuUsage: GraphSensorConfig;
  cpuConsumption: SensorConfig;
  gpuTemp: GraphSensorConfig;
  gpuUsage: GraphSensorConfig;
  vramUsage: GraphSensorConfig;
  gpuConsumption: SensorConfig;
  totalVramUsed: SensorConfig;
  ramUsage: GraphSensorConfig;
  upRate: SensorConfig;
  downRate: SensorConfig;
}

export type TemperatureUnit = "C" | "F";
export type ThemeMode = "light" | "dark" | "system";
export type GraphType = "ring" | "bar";

export interface OverlaySettings {
  isDarkTheme: boolean;
  isMeterLight: boolean;
  themeMode: ThemeMode;
  temperatureUnit: TemperatureUnit;
  isHorizontal: boolean;
  useCustomPosition: boolean;
  positionIndex: number;
  selectedDisplayIndex: number;
  netGraph: boolean;
  progressType: ProgressType;
  graphType: GraphType;
  positionX: number;
  positionY: number;
  isPositionLocked: boolean;
  opacity: number;
  pillOpacity: number;
  fontSizeValue: number;
  fontSizeLabel: number;
  numberFontSize: number;
  numberLabelFontSize: number;
  fontWeight: number;
  labelFontWeight: number;
  pollingRate: number;
  isLoggingEnabled: boolean;
  sensors: SensorsConfig;
}

export interface Hardware {
  name: string;
  identifier: string;
  hardwareType: HardwareType;
}

export interface Sensor {
  name: string;
  identifier: string;
  hardwareIdentifier: string;
  sensorType: SensorType;
  value: number;
}

export interface HardwareMonitorData {
  hardwares: Hardware[];
  sensors: Sensor[];
  lastPollTime: number;
}

export interface PipeStatus {
  connected: boolean;
  error?: string;
}

export interface MonitorInfo {
  name: string;
  width: number;
  height: number;
  x: number;
  y: number;
  primary: boolean;
}

export interface AppPreferences {
  adminConsent: boolean;
  startMinimized: boolean;
}

export type SensorKey = keyof SensorsConfig;

export const POLLING_RATES = [33, 50, 100, 250, 300, 350, 400, 500] as const;

export const DEFAULT_SETTINGS: OverlaySettings = {
  isDarkTheme: false,
  isMeterLight: false,
  themeMode: "light",
  temperatureUnit: "C",
  isHorizontal: true,
  useCustomPosition: true,
  positionIndex: 4,
  selectedDisplayIndex: 0,
  netGraph: false,
  progressType: "circular",
  graphType: "ring",
  positionX: 0,
  positionY: 0,
  isPositionLocked: false,
  opacity: 1.0,
  pillOpacity: 0.3,
  fontSizeValue: 12,
  fontSizeLabel: 12,
  numberFontSize: 14,
  numberLabelFontSize: 10,
  fontWeight: 500,
  labelFontWeight: 500,
  pollingRate: 500,
  isLoggingEnabled: false,
  sensors: {
    framerate: { isEnabled: true, customReadingId: "" },
    frametime: { isEnabled: true, customReadingId: "" },
    cpuTemp: { isEnabled: true, customReadingId: "", boundaries: { low: 60, medium: 80, high: 90 } },
    cpuUsage: { isEnabled: true, customReadingId: "", boundaries: { low: 60, medium: 80, high: 90 } },
    cpuConsumption: { isEnabled: true, customReadingId: "" },
    gpuTemp: { isEnabled: true, customReadingId: "", boundaries: { low: 60, medium: 80, high: 90 } },
    gpuUsage: { isEnabled: true, customReadingId: "", boundaries: { low: 60, medium: 80, high: 90 } },
    vramUsage: { isEnabled: true, customReadingId: "", boundaries: { low: 60, medium: 80, high: 90 } },
    gpuConsumption: { isEnabled: true, customReadingId: "" },
    totalVramUsed: { isEnabled: true, customReadingId: "" },
    ramUsage: { isEnabled: true, customReadingId: "", boundaries: { low: 60, medium: 80, high: 90 } },
    upRate: { isEnabled: true, customReadingId: "" },
    downRate: { isEnabled: true, customReadingId: "" },
  },
};
