import type { SongGraph } from "@/lib/network/buildGraph";
import { GRAPH_NOVERLAP_CONFIG } from "@/lib/network/graphConfig";
import { hashUnit } from "@/lib/network/hash";

export interface OccupiedPosition {
  size: number;
  x: number;
  y: number;
}

const PLACEMENT_RINGS = 12;
const PLACEMENT_SPOKES = 16;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const COLLISION_MARGIN = GRAPH_NOVERLAP_CONFIG.settings.margin;
const COLLISION_RATIO = GRAPH_NOVERLAP_CONFIG.settings.ratio;

const collisionRadius = (size: number) =>
  size * COLLISION_RATIO + COLLISION_MARGIN;

export class OccupiedPositionIndex {
  readonly positions: OccupiedPosition[] = [];
  private readonly buckets = new Map<string, OccupiedPosition[]>();
  private readonly cellSize: number;
  private maximumRadius: number;

  constructor(
    positions: OccupiedPosition[] = [],
    maximumNodeSize = positions.reduce(
      (maximum, position) => Math.max(maximum, position.size),
      0,
    ),
  ) {
    this.maximumRadius = collisionRadius(maximumNodeSize);
    this.cellSize = Math.max(this.maximumRadius * 2, 1);
    positions.forEach((position) => this.add(position));
  }

  private cellFor(position: { x: number; y: number }) {
    return {
      x: Math.floor(position.x / this.cellSize),
      y: Math.floor(position.y / this.cellSize),
    };
  }

  private key(x: number, y: number) {
    return `${x}:${y}`;
  }

  add(position: OccupiedPosition) {
    this.maximumRadius = Math.max(
      this.maximumRadius,
      collisionRadius(position.size),
    );
    this.positions.push(position);
    const cell = this.cellFor(position);
    const key = this.key(cell.x, cell.y);
    const bucket = this.buckets.get(key);
    if (bucket) bucket.push(position);
    else this.buckets.set(key, [position]);
  }

  collides(position: OccupiedPosition) {
    const radius = collisionRadius(position.size);
    const cell = this.cellFor(position);
    const cellRange =
      Math.ceil((radius + this.maximumRadius) / this.cellSize) + 1;

    for (let x = cell.x - cellRange; x <= cell.x + cellRange; x += 1) {
      for (let y = cell.y - cellRange; y <= cell.y + cellRange; y += 1) {
        const bucket = this.buckets.get(this.key(x, y));
        if (!bucket) continue;
        if (
          bucket.some((node) => {
            const minimumDistance = radius + collisionRadius(node.size);
            const deltaX = position.x - node.x;
            const deltaY = position.y - node.y;
            return (
              deltaX * deltaX + deltaY * deltaY <
              minimumDistance * minimumDistance
            );
          })
        ) {
          return true;
        }
      }
    }
    return false;
  }
}

export const findAvailablePosition = (
  occupied: OccupiedPositionIndex,
  center: { x: number; y: number },
  preferredAngle: number,
  preferredOffset: number,
  size: number,
) => {
  const scaledRadius = size * COLLISION_RATIO + COLLISION_MARGIN;
  const initialRadius = Math.max(preferredOffset, scaledRadius);

  for (let ring = 0; ring < PLACEMENT_RINGS; ring += 1) {
    const radius = initialRadius + ring * scaledRadius;
    const ringRotation = preferredAngle + ring * GOLDEN_ANGLE;
    for (let spoke = 0; spoke < PLACEMENT_SPOKES; spoke += 1) {
      const angle =
        ringRotation + (spoke * Math.PI * 2) / PLACEMENT_SPOKES;
      const position = {
        size,
        x: center.x + Math.cos(angle) * radius,
        y: center.y + Math.sin(angle) * radius,
      };
      if (!occupied.collides(position)) return position;
    }
  }

  const escapeRadius = occupied.positions.reduce((maximum, node) => {
    const requiredDistance =
      Math.hypot(node.x - center.x, node.y - center.y) +
      scaledRadius +
      node.size * COLLISION_RATIO +
      COLLISION_MARGIN;
    return Math.max(maximum, requiredDistance);
  }, initialRadius);
  return {
    size,
    x: center.x + Math.cos(preferredAngle) * escapeRadius,
    y: center.y + Math.sin(preferredAngle) * escapeRadius,
  };
};

export const separateNodeCollisions = (graph: SongGraph) => {
  const nodes = graph.nodes().sort();
  const maximumNodeSize = nodes.reduce(
    (maximum, node) =>
      Math.max(maximum, graph.getNodeAttribute(node, "size")),
    0,
  );
  const occupied = new OccupiedPositionIndex([], maximumNodeSize);

  nodes.forEach((node) => {
    const attributes = graph.getNodeAttributes(node);
    let position = {
      size: attributes.size,
      x: attributes.x,
      y: attributes.y,
    };
    if (occupied.collides(position)) {
      position = findAvailablePosition(
        occupied,
        position,
        hashUnit(`${node}:collision`) * Math.PI * 2,
        0,
        attributes.size,
      );
      graph.mergeNodeAttributes(node, { x: position.x, y: position.y });
    }
    occupied.add(position);
  });
};
