import NextAuth from "next-auth"
import Spotify from "next-auth/providers/spotify"

if (!process.env.SPOTIFY_CLIENT_ID) {
  console.error("❌ Missing SPOTIFY_CLIENT_ID");
}
if (!process.env.SPOTIFY_CLIENT_SECRET) {
  console.error("❌ Missing SPOTIFY_CLIENT_SECRET");
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Spotify({
      clientId: process.env.SPOTIFY_CLIENT_ID,
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
      authorization: "https://accounts.spotify.com/authorize?scope=user-read-email+user-read-private+user-library-read+streaming+user-read-playback-state+user-modify-playback-state",
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        return {
          ...token,
          access_token: account.access_token,
          expires_at: account.expires_at,
          refresh_token: account.refresh_token,
        }
      }
      return token
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
