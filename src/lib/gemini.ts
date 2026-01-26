import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.SPOTIFY_GEMINI_API_KEY;

export async function generateSongSuggestions(prompt: string) {
    if (!apiKey) {
        throw new Error("SPOTIFY_GEMINI_API_KEY is not defined");
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const modelName = process.env.SPOTIFY_GEMINI_MODEL || "gemini-3.0-flash";
    const model = genAI.getGenerativeModel({ model: modelName });

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    return { text, usageMetadata: response.usageMetadata, model: modelName };
}
