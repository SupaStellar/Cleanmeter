use serde::{Deserialize, Serialize};
use serde_repr::{Deserialize_repr, Serialize_repr};

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
#[repr(u16)]
pub enum Command {
    Data = 0,
    RefreshPresentMonApps = 1,
    SelectPresentMonApp = 2,
    PresentMonApps = 3,
    SelectPollingRate = 4,
}

impl TryFrom<u16> for Command {
    type Error = String;
    fn try_from(value: u16) -> Result<Self, Self::Error> {
        match value {
            0 => Ok(Command::Data),
            1 => Ok(Command::RefreshPresentMonApps),
            2 => Ok(Command::SelectPresentMonApp),
            3 => Ok(Command::PresentMonApps),
            4 => Ok(Command::SelectPollingRate),
            _ => Err(format!("Unknown command: {}", value)),
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize_repr, Deserialize_repr, PartialEq)]
#[repr(u32)]
pub enum HardwareType {
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

impl From<u32> for HardwareType {
    fn from(value: u32) -> Self {
        match value {
            0 => HardwareType::Motherboard,
            1 => HardwareType::SuperIO,
            2 => HardwareType::Cpu,
            3 => HardwareType::Memory,
            4 => HardwareType::GpuNvidia,
            5 => HardwareType::GpuAmd,
            6 => HardwareType::GpuIntel,
            7 => HardwareType::Storage,
            8 => HardwareType::Network,
            9 => HardwareType::Cooler,
            10 => HardwareType::EmbeddedController,
            11 => HardwareType::Psu,
            12 => HardwareType::Battery,
            _ => HardwareType::Unknown,
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize_repr, Deserialize_repr, PartialEq)]
#[repr(u32)]
pub enum SensorType {
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

impl From<u32> for SensorType {
    fn from(value: u32) -> Self {
        match value {
            0 => SensorType::Voltage,
            1 => SensorType::Current,
            2 => SensorType::Power,
            3 => SensorType::Clock,
            4 => SensorType::Temperature,
            5 => SensorType::Load,
            6 => SensorType::Frequency,
            7 => SensorType::Fan,
            8 => SensorType::Flow,
            9 => SensorType::Control,
            10 => SensorType::Level,
            11 => SensorType::Factor,
            12 => SensorType::Data,
            13 => SensorType::SmallData,
            14 => SensorType::Throughput,
            15 => SensorType::TimeSpan,
            16 => SensorType::Energy,
            17 => SensorType::Noise,
            _ => SensorType::Unknown,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Hardware {
    pub name: String,
    pub identifier: String,
    #[serde(rename = "hardwareType")]
    pub hardware_type: HardwareType,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Sensor {
    pub name: String,
    pub identifier: String,
    #[serde(rename = "hardwareIdentifier")]
    pub hardware_identifier: String,
    #[serde(rename = "sensorType")]
    pub sensor_type: SensorType,
    pub value: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HardwareMonitorData {
    pub hardwares: Vec<Hardware>,
    pub sensors: Vec<Sensor>,
    #[serde(rename = "lastPollTime")]
    pub last_poll_time: i64,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum ProgressType {
    Circular,
    Bar,
    None,
}

impl Default for ProgressType {
    fn default() -> Self {
        ProgressType::Circular
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Boundaries {
    pub low: u32,
    pub medium: u32,
    pub high: u32,
}

impl Default for Boundaries {
    fn default() -> Self {
        Boundaries {
            low: 60,
            medium: 80,
            high: 90,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SensorConfig {
    #[serde(rename = "isEnabled")]
    pub is_enabled: bool,
    #[serde(rename = "customReadingId")]
    pub custom_reading_id: String,
}

impl Default for SensorConfig {
    fn default() -> Self {
        SensorConfig {
            is_enabled: true,
            custom_reading_id: String::new(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GraphSensorConfig {
    #[serde(rename = "isEnabled")]
    pub is_enabled: bool,
    #[serde(rename = "customReadingId")]
    pub custom_reading_id: String,
    pub boundaries: Boundaries,
}

impl Default for GraphSensorConfig {
    fn default() -> Self {
        GraphSensorConfig {
            is_enabled: true,
            custom_reading_id: String::new(),
            boundaries: Boundaries::default(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SensorsConfig {
    pub framerate: SensorConfig,
    pub frametime: SensorConfig,
    #[serde(rename = "cpuTemp")]
    pub cpu_temp: GraphSensorConfig,
    #[serde(rename = "cpuUsage")]
    pub cpu_usage: GraphSensorConfig,
    #[serde(rename = "cpuConsumption")]
    pub cpu_consumption: SensorConfig,
    #[serde(rename = "gpuTemp")]
    pub gpu_temp: GraphSensorConfig,
    #[serde(rename = "gpuUsage")]
    pub gpu_usage: GraphSensorConfig,
    #[serde(rename = "vramUsage")]
    pub vram_usage: GraphSensorConfig,
    #[serde(rename = "gpuConsumption")]
    pub gpu_consumption: SensorConfig,
    #[serde(rename = "totalVramUsed")]
    pub total_vram_used: SensorConfig,
    #[serde(rename = "ramUsage")]
    pub ram_usage: GraphSensorConfig,
    #[serde(rename = "upRate")]
    pub up_rate: SensorConfig,
    #[serde(rename = "downRate")]
    pub down_rate: SensorConfig,
}

impl Default for SensorsConfig {
    fn default() -> Self {
        SensorsConfig {
            framerate: SensorConfig::default(),
            frametime: SensorConfig::default(),
            cpu_temp: GraphSensorConfig::default(),
            cpu_usage: GraphSensorConfig::default(),
            cpu_consumption: SensorConfig::default(),
            gpu_temp: GraphSensorConfig::default(),
            gpu_usage: GraphSensorConfig::default(),
            vram_usage: GraphSensorConfig::default(),
            gpu_consumption: SensorConfig::default(),
            total_vram_used: SensorConfig::default(),
            ram_usage: GraphSensorConfig::default(),
            up_rate: SensorConfig::default(),
            down_rate: SensorConfig::default(),
        }
    }
}

fn default_pill_opacity() -> f32 { 0.3 }
fn default_font_size_value() -> f32 { 12.0 }
fn default_font_size_label() -> f32 { 12.0 }
fn default_number_font_size() -> f32 { 14.0 }
fn default_number_label_font_size() -> f32 { 10.0 }
fn default_font_weight() -> u16 { 500 }
fn default_temperature_unit() -> String { "C".to_string() }
fn default_theme_mode() -> String { "light".to_string() }
fn default_graph_type() -> String { "ring".to_string() }
fn default_use_custom_position() -> bool { true }

// Every field the TypeScript OverlaySettings interface defines must also live
// here, or serde silently drops it during save_settings deserialization. The
// overlay window then receives a stripped payload via the settings-changed
// event and ends up with `undefined` for any field Rust doesn't know about —
// which breaks F/C, custom-position drag, theme mode, etc.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OverlaySettings {
    #[serde(rename = "isDarkTheme")]
    pub is_dark_theme: bool,
    #[serde(rename = "isMeterLight", default)]
    pub is_meter_light: bool,
    #[serde(rename = "themeMode", default = "default_theme_mode")]
    pub theme_mode: String,
    #[serde(rename = "temperatureUnit", default = "default_temperature_unit")]
    pub temperature_unit: String,
    #[serde(rename = "isHorizontal")]
    pub is_horizontal: bool,
    #[serde(rename = "useCustomPosition", default = "default_use_custom_position")]
    pub use_custom_position: bool,
    #[serde(rename = "positionIndex")]
    pub position_index: u8,
    #[serde(rename = "selectedDisplayIndex")]
    pub selected_display_index: u8,
    #[serde(rename = "netGraph")]
    pub net_graph: bool,
    #[serde(rename = "progressType")]
    pub progress_type: ProgressType,
    #[serde(rename = "graphType", default = "default_graph_type")]
    pub graph_type: String,
    #[serde(rename = "positionX")]
    pub position_x: i32,
    #[serde(rename = "positionY")]
    pub position_y: i32,
    #[serde(rename = "isPositionLocked", default)]
    pub is_position_locked: bool,
    pub opacity: f32,
    #[serde(rename = "pillOpacity", default = "default_pill_opacity")]
    pub pill_opacity: f32,
    #[serde(rename = "fontSizeValue", default = "default_font_size_value")]
    pub font_size_value: f32,
    #[serde(rename = "fontSizeLabel", default = "default_font_size_label")]
    pub font_size_label: f32,
    #[serde(rename = "numberFontSize", default = "default_number_font_size")]
    pub number_font_size: f32,
    #[serde(rename = "numberLabelFontSize", default = "default_number_label_font_size")]
    pub number_label_font_size: f32,
    #[serde(rename = "fontWeight", default = "default_font_weight")]
    pub font_weight: u16,
    #[serde(rename = "labelFontWeight", default = "default_font_weight")]
    pub label_font_weight: u16,
    #[serde(rename = "pollingRate")]
    pub polling_rate: u64,
    #[serde(rename = "isLoggingEnabled")]
    pub is_logging_enabled: bool,
    pub sensors: SensorsConfig,
}

impl Default for OverlaySettings {
    fn default() -> Self {
        OverlaySettings {
            is_dark_theme: false,
            is_meter_light: false,
            theme_mode: "light".to_string(),
            temperature_unit: "C".to_string(),
            is_horizontal: true,
            use_custom_position: true,
            position_index: 0,
            selected_display_index: 0,
            net_graph: false,
            progress_type: ProgressType::Circular,
            graph_type: "ring".to_string(),
            position_x: 0,
            position_y: 0,
            is_position_locked: false,
            opacity: 1.0,
            pill_opacity: 0.3,
            font_size_value: 12.0,
            font_size_label: 12.0,
            number_font_size: 14.0,
            number_label_font_size: 10.0,
            font_weight: 500,
            label_font_weight: 500,
            polling_rate: 500,
            is_logging_enabled: false,
            sensors: SensorsConfig::default(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppPreferences {
    #[serde(rename = "adminConsent")]
    pub admin_consent: bool,
    #[serde(rename = "startMinimized")]
    pub start_minimized: bool,
}

impl Default for AppPreferences {
    fn default() -> Self {
        AppPreferences {
            admin_consent: false,
            start_minimized: false,
        }
    }
}

#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "status")]
#[serde(rename_all = "kebab-case")]
pub enum UpdateState {
    NotAvailable,
    Available { version: String },
    Downloading { version: String, progress: f32 },
    Ready { version: String },
    Error { message: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PipeStatus {
    pub connected: bool,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MonitorInfo {
    pub name: String,
    pub width: u32,
    pub height: u32,
    pub x: i32,
    pub y: i32,
    pub primary: bool,
}
