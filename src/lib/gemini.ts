import { GoogleGenerativeAI } from "@google/generative-ai";
import type { ResponseSchema } from "@google/generative-ai";

const apiKey = process.env.SPOTIFY_GEMINI_API_KEY;

export async function generateSongSuggestions(prompt: string) {
    if (!apiKey) {
        throw new Error("SPOTIFY_GEMINI_API_KEY is not defined");
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const modelName = process.env.SPOTIFY_GEMINI_MODEL || "gemini-3.5-flash";
    const model = genAI.getGenerativeModel({ model: modelName });

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    return { text, usageMetadata: response.usageMetadata, model: modelName };
}

export async function generateStructuredSongSuggestions<T>(
    prompt: string,
    responseSchema: ResponseSchema,
) {
    if (!apiKey) {
        throw new Error("SPOTIFY_GEMINI_API_KEY is not defined");
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const modelName = process.env.SPOTIFY_GEMINI_MODEL || "gemini-3.5-flash";
    const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema,
        },
    });

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    const data = JSON.parse(text) as T;

    return { data, usageMetadata: response.usageMetadata, model: modelName };
}
