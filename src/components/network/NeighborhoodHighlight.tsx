import { useSigma } from "@react-sigma/core";
import { useEffect } from "react";

interface NeighborhoodHighlightProps {
  focusNodeId: string | null;
}

export default function NeighborhoodHighlight({
  focusNodeId,
}: NeighborhoodHighlightProps) {
  const sigma = useSigma();

  useEffect(() => {
    const graph = sigma.getGraph();
    const frame = window.requestAnimationFrame(() => {
      const container = sigma.getContainer();
      if (
        !container.isConnected ||
        container.clientWidth === 0 ||
        container.clientHeight === 0
      ) {
        return;
      }

      if (!focusNodeId || !graph.hasNode(focusNodeId)) {
        sigma.setSettings({ edgeReducer: null, nodeReducer: null });
        return;
      }

      const neighbors = new Set(graph.neighbors(focusNodeId));
      sigma.setSettings({
        nodeReducer: (node, data) => {
          if (node === focusNodeId) {
            return {
              ...data,
              forceLabel: true,
              highlighted: true,
              size: data.size * 1.45,
              zIndex: 2,
            };
          }
          if (neighbors.has(node)) {
            return {
              ...data,
              forceLabel: true,
              size: data.size * 1.18,
              zIndex: 1,
            };
          }
          return { ...data, label: "", zIndex: 0 };
        },
        edgeReducer: (edge, data) => {
          const [source, target] = graph.extremities(edge);
          const visible = source === focusNodeId || target === focusNodeId;
          return {
            ...data,
            color: visible ? "#a1a1aa" : data.color,
            hidden: !visible,
            size: visible ? Math.max(data.size ?? 1, 1.25) : data.size,
          };
        },
      });
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [focusNodeId, sigma]);

  return null;
}
