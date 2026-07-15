"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { getLibraryEnrichmentAction, getLikedSongsAction, getUserProfileAction, signOutAction } from "@/app/actions";
import {
    compactLibraryTrack,
    LIBRARY_CACHE_KEY,
    persistLibraryCache,
} from "@/lib/libraryCache";
import { SpotifyTrack } from "@/lib/spotify";
import type { TrackAudioFeatures } from "@/types/audio";

interface SpotifySavedTrackItem {
    track: SpotifyTrack | null;
    added_at: string;
}

interface SpotifySavedTracksResponse {
    items: SpotifySavedTrackItem[];
    total: number;
}

interface SpotifyArtist {
    id: string;
    genres?: string[];
}

interface LikedSongsActionResult {
    success: boolean;
    data?: SpotifySavedTracksResponse;
    status?: number;
}

export interface EnrichedTrack extends SpotifyTrack {
    features: TrackAudioFeatures | null;
    genres: string[];
    added_at?: string;
}

export function useSpotifyLibrary() {
    const [songs, setSongs] = useState<EnrichedTrack[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [progress, setProgress] = useState(0);
    const [total, setTotal] = useState(0);
    const [offset, setOffset] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const locallyPromotedIds = useRef(new Set<string>());
    const libraryCacheDisabled = useRef(false);

    const BATCH_SIZE = 50;

    // Persist only settled state; saving every loading increment is quadratic.
    useEffect(() => {
        if (
            songs.length > 0 &&
            !isLoading &&
            !isLoadingMore &&
            !libraryCacheDisabled.current
        ) {
            const persisted = persistLibraryCache(localStorage, {
                hasMore,
                offset,
                songs,
                total,
                timestamp: Date.now(),
            });
            if (!persisted) {
                libraryCacheDisabled.current = true;
                console.warn(
                    "Liked-song cache exceeded browser storage; continuing without it.",
                );
            }
        }
    }, [hasMore, isLoading, isLoadingMore, offset, songs, total]);

    const fetchTracksAndEnrich = async (currentOffset: number, currentLimit: number) => {
        // 1. Fetch Liked Songs
        const result = await getLikedSongsAction(currentLimit, currentOffset) as LikedSongsActionResult;

        if (!result.success || !result.data || !result.data.items || result.data.items.length === 0) {
            if (result.status === 401) {
                localStorage.removeItem(LIBRARY_CACHE_KEY);
                await signOutAction();
                return null;
            }
            return { tracks: [], total: 0 };
        }

        type TrackWithAddedAt = SpotifyTrack & { added_at: string };
        const newTracks = result.data.items
            .map((item) => (item.track ? { ...item.track, added_at: item.added_at } : null))
            .filter((track): track is TrackWithAddedAt => Boolean(track));

        const validTracks = newTracks.filter((track) => track.id && track.type === "track" && !track.is_local);

        // 2. Fetch Artists to get Genres (Batching)
        const artistIds = new Set<string>();
        validTracks.forEach((track) => {
            track.artists.forEach((artist) => artistIds.add(artist.id));
        });

        const uniqueArtistIds = Array.from(artistIds);
        const artistMap = new Map<string, string[]>();

        const enrichment = await getLibraryEnrichmentAction(
            validTracks.map((track) => track.id),
            uniqueArtistIds,
        );
        (enrichment.artists as SpotifyArtist[]).forEach((artist) => {
            if (artist?.id) {
                artistMap.set(artist.id, artist.genres ?? []);
            }
        });
        const audioFeatures = new Map<string, TrackAudioFeatures>(
            enrichment.audioFeatures.map(({ id, energy, tempo }) => [
                id,
                { energy, tempo },
            ]),
        );

        // 3. Merge Genres into Tracks
        const enrichedTracks: EnrichedTrack[] = validTracks.map((track) => {
            const genreCounts = new Map<string, number>();
            track.artists.forEach((artist) => {
                const genres = artistMap.get(artist.id);
                if (genres) {
                    genres.forEach(g => {
                        genreCounts.set(g, (genreCounts.get(g) ?? 0) + 1);
                    });
                }
            });

            const sortedGenres = Array.from(genreCounts.entries())
                .sort((a, b) => b[1] - a[1])
                .map(([genre]) => genre);

            return compactLibraryTrack({
                ...track,
                features: audioFeatures.get(track.id) ?? null,
                genres: sortedGenres
            });
        });

        return { tracks: enrichedTracks, total: result.data.total };
    };

    const fetchLibrary = useCallback(async () => {
        setIsLoading(true);
        setProgress(0);
        setSongs([]);
        setOffset(0);
        setHasMore(true);

        try {
            // Verify token first
            const profileResult = await getUserProfileAction();
            if (!profileResult.success && profileResult.status === 401) {
                localStorage.removeItem(LIBRARY_CACHE_KEY);
                await signOutAction();
                return;
            }

            // Check cache first
            const cached = localStorage.getItem(LIBRARY_CACHE_KEY);
            if (cached) {
                try {
                    const { songs: cachedSongs, total: cachedTotal, offset: cachedOffset, hasMore: cachedHasMore } = JSON.parse(cached);
                    if (cachedSongs && cachedSongs.length > 0) {
                        setSongs((cachedSongs as EnrichedTrack[]).map(compactLibraryTrack));
                        setTotal(cachedTotal);
                        setOffset(cachedOffset);
                        setHasMore(cachedHasMore);
                        setIsLoading(false);
                        setProgress(100);
                        return;
                    }
                } catch (e) {
                    console.error("Failed to parse library cache", e);
                    localStorage.removeItem(LIBRARY_CACHE_KEY);
                }
            }

            const result = await fetchTracksAndEnrich(0, BATCH_SIZE);

            if (result) {
                setSongs(result.tracks);
                setTotal(result.total);
                setOffset(BATCH_SIZE);
                if (result.tracks.length < BATCH_SIZE || result.tracks.length >= result.total) {
                    setHasMore(false);
                }
            } else {
                setHasMore(false);
            }

        } catch (error) {
            console.error("Error fetching library:", error);
        } finally {
            setIsLoading(false);
            setProgress(100);
        }
    }, []);

    const loadMore = useCallback(async () => {
        if (isLoadingMore || !hasMore) return;

        setIsLoadingMore(true);
        try {
            const result = await fetchTracksAndEnrich(offset, BATCH_SIZE);

            if (result) {
                setSongs(prev => [...prev, ...result.tracks]);
                setOffset(prev => prev + BATCH_SIZE);

                if (result.tracks.length < BATCH_SIZE || songs.length + result.tracks.length >= result.total) {
                    setHasMore(false);
                }
            } else {
                setHasMore(false);
            }
        } catch (error) {
            console.error("Error loading more songs:", error);
        } finally {
            setIsLoadingMore(false);
        }
    }, [offset, hasMore, isLoadingMore, songs.length]);

    const loadAll = useCallback(async () => {
        setIsLoading(true);
        setProgress(0);
        setSongs([]);
        setOffset(0);
        setHasMore(true);

        try {
            const profileResult = await getUserProfileAction();
            if (!profileResult.success && profileResult.status === 401) {
                localStorage.removeItem(LIBRARY_CACHE_KEY);
                await signOutAction();
                return [];
            }

            const cached = localStorage.getItem(LIBRARY_CACHE_KEY);
            if (cached) {
                try {
                    const { songs: cachedSongs, total: cachedTotal, hasMore: cachedHasMore } = JSON.parse(cached);
                    if (cachedSongs && cachedSongs.length > 0 && cachedHasMore === false) {
                        const compactCachedSongs = (cachedSongs as EnrichedTrack[]).map(
                            compactLibraryTrack,
                        );
                        setSongs(compactCachedSongs);
                        setTotal(cachedTotal);
                        setOffset(compactCachedSongs.length);
                        setHasMore(false);
                        setIsLoading(false);
                        setProgress(100);
                        return compactCachedSongs;
                    }
                } catch (e) {
                    console.error("Failed to parse library cache", e);
                    localStorage.removeItem(LIBRARY_CACHE_KEY);
                }
            }

            const allTracks: EnrichedTrack[] = [];
            let currentOffset = 0;
            let totalCount = 0;

            while (true) {
                const result = await fetchTracksAndEnrich(currentOffset, BATCH_SIZE);

                if (!result || result.tracks.length === 0) {
                    break;
                }

                if (totalCount === 0) {
                    totalCount = result.total;
                    setTotal(result.total);
                }

                allTracks.push(...result.tracks);
                setSongs([...allTracks]);
                currentOffset += BATCH_SIZE;
                setOffset(currentOffset);
                setProgress(Math.min(100, Math.round((allTracks.length / totalCount) * 100)));

                if (allTracks.length >= totalCount) {
                    break;
                }
            }

            setHasMore(allTracks.length < totalCount);
            return allTracks;
        } catch (error) {
            console.error("Error loading full library:", error);
            return [];
        } finally {
            setIsLoading(false);
            setProgress(100);
        }
    }, []);

    const promoteSavedTrack = useCallback((track: EnrichedTrack) => {
        const compactTrack = compactLibraryTrack(track);
        if (locallyPromotedIds.current.has(compactTrack.id)) return;
        locallyPromotedIds.current.add(compactTrack.id);
        setSongs((current) =>
            current.some((song) => song.id === compactTrack.id)
                ? current
                : [compactTrack, ...current],
        );
        setTotal((current) => current + 1);
        setOffset((current) => current + 1);
    }, []);

    return { songs, isLoading, isLoadingMore, hasMore, progress, total, fetchLibrary, loadMore, loadAll, promoteSavedTrack };
}
