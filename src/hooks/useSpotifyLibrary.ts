"use client";

import { useState, useCallback, useEffect } from "react";
import { getLikedSongsAction, getArtistsAction, getUserProfileAction } from "@/app/actions";
import { SpotifyTrack } from "@/lib/spotify";
import { useSpotifyAuth } from "@/hooks/useSpotifyAuth";

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
    features: null; // Deprecated/Restricted
    genres: string[];
}

export function useSpotifyLibrary() {
    const { ensureValidToken, signOut } = useSpotifyAuth();
    const [songs, setSongs] = useState<EnrichedTrack[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [progress, setProgress] = useState(0);
    const [total, setTotal] = useState(0);
    const [offset, setOffset] = useState(0);
    const [hasMore, setHasMore] = useState(true);

    const BATCH_SIZE = 50;
    const LIBRARY_CACHE_KEY = 'spotify_library_cache';

    // Save to cache whenever state changes
    useEffect(() => {
        if (songs.length > 0) {
            localStorage.setItem(LIBRARY_CACHE_KEY, JSON.stringify({
                songs,
                total,
                offset,
                hasMore,
                timestamp: Date.now()
            }));
        }
    }, [songs, total, offset, hasMore]);

    const fetchTracksAndEnrich = useCallback(async (currentOffset: number, currentLimit: number) => {
        const token = await ensureValidToken();
        if (!token) {
            return { tracks: [], total: 0 };
        }
        // 1. Fetch Liked Songs
        const result = await getLikedSongsAction(currentLimit, currentOffset, token) as LikedSongsActionResult;

        if (!result.success || !result.data || !result.data.items || result.data.items.length === 0) {
            if (result.status === 401) {
                localStorage.removeItem(LIBRARY_CACHE_KEY);
                await signOut();
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

        for (let i = 0; i < uniqueArtistIds.length; i += BATCH_SIZE) {
            const batch = uniqueArtistIds.slice(i, i + BATCH_SIZE);
            const artists = await getArtistsAction(batch, token) as SpotifyArtist[];

            artists.forEach((artist) => {
                if (artist?.id) {
                    artistMap.set(artist.id, artist.genres ?? []);
                }
            });
        }

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

            return {
                ...track,
                features: null,
                genres: sortedGenres
            };
        });

        return { tracks: enrichedTracks, total: result.data.total };
    }, [ensureValidToken, signOut]);

    const fetchLibrary = useCallback(async () => {
        setIsLoading(true);
        setProgress(0);
        setSongs([]);
        setOffset(0);
        setHasMore(true);

        try {
            // Verify token first
            const token = await ensureValidToken();
            if (!token) {
                return;
            }
            const profileResult = await getUserProfileAction(token);
            if (!profileResult.success && profileResult.status === 401) {
                localStorage.removeItem(LIBRARY_CACHE_KEY);
                await signOut();
                return;
            }

            // Check cache first
            const cached = localStorage.getItem(LIBRARY_CACHE_KEY);
            if (cached) {
                try {
                    const { songs: cachedSongs, total: cachedTotal, offset: cachedOffset, hasMore: cachedHasMore } = JSON.parse(cached);
                    if (cachedSongs && cachedSongs.length > 0) {
                        setSongs(cachedSongs);
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
    }, [ensureValidToken, fetchTracksAndEnrich, signOut]);

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
    }, [offset, hasMore, isLoadingMore, songs.length, fetchTracksAndEnrich]);

    const loadAll = useCallback(async () => {
        setIsLoading(true);
        setProgress(0);
        setSongs([]);
        setOffset(0);
        setHasMore(true);

        try {
            const token = await ensureValidToken();
            if (!token) {
                return [];
            }
            const profileResult = await getUserProfileAction(token);
            if (!profileResult.success && profileResult.status === 401) {
                localStorage.removeItem(LIBRARY_CACHE_KEY);
                await signOut();
                return [];
            }

            const cached = localStorage.getItem(LIBRARY_CACHE_KEY);
            if (cached) {
                try {
                    const { songs: cachedSongs, total: cachedTotal, hasMore: cachedHasMore } = JSON.parse(cached);
                    if (cachedSongs && cachedSongs.length > 0 && cachedHasMore === false) {
                        setSongs(cachedSongs);
                        setTotal(cachedTotal);
                        setOffset(cachedSongs.length);
                        setHasMore(false);
                        setIsLoading(false);
                        setProgress(100);
                        return cachedSongs as EnrichedTrack[];
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
    }, [ensureValidToken, signOut, fetchTracksAndEnrich]);

    return { songs, isLoading, isLoadingMore, hasMore, progress, total, fetchLibrary, loadMore, loadAll };
}
