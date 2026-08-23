import type {
  Boundaries,
  ProgressType,
  Sensor,
  SensorConfig,
} from "@/lib/types";
import { selectSensorReadings, sensorReadingIds } from "@/lib/sensor-readings";
import { MetricValue } from "./MetricValue";
import { ProgressBar } from "./ProgressBar";
import { ProgressRing } from "./ProgressRing";

interface FormattedReading {
  value: string;
  unit: string;
}

interface MultiValueMetricProps {
  sensors: Sensor[];
  config: SensorConfig;
  progressType: ProgressType;
  format: (value: number) => FormattedReading;
  labelForSensor: (sensor: Sensor) => string;
  valueFontSize: number;
  labelFontSize: number;
  valueFontWeight: number;
  labelFontWeight: number;
  boundaries?: Boundaries;
  max?: number;
  accepts?: (sensor: Sensor) => boolean;
}

const acceptEverySensor = () => true;

/**
 * One primary reading plus any supplemental readings selected for the same
 * metric. The primary retains the existing gauge; supplemental values stay
 * compact and labeled so their meaning remains clear.
 */
export function MultiValueMetric({
  sensors,
  config,
  progressType,
  format,
  labelForSensor,
  valueFontSize,
  labelFontSize,
  valueFontWeight,
  labelFontWeight,
  boundaries,
  max = 100,
  accepts = acceptEverySensor,
}: MultiValueMetricProps) {
  const readings = selectSensorReadings(sensors, config, accepts);
  const primary = format(readings.primary?.value ?? 0);
  const showProgress = boundaries !== undefined && progressType !== "none";
  const Progress = progressType === "bar" ? ProgressBar : ProgressRing;
  const primaryLabel =
    readings.primary && sensorReadingIds(config).length > 1
      ? labelForSensor(readings.primary)
      : undefined;
  const textProps = {
    valueFontSize,
    labelFontSize,
    valueFontWeight,
    labelFontWeight,
  };

  return (
    <>
      {showProgress ? (
        <div className="flex items-center gap-1" title={readings.primary?.name}>
          {primaryLabel && (
            <span
              style={{
                fontSize: labelFontSize,
                fontWeight: labelFontWeight,
                color: "var(--overlay-text-muted)",
                fontFamily: "Inter",
                letterSpacing: "0.04em",
              }}
            >
              {primaryLabel}
            </span>
          )}
          <Progress
            value={readings.primary?.value ?? 0}
            max={max}
            label={primary.value}
            unit={primary.unit}
            boundaries={boundaries}
          />
        </div>
      ) : (
        <MetricValue
          label={primaryLabel}
          value={primary.value}
          unit={primary.unit}
          title={readings.primary?.name}
          {...textProps}
        />
      )}
      {readings.additional.map((sensor) => {
        const reading = format(sensor.value);
        return (
          <MetricValue
            key={sensor.identifier}
            label={labelForSensor(sensor)}
            value={reading.value}
            unit={reading.unit}
            title={sensor.name}
            {...textProps}
          />
        );
      })}
    </>
  );
}
