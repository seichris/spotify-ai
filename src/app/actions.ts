"use server";

import { fetchSpotify, getLikedSongs, getAudioFeatures, searchSpotify } from "@/lib/spotify";
import { generateSongSuggestions } from "@/lib/gemini";

export async function getLikedSongsAction(limit: number, offset: number) {
    try {
        const data = await getLikedSongs(limit, offset);
        return { success: true, data };
    } catch (error: any) {
        console.error("Error fetching liked songs:", error);
        const status = error.message.includes("401") || error.message.toLowerCase().includes("expired") ? 401 : 500;
        return { success: false, error: "Failed to fetch songs", status };
    }
}

export async function getAudioFeaturesAction(ids: string[]) {
    try {
        const data = await getAudioFeatures(ids);
        return { success: true, data };
    } catch (error) {
        console.error("Error fetching audio features:", error);
        return { success: false, error: "Failed to fetch audio features" };
    }
}

export async function getUserProfileAction() {
    try {
        const data = await fetchSpotify("/me");
        return { success: true, data };
    } catch (error: any) {
        console.error("Error fetching user profile:", error);
        const status = error.message.includes("401") || error.message.toLowerCase().includes("expired") ? 401 : 500;
        return { success: false, error: "Failed to fetch user profile", status };
    }
}

export async function getTrackAction(trackId: string) {
    try {
        const data = await fetchSpotify(`/tracks/${trackId}`);
        return { success: true, data };
    } catch (error: any) {
        console.error("Error fetching track:", error);
        const status = error.message.includes("401") || error.message.toLowerCase().includes("expired") ? 401 : 500;
        return { success: false, error: "Failed to fetch track", status };
    }
}

export async function getSingularAudioFeaturesAction(id: string) {
    try {
        const data = await fetchSpotify(`/audio-features/${id}`);
        return data;
    } catch (error) {
        console.error("Error fetching singular audio features:", error);
        return null;
    }
}

export async function getArtistsAction(ids: string[]) {
    if (!ids.length) return [];
    try {
        // Spotify allows up to 50 ids per request
        const batches = [];
        for (let i = 0; i < ids.length; i += 50) {
            const batchIds = ids.slice(i, i + 50).join(',');
            batches.push(fetchSpotify(`/artists?ids=${batchIds}`));
        }

        const results = await Promise.all(batches);
        return results.flatMap(r => r.artists);
    } catch (error) {
        console.error("Error fetching artists:", error);
        return [];
    }
}

export async function signOutAction() {
    const { signOut } = await import("@/auth");
    await signOut();
}

export async function getGeminiSuggestionsAction(songName: string, artistName: string) {
    try {
        const prompt = `Analyze the song "${songName}" by ${artistName}.
        1. Explain why this song is unique (vibe, instruments, history).
        2. Suggest 5-10 similar songs, categorized by "Vibe" or "Connection" (e.g., "Heavy Blues Peers", "Cinematic Vibe").
        3. For each song, explain WHY it fits.

        IMPORTANT: At the very end of your response, after all the text, provide a machine-readable list of the songs in this exact format:
        $$$Song Name$$$Artist Name$$$
        $$$Song Name$$$Artist Name$$$
        
        Do not include any numbering or extra text in the machine-readable section. Just the $$$ separators.`;

        const text = await generateSongSuggestions(prompt);
        console.log("Gemini Output:", text);

        // Parse the text output
        // We want to show the text to the user, but hide the machine readable part if possible, or just parse it.
        // Let's split by the first occurrence of $$$

        const parts = text.split('$$$');
        const visibleText = parts[0].trim(); // Everything before the first $$$

        // The rest are song/artist pairs
        // The format is $$$Song$$$Artist$$$
        // So splitting by $$$ gives ["", "Song", "Artist", "\n", "Song", "Artist", ...]

        const suggestions = [];
        // We start looking from index 1 (since index 0 is the text)
        // We need to find pairs.

        // A more robust regex approach for the whole text:
        const songRegex = /\$\$\$(.*?)\$\$\$(.*?)\$\$\$/g;
        let match;

        while ((match = songRegex.exec(text)) !== null) {
            const song = match[1].trim();
            const artist = match[2].trim();

            // Search Spotify
            const searchResult = await searchSpotify(`${song} ${artist}`, 'track', 1);
            if (searchResult.tracks && searchResult.tracks.items.length > 0) {
                suggestions.push(searchResult.tracks.items[0]);
            }
        }

        return { success: true, text: visibleText, suggestions };
    } catch (error: any) {
        console.error("Error getting Gemini suggestions:", error);
        return { success: false, error: "Failed to get suggestions" };
    }
}
