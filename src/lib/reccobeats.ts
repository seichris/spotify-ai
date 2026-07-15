import { normalizeSpotifyId } from "@/lib/spotifyValidation";
import type { TrackAudioFeatures } from "@/types/audio";

const AUDIO_FEATURES_ENDPOINT = "https://api.reccobeats.com/v1/audio-features";
const BATCH_SIZE = 40;
const REQUEST_TIMEOUT_MS = 8_000;

interface ReccoBeatsAudioFeature {
  energy?: unknown;
  href?: unknown;
  tempo?: unknown;
}

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const spotifyIdFromHref = (href: unknown) => {
  if (typeof href !== "string") return null;
  try {
    const url = new URL(href);
    const segments = url.pathname.split("/").filter(Boolean);
    const trackIndex = segments.indexOf("track");
    return trackIndex >= 0
      ? normalizeSpotifyId(segments[trackIndex + 1])
      : null;
  } catch {
    return null;
  }
};

export const parseAudioFeaturesResponse = (value: unknown) => {
  if (!value || typeof value !== "object") {
    return new Map<string, TrackAudioFeatures>();
  }

  const content = (value as { content?: unknown }).content;
  if (!Array.isArray(content)) {
    return new Map<string, TrackAudioFeatures>();
  }

  const parsed = new Map<string, TrackAudioFeatures>();
  content.forEach((item) => {
    if (!item || typeof item !== "object") return;
    const record = item as ReccoBeatsAudioFeature;
    const spotifyId = spotifyIdFromHref(record.href);
    if (
      !spotifyId ||
      !isFiniteNumber(record.energy) ||
      record.energy < 0 ||
      record.energy > 1 ||
      !isFiniteNumber(record.tempo) ||
      record.tempo <= 0 ||
      record.tempo > 400
    ) {
      return;
    }

    parsed.set(spotifyId, {
      energy: record.energy,
      tempo: record.tempo,
    });
  });
  return parsed;
};

const fetchBatch = async (ids: string[]) => {
  const url = new URL(AUDIO_FEATURES_ENDPOINT);
  url.searchParams.set("ids", ids.join(","));
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      cache: "force-cache",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`ReccoBeats audio features failed (${response.status})`);
    }
    return parseAudioFeaturesResponse(await response.json());
  } finally {
    clearTimeout(timeout);
  }
};

export const getTrackAudioFeatures = async (trackIds: string[]) => {
  const ids = Array.from(
    new Set(trackIds.map(normalizeSpotifyId).filter((id): id is string => Boolean(id))),
  ).sort();
  const batches = Array.from(
    { length: Math.ceil(ids.length / BATCH_SIZE) },
    (_, index) => ids.slice(index * BATCH_SIZE, (index + 1) * BATCH_SIZE),
  );
  const results = await Promise.allSettled(batches.map(fetchBatch));
  const features = new Map<string, TrackAudioFeatures>();

  results.forEach((result) => {
    if (result.status === "fulfilled") {
      result.value.forEach((value, id) => features.set(id, value));
    } else {
      console.warn("Continuing without an audio-feature batch", result.reason);
    }
  });

  return features;
};
