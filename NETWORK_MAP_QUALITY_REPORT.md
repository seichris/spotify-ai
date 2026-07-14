# Network Map Quality Report

## Evaluation snapshot

- Date: 2026-07-14
- Similarity model: `metadata-v1`
- Layout model: `forceatlas2-v2`
- Library evaluated: 1,283 liked tracks
- Sparse relationships: 2,667
- Multi-song neighborhoods: 129
- Explicit islands: 173
- Same-artist relationships: 443 (16.6%)
- Qualitative benchmark: 16 of 16 fixture seeds retain a plausible expected neighbor
- Automated checks: 29 tests across graph construction, layout/cache stability, discovery resolution and placement, feedback, persistence, Spotify mutation validation, and token-refresh state

## Performance

| Path | Measured result | Product budget | Result |
| --- | ---: | ---: | --- |
| Cold graph construction and layout | approximately 2.8-3.1 seconds | under 6 seconds | Pass |
| Cached graph restoration | approximately 1.4-1.7 seconds | under 2.5 seconds | Pass |
| Main-thread graph algorithms | worker-backed | avoid blocking React | Pass |
| Candidate placement | anchor barycenter, no global relayout | immediate insertion | Pass |

Measurements were collected in the local development environment with the authenticated full library. They are directional rather than production telemetry.

## Relevance and explainability

The metadata model meets the first-release quality bar:

- specific genres receive more weight than broad genres through library-local IDF;
- same-artist neighbors are capped below the total neighbor limit;
- every visible relationship retains genre, artist, and album evidence;
- candidates reuse the liked-library feature model and cannot change score because unrelated candidates joined the same batch;
- weak candidates remain in a shelf rather than being inserted into a confident neighborhood;
- familiar, balanced, and adventurous modes change candidate thresholds and ordering without moving the liked-song map.

## Known limitations

- Artist genres are not track-level acoustic descriptions. The 173 islands are visible evidence of catalog gaps rather than songs forced into a misleading `mixed` group.
- Two-dimensional position is approximate. Local neighbors and stored edge evidence are the source of truth.
- Gemini requests cannot complete from the current execution location because Google returns `User location is not supported for the API use`. The base map and failure state remain usable.
- A live save verification requires the user to sign in once with the new `user-library-modify` scope. Automated verification does not mutate the user's Spotify library or playlists.

## Phase 5 model decision

Keep `metadata-v1` for the first complete product loop. Do not add semantic descriptors to map placement yet.

No defensible, sufficiently covered track-level descriptor source has been validated in this repository, and Gemini-generated descriptors cannot currently be measured live from this server location. Introducing semantic placement now would add cost and hallucination risk without comparative evidence. Any future hybrid model should use a new `modelVersion`, a fixed before/after relevance set, catalog-coverage reporting, and explicit latency/cost measurements.

## Release interpretation

The map is ready as a spatial discovery interface at the code and deterministic-integration level. The remaining live acceptance actions belong to the user/environment boundary:

1. Sign in to Spotify again to grant the added save scope and obtain a fresh refresh token.
2. Run one candidate discovery from a Gemini-supported server region.
3. Audition and deliberately save or playlist one candidate to confirm the external account mutation.
