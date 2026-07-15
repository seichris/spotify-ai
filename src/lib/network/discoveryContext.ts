import type Graph from "graphology";
import type { EnrichedTrack } from "@/hooks/useSpotifyLibrary";
import type {
  ClusterProfile,
  DiscoveryContext,
  DiscoveryScope,
  DiscoveryTrackSummary,
  ExplorationMode,
  SongGraphEdgeAttributes,
  SongGraphNodeAttributes,
} from "@/types/network";

interface CreateDiscoveryContextOptions {
  cluster?: ClusterProfile | null;
  dismissedTrackIds?: string[];
  exploration?: ExplorationMode;
  graph: Graph<SongGraphNodeAttributes, SongGraphEdgeAttributes>;
  scope: DiscoveryScope;
  selectedTrackId?: string | null;
  tracks: EnrichedTrack[];
}

const toSummary = (track: EnrichedTrack): DiscoveryTrackSummary => ({
  artistIds: track.artists.map((artist) => artist.id),
  artistNames: track.artists.map((artist) => artist.name),
  features: track.features,
  genres: track.genres,
  id: track.id,
  name: track.name,
});

const rankNeighbors = (
  graph: Graph<SongGraphNodeAttributes, SongGraphEdgeAttributes>,
  trackId: string,
) => {
  if (!graph.hasNode(trackId)) return [];
  return graph
    .neighbors(trackId)
    .map((neighborId) => ({
      id: neighborId,
      weight: graph.getEdgeAttribute(trackId, neighborId, "weight"),
    }))
    .sort((left, right) => right.weight - left.weight || left.id.localeCompare(right.id));
};

const topGenresFor = (tracks: DiscoveryTrackSummary[]) => {
  const counts = new Map<string, number>();
  tracks.forEach((track) => {
    track.genres.forEach((genre) => {
      counts.set(genre, (counts.get(genre) ?? 0) + 1);
    });
  });
  return Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 8)
    .map(([genre]) => genre);
};

export const createDiscoveryContext = ({
  cluster,
  dismissedTrackIds = [],
  exploration = "balanced",
  graph,
  scope,
  selectedTrackId,
  tracks,
}: CreateDiscoveryContextOptions): DiscoveryContext => {
  const tracksById = new Map(tracks.map((track) => [track.id, track]));
  let anchorIds: string[] = [];
  let seedIds: string[] = [];

  if (scope === "cluster") {
    if (!cluster) throw new Error("Choose a neighborhood before discovering.");
    anchorIds = cluster.representativeTrackIds.slice(0, 6);
    seedIds = anchorIds.slice(0, 4);
  } else {
    if (!selectedTrackId || !tracksById.has(selectedTrackId)) {
      throw new Error("Choose a liked song before discovering.");
    }
    seedIds = [selectedTrackId];
    anchorIds =
      scope === "song"
        ? [selectedTrackId]
        : [
            selectedTrackId,
            ...rankNeighbors(graph, selectedTrackId)
              .slice(0, 6)
              .map((neighbor) => neighbor.id),
          ];
  }

  const anchorTracks = Array.from(new Set(anchorIds))
    .flatMap((id) => {
      const track = tracksById.get(id);
      return track ? [toSummary(track)] : [];
    })
    .slice(0, 7);
  const seedTracks = Array.from(new Set(seedIds)).flatMap((id) => {
    const track = tracksById.get(id);
    return track ? [toSummary(track)] : [];
  });

  if (anchorTracks.length === 0 || seedTracks.length === 0) {
    throw new Error("The selected area has no usable discovery seeds.");
  }

  return {
    anchorTracks,
    clusterLabel: scope === "cluster" ? cluster?.label : undefined,
    dismissedTrackIds: Array.from(new Set(dismissedTrackIds)).slice(0, 500),
    existingTrackIds: Array.from(tracksById.keys()),
    exploration,
    scope,
    seedTracks,
    topGenres: topGenresFor(anchorTracks),
  };
};
