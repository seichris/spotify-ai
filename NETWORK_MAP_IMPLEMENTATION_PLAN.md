# Song Discovery Map Implementation Plan

## Implementation status

All five phases were implemented and passed their phase-specific deep review/fix gates on 2026-07-14. The measured `metadata-v1` graph remains the release model; a semantic placement layer was deliberately deferred because it lacks a validated, sufficiently covered source. Detailed findings and evidence are recorded in `NETWORK_MAP_REVIEW_LEDGER.md` and `NETWORK_MAP_QUALITY_REPORT.md`.

The remaining live checks require user/environment authority rather than more code: a fresh Spotify sign-in for the new save scope, one Gemini request from a supported server location, and one deliberate save or playlist mutation.

## Executive summary

The map is not primarily a visualization of a Spotify library. It is an interface for finding the next song a user will want to keep.

The product should turn a user's liked songs into a navigable similarity graph, expose coherent musical neighborhoods, and place recommended songs at the edges of those neighborhoods. A user should be able to move from recognition ("these are my songs") to understanding ("this is the pocket I am in") to discovery ("show me something nearby but new") without leaving the map.

The implementation will replace the current genre-bucket scatterplot with:

- a sparse, weighted song graph stored in Graphology;
- topology-derived communities detected with Louvain;
- a stable ForceAtlas2 layout computed off the main thread;
- WebGL rendering and interaction through Sigma and React Sigma;
- image nodes using Spotify album artwork;
- a discovery layer that inserts Gemini-suggested, Spotify-resolved candidate tracks next to their closest liked-song anchors;
- explicit feedback actions that improve future discovery sessions.

The first version will use only signals the app already obtains reliably: artist genres, artist identity, album identity, and library membership. It will not pretend that artist genres are a complete description of a song's sound. Richer track-level vibe signals can be introduced behind a versioned similarity model after they are validated.

## 1. Product problem

### The problem we are solving

Large liked-song libraries become difficult to use for discovery. Lists are good at retrieval when a user already knows what they want, but poor at answering:

- What parts of my taste belong together?
- What should I play after this song?
- Which region of my taste have I not explored recently?
- What is adjacent to a vibe I already love, but not already in my library?
- Why is a recommendation being shown to me?

The map should reduce the work between "I want something like this" and hearing a promising new song.

### Product thesis

People can express musical intent more easily by pointing to an example or a neighborhood than by writing a perfect search query. A spatial interface makes that intent visible and editable.

The map succeeds when it produces good listening and saving decisions. Visual beauty, cluster count, and time spent panning are secondary signals.

### Primary user job

> Starting from one or more songs I already like, help me find, audition, and keep nearby songs that feel meaningfully related.

### Non-goals for the first release

- Producing a scientifically exact two-dimensional model of musical taste.
- Making the horizontal and vertical axes carry fixed meanings such as energy or valence.
- Displaying every graph edge simultaneously.
- Replacing Spotify playback, liked songs, or playlists.
- Depending on Spotify Audio Features, Audio Analysis, or Recommendations endpoints that are unavailable or restricted for this app.
- Using Gemini output as unquestioned ground truth about how a song sounds.

## 2. What the map represents

### Nodes

Each node represents one track.

There are two node kinds:

1. **Liked nodes** are songs already in the user's Spotify library. They form the stable core of the map.
2. **Candidate nodes** are new recommendations. They appear temporarily at the frontier of a selected neighborhood until the user saves, dismisses, or clears them.

Candidate nodes must be visually distinct from liked nodes. A border, glow, badge, or shape treatment should communicate "new" without making them look more authoritative.

### Edges

An edge means that two songs have enough evidence of musical relatedness to be useful neighbors. Edge weight represents the strength of that evidence.

Edges are not claims that two tracks are objectively identical. Each edge should retain its evidence so the UI can explain it, for example:

- shared specific genres;
- related or shared artists;
- same album or recording context;
- later, shared semantic vibe descriptors.

The graph should be sparse. Each song should connect to only its most useful neighbors, not every song with a nonzero score.

### Distance

Short graph distance means "reachable through strong similarity relationships." Physical screen distance is an approximate layout consequence, not a calibrated measurement.

The map should optimize local truth:

- immediate neighbors should be plausible;
- coherent neighborhoods should form;
- weakly connected regions should separate;
- the same library should not radically rearrange on every load.

Global screen distance and axis direction should not be presented as semantically exact.

### Clusters

Clusters represent communities discovered from the similarity graph. They are not predetermined genre buckets.

A cluster may correspond to a genre, era, scene, mood, texture, artist family, or mixture of those signals. Louvain will assign the initial communities; labels will be descriptive summaries of the members rather than the rule that created the groups.

This removes the current fixed limit of nine genres plus a misleading `mixed` bucket. The number and size of communities will follow the actual library.

### Labels

Cluster labels should be generated after clustering, using a compact profile containing:

- highest-weight genres;
- representative artists;
- representative tracks nearest the community center;
- distinguishing features relative to the rest of the library.

For the first implementation, deterministic labels such as "Indie Soul / Neo-Psychedelia" are acceptable. Gemini can later produce friendlier names, but the deterministic profile remains the source of evidence.

## 3. Current baseline

The current implementation provides a useful integration shell but not yet a similarity map:

- `src/components/SongNetwork.tsx` groups songs by their first artist genre.
- It places up to nine genre groups around a ring and folds the rest into `mixed`.
- Song positions are deterministic random scatter within each bucket.
- Artist and cluster links are sampled and capped at 220.
- Album covers are absolutely positioned DOM elements, with links rendered in SVG.
- `src/lib/similarity.ts` calculates unweighted genre Jaccard similarity for per-song recommendations but does not drive the map.
- `src/hooks/useSpotifyLibrary.ts` already loads liked songs, enriches their artists with genres, and caches the result.
- `src/app/actions.ts` already asks Gemini for recommendations and resolves the returned names through Spotify Search.
- `src/hooks/useVibePlaylists.ts` already builds genre/artist summaries and persists generated vibe state.
- `src/auth.ts` currently requests `user-library-read` but not `user-library-modify`, so saving a discovered track will require an explicit OAuth scope change and reauthorization.

The migration should preserve the working library, playback, authentication, and Spotify resolution paths while replacing the map's graph construction, layout, rendering, and discovery interaction.

## 4. Technical stack

### Core packages

| Package | Role |
| --- | --- |
| `graphology` | Typed in-memory graph model for song and candidate nodes |
| `graphology-types` | TypeScript graph types |
| `graphology-communities-louvain` | Weighted community detection |
| `graphology-layout-forceatlas2` | Force-directed graph layout with worker support |
| `sigma` | WebGL graph rendering, camera, picking, and interactions |
| `@react-sigma/core` | React lifecycle and hooks for Sigma |
| `@react-sigma/layout-forceatlas2` | React controls/hooks around the ForceAtlas2 worker |
| `@sigma/node-image` | Album artwork rendering through a WebGL texture atlas |

Planned install command:

```bash
npm install \
  sigma graphology graphology-types \
  @react-sigma/core @react-sigma/layout-forceatlas2 \
  graphology-layout-forceatlas2 \
  graphology-communities-louvain \
  @sigma/node-image
```

Package versions must be resolved and committed together so Sigma, React Sigma, and their peer dependencies remain compatible.

### Next.js integration

The graph renderer is browser-only. It should live behind a client boundary and be dynamically imported with server-side rendering disabled if importing Sigma at module scope accesses `window`.

The React wrapper should not receive newly constructed `graph` or `settings` objects on every render. Graph updates should happen through Graphology/Sigma APIs, while stable container settings are memoized.

### Why this stack

- Around 1,300 image nodes is an appropriate WebGL workload and an awkward DOM workload.
- Graphology keeps graph construction and algorithms independent from rendering.
- ForceAtlas2 naturally turns weighted relationships into neighborhoods.
- Louvain gives us data-driven communities instead of fixed genre buckets.
- Sigma provides pan, zoom, hover, click, camera controls, and extensible render layers without building a Canvas interaction engine from scratch.

## 5. Domain model

Create graph-specific types separate from raw Spotify responses.

```ts
type SongNodeKind = "liked" | "candidate";
type CandidateStatus = "unseen" | "previewed" | "saved" | "dismissed";

interface SongGraphNode {
  id: string;
  kind: SongNodeKind;
  name: string;
  artistIds: string[];
  artistNames: string[];
  albumName: string;
  imageUrl?: string;
  uri: string;
  genres: string[];
  clusterId?: string;
  x: number;
  y: number;
  size: number;
  color: string;
  candidateStatus?: CandidateStatus;
  recommendationId?: string;
}

interface SimilarityEvidence {
  genre: number;
  artist: number;
  album: number;
  semantic?: number;
  sharedGenres: string[];
  reasonCodes: string[];
}

interface SongGraphEdge {
  weight: number;
  evidence: SimilarityEvidence;
}

interface ClusterProfile {
  id: string;
  nodeIds: string[];
  label: string;
  color: string;
  topGenres: Array<{ name: string; weight: number }>;
  representativeTrackIds: string[];
  representativeArtistIds: string[];
}
```

The graph cache must include a `modelVersion`. Changing feature weights, neighbor rules, or clustering parameters invalidates cached edges and positions.

## 6. How to construct the map

### Step 1: Normalize the library

From `EnrichedTrack[]`:

1. Remove null, local, unavailable, and non-track records.
2. Deduplicate by Spotify track ID.
3. Normalize genre strings to lowercase trimmed values.
4. Preserve all credited artists, not only the primary artist.
5. Extend the local Spotify track type to retain the album ID and use it for album identity rather than comparing album names.
6. Select one album image size suitable for the texture atlas.
7. Retain `added_at` when available for product features, but do not treat save-time proximity as musical similarity.

### Step 2: Build interpretable features

The initial model should use weighted rather than plain genre overlap.

For each genre, calculate inverse document frequency across the user's library:

```text
idf(genre) = log((songCount + 1) / (songsWithGenre + 1)) + 1
```

This prevents broad labels such as `pop` from overpowering specific labels that carry more information.

For every candidate pair, calculate:

- `genreScore`: IDF-weighted Jaccard overlap;
- `artistScore`: bounded score for shared credited artists;
- `albumScore`: small bounded score for a shared album.

Initial hypothesis:

```text
similarity =
  0.72 * genreScore +
  0.18 * artistScore +
  0.10 * albumScore
```

These weights are configuration, not product truth. They should be tested against real neighborhoods and versioned when changed.

To avoid a map made mainly of artist discographies:

- cap same-artist neighbors per node, initially at two;
- prefer cross-artist edges when their scores are close;
- keep artist and album evidence visible in explanations;
- evaluate cluster artist concentration before shipping.

Songs with no genre metadata may connect through artist or album evidence. Truly isolated songs should remain visible as small islands rather than being assigned falsely to `mixed`.

### Step 3: Generate pair candidates efficiently

At the current library size, all-pairs comparison is possible, but most comparisons have no shared evidence. Build inverted indices instead:

```text
genre -> song IDs
artist -> song IDs
album -> song IDs
```

Only score pairs that share at least one index entry. Run graph construction in a Web Worker so loading and interaction remain responsive.

### Step 4: Build a sparse k-nearest-neighbor graph

For each node:

1. Rank other songs by similarity.
2. Keep approximately 6-10 strongest neighbors above a minimum score.
3. Prefer mutual k-nearest-neighbor edges because they produce more trustworthy local structure.
4. Add a fallback strongest edge for a node that would otherwise be isolated but has real evidence.
5. Deduplicate undirected edges.
6. Store the score and evidence on every edge.

Start with `k = 8`, then tune against cluster quality, graph connectivity, and visual density. A library of 1,300 songs should produce thousands of meaningful edges internally, but the UI should reveal only the relevant subset at a time.

### Step 5: Detect communities

Run weighted Louvain community detection on the sparse graph.

Parameters and post-processing:

- use edge similarity as Louvain weight;
- seed randomness for reproducibility;
- tune resolution against several real libraries rather than forcing a target cluster count;
- retain small coherent communities;
- mark disconnected components explicitly;
- do not merge unrelated leftovers into a generic cluster solely for visual neatness.

After clustering, compute a `ClusterProfile` and choose representative tracks using weighted centrality within the community.

### Step 6: Lay out the graph

Use ForceAtlas2 in a worker with:

- deterministic initial coordinates derived from the track ID;
- edge weights enabled;
- Barnes-Hut optimization enabled for this graph size;
- node-size adjustment or a no-overlap pass;
- bounded iterations and a clear "settled" state;
- the ability to stop layout once useful positions are reached.

Cache settled positions using a key derived from:

```text
user/library identity + sorted track IDs + modelVersion + layoutVersion
```

On subsequent loads:

- restore cached positions immediately;
- place newly liked tracks near the weighted barycenter of their closest existing neighbors;
- run a short local or global relaxation only when necessary;
- avoid a full-map shuffle button because map stability is part of the user's learned mental model.

### Step 7: Render progressively

Sigma should render different detail at different zoom levels:

- **Far zoom:** colored points or simplified covers, cluster labels, no global edge hairball.
- **Medium zoom:** album covers, selected neighborhood edges, candidate indicators.
- **Near zoom:** track/artist labels, stronger hover targets, detailed similarity reasons.

Interaction rules:

- Hover highlights a node and its strongest immediate neighbors.
- Click selects a seed and opens the song inspector.
- Clicking empty space clears selection but preserves camera position.
- Clicking a cluster label frames the community and opens its profile.
- A future multi-select gesture can define a blended discovery seed.
- Keyboard focus and accessible details must provide a non-pointer path to the same song actions.

## 7. How discovery fits into the map

### Discovery scopes

The user can ask for recommendations from three progressively broader contexts:

1. **Song scope:** "More like this song."
2. **Neighborhood scope:** "More like this song and its nearest liked neighbors."
3. **Cluster scope:** "Explore this whole pocket of my taste."

Neighborhood scope should be the default because one track can be ambiguous, while a small set communicates intent more reliably.

### Build a discovery context

For the selected scope, construct a bounded `DiscoveryContext` containing:

- seed tracks;
- strongest nearby liked tracks;
- high-weight genres and representative artists;
- similarities shared across the selected neighborhood;
- artists and tracks already in the library;
- previously dismissed candidate IDs;
- an exploration setting such as `familiar`, `balanced`, or `adventurous`.

Gemini should receive this compact evidence rather than the full library.

### Generate and resolve candidates

Refactor the existing Gemini recommendation action to return structured data rather than parsing `$$$` delimiters.

For each candidate:

1. Ask Gemini for title, artist, concise reason, and which seed evidence it matches.
2. Resolve the candidate through Spotify Search.
3. Validate that the resolved title and artist plausibly match the requested item.
4. Remove duplicates, existing liked tracks, unavailable tracks, and previously dismissed candidates.
5. Fetch artist genres using the existing batched artist action.
6. Score the resolved track against the selected neighborhood using the same versioned similarity model.
7. Reject or place in a separate low-confidence shelf when it has no credible connection to the selected context.

Gemini proposes; Spotify identifies; the graph model places; the user decides.

### Place candidates on the map

Candidate tracks should not trigger an immediate full ForceAtlas2 rerun.

Place each candidate at the weighted barycenter of its strongest liked-song anchors, with a deterministic small outward offset. Render its temporary edges to those anchors. This makes the recommendation's explanation spatially visible.

If a recommendation cannot be connected credibly, do not place it inside a cluster. Show it in the discovery tray with an explicit "weak map match" state.

### Candidate actions

The selected candidate card and map node should support:

- preview/play;
- save to Spotify liked songs when the required API action is added;
- add to a selected or generated playlist;
- "more like this";
- dismiss;
- explain why it is here.

Saving promotes the candidate to a liked node. Dismissing removes it from the visible graph and records feedback. Previewing without saving is a weaker positive signal than saving.

## 8. The actual product loop

```text
Load liked songs
    -> recognize the shape of my taste
    -> choose a song, neighborhood, or cluster
    -> request nearby discoveries
    -> see new candidate nodes attached to familiar anchors
    -> understand why each candidate is present
    -> audition candidates
    -> save, playlist, explore further, or dismiss
    -> update the map and feedback state
    -> continue from the new frontier
```

### First-session experience

1. Load the full liked-song library.
2. Show progressive status: enriching metadata, building relationships, finding communities, laying out map.
3. Frame the complete graph when ready.
4. Offer one short instruction: "Pick a song or region to discover nearby music."
5. On first selection, highlight its neighborhood before offering recommendations.
6. Insert a small candidate batch, initially five, so the map remains legible and auditioning feels achievable.

### Repeated-session experience

1. Restore the map at the previous camera position.
2. Preserve saved layout coordinates and cluster identity where possible.
3. Mark newly liked songs and changed neighborhoods subtly.
4. Let the user resume an unfinished candidate set or start fresh.
5. Avoid recommending dismissed tracks again unless the user explicitly resets feedback.

### Exploration control

The discovery control should express a product tradeoff, not a technical parameter:

- **Familiar:** strong local fit, adjacent artists, conservative novelty.
- **Balanced:** same neighborhood, mostly new artists, moderate novelty.
- **Adventurous:** weaker graph distance, neighboring communities, higher novelty.

Internally this adjusts allowed graph distance, same-artist penalties, and Gemini prompt constraints. It should not silently change the core map layout.

## 9. Feedback and learning

Persist explicit and implicit events:

```ts
type DiscoveryEventType =
  | "candidate_shown"
  | "candidate_selected"
  | "preview_started"
  | "preview_completed"
  | "candidate_saved"
  | "candidate_playlisted"
  | "candidate_dismissed"
  | "more_like_candidate";
```

The first release can store feedback locally with a versioned schema. The system should use it immediately to:

- exclude dismissed tracks;
- reduce repeated artists when they are repeatedly skipped;
- preserve successful seed-to-candidate paths;
- rank future candidate batches;
- resume pending discoveries.

Do not automatically rewrite the global similarity formula from a few interactions. Start with candidate reranking, where feedback is safer and easier to explain.

## 10. Proposed code organization

```text
src/
  components/
    network/
      SongMap.tsx
      SongMapClient.tsx
      GraphLoader.tsx
      MapControls.tsx
      ClusterLabelLayer.tsx
      SongInspector.tsx
      DiscoveryTray.tsx
      SimilarityExplanation.tsx
  hooks/
    useSongGraph.ts
    useMapDiscovery.ts
  lib/
    network/
      buildFeatures.ts
      calculateSimilarity.ts
      buildGraph.ts
      detectCommunities.ts
      buildClusterProfiles.ts
      layoutGraph.ts
      placeCandidates.ts
      graphCache.ts
      graphConfig.ts
  types/
    network.ts
  workers/
    songGraph.worker.ts
```

Migration notes:

- `SongNetwork.tsx` can temporarily become a compatibility wrapper around `SongMap` so `Dashboard.tsx` changes remain small.
- Move the reusable parts of `src/lib/similarity.ts` into the new network model and keep an adapter if the recommendation list still imports its current API.
- Reuse library enrichment from `useSpotifyLibrary` rather than fetching the same artist metadata in the graph layer.
- Extend `SpotifyTrack` and `EnrichedTrack` deliberately for graph fields such as album ID and `added_at` instead of relying on extra runtime response properties that are missing from the TypeScript interfaces.
- Reuse Spotify playback through `PlayerProvider` and `usePlayer`.
- Refactor recommendation actions rather than duplicating Gemini and Spotify Search calls in the client.
- Keep graph algorithms pure and UI-independent so they can be tested with fixed fixtures.

## 11. Implementation phases

### Phase 0: Baseline and fixtures

Deliverables:

- capture the current loaded-library size and current map behavior;
- create anonymized or synthetic graph fixtures covering repeated artists, broad genres, specific genres, missing genres, isolated songs, and duplicate tracks;
- define `modelVersion`, `layoutVersion`, and cache schema conventions;
- record a small qualitative benchmark of 15-20 seed songs and expected plausible neighbors.

Exit criteria:

- we can compare the new neighborhoods to a repeatable baseline;
- no test fixture contains private account credentials or access tokens.

### Phase 1: WebGL renderer migration

Deliverables:

- install the Sigma/Graphology stack;
- create the Next.js client-only map boundary;
- render all liked songs as image nodes;
- implement pan, zoom, fit-to-map, hover, click, and loading/error states;
- use a temporary graph derived from the existing relationships if needed.

Exit criteria:

- the full current library renders without DOM cover overlap problems;
- map interaction remains responsive at approximately 1,300 nodes;
- playback can still be triggered from a selected song;
- existing recommends and playlist views still work.

### Phase 2: Similarity graph and communities

Deliverables:

- implement normalized features and IDF-weighted genre similarity;
- build the sparse k-nearest-neighbor graph in a worker;
- store edge evidence;
- run Louvain and generate deterministic cluster profiles;
- run and cache the ForceAtlas2 layout;
- add cluster colors, labels, neighborhood highlighting, and explanations.

Exit criteria:

- the layout contains no artificial `mixed` bucket;
- same-artist tracks do not dominate most neighborhoods;
- selected-node neighbors are explainable from stored evidence;
- layout is stable across reloads of an unchanged library;
- missing-genre tracks do not corrupt or crash graph construction.

### Phase 3: Map-native discovery

Deliverables:

- implement song, neighborhood, and cluster discovery contexts;
- change Gemini output to a validated structured response;
- resolve, deduplicate, enrich, and score Spotify candidates;
- add the discovery tray and candidate map nodes;
- place candidates using weighted anchor positions;
- show reasons and confidence;
- add preview, dismiss, playlist, and "more like this" actions.

Exit criteria:

- every mapped candidate has at least one visible and explainable anchor;
- existing liked songs and dismissed tracks are excluded;
- weakly resolved or weakly connected candidates are not presented as high-confidence map matches;
- recommendation failure leaves the base map usable.

### Phase 4: Save and feedback loop

Deliverables:

- add the Spotify save-track action and required scope handling if not already available;
- promote saved candidates to liked nodes;
- persist discovery events and candidate state;
- rerank later candidate batches from feedback;
- add familiar/balanced/adventurous exploration control;
- support session restoration.

Exit criteria:

- a user can complete the entire discovery loop without leaving the map;
- saved songs appear correctly after library refresh;
- dismissed candidates do not immediately return;
- feedback state is schema-versioned and resettable.

### Phase 5: Quality and richer similarity

Only start this phase after measuring the metadata model.

Potential work:

- add cached semantic vibe descriptors from a defensible source;
- compare semantic cosine similarity with metadata similarity;
- test a hybrid score behind a new `modelVersion`;
- improve cluster labeling with Gemini while keeping deterministic evidence;
- add multi-seed/lasso discovery;
- support incremental layout updates for newly liked songs;
- consider server persistence only if cross-device continuity becomes a validated need.

Any semantic model must be evaluated for hallucination, cultural bias, catalog coverage, latency, and cost before it affects map placement.

## 12. Testing and validation

### Pure algorithm tests

The repository does not currently have a test runner. Add a lightweight TypeScript test runner such as Vitest when implementing the pure graph modules.

Test at minimum:

- genre normalization and IDF weights;
- weighted Jaccard symmetry and bounds;
- artist/album caps;
- deterministic pair and edge construction;
- k-nearest-neighbor pruning;
- mutual edge preference and isolated-node fallback;
- stable community output with a fixed seed;
- cache invalidation by library and model version;
- candidate deduplication and anchor placement.

### Integration checks

- load partial and full libraries;
- restore a cached graph;
- add and remove library songs;
- handle expired Spotify sessions and API rate limits;
- handle failed/canceled layout workers;
- handle missing or cross-origin album images;
- verify selection, zoom, playback, and discovery on desktop and touch input;
- verify the map remains usable when Gemini is unavailable.

### Qualitative relevance review

For the benchmark seed set, review:

- top eight neighbors;
- cluster membership;
- explanation accuracy;
- same-artist concentration;
- candidate novelty and fit;
- cases where the map appears confident without enough evidence.

Record model changes with before/after examples instead of tuning weights only by how attractive the global shape looks.

### Required repository checks

At every implementation phase:

```bash
npm run lint
npm run build
```

## 13. Performance targets

Initial targets for a library around 1,300 tracks:

- cached map becomes interactive within 2.5 seconds on a typical development machine;
- cold graph construction and layout completes within 6 seconds, with visible progress and cancellation safety;
- pan and zoom remain visually smooth after image nodes load;
- graph computation avoids long main-thread tasks by using a worker;
- normal view does not render the entire edge set as visible lines;
- settled graph coordinates can be reused without relayout;
- candidate insertion feels immediate because it uses anchor placement rather than global simulation.

These are product budgets to measure, not assumptions that the libraries guarantee automatically.

## 14. Product success metrics

### Primary metric

**Discovery save rate:** percentage of resolved candidate tracks that users save or add to a playlist after auditioning.

### Supporting metrics

- map-to-discovery conversion: sessions where a user selects a map region and requests candidates;
- preview rate per candidate shown;
- save or playlist rate per preview;
- dismiss rate;
- "more like this" rate;
- time from map ready to first preview;
- distinct new artists saved;
- repeat discovery sessions;
- candidate resolution failure rate;
- low-confidence recommendation rate;
- map load and interaction performance.

Avoid optimizing raw time-on-map. Fast discovery can be a successful session.

## 15. Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Artist genres are too coarse for song-level vibe | Keep evidence visible, cap artist effects, benchmark neighborhoods, and add richer signals only after validation |
| Force layouts imply false precision | Describe the map as neighborhoods, hide meaningless axes, and prioritize local relationships |
| Same-artist tracks form dominant islands | Cap same-artist neighbors and prefer similarly scored cross-artist edges |
| Layout changes destroy the user's mental map | Seed initialization, cache positions, version changes, and use incremental placement |
| Thousands of edges create visual noise | Keep the graph sparse and reveal edges on selection or hover |
| Album artwork exhausts texture or network resources | Choose one image size, use fallbacks, progressively reveal images, and test CORS behavior |
| Gemini recommends nonexistent or incorrect tracks | Use structured output, resolve through Spotify, validate matches, and discard uncertain results |
| Recommendations are plausible but already familiar | Exclude the library and recent candidates, penalize repeated artists, and expose exploration level |
| Client cache becomes stale or incompatible | Version every stored schema and derive cache keys from the library and model |
| Graph computation freezes React | Build edges, communities, and layout in a worker |
| The map becomes a novelty visualization with no action | Keep discovery, playback, save, dismiss, and playlist actions adjacent to selection |

## 16. Decisions to validate during implementation

The following are starting hypotheses and should be tuned with real libraries:

- `k = 8` neighbors per track;
- initial similarity weights of 72% genre, 18% artist, and 10% album;
- maximum two same-artist neighbors per node;
- Louvain resolution value;
- five recommendations per discovery batch;
- when album covers replace simplified nodes during zoom;
- whether candidate placement needs a short local no-overlap pass;
- how much layout movement is acceptable after the library changes;
- thresholds defining familiar, balanced, and adventurous discovery.

## 17. Definition of done for the first complete product loop

The first complete version is done when:

1. A user can load their full liked-song library and receive a stable WebGL map.
2. Similar songs form explainable local neighborhoods derived from a sparse weighted graph.
3. Communities emerge from graph topology rather than fixed primary-genre buckets.
4. Selecting a song or neighborhood can request new tracks.
5. Resolved candidates appear next to the liked tracks that justify them.
6. The user can audition, save or playlist, dismiss, and continue discovering from a candidate.
7. Saved and dismissed outcomes affect later sessions.
8. The base map remains functional when Gemini fails or Spotify returns partial data.
9. The implementation passes lint and production build checks.
10. Performance and recommendation quality are measured against the targets and benchmark set above.

At that point, the map is no longer merely a picture of the user's library. It is a working spatial recommendation interface with an observable discovery loop.
