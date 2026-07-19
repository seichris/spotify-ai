import type { SongGraphBuildStage } from "@/types/network";

const STAGE_LABELS: Record<SongGraphBuildStage, string> = {
  communities: "Finding musical neighborhoods",
  layout: "Settling the map",
  normalizing: "Normalizing library metadata",
  ready: "Map ready",
  relationships: "Building song relationships",
};

interface GraphLoaderProps {
  error?: string | null;
  progress: number;
  stage: SongGraphBuildStage;
}

export default function GraphLoader({
  error,
  progress,
  stage,
}: GraphLoaderProps) {
  return (
    <div className="pointer-events-none absolute inset-x-3 top-14 z-20 rounded-xl border border-white/10 bg-black/80 p-3 shadow-xl backdrop-blur-md">
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className={error ? "text-red-300" : "text-zinc-200"}>
          {error ? "Using the preview map" : STAGE_LABELS[stage]}
        </span>
        {!error && <span className="tabular-nums text-zinc-500">{progress}%</span>}
      </div>
      {!error && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-800">
          <div
            className="h-full rounded-full bg-green-500 transition-[width] duration-300"
            style={{ width: `${Math.max(2, progress)}%` }}
          />
        </div>
      )}
      {error && (
        <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">
          Similarity processing failed, but your library remains available.
          {` ${error}`}
        </p>
      )}
    </div>
  );
}
