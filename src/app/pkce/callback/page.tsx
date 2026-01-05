import { Suspense } from "react";
import PkceCallbackClient from "./PkceCallbackClient";

export default function PkceCallbackPage() {
    return (
        <Suspense
            fallback={
                <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4">
                    <div className="h-10 w-10 animate-spin rounded-full border-2 border-green-500 border-t-transparent" />
                    <p className="mt-4 text-zinc-400">Preparing Spotify login...</p>
                </div>
            }
        >
            <PkceCallbackClient />
        </Suspense>
    );
}
