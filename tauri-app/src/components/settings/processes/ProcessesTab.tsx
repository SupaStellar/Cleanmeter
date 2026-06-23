import { useEffect, useRef, useState } from "react";
import { SectionCard } from "../stats/SectionCard";
import { Input } from "@/app/components/Input";
import { Button } from "@/app/components/Button";
import { listProcesses, killProcess } from "@/lib/tauri";
import type { ProcessInfo } from "@/lib/types";

const REFRESH_INTERVAL_MS = 3000;

// Human-readable byte size (KB/MB/GB), e.g. 1_500_000 → "1.4 MB".
function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 KB";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const value = bytes / Math.pow(1024, exponent);
  // Whole numbers for bytes/KB, one decimal for MB and up.
  const fractionDigits = exponent >= 2 ? 1 : 0;
  return `${value.toFixed(fractionDigits)} ${units[exponent]}`;
}

export function ProcessesTab() {
  const [processes, setProcesses] = useState<ProcessInfo[]>([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);
  // Avoids overlapping fetches and setState after unmount.
  const fetchingRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    const refresh = async () => {
      if (fetchingRef.current) return;
      fetchingRef.current = true;
      try {
        const result = await listProcesses();
        if (mountedRef.current) setProcesses(result ?? []);
      } catch (err) {
        console.error("Failed to list processes:", err);
      } finally {
        if (mountedRef.current) setLoading(false);
        fetchingRef.current = false;
      }
    };

    refresh();
    const interval = setInterval(refresh, REFRESH_INTERVAL_MS);

    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, []);

  const handleKill = async (proc: ProcessInfo) => {
    // Killing a process is destructive, so require explicit confirmation.
    const confirmed = window.confirm(
      `End process "${proc.name}" (PID ${proc.pid})?`,
    );
    if (!confirmed) return;
    try {
      await killProcess(proc.pid);
    } catch (err) {
      console.error(`Failed to kill process ${proc.pid}:`, err);
    }
    // Refresh immediately so the list reflects the change.
    try {
      const result = await listProcesses();
      if (mountedRef.current) setProcesses(result ?? []);
    } catch (err) {
      console.error("Failed to refresh processes:", err);
    }
  };

  const query = filter.trim().toLowerCase();
  const filtered = (
    query
      ? processes.filter((p) => p.name.toLowerCase().includes(query))
      : processes
  )
    // Backend already sorts by CPU desc; keep a stable client-side sort too.
    .slice()
    .sort((a, b) => b.cpuUsage - a.cpuUsage);

  return (
    <div className="flex h-full w-full flex-col gap-4">
      <SectionCard title="Running Processes">
        <Input
          placeholder="Filter by name…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />

        <div className="flex flex-col">
          {/* Column header row */}
          <div className="flex items-center gap-[var(--spacingS)] border-b border-[var(--borderSubtle)] px-[var(--spacingXs)] pb-[var(--spacingXs)] text-label-sm-medium text-[var(--textParagraph2)]">
            <span className="flex-1">Name</span>
            <span className="w-16 text-right">CPU</span>
            <span className="w-24 text-right">Memory</span>
            <span className="w-20 shrink-0" />
          </div>

          <div className="max-h-[360px] overflow-y-auto">
            {loading ? (
              <p className="px-[var(--spacingXs)] py-[var(--spacingM)] text-center text-body-sm-regular text-[var(--textParagraph1)]">
                Loading processes…
              </p>
            ) : filtered.length === 0 ? (
              <p className="px-[var(--spacingXs)] py-[var(--spacingM)] text-center text-body-sm-regular text-[var(--textParagraph1)]">
                {query ? "No matching processes." : "No processes found."}
              </p>
            ) : (
              filtered.map((proc) => (
                <div
                  key={proc.pid}
                  className="flex items-center gap-[var(--spacingS)] border-b border-[var(--borderSubtle)] px-[var(--spacingXs)] py-[var(--spacingXs)] text-body-sm-regular text-[var(--textHeading)]"
                >
                  <span className="min-w-0 flex-1 truncate" title={proc.name}>
                    {proc.name}
                  </span>
                  <span className="w-16 text-right tabular-nums text-[var(--textParagraph2)]">
                    {proc.cpuUsage.toFixed(1)}%
                  </span>
                  <span className="w-24 text-right tabular-nums text-[var(--textParagraph2)]">
                    {formatBytes(proc.memoryBytes)}
                  </span>
                  <div className="w-20 shrink-0 text-right">
                    <Button
                      variant="filled-white"
                      size="sm"
                      onClick={() => handleKill(proc)}
                    >
                      End
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
