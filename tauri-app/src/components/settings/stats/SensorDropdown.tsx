import { Select } from "@/components/ui/Select";
import type { Hardware, Sensor, SensorType } from "@/lib/types";
import { formatValue } from "@/lib/utils";

interface SensorDropdownProps {
  sensorType: SensorType;
  sensors: Sensor[];
  hardwares: Hardware[];
  value: string;
  onChange: (id: string) => void;
}

export function SensorDropdown({
  sensorType,
  sensors,
  hardwares,
  value,
  onChange,
}: SensorDropdownProps) {
  const matchingSensors = sensors.filter((s) => s.sensorType === sensorType);

  const options = matchingSensors.map((sensor) => {
    const hw = hardwares.find(
      (h) => h.identifier === sensor.hardwareIdentifier
    );
    const hwName = hw?.name ?? "Unknown";
    return {
      value: sensor.identifier,
      label: `${hwName} > ${sensor.name} (${formatValue(sensor.value, 1)})`,
    };
  });

  if (options.length === 0) return null;

  return (
    <div className="ml-7 mt-1 mb-2">
      <Select
        value={value}
        options={options}
        onChange={onChange}
        placeholder="Select sensor..."
      />
    </div>
  );
}
