import { RotateCcw } from "lucide-react";
import type { ExplorationMode } from "@/types/network";

interface DiscoveryControlsProps {
  eventCount: number;
  exploration: ExplorationMode;
  hasRestored: boolean;
  onChange: (mode: ExplorationMode) => void;
  onReset: () => void;
}

export default function DiscoveryControls({
  eventCount,
  exploration,
  hasRestored,
  onChange,
  onReset,
}: DiscoveryControlsProps) {
  return (
    <div className="absolute left-3 top-12 z-20 flex items-center gap-1.5 rounded-full border border-white/10 bg-black/75 p-1 text-[11px] text-zinc-400 shadow-lg backdrop-blur-md">
      <label>
        <span className="sr-only">Discovery range</span>
        <select
          aria-label="Discovery range"
          className="rounded-full bg-transparent px-2 py-1 text-zinc-200 focus:outline-none focus:ring-1 focus:ring-green-500"
          disabled={!hasRestored}
          value={exploration}
          onChange={(event) =>
            onChange(event.target.value as ExplorationMode)
          }
        >
          <option value="familiar">Familiar</option>
          <option value="balanced">Balanced</option>
          <option value="adventurous">Adventurous</option>
        </select>
      </label>
      {eventCount > 0 && (
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-zinc-500 hover:bg-white/10 hover:text-white"
          aria-label="Reset discovery history"
          title="Clear local discovery history and dismissed songs"
        >
          <RotateCcw className="h-3 w-3" /> Reset
        </button>
      )}
    </div>
  );
}
