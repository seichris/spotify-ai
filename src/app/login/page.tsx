import { signIn } from "@/auth";
import { Button } from "@/components/ui/Button";
import { Music2 } from "lucide-react";

export default function LoginPage() {
    return (
        <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-md space-y-8 text-center">
                <div className="flex flex-col items-center justify-center space-y-2">
                    <div className="p-4 bg-green-500 rounded-full">
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
                        await signIn("spotify", { redirectTo: "/" });
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
