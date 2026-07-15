import type { EnrichedTrack } from "@/hooks/useSpotifyLibrary";
import {
  createLibraryFingerprint,
  loadGraphCache,
  saveGraphCache,
} from "@/lib/network/graphCache";
import type {
  SongGraphBuildResult,
  SongGraphBuildStage,
} from "@/types/network";
import type {
  SongGraphWorkerRequest,
  SongGraphWorkerResponse,
} from "@/types/networkWorker";

type ProgressReporter = (stage: SongGraphBuildStage, progress: number) => void;

export const buildSongGraphClient = (
  tracks: EnrichedTrack[],
  reportProgress: ProgressReporter = () => undefined,
) =>
  new Promise<SongGraphBuildResult>((resolve, reject) => {
    const libraryFingerprint = createLibraryFingerprint(tracks);
    const requestId = `playlist:${libraryFingerprint}:${Date.now()}`;
    const cache = loadGraphCache(libraryFingerprint);
    const worker = new Worker(
      new URL("../../workers/songGraph.worker.ts", import.meta.url),
      { type: "module" },
    );
    const finish = () => worker.terminate();

    worker.onmessage = (event: MessageEvent<SongGraphWorkerResponse>) => {
      const message = event.data;
      if (message.requestId !== requestId) return;

      if (message.type === "progress") {
        reportProgress(message.stage, message.progress);
        return;
      }
      if (message.type === "error") {
        finish();
        reject(new Error(message.error));
        return;
      }

      saveGraphCache(message.result.cache);
      finish();
      resolve(message.result);
    };
    worker.onerror = (event) => {
      finish();
      reject(new Error(event.message || "The graph worker stopped unexpectedly."));
    };

    const request: SongGraphWorkerRequest = { cache, requestId, tracks };
    worker.postMessage(request);
  });
