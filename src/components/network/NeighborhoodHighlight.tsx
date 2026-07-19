import { useSigma } from "@react-sigma/core";
import { useEffect } from "react";

interface NeighborhoodHighlightProps {
  focusNodeId: string | null;
  selectedNodeId?: string | null;
}

export default function NeighborhoodHighlight({
  focusNodeId,
  selectedNodeId,
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

      const hasFocus = Boolean(focusNodeId && graph.hasNode(focusNodeId));
      const hasSelection = Boolean(
        selectedNodeId && graph.hasNode(selectedNodeId),
      );
      if (!hasFocus && !hasSelection) {
        sigma.setSettings({ edgeReducer: null, nodeReducer: null });
        return;
      }

      const neighbors =
        focusNodeId && hasFocus
          ? new Set(graph.neighbors(focusNodeId))
          : new Set<string>();
      sigma.setSettings({
        nodeReducer: (node, data) => {
          if (node === selectedNodeId) {
            return {
              ...data,
              forceLabel: false,
              highlighted: true,
              label: "",
              size: data.size * 1.45,
              zIndex: 2,
            };
          }
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
          const visible = hasFocus
            ? source === focusNodeId || target === focusNodeId
            : true;
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
  }, [focusNodeId, selectedNodeId, sigma]);

  return null;
}
