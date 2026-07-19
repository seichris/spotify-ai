"use client";

import { useSigma } from "@react-sigma/core";
import { Check, ListPlus, LoaderCircle, Play } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { EnrichedTrack } from "@/hooks/useSpotifyLibrary";

interface NodeAnchor {
  actionsOnLeft: boolean;
  radius: number;
  viewportHeight: number;
  viewportWidth: number;
  x: number;
  y: number;
}

const ACTION_SIZE = 44;
const ACTION_GAP = 8;
const ACTION_STACK_HEIGHT = ACTION_SIZE * 2 + ACTION_GAP;
const LABEL_HEIGHT = 32;
const LABEL_MAX_WIDTH = 240;
const VIEWPORT_MARGIN = 12;

export interface SelectedNodeActionsProps {
  onPlay: (track: EnrichedTrack) => Promise<void>;
  onQueue: (track: EnrichedTrack) => Promise<void>;
  playDisabled?: boolean;
  track: EnrichedTrack;
  viewportTopInset?: number;
}

const sameAnchor = (left: NodeAnchor | null, right: NodeAnchor | null) =>
  left === right ||
  Boolean(
    left &&
      right &&
      left.actionsOnLeft === right.actionsOnLeft &&
      Math.abs(left.radius - right.radius) < 0.5 &&
      left.viewportHeight === right.viewportHeight &&
      left.viewportWidth === right.viewportWidth &&
      Math.abs(left.x - right.x) < 0.5 &&
      Math.abs(left.y - right.y) < 0.5,
  );

export default function SelectedNodeActions({
  onPlay,
  onQueue,
  playDisabled = false,
  track,
  viewportTopInset = VIEWPORT_MARGIN,
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
    const dimensions = sigma.getDimensions();
    const nextAnchor = {
      actionsOnLeft:
        point.x + radius + ACTION_SIZE + VIEWPORT_MARGIN * 2 >
        dimensions.width,
      radius,
      viewportHeight: dimensions.height,
      viewportWidth: dimensions.width,
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
  const nodeIsVisible =
    anchor.x + anchor.radius >= 0 &&
    anchor.x - anchor.radius <= anchor.viewportWidth &&
    anchor.y + anchor.radius >= 0 &&
    anchor.y - anchor.radius <= anchor.viewportHeight;
  if (!nodeIsVisible) return null;

  const actionOffset = anchor.radius + 12;
  const viewportTop = Math.max(VIEWPORT_MARGIN, viewportTopInset);
  const preferredActionLeft = anchor.actionsOnLeft
    ? anchor.x - actionOffset - ACTION_SIZE
    : anchor.x + actionOffset;
  const actionLeft = Math.max(
    VIEWPORT_MARGIN,
    Math.min(
      preferredActionLeft,
      anchor.viewportWidth - ACTION_SIZE - VIEWPORT_MARGIN,
    ),
  );
  const actionTop = Math.max(
    viewportTop,
    Math.min(
      anchor.y - 18,
      anchor.viewportHeight - ACTION_STACK_HEIGHT - VIEWPORT_MARGIN,
    ),
  );
  let labelMaxWidth = Math.min(
    LABEL_MAX_WIDTH,
    anchor.viewportWidth - VIEWPORT_MARGIN * 2,
  );
  let labelX = Math.max(
    VIEWPORT_MARGIN + labelMaxWidth / 2,
    Math.min(
      anchor.x,
      anchor.viewportWidth - VIEWPORT_MARGIN - labelMaxWidth / 2,
    ),
  );
  const labelAboveBottom = anchor.y - anchor.radius - 14;
  const labelBelowNode = labelAboveBottom - LABEL_HEIGHT < viewportTop;
  const preferredLabelTop = labelBelowNode
    ? anchor.y + anchor.radius + 14
    : labelAboveBottom - LABEL_HEIGHT;
  const labelTop = Math.max(
    viewportTop,
    Math.min(
      preferredLabelTop,
      anchor.viewportHeight - LABEL_HEIGHT - VIEWPORT_MARGIN,
    ),
  );
  const labelBottom = labelTop + LABEL_HEIGHT;
  const actionBottom = actionTop + ACTION_STACK_HEIGHT;
  const labelOverlapsActionsVertically =
    labelTop < actionBottom + ACTION_GAP &&
    labelBottom + ACTION_GAP > actionTop;

  if (labelOverlapsActionsVertically) {
    const leftSpace = actionLeft - ACTION_GAP - VIEWPORT_MARGIN;
    const rightStart = actionLeft + ACTION_SIZE + ACTION_GAP;
    const rightSpace =
      anchor.viewportWidth - VIEWPORT_MARGIN - rightStart;

    if (rightSpace >= leftSpace) {
      labelMaxWidth = Math.min(LABEL_MAX_WIDTH, Math.max(0, rightSpace));
      labelX = rightStart + labelMaxWidth / 2;
    } else {
      labelMaxWidth = Math.min(LABEL_MAX_WIDTH, Math.max(0, leftSpace));
      labelX =
        actionLeft - ACTION_GAP - labelMaxWidth / 2;
    }
  }
  const isBusy = action !== null;

  return (
    <>
      <div
        className="pointer-events-none absolute z-30 flex h-8 items-center truncate rounded-full bg-white px-4 text-base font-medium leading-none text-black shadow-lg"
        style={{
          left: labelX,
          maxWidth: labelMaxWidth,
          top: labelTop,
          transform: "translateX(-50%)",
        }}
      >
        {track.name}
      </div>

      <div
        className="absolute z-30 flex flex-col gap-2"
        onPointerDown={(event) => event.stopPropagation()}
        style={{
          left: actionLeft,
          top: actionTop,
        }}
      >
        <button
          aria-label={`Play ${track.name}`}
          className={`grid h-11 w-11 place-items-center rounded-full bg-white text-black shadow-lg transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-400 disabled:cursor-wait disabled:opacity-70 ${errorAction === "play" ? "ring-2 ring-red-500" : ""}`}
          disabled={playDisabled || isBusy}
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
