"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { EnrichedTrack } from "@/hooks/useSpotifyLibrary";
import { cn } from "@/lib/utils";

const MAX_CLUSTERS = 9;
const MAX_LINKS = 220;

interface NetworkNode {
    id: string;
    left: number;
    top: number;
    cx: number;
    cy: number;
    size: number;
    title: string;
    subtitle: string;
    imageUrl?: string;
    clusterKey: string;
    primaryArtistId?: string;
    sortKey: number;
}

interface NetworkLink {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
}

interface ClusterLabel {
    key: string;
    title: string;
    x: number;
    y: number;
    count: number;
}

const hashString = (value: string) => {
    let hash = 0;
    for (let i = 0; i < value.length; i += 1) {
        hash = (hash << 5) - hash + value.charCodeAt(i);
        hash |= 0;
    }
    return (hash >>> 0) / 4294967295;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const getPrimaryGenre = (track: EnrichedTrack) => {
    if (!track.genres || track.genres.length === 0) return "mixed";
    return track.genres[0].toLowerCase();
};

const getImageUrl = (track: EnrichedTrack) => {
    if (!track.album || !track.album.images) return undefined;
    return track.album.images[1]?.url || track.album.images[0]?.url || track.album.images[2]?.url;
};

export default function SongNetwork({ songs, seed = 0 }: { songs: EnrichedTrack[]; seed?: number }) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

    useLayoutEffect(() => {
        if (!containerRef.current) return;
        const element = containerRef.current;

        const update = () => {
            setContainerSize({
                width: element.clientWidth,
                height: element.clientHeight,
            });
        };

        update();

        const observer = new ResizeObserver(update);
        observer.observe(element);

        return () => observer.disconnect();
    }, []);

    const { nodes, links, labels } = useMemo(() => {
        if (songs.length === 0 || containerSize.width === 0 || containerSize.height === 0) {
            return { nodes: [] as NetworkNode[], links: [] as NetworkLink[], labels: [] as ClusterLabel[] };
        }

        const filtered = songs.filter(track => track.id && track.type === "track" && !track.is_local);
        const grouped = new Map<string, EnrichedTrack[]>();
        filtered.forEach(track => {
            const key = getPrimaryGenre(track);
            if (!grouped.has(key)) grouped.set(key, []);
            grouped.get(key)?.push(track);
        });

        const sortedGroups = Array.from(grouped.entries()).sort((a, b) => b[1].length - a[1].length);
        const topGroups = sortedGroups.slice(0, MAX_CLUSTERS);
        const overflow = sortedGroups.slice(MAX_CLUSTERS).flatMap(([, tracks]) => tracks);

        if (overflow.length > 0) {
            topGroups.push(["mixed", overflow]);
        }

        const clusterCount = topGroups.length;
        const minSide = Math.min(containerSize.width, containerSize.height);
        const ringRadius = minSide * 0.25;
        const scatterRadius = minSide * 0.18;
        const jitter = minSide * 0.05;
        const baseSize = clamp(Math.round(minSide / 16), 32, 58);
        const padding = baseSize;
        const centerX = containerSize.width / 2;
        const centerY = containerSize.height / 2;

        const nodeList: NetworkNode[] = [];
        const labelList: ClusterLabel[] = [];

        topGroups.forEach(([clusterKey, tracks], index) => {
            const angle = (Math.PI * 2 * index) / clusterCount;
            const clusterCenterX = centerX + ringRadius * Math.cos(angle);
            const clusterCenterY = centerY + ringRadius * Math.sin(angle);

            labelList.push({
                key: clusterKey,
                title: clusterKey,
                x: clusterCenterX,
                y: clusterCenterY,
                count: tracks.length,
            });

            tracks.forEach(track => {
                const seedKey = `${seed}-${track.id}`;
                const radial = Math.sqrt(hashString(`${seedKey}-r`));
                const theta = Math.PI * 2 * hashString(`${seedKey}-a`);
                const wobbleX = (hashString(`${seedKey}-x`) - 0.5) * jitter;
                const wobbleY = (hashString(`${seedKey}-y`) - 0.5) * jitter;
                const sizeJitter = (hashString(`${seedKey}-s`) - 0.5) * 10;

                const radius = scatterRadius * radial;
                const x = clusterCenterX + radius * Math.cos(theta) + wobbleX;
                const y = clusterCenterY + radius * Math.sin(theta) + wobbleY;
                const nodeSize = clamp(Math.round(baseSize + sizeJitter), 28, 64);

                const left = clamp(x - nodeSize / 2, padding, containerSize.width - nodeSize - padding);
                const top = clamp(y - nodeSize / 2, padding, containerSize.height - nodeSize - padding);

                nodeList.push({
                    id: track.id,
                    left,
                    top,
                    cx: left + nodeSize / 2,
                    cy: top + nodeSize / 2,
                    size: nodeSize,
                    title: track.name,
                    subtitle: track.artists.map(artist => artist.name).join(", "),
                    imageUrl: getImageUrl(track),
                    clusterKey,
                    primaryArtistId: track.artists[0]?.id,
                    sortKey: hashString(`${seedKey}-k`),
                });
            });
        });

        const artistGroups = new Map<string, NetworkNode[]>();
        nodeList.forEach(node => {
            if (!node.primaryArtistId) return;
            const existing = artistGroups.get(node.primaryArtistId) || [];
            existing.push(node);
            artistGroups.set(node.primaryArtistId, existing);
        });

        const linkList: NetworkLink[] = [];
        const linkKeys = new Set<string>();

        artistGroups.forEach(nodesForArtist => {
            if (nodesForArtist.length < 2) return;
            const sorted = [...nodesForArtist].sort((a, b) => a.sortKey - b.sortKey);
            for (let i = 0; i < sorted.length - 1; i += 1) {
                if (linkList.length >= MAX_LINKS) return;
                const a = sorted[i];
                const b = sorted[i + 1];
                const key = `${a.id}-${b.id}`;
                if (linkKeys.has(key)) continue;
                linkKeys.add(key);
                linkList.push({ x1: a.cx, y1: a.cy, x2: b.cx, y2: b.cy });
            }
        });

        const clusterGroups = new Map<string, NetworkNode[]>();
        nodeList.forEach(node => {
            const existing = clusterGroups.get(node.clusterKey) || [];
            existing.push(node);
            clusterGroups.set(node.clusterKey, existing);
        });

        clusterGroups.forEach(nodesForCluster => {
            if (linkList.length >= MAX_LINKS) return;
            const sorted = [...nodesForCluster].sort((a, b) => a.sortKey - b.sortKey).slice(0, 40);
            for (let i = 0; i < sorted.length - 1; i += 1) {
                if (linkList.length >= MAX_LINKS) return;
                const a = sorted[i];
                const b = sorted[i + 1];
                const key = `${a.id}-${b.id}`;
                if (linkKeys.has(key)) continue;
                linkKeys.add(key);
                linkList.push({ x1: a.cx, y1: a.cy, x2: b.cx, y2: b.cy });
            }
        });

        return { nodes: nodeList, links: linkList, labels: labelList };
    }, [songs, containerSize.width, containerSize.height, seed]);

    return (
        <div
            ref={containerRef}
            className="relative h-[70vh] w-full overflow-hidden rounded-2xl border border-zinc-800/70 bg-gradient-to-br from-zinc-950 via-black to-zinc-900"
        >
            {nodes.length === 0 ? (
                <div className="absolute inset-0 flex items-center justify-center text-sm text-zinc-500">
                    Load your full library to render the map.
                </div>
            ) : (
                <>
                    <svg className="absolute inset-0 h-full w-full" aria-hidden="true">
                        <defs>
                            <linearGradient id="nodeLines" x1="0" y1="0" x2="1" y2="1">
                                <stop offset="0%" stopColor="#22c55e" stopOpacity="0.3" />
                                <stop offset="100%" stopColor="#a855f7" stopOpacity="0.1" />
                            </linearGradient>
                        </defs>
                        {links.map((link, index) => (
                            <line
                                key={`link-${index}`}
                                x1={link.x1}
                                y1={link.y1}
                                x2={link.x2}
                                y2={link.y2}
                                stroke="url(#nodeLines)"
                                strokeWidth="1"
                                strokeOpacity="0.7"
                            />
                        ))}
                    </svg>

                    {labels.map(label => (
                        <div
                            key={`label-${label.key}`}
                            className="pointer-events-none absolute text-[10px] uppercase tracking-[0.3em] text-zinc-500"
                            style={{ left: label.x - 40, top: label.y - 14 }}
                        >
                            {label.title}
                        </div>
                    ))}

                    {nodes.map(node => (
                        <div
                            key={node.id}
                            className={cn(
                                "group absolute rounded-xl border border-white/10 shadow-lg shadow-black/40",
                                "transition-transform duration-500 ease-out hover:scale-110"
                            )}
                            style={{
                                left: node.left,
                                top: node.top,
                                width: node.size,
                                height: node.size,
                            }}
                        >
                            {node.imageUrl ? (
                                <img
                                    src={node.imageUrl}
                                    alt={node.title}
                                    className="h-full w-full rounded-xl object-cover"
                                    loading="lazy"
                                />
                            ) : (
                                <div className="flex h-full w-full items-center justify-center rounded-xl bg-zinc-800 text-xs text-zinc-200">
                                    {node.title.slice(0, 1)}
                                </div>
                            )}
                            <div
                                className={cn(
                                    "pointer-events-none absolute left-1/2 top-full z-10 mt-2 w-48 -translate-x-1/2",
                                    "rounded-md bg-black/80 p-2 text-left text-xs text-zinc-200 opacity-0",
                                    "transition-opacity duration-200 group-hover:opacity-100"
                                )}
                            >
                                <p className="font-semibold text-white">{node.title}</p>
                                <p className="text-[11px] text-zinc-400">{node.subtitle}</p>
                            </div>
                        </div>
                    ))}
                </>
            )}
        </div>
    );
}
