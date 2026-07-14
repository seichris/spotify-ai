"use client";

import { useCallback, useState } from "react";
import { EnrichedTrack } from "@/hooks/useSpotifyLibrary";
import {
    addTracksToPlaylistAction,
    createPlaylistAction,
    getArtistTopTracksAction,
    getGeminiVibePlanAction,
    getUserProfileAction,
    replacePlaylistTracksAction,
} from "@/app/actions";
import { estimateGeminiCost } from "@/lib/geminiPricing";

const STATE_KEY = "vibe_playlist_state_v1";
const parseEnvInt = (value: string | undefined, fallback: number) => {
    const parsed = Number.parseInt(value ?? "", 10);
    return Number.isFinite(parsed) ? parsed : fallback;
};
const MAX_VIBES = parseEnvInt(process.env.NEXT_PUBLIC_MAX_VIBES, 6);
const MIN_CLUSTER_SIZE = 6;
const NEW_SONGS_PER_VIBE = parseEnvInt(process.env.NEXT_PUBLIC_NEW_SONGS_PER_VIBE, 10);

interface TrackSummary {
    id: string;
    name: string;
    artists: { id: string; name: string }[];
    genres: string[];
    uri: string;
}

interface SpotifyApiTrack {
    id: string;
    name: string;
    artists: { id: string; name: string }[];
    uri: string;
}

interface VibeProfile {
    id: string;
    name: string;
    description: string;
    playlistId: string;
    playlistUrl?: string;
    genreCounts: Record<string, number>;
    artistCounts: Record<string, number>;
    suggestedTrackIds: string[];
    createdAt: number;
    updatedAt: number;
}

interface VibeState {
    version: 1;
    analyzedSongIds: string[];
    addedTrackIds: string[];
    songToVibes: Record<string, string[]>;
    vibes: Record<string, VibeProfile>;
    bigPlaylist?: {
        id: string;
        name: string;
        url?: string;
        updatedAt: number;
    };
    lastRunAt?: number;
}

interface VibeCluster {
    key: string;
    tracks: TrackSummary[];
    genreCounts: Record<string, number>;
    artistCounts: Record<string, number>;
    artistNames: Record<string, string>;
}

export interface PlaylistBuildResult {
    id: string;
    name: string;
    url?: string;
    addedLikedCount: number;
    addedNewCount: number;
}

export interface LibraryPlaylistResult {
    id: string;
    name: string;
    url?: string;
    totalTracks: number;
    groupCount: number;
}

const createEmptyState = (): VibeState => ({
    version: 1,
    analyzedSongIds: [],
    addedTrackIds: [],
    songToVibes: {},
    vibes: {},
    bigPlaylist: undefined,
    lastRunAt: undefined,
});

const createId = () => {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
        return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
};

const loadState = (): VibeState => {
    if (typeof window === "undefined") return createEmptyState();
    const raw = localStorage.getItem(STATE_KEY);
    if (!raw) return createEmptyState();
    try {
        const parsed = JSON.parse(raw);
        if (parsed?.version !== 1) return createEmptyState();
        return {
            ...createEmptyState(),
            ...parsed,
            vibes: parsed.vibes || {},
            songToVibes: parsed.songToVibes || {},
        } as VibeState;
    } catch (error) {
        console.error("Failed to parse vibe state", error);
        return createEmptyState();
    }
};

const saveState = (state: VibeState) => {
    if (typeof window === "undefined") return;
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
};

const toTrackSummary = (track: EnrichedTrack): TrackSummary => ({
    id: track.id,
    name: track.name,
    artists: track.artists,
    genres: track.genres ?? [],
    uri: track.uri,
});

const getPrimaryGenre = (track: TrackSummary) => {
    if (!track.genres || track.genres.length === 0) return "mixed";
    return track.genres[0];
};

const increment = (counts: Record<string, number>, key: string) => {
    counts[key] = (counts[key] ?? 0) + 1;
};

const buildCounts = (tracks: TrackSummary[]) => {
    const genreCounts: Record<string, number> = {};
    const artistCounts: Record<string, number> = {};
    const artistNames: Record<string, string> = {};

    tracks.forEach(track => {
        track.genres.forEach(genre => increment(genreCounts, genre));
        track.artists.forEach(artist => {
            increment(artistCounts, artist.id);
            artistNames[artist.id] = artist.name;
        });
    });

    return { genreCounts, artistCounts, artistNames };
};

const getTopKeys = (counts: Record<string, number>, limit: number) =>
    Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([key]) => key);

const buildClusters = (tracks: TrackSummary[]) => {
    if (tracks.length === 0) return [] as VibeCluster[];

    const buckets: Record<string, TrackSummary[]> = {};
    tracks.forEach(track => {
        const key = getPrimaryGenre(track).toLowerCase();
        if (!buckets[key]) buckets[key] = [];
        buckets[key].push(track);
    });

    const clusters = Object.entries(buckets)
        .map(([key, bucket]) => {
            const { genreCounts, artistCounts, artistNames } = buildCounts(bucket);
            return { key, tracks: bucket, genreCounts, artistCounts, artistNames } as VibeCluster;
        })
        .sort((a, b) => b.tracks.length - a.tracks.length);

    if (clusters.length <= MAX_VIBES) {
        return clusters;
    }

    const selected: VibeCluster[] = [];
    const mixedTracks: TrackSummary[] = [];

    clusters.forEach(cluster => {
        if (selected.length < MAX_VIBES - 1 && cluster.tracks.length >= MIN_CLUSTER_SIZE) {
            selected.push(cluster);
        } else {
            mixedTracks.push(...cluster.tracks);
        }
    });

    if (mixedTracks.length > 0) {
        const { genreCounts, artistCounts, artistNames } = buildCounts(mixedTracks);
        selected.push({
            key: "mixed",
            tracks: mixedTracks,
            genreCounts,
            artistCounts,
            artistNames,
        });
    }

    return selected;
};

const createSummary = (cluster: VibeCluster) => {
    const topGenres = getTopKeys(cluster.genreCounts, 6);
    const topArtistIds = getTopKeys(cluster.artistCounts, 6);
    const topArtists = topArtistIds.map(id => cluster.artistNames[id] || id);
    const sampleSongs = cluster.tracks
        .slice(0, 12)
        .map(track => `${track.name} - ${track.artists.map(artist => artist.name).join(", ")}`)
        .join("; ");

    return {
        summaryText: `Top genres: ${topGenres.join(", ") || "unknown"}\nTop artists: ${topArtists.join(", ") || "unknown"}\nSample liked songs: ${sampleSongs}`,
        topGenres,
        topArtistIds,
    };
};

const getVibeTopGenres = (vibe: VibeProfile, limit = 6) => getTopKeys(vibe.genreCounts, limit);

const getVibeTopArtists = (vibe: VibeProfile, limit = 6) => getTopKeys(vibe.artistCounts, limit);

const scoreTrackForVibe = (track: TrackSummary, vibe: VibeProfile) => {
    const vibeGenres = new Set(getVibeTopGenres(vibe));
    const vibeArtists = new Set(getVibeTopArtists(vibe));
    const genreMatches = track.genres.filter(genre => vibeGenres.has(genre));
    const artistMatches = track.artists.filter(artist => vibeArtists.has(artist.id));
    const score = genreMatches.length * 2 + artistMatches.length * 2;
    return { score, genreMatches, artistMatches };
};

const pickVibeMatches = (track: TrackSummary, vibes: Record<string, VibeProfile>) => {
    const scored = Object.entries(vibes)
        .map(([id, vibe]) => ({ id, ...scoreTrackForVibe(track, vibe) }))
        .filter(result => result.score >= 2)
        .sort((a, b) => b.score - a.score);

    if (scored.length === 0) return [] as string[];
    const bestScore = scored[0].score;
    return scored.filter(item => item.score >= bestScore - 1).map(item => item.id);
};

const updateVibeCounts = (vibe: VibeProfile, tracks: TrackSummary[]) => {
    tracks.forEach(track => {
        track.genres.forEach(genre => increment(vibe.genreCounts, genre));
        track.artists.forEach(artist => increment(vibe.artistCounts, artist.id));
    });
};

const dedupeTracks = (tracks: TrackSummary[]) => {
    const seen = new Set<string>();
    return tracks.filter(track => {
        if (seen.has(track.id)) return false;
        seen.add(track.id);
        return true;
    });
};

const addSongToVibeMap = (map: Record<string, string[]>, songId: string, vibeId: string) => {
    const existing = map[songId] ?? [];
    if (existing.includes(vibeId)) return;
    map[songId] = [...existing, vibeId];
};

const getErrorMessage = (error: unknown, fallback: string) => {
    if (error instanceof Error && error.message) {
        return error.message;
    }
    return fallback;
};

export function useVibePlaylists() {
    const [isBuilding, setIsBuilding] = useState(false);
    const [steps, setSteps] = useState<string[]>([]);
    const [results, setResults] = useState<PlaylistBuildResult[]>([]);
    const [libraryResult, setLibraryResult] = useState<LibraryPlaylistResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isBuildingLibrary, setIsBuildingLibrary] = useState(false);

    const logStep = (message: string) => {
        setSteps(prev => [...prev, message]);
    };

    const resetState = useCallback(() => {
        if (typeof window === "undefined") return;
        localStorage.removeItem(STATE_KEY);
        setSteps([]);
        setResults([]);
        setLibraryResult(null);
        setError(null);
    }, []);

    const buildVibePlaylists = useCallback(async (songs: EnrichedTrack[]) => {
        setIsBuilding(true);
        setSteps([]);
        setResults([]);
        setLibraryResult(null);
        setError(null);

        try {
            const likedSongs = songs
                .filter(track => track.id && track.type === "track" && !track.is_local)
                .map(toTrackSummary);
            const likedIds = new Set(likedSongs.map(track => track.id));

            if (likedSongs.length === 0) {
                setError("No liked songs available. Load your library first.");
                return;
            }

            const state = loadState();
            const analyzedSet = new Set(state.analyzedSongIds);
            const persistedAddedSet = new Set(state.addedTrackIds);
            const runAddedSet = new Set<string>();
            const songToVibes = state.songToVibes ?? {};
            const syncStateSets = () => {
                state.analyzedSongIds = Array.from(analyzedSet);
                state.addedTrackIds = Array.from(new Set([...persistedAddedSet, ...runAddedSet]));
                state.songToVibes = songToVibes;
            };
            const hasVibes = Object.keys(state.vibes).length > 0;
            const geminiUsageByModel = new Map<
                string,
                {
                    promptTokenCount: number;
                    candidatesTokenCount: number;
                    totalTokenCount: number;
                    cachedContentTokenCount: number;
                    requests: number;
                }
            >();
            const ensureUsage = (modelName: string) => {
                const existing = geminiUsageByModel.get(modelName);
                if (existing) return existing;
                const nextUsage = {
                    promptTokenCount: 0,
                    candidatesTokenCount: 0,
                    totalTokenCount: 0,
                    cachedContentTokenCount: 0,
                    requests: 0,
                };
                geminiUsageByModel.set(modelName, nextUsage);
                return nextUsage;
            };

            const newLikedSongs = hasVibes
                ? likedSongs.filter(track => !analyzedSet.has(track.id))
                : likedSongs;

            logStep(`Loaded ${Object.keys(state.vibes).length} vibe playlists.`);
            logStep(`Found ${newLikedSongs.length} new liked songs to analyze.`);

            if (newLikedSongs.length === 0 && hasVibes) {
                logStep("No new songs to process.");
                return;
            }

            const profileResult = await getUserProfileAction();
            if (!profileResult.success || !profileResult.data) {
                setError("Failed to load Spotify profile.");
                return;
            }

            const market = profileResult.data.country || "US";

            const assignments = new Map<string, TrackSummary[]>();
            const unassigned: TrackSummary[] = [];

            if (hasVibes) {
                newLikedSongs.forEach(track => {
                    const matches = pickVibeMatches(track, state.vibes);
                    if (matches.length === 0) {
                        unassigned.push(track);
                        return;
                    }
                    matches.forEach(vibeId => {
                        const existing = assignments.get(vibeId) || [];
                        existing.push(track);
                        assignments.set(vibeId, existing);
                    });
                });
            }

            const clusters = hasVibes ? buildClusters(unassigned) : buildClusters(newLikedSongs);
            if (clusters.length > 0) {
                logStep(`Creating ${clusters.length} new vibe playlist${clusters.length === 1 ? "" : "s"}.`);
            }

            const buildResults: PlaylistBuildResult[] = [];

            for (const [vibeId, tracks] of assignments.entries()) {
                const vibe = state.vibes[vibeId];
                if (!vibe || tracks.length === 0) continue;

                const uniqueTracks = dedupeTracks(tracks);
                uniqueTracks.forEach(track => addSongToVibeMap(songToVibes, track.id, vibeId));
                const urisToAdd = uniqueTracks
                    .filter(track => !persistedAddedSet.has(track.id))
                    .map(track => track.uri);

                if (urisToAdd.length === 0) {
                    uniqueTracks.forEach(track => analyzedSet.add(track.id));
                    syncStateSets();
                    saveState(state);
                    continue;
                }

                logStep(`Updating ${vibe.name} with ${urisToAdd.length} liked songs.`);

                const addResult = await addTracksToPlaylistAction(vibe.playlistId, urisToAdd);
                if (!addResult.success) {
                    logStep(`Failed to update ${vibe.name}.`);
                    continue;
                }

                updateVibeCounts(vibe, uniqueTracks);
                vibe.updatedAt = Date.now();

                uniqueTracks.forEach(track => {
                    analyzedSet.add(track.id);
                    runAddedSet.add(track.id);
                });

                buildResults.push({
                    id: vibe.playlistId,
                    name: vibe.name,
                    url: vibe.playlistUrl,
                    addedLikedCount: urisToAdd.length,
                    addedNewCount: 0,
                });

                syncStateSets();
                saveState(state);
            }

            for (const cluster of clusters) {
                if (cluster.tracks.length === 0) continue;

                const alreadyAdded = cluster.tracks.filter(track => persistedAddedSet.has(track.id));
                const freshTracks = cluster.tracks.filter(track => !persistedAddedSet.has(track.id));

                alreadyAdded.forEach(track => analyzedSet.add(track.id));

                if (freshTracks.length === 0) {
                    logStep(`Skipping ${cluster.key} cluster (songs already in playlists).`);
                    continue;
                }

                const { genreCounts, artistCounts, artistNames } = buildCounts(freshTracks);
                const activeCluster: VibeCluster = {
                    key: cluster.key,
                    tracks: freshTracks,
                    genreCounts,
                    artistCounts,
                    artistNames,
                };

                const summary = createSummary(activeCluster);
                const geminiResult = await getGeminiVibePlanAction(summary.summaryText);
                const modelName = geminiResult?.model || "unknown";
                const usage = ensureUsage(modelName);
                usage.requests += 1;
                if (geminiResult?.usageMetadata) {
                    usage.promptTokenCount += geminiResult.usageMetadata.promptTokenCount || 0;
                    usage.candidatesTokenCount += geminiResult.usageMetadata.candidatesTokenCount || 0;
                    usage.totalTokenCount += geminiResult.usageMetadata.totalTokenCount || 0;
                    if (typeof geminiResult.usageMetadata.cachedContentTokenCount === "number") {
                        usage.cachedContentTokenCount += geminiResult.usageMetadata.cachedContentTokenCount;
                    }
                }

                const rawVibeName = geminiResult.success && geminiResult.vibeName
                    ? geminiResult.vibeName
                    : `${summary.topGenres[0] || "Mixed"} Vibes`;
                const vibeDescription = geminiResult.success && geminiResult.vibeDescription
                    ? geminiResult.vibeDescription
                    : `Inspired by ${summary.topGenres.slice(0, 3).join(", ") || "your liked songs"}.`;

                const trimmedVibeName = rawVibeName.trim();
                const safeVibeName = trimmedVibeName.length > 60
                    ? `${trimmedVibeName.slice(0, 57)}...`
                    : trimmedVibeName;
                const playlistName = `Gemini Vibe - ${safeVibeName}`.slice(0, 100);
                logStep(`Creating playlist "${playlistName}".`);

                const playlistResult = await createPlaylistAction(playlistName, vibeDescription, false);
                if (!playlistResult.success || !playlistResult.data) {
                    logStep(`Failed to create playlist for ${safeVibeName}.`);
                    continue;
                }

                const playlistId = playlistResult.data.id as string;
                const playlistUrl = playlistResult.data.external_urls?.spotify as string | undefined;

                const likedUris = activeCluster.tracks
                    .filter(track => !persistedAddedSet.has(track.id))
                    .map(track => track.uri);

                let suggestedTracks: TrackSummary[] = [];
                if (geminiResult.success && Array.isArray(geminiResult.suggestions)) {
                    const suggestions = geminiResult.suggestions as SpotifyApiTrack[];
                    suggestedTracks = suggestions.map(track => ({
                        id: track.id,
                        name: track.name,
                        artists: track.artists,
                        genres: [],
                        uri: track.uri,
                    }));
                }

                suggestedTracks = dedupeTracks(suggestedTracks)
                    .filter(track => !likedIds.has(track.id))
                    .filter(track => !persistedAddedSet.has(track.id));

                if (suggestedTracks.length < NEW_SONGS_PER_VIBE && summary.topArtistIds.length > 0) {
                    for (const artistId of summary.topArtistIds) {
                        const topTracksResult = await getArtistTopTracksAction(artistId, market);
                        if (!topTracksResult.success || !topTracksResult.data) continue;
                        const topTracks = (topTracksResult.data.tracks || []) as SpotifyApiTrack[];
                        topTracks.forEach(track => {
                            if (suggestedTracks.length >= NEW_SONGS_PER_VIBE) return;
                            if (likedIds.has(track.id) || persistedAddedSet.has(track.id)) return;
                            if (suggestedTracks.find(item => item.id === track.id)) return;
                            suggestedTracks.push({
                                id: track.id,
                                name: track.name,
                                artists: track.artists,
                                genres: [],
                                uri: track.uri,
                            });
                        });
                        if (suggestedTracks.length >= NEW_SONGS_PER_VIBE) break;
                    }
                }

                const newTracks = suggestedTracks.slice(0, NEW_SONGS_PER_VIBE);
                const newUris = newTracks.map(track => track.uri);

                const allUris = Array.from(new Set([...likedUris, ...newUris]));
                logStep(`Adding ${likedUris.length} liked + ${newTracks.length} new songs to ${playlistName}.`);

                const addResult = await addTracksToPlaylistAction(playlistId, allUris);
                if (!addResult.success) {
                    logStep(`Failed to add tracks to ${playlistName}.`);
                    continue;
                }

                const vibeId = createId();
                const newVibe: VibeProfile = {
                    id: vibeId,
                    name: playlistName,
                    description: vibeDescription,
                    playlistId,
                    playlistUrl,
                    genreCounts: { ...activeCluster.genreCounts },
                    artistCounts: { ...activeCluster.artistCounts },
                    suggestedTrackIds: newTracks.map(track => track.id),
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                };

                state.vibes[vibeId] = newVibe;

                activeCluster.tracks.forEach(track => {
                    analyzedSet.add(track.id);
                    runAddedSet.add(track.id);
                    addSongToVibeMap(songToVibes, track.id, vibeId);
                });

                newTracks.forEach(track => {
                    runAddedSet.add(track.id);
                });

                buildResults.push({
                    id: playlistId,
                    name: playlistName,
                    url: playlistUrl,
                    addedLikedCount: likedUris.length,
                    addedNewCount: newTracks.length,
                });

                syncStateSets();
                saveState(state);
            }

            syncStateSets();
            state.lastRunAt = Date.now();
            saveState(state);

            if (geminiUsageByModel.size > 0) {
                let totalPrompt = 0;
                let totalCandidates = 0;
                let totalTokens = 0;
                let totalCost = 0;
                let hasCost = false;
                geminiUsageByModel.forEach((usage, modelName) => {
                    totalPrompt += usage.promptTokenCount;
                    totalCandidates += usage.candidatesTokenCount;
                    totalTokens += usage.totalTokenCount;
                    const cached = usage.cachedContentTokenCount;
                    const cachedText = cached > 0 ? `, cached=${cached}` : "";
                    const estimate = estimateGeminiCost(
                        modelName,
                        usage.promptTokenCount,
                        usage.candidatesTokenCount
                    );
                    if (estimate) {
                        totalCost += estimate.totalCost;
                        hasCost = true;
                    }
                    const costText = estimate ? `, cost=$${estimate.totalCost.toFixed(6)}` : "";
                    console.log(
                        `[Gemini] Build Vibe Playlists (${modelName}): ${usage.requests} request(s), prompt=${usage.promptTokenCount}, candidates=${usage.candidatesTokenCount}, total=${usage.totalTokenCount}${cachedText}${costText}`
                    );
                });
                if (geminiUsageByModel.size > 1) {
                    const totalCostText = hasCost ? `, cost=$${totalCost.toFixed(6)}` : "";
                    console.log(
                        `[Gemini] Build Vibe Playlists (all models): prompt=${totalPrompt}, candidates=${totalCandidates}, total=${totalTokens}${totalCostText}`
                    );
                }
            }

            setResults(buildResults);
        } catch (err) {
            console.error("Error building vibe playlists", err);
            setError(getErrorMessage(err, "Failed to build playlists."));
        } finally {
            setIsBuilding(false);
        }
    }, []);

    const buildLibraryPlaylist = useCallback(async (songs: EnrichedTrack[]) => {
        setIsBuildingLibrary(true);
        setSteps([]);
        setResults([]);
        setLibraryResult(null);
        setError(null);

        try {
            const likedSongs = songs
                .filter(track => track.id && track.type === "track" && !track.is_local)
                .map(toTrackSummary);

            if (likedSongs.length === 0) {
                setError("No liked songs available. Load your library first.");
                return;
            }

            const state = loadState();
            const songToVibes = state.songToVibes ?? {};
            const vibeEntries = Object.entries(state.vibes || {}).sort((a, b) =>
                a[1].name.localeCompare(b[1].name)
            );
            const hasVibes = vibeEntries.length > 0;

            const grouped: Record<string, TrackSummary[]> = {};
            const fallback: Record<string, TrackSummary[]> = {};

            likedSongs.forEach(track => {
                const savedVibes = songToVibes[track.id]?.filter(vibeId => state.vibes[vibeId]);
                if (savedVibes && savedVibes.length > 0) {
                    const vibeId = savedVibes[0];
                    if (!grouped[vibeId]) grouped[vibeId] = [];
                    grouped[vibeId].push(track);
                    return;
                }

                if (hasVibes) {
                    const matches = pickVibeMatches(track, state.vibes);
                    if (matches.length > 0) {
                        const vibeId = matches[0];
                        if (!grouped[vibeId]) grouped[vibeId] = [];
                        grouped[vibeId].push(track);
                        addSongToVibeMap(songToVibes, track.id, vibeId);
                        return;
                    }
                }

                const fallbackKey = `genre:${getPrimaryGenre(track)}`;
                if (!fallback[fallbackKey]) fallback[fallbackKey] = [];
                fallback[fallbackKey].push(track);
            });

            const orderedTracks: TrackSummary[] = [];
            vibeEntries.forEach(([vibeId]) => {
                const group = grouped[vibeId];
                if (group && group.length > 0) {
                    orderedTracks.push(...group);
                }
            });

            const fallbackEntries = Object.entries(fallback).sort((a, b) => b[1].length - a[1].length);
            fallbackEntries.forEach(([, group]) => orderedTracks.push(...group));

            if (orderedTracks.length === 0) {
                setError("Could not build a vibe-ordered playlist.");
                return;
            }

            const description =
                "All liked songs grouped by vibe. Generated by Gemini using your saved vibe profiles.";

            let playlistId = state.bigPlaylist?.id;
            const playlistName = state.bigPlaylist?.name || "Gemini Library - Vibe Order";
            let playlistUrl = state.bigPlaylist?.url;

            if (!playlistId) {
                logStep(`Creating library playlist \"${playlistName}\".`);
                const createResult = await createPlaylistAction(playlistName, description, false);
                if (!createResult.success || !createResult.data) {
                    setError("Failed to create the library playlist.");
                    return;
                }
                playlistId = createResult.data.id as string;
                playlistUrl = createResult.data.external_urls?.spotify as string | undefined;
            } else {
                logStep(`Updating library playlist \"${playlistName}\".`);
            }

            const orderedUris = orderedTracks.map(track => track.uri);
            const replaceResult = await replacePlaylistTracksAction(playlistId, orderedUris);
            if (!replaceResult.success) {
                setError("Failed to update the library playlist.");
                return;
            }

            state.songToVibes = songToVibes;
            state.bigPlaylist = {
                id: playlistId,
                name: playlistName,
                url: playlistUrl,
                updatedAt: Date.now(),
            };
            saveState(state);

            setLibraryResult({
                id: playlistId,
                name: playlistName,
                url: playlistUrl,
                totalTracks: orderedUris.length,
                groupCount: vibeEntries.length + fallbackEntries.length,
            });
        } catch (err) {
            console.error("Error building library playlist", err);
            setError(getErrorMessage(err, "Failed to build library playlist."));
        } finally {
            setIsBuildingLibrary(false);
        }
    }, []);

    return {
        isBuilding,
        isBuildingLibrary,
        steps,
        results,
        libraryResult,
        error,
        buildVibePlaylists,
        buildLibraryPlaylist,
        resetState,
    };
}
