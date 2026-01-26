This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Features

- Spotify OAuth login and required scopes; login notes Premium is needed for playback. `src/auth.ts` `src/app/login/page.tsx`
- Loads liked songs, enriches with artist genres, caches in localStorage, supports infinite scroll and "load full library". `src/hooks/useSpotifyLibrary.ts` `src/components/Dashboard.tsx`
- Per-song "Recommends": click a liked song to get Gemini analysis + similar tracks; cached suggestions; click a suggestion to play. `src/components/Dashboard.tsx` `src/app/actions.ts`
- AI Playlist Sorter: clusters liked songs into vibe playlists, uses Gemini to name/describe and suggest tracks, creates Spotify playlists, adds liked + new tracks, and persists vibe state. `src/hooks/useVibePlaylists.ts` `src/app/actions.ts`
- Library playlist: creates/updates a single "vibe-ordered" playlist of all liked songs. `src/hooks/useVibePlaylists.ts`
- Network map: 2D genre clusters with artist connections and shuffleable layout. `src/components/SongNetwork.tsx`
- Playback bar using Spotify Web Playback SDK (play/pause/skip). `src/hooks/useSpotifyPlayer.ts` `src/components/Dashboard.tsx`

## Gemini limits

- Per-song requests send only the song name + artist; prompt asks for 5-10 similar songs. No explicit hard cap or token limit is set in code. `src/app/actions.ts` `src/lib/gemini.ts`
- Vibe-plan requests send a summary capped to top 6 genres, top 6 artists, and up to 12 sample liked songs per cluster. `src/hooks/useVibePlaylists.ts`
- Vibe-plan calls per run are capped by `MAX_VIBES = 6`, and each vibe playlist uses up to `NEW_SONGS_PER_VIBE = 10` suggestions. `src/hooks/useVibePlaylists.ts`
