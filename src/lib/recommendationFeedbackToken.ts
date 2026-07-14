import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type {
  ExplorationMode,
  RecommendationStrategy,
} from "@/types/network";

const TOKEN_CONTEXT = "spotify-gemini:recommendation-feedback:v1\0";
const TOKEN_VERSION = 1;
const MAX_TOKEN_LENGTH = 240;
const EXPLORATION_MODES = new Set<ExplorationMode>([
  "familiar",
  "balanced",
  "adventurous",
]);
const RECOMMENDATION_STRATEGIES = new Set<RecommendationStrategy>([
  "song",
  "neighborhood",
]);

export interface RecommendationFeedbackTokenClaims {
  exploration: ExplorationMode;
  strategy: RecommendationStrategy;
  trackId: string;
  userId: string;
}

const getSigningSecret = () => {
  const secret = process.env.SPOTIFY_AUTH_SECRET;
  if (!secret) {
    throw new Error("Recommendation feedback signing is not configured.");
  }
  return secret;
};

const signatureFor = (payload: string) =>
  createHmac("sha256", getSigningSecret())
    .update(TOKEN_CONTEXT)
    .update(payload)
    .digest("base64url");

export const createRecommendationFeedbackToken = ({
  exploration,
  strategy,
  trackId,
  userId,
}: RecommendationFeedbackTokenClaims) => {
  const payload = Buffer.from(
    JSON.stringify([
      TOKEN_VERSION,
      userId,
      trackId,
      strategy,
      exploration,
      randomUUID(),
    ]),
  ).toString("base64url");
  const token = `${payload}.${signatureFor(payload)}`;
  if (token.length > MAX_TOKEN_LENGTH) {
    throw new Error("Recommendation feedback token is too long.");
  }
  return token;
};

export const verifyRecommendationFeedbackToken = (
  token: string,
): RecommendationFeedbackTokenClaims | null => {
  if (!token || token.length > MAX_TOKEN_LENGTH) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, signature] = parts;

  try {
    const expected = Buffer.from(signatureFor(payload), "utf8");
    const actual = Buffer.from(signature, "utf8");
    if (
      expected.length !== actual.length ||
      !timingSafeEqual(expected, actual)
    ) {
      return null;
    }

    const value = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as unknown;
    if (!Array.isArray(value) || value.length !== 6) return null;
    const [version, userId, trackId, strategy, exploration, nonce] = value;
    if (
      version !== TOKEN_VERSION ||
      typeof userId !== "string" ||
      !userId ||
      typeof trackId !== "string" ||
      !trackId ||
      typeof strategy !== "string" ||
      !RECOMMENDATION_STRATEGIES.has(strategy as RecommendationStrategy) ||
      typeof exploration !== "string" ||
      !EXPLORATION_MODES.has(exploration as ExplorationMode) ||
      typeof nonce !== "string" ||
      !nonce
    ) {
      return null;
    }

    return {
      exploration: exploration as ExplorationMode,
      strategy: strategy as RecommendationStrategy,
      trackId,
      userId,
    };
  } catch {
    return null;
  }
};
