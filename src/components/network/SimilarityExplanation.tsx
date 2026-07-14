import { useMemo } from "react";
import type Graph from "graphology";
import type { EnrichedTrack } from "@/hooks/useSpotifyLibrary";
import type {
  SongGraphEdgeAttributes,
  SongGraphNodeAttributes,
} from "@/types/network";

interface SimilarityExplanationProps {
  graph: Graph<SongGraphNodeAttributes, SongGraphEdgeAttributes>;
  track: EnrichedTrack;
  tracksById: Map<string, EnrichedTrack>;
}

const describeEvidence = (evidence: SongGraphEdgeAttributes["evidence"]) => {
  const reasons: string[] = [];
  if (evidence.sharedGenres.length > 0) {
    reasons.push(evidence.sharedGenres.slice(0, 2).join(" + "));
  }
  if (evidence.artist > 0) reasons.push("shared artist");
  if (evidence.album > 0) reasons.push("same album");
  return reasons.join(" · ") || "weak metadata link";
};

export default function SimilarityExplanation({
  graph,
  track,
  tracksById,
}: SimilarityExplanationProps) {
  const neighbors = useMemo(() => {
    if (!graph.hasNode(track.id)) return [];
    return graph
      .neighbors(track.id)
      .flatMap((neighborId) => {
        const edge = graph.edge(track.id, neighborId);
        const neighbor = tracksById.get(neighborId);
        if (!edge || !neighbor) return [];
        const attributes = graph.getEdgeAttributes(edge);
        return [{ attributes, neighbor }];
      })
      .sort((left, right) => right.attributes.weight - left.attributes.weight)
      .slice(0, 4);
  }, [graph, track.id, tracksById]);

  if (neighbors.length === 0) {
    return (
      <p className="mt-3 text-[11px] leading-relaxed text-zinc-500">
        This song is currently an island: the available metadata does not
        justify a strong neighbor.
      </p>
    );
  }

  return (
    <div className="mt-3 border-t border-white/10 pt-2">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
        Strongest nearby songs
      </p>
      <ul className="mt-1.5 space-y-1.5">
        {neighbors.map(({ attributes, neighbor }) => (
          <li key={neighbor.id} className="text-[11px] leading-tight">
            <span className="text-zinc-300">{neighbor.name}</span>
            <span className="text-zinc-600"> · </span>
            <span className="text-zinc-500">
              {describeEvidence(attributes.evidence)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
