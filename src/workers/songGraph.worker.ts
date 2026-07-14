import { buildSongGraph } from "@/lib/network/buildSongGraph";
import type {
  SongGraphWorkerRequest,
  SongGraphWorkerResponse,
} from "@/types/networkWorker";

interface WorkerContext {
  onmessage: ((event: MessageEvent<SongGraphWorkerRequest>) => void) | null;
  postMessage: (message: SongGraphWorkerResponse) => void;
}

const workerContext = self as unknown as WorkerContext;

workerContext.onmessage = (event) => {
  const { cache, requestId, tracks } = event.data;

  try {
    const result = buildSongGraph(tracks, cache, (stage, progress) => {
      workerContext.postMessage({
        progress,
        requestId,
        stage,
        type: "progress",
      });
    });
    workerContext.postMessage({ requestId, result, type: "result" });
  } catch (error) {
    workerContext.postMessage({
      error: error instanceof Error ? error.message : "Unknown graph worker error",
      requestId,
      type: "error",
    });
  }
};
