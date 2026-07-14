"use client";

import Graph from "graphology";
import { useEffect, useState } from "react";
import type { EnrichedTrack } from "@/hooks/useSpotifyLibrary";
import {
  createLibraryFingerprint,
  loadGraphCache,
  saveGraphCache,
} from "@/lib/network/graphCache";
import type {
  ClusterProfile,
  SongGraphBuildStage,
  SongGraphBuildStats,
  SongGraphEdgeAttributes,
  SongGraphNodeAttributes,
} from "@/types/network";
import type {
  SongGraphWorkerRequest,
  SongGraphWorkerResponse,
} from "@/types/networkWorker";

interface SongGraphState {
  clusters: ClusterProfile[];
  error: string | null;
  graph: Graph<SongGraphNodeAttributes, SongGraphEdgeAttributes> | null;
  progress: number;
  stage: SongGraphBuildStage;
  stats: SongGraphBuildStats | null;
}

const INITIAL_STATE: SongGraphState = {
  clusters: [],
  error: null,
  graph: null,
  progress: 0,
  stage: "normalizing",
  stats: null,
};

export const useSongGraph = (tracks: EnrichedTrack[]) => {
  const [state, setState] = useState<SongGraphState>(INITIAL_STATE);

  useEffect(() => {
    if (tracks.length === 0) {
      return;
    }

    let active = true;
    const libraryFingerprint = createLibraryFingerprint(tracks);
    const requestId = `${libraryFingerprint}:${Date.now()}`;
    const cache = loadGraphCache(libraryFingerprint);
    const worker = new Worker(
      new URL("../workers/songGraph.worker.ts", import.meta.url),
      { type: "module" },
    );

    worker.onmessage = (event: MessageEvent<SongGraphWorkerResponse>) => {
      const message = event.data;
      if (!active || message.requestId !== requestId) return;

      if (message.type === "progress") {
        setState((current) => ({
          ...(message.stage === "normalizing" ? INITIAL_STATE : current),
          progress: message.progress,
          stage: message.stage,
        }));
        return;
      }

      if (message.type === "error") {
        worker.terminate();
        setState((current) => ({
          ...current,
          error: message.error,
        }));
        return;
      }

      const graph = new Graph<
        SongGraphNodeAttributes,
        SongGraphEdgeAttributes
      >({ type: "undirected" });
      graph.import(message.result.graph);
      saveGraphCache(message.result.cache);
      worker.terminate();
      setState({
        clusters: message.result.clusters,
        error: null,
        graph,
        progress: 100,
        stage: "ready",
        stats: message.result.stats,
      });
    };

    worker.onerror = (event) => {
      if (!active) return;
      worker.terminate();
      setState((current) => ({
        ...current,
        error: event.message || "The graph worker stopped unexpectedly.",
      }));
    };

    const request: SongGraphWorkerRequest = { cache, requestId, tracks };
    worker.postMessage(request);

    return () => {
      active = false;
      worker.terminate();
    };
  }, [tracks]);

  return state;
};
