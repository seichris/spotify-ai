import NextAuth from "next-auth"
import Spotify from "next-auth/providers/spotify"
import {
  isSpotifyAccessTokenCurrent,
  mergeSpotifyRefresh,
} from "@/lib/spotifyAuth"
import type { SpotifyRefreshResponse } from "@/lib/spotifyAuth"

const spotifyRefreshRequests = new Map<
  string,
  Promise<SpotifyRefreshResponse>
>()

const refreshSpotifyAccessToken = async (refreshToken: string) => {
  const pending = spotifyRefreshRequests.get(refreshToken)
  if (pending) return pending

  const request = (async () => {
    const clientId = process.env.SPOTIFY_CLIENT_ID
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET
    if (!clientId || !clientSecret) {
      throw new Error("Spotify OAuth credentials are incomplete")
    }

    const response = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    })
    const result = (await response.json()) as SpotifyRefreshResponse & {
      error?: string
      error_description?: string
    }
    if (!response.ok || !result.access_token || !result.expires_in) {
      throw new Error(
        result.error_description ?? result.error ?? `Spotify token refresh failed (${response.status})`,
      )
    }
    return result
  })()

  spotifyRefreshRequests.set(refreshToken, request)
  try {
    return await request
  } finally {
    spotifyRefreshRequests.delete(refreshToken)
  }
}

if (!process.env.SPOTIFY_CLIENT_ID) {
  console.error("❌ Missing SPOTIFY_CLIENT_ID");
}
if (!process.env.SPOTIFY_CLIENT_SECRET) {
  console.error("❌ Missing SPOTIFY_CLIENT_SECRET");
}
if (!process.env.SPOTIFY_AUTH_SECRET) {
  console.error("❌ Missing SPOTIFY_AUTH_SECRET");
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.SPOTIFY_AUTH_SECRET,
  providers: [
    Spotify({
      clientId: process.env.SPOTIFY_CLIENT_ID,
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
      authorization:
        "https://accounts.spotify.com/authorize?scope=user-read-email+user-read-private+user-library-read+user-library-modify+playlist-modify-private+streaming+user-read-playback-state+user-modify-playback-state",
    }),
  ],
  callbacks: {
    async redirect({ url, baseUrl }) {
      const configuredUrl = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL

      if (!configuredUrl) {
        return url.startsWith("/") ? `${baseUrl}${url}` : baseUrl
      }

      const configuredOrigin = new URL(configuredUrl).origin

      if (url.startsWith("/")) {
        return `${configuredOrigin}${url}`
      }

      const target = new URL(url)
      const isLocalOrigin =
        target.origin === baseUrl ||
        target.hostname === "localhost" ||
        target.hostname === "127.0.0.1"

      if (isLocalOrigin) {
        return `${configuredOrigin}${target.pathname}${target.search}${target.hash}`
      }

      return configuredOrigin
    },
    async jwt({ token, account }) {
      if (account) {
        return {
          ...token,
          access_token: account.access_token,
          expires_at: account.expires_at,
          refresh_token: account.refresh_token,
        }
      }
      const expiresAt =
        typeof token.expires_at === "number" ? token.expires_at : undefined
      if (isSpotifyAccessTokenCurrent(expiresAt)) {
        return token
      }
      const refreshToken =
        typeof token.refresh_token === "string" ? token.refresh_token : null
      if (!refreshToken) {
        return { ...token, error: "RefreshTokenError" }
      }

      try {
        const refreshed = await refreshSpotifyAccessToken(refreshToken)
        return {
          ...token,
          ...mergeSpotifyRefresh(refreshToken, refreshed),
          error: undefined,
        }
      } catch (error) {
        console.error(
          "Error refreshing Spotify access token",
          error instanceof Error ? error.message : "Unknown refresh error",
        )
        return { ...token, error: "RefreshTokenError" }
      }
    },
    async session({ session, token }) {
      return {
        ...session,
        access_token: token.access_token,
        error: token.error,
      }
    },
  },
})
