import { signIn } from "@/auth";
import { Button } from "@/components/ui/Button";
import { getSafeLoginRedirect } from "@/lib/loginRedirect";
import { Music2 } from "lucide-react";

interface LoginPageProps {
  searchParams: Promise<{ redirectTo?: string | string[] }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { redirectTo } = await searchParams;
  const safeRedirect = getSafeLoginRedirect(redirectTo);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-black p-4 text-white">
      <div className="w-full max-w-md space-y-8 text-center">
        <div className="flex flex-col items-center justify-center space-y-2">
          <div className="rounded-full bg-green-500 p-4">
            <Music2 className="h-12 w-12 text-black" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight">Spotify Analyzer</h1>
          <p className="text-zinc-400">
            Unlock insights from your music library. Sort by vibe, energy, and more.
          </p>
        </div>

        <form
          action={async () => {
            "use server";
            await signIn("spotify", { redirectTo: safeRedirect });
          }}
        >
          <Button size="lg" className="w-full text-lg">
            Connect with Spotify
          </Button>
        </form>

        <p className="text-xs text-zinc-500">
          Spotify Premium required for playback.
        </p>
      </div>
    </div>
  );
}
