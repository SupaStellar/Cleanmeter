import type { Sensor } from "@/lib/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/shadcn/select";

interface Props {
  value: string;
  options: Sensor[];
  onChange: (v: string) => void;
}

/**
 * Sensor picker used by every SubCollapsible across the stats settings.
 * Trigger reads "Sensor: <name>" and the dropdown lists the hardware-filtered
 * sensors passed in `options`.
 */
export function SensorSelect({ value, options, onChange }: Props) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-10 rounded-[8px] bg-card text-[14px]">
        <span className="flex items-center gap-2">
          <span className="text-[14px] font-normal text-muted-foreground">Sensor:</span>
          <SelectValue placeholder="Select" />
        </span>
      </SelectTrigger>
      <SelectContent>
        {options.map((s) => (
          <SelectItem key={s.identifier} value={s.identifier}>
            {s.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
