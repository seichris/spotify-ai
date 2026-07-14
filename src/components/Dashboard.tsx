"use client";

import { useSpotifyLibrary } from "@/hooks/useSpotifyLibrary";
import { useVibePlaylists } from "@/hooks/useVibePlaylists";
import { usePlayer } from "@/components/PlayerProvider";
import { Button } from "@/components/ui/Button";
import SongNetwork from "@/components/SongNetwork";
import { Loader2, Play, SkipBack, Pause, SkipForward, Sparkles } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { EnrichedTrack } from "@/hooks/useSpotifyLibrary";
import { SpotifyTrack } from "@/lib/spotify";
import { signOutAction, getGeminiSuggestionsAction } from "@/app/actions";

type GeminiCacheEntry = {
    text?: string;
    suggestions?: SpotifyTrack[];
};

export default function Dashboard() {
    const { songs, isLoading, isLoadingMore, hasMore, progress, total, loadMore, loadAll, promoteSavedTrack } = useSpotifyLibrary();
    const { isActive, isPaused, playTrack, togglePlay, nextTrack, previousTrack } = usePlayer();
    const [selectedSong, setSelectedSong] = useState<EnrichedTrack | null>(null);
    const [viewMode, setViewMode] = useState<"recommends" | "sort" | "network">("network");
    const observerTarget = useRef<HTMLDivElement | null>(null);
    const libraryLoadStarted = useRef(false);
    const [isPreparingLibrary, setIsPreparingLibrary] = useState(false);

    const {
        isBuilding,
        steps,
        results,
        error,
        buildVibePlaylists,
        resetState,
    } = useVibePlaylists();

    const isFullLibraryLoaded = total > 0 && songs.length >= total && !hasMore;

    const [isGeminiLoading, setIsGeminiLoading] = useState(false);
    const [cachedSuggestionsMap, setCachedSuggestionsMap] = useState<Record<string, SpotifyTrack[]>>({});

    useEffect(() => {
        if (libraryLoadStarted.current) return;
        libraryLoadStarted.current = true;
        void loadAll();
    }, [loadAll]);

    // Load cached suggestions for visible songs
    useEffect(() => {
        if (songs.length > 0) {
            const newCacheMap: Record<string, SpotifyTrack[]> = {};
            songs.forEach(song => {
                const cacheKey = `gemini_cache_${song.id}`;
                const cachedData = localStorage.getItem(cacheKey);
                if (cachedData) {
                    try {
                        const parsed = JSON.parse(cachedData) as GeminiCacheEntry;
                        if (Array.isArray(parsed.suggestions) && parsed.suggestions.length > 0) {
                            newCacheMap[song.id] = parsed.suggestions;
                        }
                    } catch {
                        // Ignore parse errors
                    }
                }
            });
            setCachedSuggestionsMap(prev => ({ ...prev, ...newCacheMap }));
        }
    }, [songs]);

    useEffect(() => {
        const observer = new IntersectionObserver(
            entries => {
                if (entries[0].isIntersecting && hasMore && !isLoadingMore) {
                    loadMore();
                }
            },
            { threshold: 0.1 }
        );

        const currentTarget = observerTarget.current;
        if (currentTarget) {
            observer.observe(currentTarget);
        }

        return () => {
            if (currentTarget) {
                observer.unobserve(currentTarget);
            }
        };
    }, [hasMore, isLoadingMore, loadMore]);

    const handleSongClick = async (song: EnrichedTrack) => {
        if (selectedSong?.id === song.id) {
            // Toggle off if clicking same song
            setSelectedSong(null);
            return;
        }

        setSelectedSong(song);
        setIsGeminiLoading(true);

        // Check LocalStorage first
        const cacheKey = `gemini_cache_${song.id}`;
        const cachedData = localStorage.getItem(cacheKey);

        if (cachedData) {
            try {
                const parsed = JSON.parse(cachedData) as GeminiCacheEntry;
                if (Array.isArray(parsed.suggestions)) {
                    setCachedSuggestionsMap(prev => ({
                        ...prev,
                        [song.id]: parsed.suggestions ?? []
                    }));
                }
                setIsGeminiLoading(false);
                return;
            } catch (error) {
                console.error("Failed to parse cached data", error);
                localStorage.removeItem(cacheKey);
            }
        }

        const result = await getGeminiSuggestionsAction(song.name, song.artists[0].name);

        if (result.success && Array.isArray(result.suggestions)) {
            const suggestions = result.suggestions as SpotifyTrack[];

            // Save to LocalStorage
            localStorage.setItem(cacheKey, JSON.stringify({
                text: result.text,
                suggestions,
                timestamp: Date.now()
            }));

            // Update cache map
            setCachedSuggestionsMap(prev => ({
                ...prev,
                [song.id]: suggestions
            }));
        }

        setIsGeminiLoading(false);
    };

    const handleBuildVibes = async () => {
        if (isBuilding || isPreparingLibrary) return;
        setIsPreparingLibrary(true);
        let allSongs: EnrichedTrack[] = [];
        try {
            allSongs = await loadAll();
        } finally {
            setIsPreparingLibrary(false);
        }
        const library = allSongs.length > 0 ? allSongs : songs;
        await buildVibePlaylists(library);
    };

    if (isLoading && songs.length === 0 && viewMode === "recommends") {
        return (
            <div className="flex h-screen flex-col items-center justify-center bg-black text-white">
                <Loader2 className="h-10 w-10 animate-spin text-green-500" />
                <p className="mt-4 text-zinc-400">Loading your library... {Math.round(progress)}%</p>
                <Button variant="outline" className="mt-8" onClick={() => {
                    localStorage.removeItem('spotify_library_cache');
                    signOutAction();
                }}>X</Button>
            </div>
        );
    }

    return (
        <div className={`min-h-screen bg-zinc-950 text-white relative ${viewMode === "network" ? "overflow-hidden" : "p-8 pb-32"}`}>
            {/* Floating Header Navigation */}
            <div className="fixed top-6 left-1/2 -translate-x-1/2 flex items-center gap-2 z-50 rounded-full border border-white/10 bg-black/75 p-1.5 shadow-xl backdrop-blur-md">
                {/* <button
                    onClick={() => setViewMode('recommends')}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${viewMode === 'recommends' ? 'bg-white text-black shadow-sm' : 'text-zinc-400 hover:text-white hover:bg-zinc-900'}`}
                >
                    Recommends
                </button> */}
                <button
                    onClick={() => setViewMode('sort')}
                    disabled={!isFullLibraryLoaded}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${viewMode === 'sort' ? 'bg-white text-black shadow-sm' : 'text-zinc-400 hover:text-white hover:bg-zinc-900'} ${!isFullLibraryLoaded ? 'opacity-50 cursor-not-allowed hover:text-zinc-400 hover:bg-transparent' : ''}`}
                >
                    Vibe Playlists
                </button>
                <button
                    onClick={() => setViewMode("network")}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${viewMode === "network" ? "bg-white text-black shadow-sm" : "text-zinc-400 hover:text-white hover:bg-zinc-900"}`}
                >
                    Network Map
                </button>
                <button
                    onClick={() => {
                        localStorage.removeItem('spotify_library_cache');
                        signOutAction();
                    }}
                    className="px-4 py-2 rounded-full text-sm font-medium transition-all text-zinc-400 hover:text-white hover:bg-zinc-900"
                >
                    X
                </button>
            </div>

            <div className={viewMode === "network" ? "fixed inset-0" : "max-w-4xl mx-auto mt-24"}>
                {viewMode === "recommends" ? (
                    <div className="space-y-2">
                        {/* <div className="flex justify-between items-end mb-6 px-2">
                            <div>
                                <h1 className="text-2xl font-bold tracking-tight">Your Liked Songs</h1>
                                <p className="text-sm text-zinc-400">
                                    {isLoading ? `Analyzing... ${Math.round(progress)}%` : `${songs.length} songs`}
                                </p>
                            </div>
                        </div> */}
                        {songs.map((song) => (
                            <div key={song.id} className="group bg-zinc-900/30 rounded-md overflow-hidden transition-colors">
                                <div className="grid grid-cols-[30%_70%] min-h-24">
                                    {/* Left Column: Song Info */}
                                    <div
                                        onClick={() => handleSongClick(song)}
                                        className={`flex items-start p-3 cursor-pointer hover:bg-zinc-800/50 transition-colors h-full ${selectedSong?.id === song.id ? "bg-zinc-800/80" : ""}`}
                                    >
                                        <div
                                            role="img"
                                            aria-label={`${song.album.name} cover`}
                                            className="mr-4 h-16 w-16 shrink-0 rounded bg-zinc-800 bg-cover bg-center shadow-sm"
                                            style={song.album.images[2]?.url ? { backgroundImage: `url(${song.album.images[2].url})` } : undefined}
                                        />
                                        <div className="flex-1 min-w-0 overflow-hidden">
                                            <p className={`font-medium truncate ${selectedSong?.id === song.id ? "text-green-400" : "text-zinc-200"}`}>{song.name}</p>
                                            <p className="text-sm text-zinc-500 truncate">
                                                {song.artists.map(a => a.name).join(", ")}
                                            </p>
                                            {song.genres && song.genres.length > 0 && (
                                                <div className="flex gap-1 mt-1 overflow-hidden">
                                                    {song.genres.slice(0, 2).map(g => (
                                                        <span key={g} className="text-[10px] text-zinc-500 bg-zinc-900 px-1.5 py-0.5 rounded-full whitespace-nowrap">{g}</span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Right Column: Recommendations */}
                                    <div className="flex flex-col justify-center px-4 py-2 h-full bg-zinc-950/20 overflow-hidden">
                                        {selectedSong?.id === song.id && isGeminiLoading ? (
                                            <div className="flex items-center text-zinc-500 text-sm animate-pulse h-full">
                                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                Analyzing...
                                            </div>
                                        ) : cachedSuggestionsMap[song.id] ? (
                                            <div className="flex flex-col gap-2 w-full">
                                                {/* Suggested Songs - Horizontal Scroll */}
                                                <div className="flex gap-3 items-center overflow-x-auto scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent pb-2">
                                                {cachedSuggestionsMap[song.id].map((suggestion: SpotifyTrack) => (
                                                    <div
                                                        key={suggestion.id}
                                                        className="flex flex-col justify-center min-w-[140px] h-20 p-2 bg-zinc-900/80 rounded-md cursor-pointer hover:bg-zinc-800 transition-all group relative shrink-0"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            void playTrack(suggestion.uri).catch((playbackError) => {
                                                                console.error("Could not start Spotify playback", playbackError);
                                                            });
                                                        }}
                                                    >
                                                        <div className="flex items-center gap-2 mb-1">
                                                            {suggestion.album.images[2] && (
                                                                <div
                                                                    role="img"
                                                                    aria-label={`${suggestion.name} cover`}
                                                                    className="h-8 w-8 rounded bg-zinc-800 bg-cover bg-center shadow-sm"
                                                                    style={{ backgroundImage: `url(${suggestion.album.images[2].url})` }}
                                                                />
                                                            )}
                                                            <div className="overflow-hidden">
                                                                <p className="text-xs font-medium text-zinc-300 group-hover:text-white truncate">
                                                                    {suggestion.name}
                                                                </p>
                                                                <p className="text-[10px] text-zinc-500 truncate">
                                                                    {suggestion.artists.map((artist) => artist.name).join(", ")}
                                                                </p>
                                                            </div>
                                                        </div>
                                                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20 rounded-md">
                                                                <Play className="w-6 h-6 fill-white text-white drop-shadow-md" />
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>

                                                {/* Gemini Text Card */}
                                                {selectedSong?.id === song.id && (() => {
                                                    const cacheKey = `gemini_cache_${song.id}`;
                                                    const cachedData = localStorage.getItem(cacheKey);
                                                    let text = "";
                                                    if (cachedData) {
                                                        try {
                                                            const parsed = JSON.parse(cachedData) as GeminiCacheEntry;
                                                            text = parsed.text ?? "";
                                                        } catch { }
                                                    }
                                                    return text ? (
                                                        <div className="w-full p-2 bg-zinc-900/40 rounded-md text-[10px] text-zinc-400 leading-tight whitespace-pre-wrap animate-in fade-in slide-in-from-top-1 duration-300">
                                                            {text}
                                                        </div>
                                                    ) : null;
                                                })()}
                                            </div>
                                        ) : (
                                            <div
                                                className="text-xs text-zinc-500 italic pl-2 flex items-center h-full cursor-pointer hover:text-zinc-300 transition-colors"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleSongClick(song);
                                                }}
                                            >
                                                Find similar songs
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}

                        {/* Load More Button / Sentinel */}
                        {hasMore && (
                            <div ref={observerTarget} className="flex justify-center pt-8 pb-4">
                                <Button
                                    variant="outline"
                                    onClick={loadMore}
                                    disabled={isLoadingMore}
                                    className="w-full md:w-auto min-w-[200px] text-zinc-400"
                                >
                                    {isLoadingMore ? (
                                        <>
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            Loading more songs...
                                        </>
                                    ) : (
                                        "Load More"
                                        // {Currently `${songs.length} songs. Load more!`}
                                    )}
                                </Button>
                            </div>
                        )}
                    </div>
                ) : viewMode === "sort" ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center space-y-6 animate-in fade-in duration-500">
                        <div className="p-4 bg-zinc-900/50 rounded-full">
                            <Sparkles className="w-8 h-8 text-purple-400" />
                        </div>
                        <div className="max-w-xl space-y-2">
                            <h2 className="text-xl font-bold">AI Playlist Sorter</h2>
                            <p className="text-zinc-400 leading-relaxed">
                                Build vibe playlists from your liked songs, then add 10 new tracks that match each vibe.
                            </p>
                            <p className="text-xs text-zinc-500">
                                {total > 0 ? `${songs.length} / ${total}` : songs.length} liked songs loaded.
                            </p>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-3">
                            <Button
                                variant="primary"
                                isLoading={isPreparingLibrary || isBuilding}
                                onClick={handleBuildVibes}
                                disabled={isPreparingLibrary || isBuilding}
                            >
                                {isPreparingLibrary ? "Loading Library..." : "Build Vibe Playlists"}
                            </Button>
                            {/* <Button
                                variant="secondary"
                                onClick={handleBuildLibraryPlaylist}
                            >
                                Build Library Playlist
                            </Button> */}
                            <Button
                                variant="outline"
                                onClick={resetState}
                                disabled={isPreparingLibrary || isBuilding}
                            >
                                Reset Vibe Cache
                            </Button>
                        </div>

                        {(isPreparingLibrary || isLoading) && (
                            <p className="text-xs text-zinc-400">
                                Loading library... {Math.round(progress)}%
                            </p>
                        )}

                        {error && (
                            <p className="text-sm text-red-400">{error}</p>
                        )}

                        {steps.length > 0 && (
                            <div className="w-full max-w-xl bg-zinc-900/50 rounded-lg p-4 text-left">
                                <h3 className="text-sm font-semibold text-zinc-200">Progress</h3>
                                <ul className="mt-2 space-y-1 list-disc list-inside text-xs text-zinc-400">
                                    {steps.map((step, index) => (
                                        <li key={`${step}-${index}`}>{step}</li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {results.length > 0 && (
                            <div className="w-full max-w-xl space-y-2">
                                <h3 className="text-sm font-semibold text-zinc-200">Playlists</h3>
                                {results.map(result => (
                                    <div
                                        key={result.id}
                                        className="flex items-center justify-between gap-4 bg-zinc-900/40 rounded-md p-3"
                                    >
                                        <div className="text-left">
                                            <p className="text-sm font-medium text-white">{result.name}</p>
                                            <p className="text-xs text-zinc-500">
                                                {result.addedLikedCount} liked · {result.addedNewCount} new
                                            </p>
                                        </div>
                                        {result.url && (
                                            <a
                                                href={result.url}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="text-xs text-green-400 hover:text-green-300"
                                            >
                                                Open
                                            </a>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* {libraryResult && (
                            <div className="w-full max-w-xl space-y-2">
                                <h3 className="text-sm font-semibold text-zinc-200">Library Playlist</h3>
                                <div className="flex items-center justify-between gap-4 bg-zinc-900/40 rounded-md p-3">
                                    <div className="text-left">
                                        <p className="text-sm font-medium text-white">{libraryResult.name}</p>
                                        <p className="text-xs text-zinc-500">
                                            {libraryResult.totalTracks} songs · {libraryResult.groupCount} groups
                                        </p>
                                    </div>
                                    {libraryResult.url && (
                                        <a
                                            href={libraryResult.url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="text-xs text-green-400 hover:text-green-300"
                                        >
                                            Open
                                        </a>
                                    )}
                                </div>
                            </div>
                        )} */}
                    </div>
                ) : (
                    <div className="h-full w-full animate-in fade-in duration-500">
                        <SongNetwork
                            songs={isFullLibraryLoaded ? songs : []}
                            onCandidateSaved={promoteSavedTrack}
                            onPlaySong={async (song) => {
                                try {
                                    await playTrack(song.uri);
                                    return true;
                                } catch (playbackError) {
                                    console.error("Could not start Spotify playback", playbackError);
                                    return false;
                                }
                            }}
                        />
                    </div>
                )}
            </div>

            {/* Floating Player Controls */}
            <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center justify-center gap-3 rounded-full border border-white/10 bg-black/75 p-1.5 shadow-xl backdrop-blur-md">
                <Button variant="ghost" size="icon" onClick={previousTrack} disabled={!isActive} className="hover:text-white text-zinc-400">
                    <SkipBack className="h-5 w-5" />
                </Button>
                <Button variant="primary" size="icon" className="rounded-full h-10 w-10" onClick={togglePlay} disabled={!isActive}>
                    {isPaused ? <Play className="h-5 w-5 fill-black ml-0.5" /> : <Pause className="h-5 w-5 fill-black" />}
                </Button>
                <Button variant="ghost" size="icon" onClick={nextTrack} disabled={!isActive} className="hover:text-white text-zinc-400">
                    <SkipForward className="h-5 w-5" />
                </Button>
            </div>
        </div >
    );
}
