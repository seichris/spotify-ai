import Graph from "graphology";
import { EnrichedTrack } from "@/hooks/useSpotifyLibrary";
import {
  SongGraphEdgeAttributes,
  SongGraphNodeAttributes,
} from "@/types/network";

const CLUSTER_COLORS = [
  "#22c55e",
  "#a855f7",
  "#06b6d4",
  "#f97316",
  "#ec4899",
  "#eab308",
  "#3b82f6",
  "#14b8a6",
];

const hashString = (value: string) => {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0) / 4294967295;
};

const normalizeGenre = (genre: string) => genre.trim().toLowerCase();

const getPrimaryGenre = (track: EnrichedTrack) =>
  normalizeGenre(track.genres[0] ?? "unmapped");

const getImageUrl = (track: EnrichedTrack) =>
  track.album.images[1]?.url ??
  track.album.images[0]?.url ??
  track.album.images[2]?.url;

export const buildPreviewGraph = (tracks: EnrichedTrack[]) => {
  const graph = new Graph<
    SongGraphNodeAttributes,
    SongGraphEdgeAttributes
  >({ type: "undirected" });
  const validTracks = Array.from(
    new Map(
      tracks
        .filter(
          (track) =>
            Boolean(track.id) && track.type === "track" && !track.is_local,
        )
        .map((track) => [track.id, track]),
    ).values(),
  );
  const genres = Array.from(
    new Set(validTracks.map((track) => getPrimaryGenre(track))),
  ).sort();
  const genreIndex = new Map(genres.map((genre, index) => [genre, index]));
  const clusterCount = Math.max(genres.length, 1);

  validTracks.forEach((track) => {
    const genre = getPrimaryGenre(track);
    const clusterIndex = genreIndex.get(genre) ?? 0;
    const clusterAngle = (Math.PI * 2 * clusterIndex) / clusterCount;
    const clusterRadius = clusterCount === 1 ? 0 : 16;
    const clusterX = Math.cos(clusterAngle) * clusterRadius;
    const clusterY = Math.sin(clusterAngle) * clusterRadius;
    const radial = 2 + Math.sqrt(hashString(`${track.id}:radius`)) * 7;
    const angle = hashString(`${track.id}:angle`) * Math.PI * 2;

    graph.addNode(track.id, {
      albumId: track.album.id,
      albumName: track.album.name,
      artistIds: track.artists.map((artist) => artist.id),
      artistNames: track.artists.map((artist) => artist.name),
      color: CLUSTER_COLORS[clusterIndex % CLUSTER_COLORS.length],
      genres: track.genres.map(normalizeGenre),
      image: getImageUrl(track),
      kind: "liked",
      label: track.name,
      size: 7,
      type: "image",
      uri: track.uri,
      x: clusterX + Math.cos(angle) * radial,
      y: clusterY + Math.sin(angle) * radial,
    });
  });

  return graph;
};
