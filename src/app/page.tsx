import { auth } from "@/auth";
import HomeGate from "@/components/HomeGate";

export default async function Home() {
  const session = await auth();
  const serverAccessToken = session?.access_token ?? null;
  const nextAuthEnabled = Boolean(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET);
  const pkceClientId = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID ?? process.env.SPOTIFY_CLIENT_ID ?? null;
  const pkceEnabled = Boolean(pkceClientId);

  return (
    <HomeGate
      serverAccessToken={serverAccessToken}
      nextAuthEnabled={nextAuthEnabled}
      pkceEnabled={pkceEnabled}
      pkceClientId={pkceClientId}
    />
  );
}
