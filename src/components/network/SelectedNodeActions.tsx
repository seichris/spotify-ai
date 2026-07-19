"use client";

import { useSigma } from "@react-sigma/core";
import { Check, ListPlus, LoaderCircle, Play } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { EnrichedTrack } from "@/hooks/useSpotifyLibrary";

interface NodeAnchor {
  actionsOnLeft: boolean;
  radius: number;
  x: number;
  y: number;
}

export interface SelectedNodeActionsProps {
  onPlay: (track: EnrichedTrack) => Promise<void>;
  onQueue: (track: EnrichedTrack) => Promise<void>;
  track: EnrichedTrack;
}

const sameAnchor = (left: NodeAnchor | null, right: NodeAnchor | null) =>
  left === right ||
  Boolean(
    left &&
      right &&
      left.actionsOnLeft === right.actionsOnLeft &&
      Math.abs(left.radius - right.radius) < 0.5 &&
      Math.abs(left.x - right.x) < 0.5 &&
      Math.abs(left.y - right.y) < 0.5,
  );

export default function SelectedNodeActions({
  onPlay,
  onQueue,
  track,
}: SelectedNodeActionsProps) {
  const sigma = useSigma();
  const [anchor, setAnchor] = useState<NodeAnchor | null>(null);
  const [action, setAction] = useState<"play" | "queue" | null>(null);
  const [errorAction, setErrorAction] = useState<"play" | "queue" | null>(
    null,
  );
  const [queued, setQueued] = useState(false);
  const [status, setStatus] = useState("");

  const updateAnchor = useCallback(() => {
    const displayData = sigma.getNodeDisplayData(track.id);
    if (!displayData) {
      setAnchor((current) => (sameAnchor(current, null) ? current : null));
      return;
    }

    const point = sigma.framedGraphToViewport({
      x: displayData.x,
      y: displayData.y,
    });
    const radius = sigma.scaleSize(displayData.size);
    const nextAnchor = {
      actionsOnLeft:
        point.x + radius + 68 > sigma.getDimensions().width,
      radius,
      x: point.x,
      y: point.y,
    };
    setAnchor((current) =>
      sameAnchor(current, nextAnchor) ? current : nextAnchor,
    );
  }, [sigma, track.id]);

  useEffect(() => {
    const camera = sigma.getCamera();
    const frame = window.requestAnimationFrame(updateAnchor);
    sigma.on("afterRender", updateAnchor);
    sigma.on("resize", updateAnchor);
    camera.on("updated", updateAnchor);

    return () => {
      window.cancelAnimationFrame(frame);
      sigma.off("afterRender", updateAnchor);
      sigma.off("resize", updateAnchor);
      camera.off("updated", updateAnchor);
    };
  }, [sigma, updateAnchor]);

  const runAction = async (nextAction: "play" | "queue") => {
    setAction(nextAction);
    setErrorAction(null);
    if (nextAction === "queue") setQueued(false);

    try {
      if (nextAction === "play") {
        await onPlay(track);
        setStatus(`Playing ${track.name}`);
      } else {
        await onQueue(track);
        setQueued(true);
        setStatus(`Queued ${track.name}`);
      }
    } catch (error) {
      console.error(
        nextAction === "play"
          ? "Could not start Spotify playback"
          : "Could not add the song to the Spotify queue",
        error,
      );
      setErrorAction(nextAction);
      setStatus(
        nextAction === "play"
          ? `Could not play ${track.name}`
          : `Could not queue ${track.name}`,
      );
    } finally {
      setAction(null);
    }
  };

  if (!anchor) return null;

  const actionOffset = anchor.radius + 12;
  const actionX = anchor.actionsOnLeft
    ? anchor.x - actionOffset
    : anchor.x + actionOffset;
  const labelTranslateX = anchor.actionsOnLeft ? "-80%" : "-20%";
  const isBusy = action !== null;

  return (
    <>
      <div
        className="pointer-events-none absolute z-20 max-w-60 truncate rounded-full bg-white px-4 py-2 text-base font-medium leading-none text-black shadow-lg"
        style={{
          left: anchor.x,
          top: Math.max(anchor.y - anchor.radius - 14, 52),
          transform: `translate(${labelTranslateX}, -100%)`,
        }}
      >
        {track.name}
      </div>

      <div
        className="absolute z-20 flex flex-col gap-2"
        onPointerDown={(event) => event.stopPropagation()}
        style={{
          left: actionX,
          top: anchor.y - 18,
          transform: anchor.actionsOnLeft ? "translateX(-100%)" : undefined,
        }}
      >
        <button
          aria-label={`Play ${track.name}`}
          className={`grid h-11 w-11 place-items-center rounded-full bg-white text-black shadow-lg transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-400 disabled:cursor-wait disabled:opacity-70 ${errorAction === "play" ? "ring-2 ring-red-500" : ""}`}
          disabled={isBusy}
          onClick={(event) => {
            event.stopPropagation();
            void runAction("play");
          }}
          title={`Play ${track.name}`}
          type="button"
        >
          {action === "play" ? (
            <LoaderCircle className="h-5 w-5 animate-spin" />
          ) : (
            <Play className="ml-0.5 h-5 w-5 fill-current" />
          )}
        </button>
        <button
          aria-label={`${queued ? "Queue again" : "Add to queue"}: ${track.name}`}
          className={`grid h-11 w-11 place-items-center rounded-full text-black shadow-lg transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-400 disabled:cursor-wait disabled:opacity-70 ${queued ? "bg-green-400" : "bg-white"} ${errorAction === "queue" ? "ring-2 ring-red-500" : ""}`}
          disabled={isBusy}
          onClick={(event) => {
            event.stopPropagation();
            void runAction("queue");
          }}
          title={`Add ${track.name} to the Spotify queue`}
          type="button"
        >
          {action === "queue" ? (
            <LoaderCircle className="h-5 w-5 animate-spin" />
          ) : queued ? (
            <Check className="h-5 w-5" />
          ) : (
            <ListPlus className="h-5 w-5" />
          )}
        </button>
      </div>

      <p aria-live="polite" className="sr-only">
        {status}
      </p>
    </>
  );
}
