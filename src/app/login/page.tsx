import LoginPanel from "@/components/LoginPanel";

export default function LoginPage() {
    const nextAuthEnabled = Boolean(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET);
    const pkceClientId = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID ?? process.env.SPOTIFY_CLIENT_ID ?? null;
    const pkceEnabled = Boolean(pkceClientId);

    return (
        <LoginPanel
            nextAuthEnabled={nextAuthEnabled}
            pkceEnabled={pkceEnabled}
            pkceClientId={pkceClientId}
        />
    );
}
