import { useSigma } from "@react-sigma/core";
import { useEffect } from "react";
import type { ClusterProfile } from "@/types/network";

interface ClusterFocusProps {
  cluster: ClusterProfile | null;
}

export default function ClusterFocus({ cluster }: ClusterFocusProps) {
  const sigma = useSigma();

  useEffect(() => {
    if (!cluster) return;

    const displayPoints = cluster.nodeIds.flatMap((node) => {
      const displayData = sigma.getNodeDisplayData(node);
      return displayData ? [{ x: displayData.x, y: displayData.y }] : [];
    });
    if (displayPoints.length === 0) return;

    const center = displayPoints.reduce(
      (total, point) => ({ x: total.x + point.x, y: total.y + point.y }),
      { x: 0, y: 0 },
    );
    const xValues = displayPoints.map((point) => point.x);
    const yValues = displayPoints.map((point) => point.y);
    const span = Math.max(
      Math.max(...xValues) - Math.min(...xValues),
      Math.max(...yValues) - Math.min(...yValues),
    );
    sigma.getCamera().animate(
      {
        ratio: Math.max(0.08, Math.min(1, span * 1.8)),
        x: center.x / displayPoints.length,
        y: center.y / displayPoints.length,
      },
      { duration: 450 },
    );
  }, [cluster, sigma]);

  return null;
}
