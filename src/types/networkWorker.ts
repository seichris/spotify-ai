import type { EnrichedTrack } from "@/hooks/useSpotifyLibrary";
import type {
  GraphCachePayload,
  SongGraphBuildResult,
  SongGraphBuildStage,
} from "@/types/network";

export interface SongGraphWorkerRequest {
  cache: GraphCachePayload | null;
  requestId: string;
  tracks: EnrichedTrack[];
}

export type SongGraphWorkerResponse =
  | {
      progress: number;
      requestId: string;
      stage: SongGraphBuildStage;
      type: "progress";
    }
  | {
      requestId: string;
      result: SongGraphBuildResult;
      type: "result";
    }
  | {
      error: string;
      requestId: string;
      type: "error";
    };
