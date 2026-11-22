import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RANGE_PRESETS, presetRange, type DateRange, type RangePreset } from "@/lib/fees";
import { cn } from "@/lib/utils";

export interface RangeState {
  preset: RangePreset;
  from: string;
  to: string;
}

export const ALL_TIME: RangeState = { preset: "all", from: "", to: "" };

export function resolveRange(r: RangeState): DateRange {
  return presetRange(r.preset, new Date(), { from: r.from || null, to: r.to || null });
}

/** Period dropdown with optional custom from/to dates. */
export function DateRangeFilter({
  value,
  onChange,
  label = "Period",
  className,
}: {
  value: RangeState;
  onChange: (v: RangeState) => void;
  label?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <Select value={value.preset} onValueChange={(v) => onChange({ ...value, preset: v as RangePreset })}>
        <SelectTrigger className="min-w-44 sm:w-52" aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {RANGE_PRESETS.map((p) => (
            <SelectItem key={p.value} value={p.value}>
              {p.value === "all" ? `${label}: All time` : p.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {value.preset === "custom" && (
        <>
          <Input type="date" aria-label="From date" className="w-40" value={value.from} onChange={(e) => onChange({ ...value, from: e.target.value })} />
          <span className="text-sm text-muted-foreground">to</span>
          <Input type="date" aria-label="To date" className="w-40" value={value.to} onChange={(e) => onChange({ ...value, to: e.target.value })} />
        </>
      )}
    </div>
  );
}
