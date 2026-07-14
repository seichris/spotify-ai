# Network Map Review Ledger

This ledger records the deep review/fix gate completed after each implementation phase. Findings at P0-P2 must be fixed or explicitly accepted before the next phase starts. Existing user-owned changes in `src/app/layout.tsx` and `src/auth.ts` are outside the review-owned diff unless a later phase intentionally changes them.

## Review baseline

- Base commit: `aa5ae9f90d0004654e8e552003be2bf0a1e87548`
- Review mode: deep, fix locally
- Severity gate: P0, P1, P2
- Maximum review iterations per phase: 5
- Required gate checks: tests, lint, production build, and proportionate browser verification

## Phase 0: Baseline and fixtures

### Iteration 1

| ID | Severity | Finding | Resolution |
| --- | --- | --- | --- |
| F0-001 | P1 | The original Next.js dependency had published high-severity advisories. | Upgraded Next.js and its matching ESLint configuration to 16.2.10, updated React, and ran the non-breaking audit fix. No high or critical production advisories remain. |
| F0-002 | P2 | The first synthetic fixture did not provide the planned 15-20 qualitative benchmark seeds. | Expanded the fixture to 20 unique tracks and 16 named benchmark cases spanning repeated artists, broad and specific genres, missing genres, an isolate, and a duplicate record. |

### Confirming pass

- Result: clean at P0-P2.
- Tests: 5 passed.
- Lint: passed with pre-existing warnings only.
- Production build: passed.
- Audit note: three moderate reports remain because Next.js embeds PostCSS below 8.5.10; npm offers no compatible non-breaking upgrade. The app does not stringify untrusted CSS at runtime.

## Phase 1: WebGL renderer migration

### Iteration 1

| ID | Severity | Finding | Resolution |
| --- | --- | --- | --- |
| F1-001 | P1 | Tailwind 4 was configured with the removed v3 directives, leaving most utility classes unapplied across the app. | Replaced the directives with the Tailwind 4 CSS import and browser-verified the styled dashboard and playlist view. |
| F1-002 | P1 | React Sigma's root CSS variable forced a white canvas over the intended dark map. | Scoped Sigma background and control variables to `.song-map`; the full 1,283-node map now renders on the dark canvas. |
| F1-003 | P2 | The canvas exposed pointer selection only, so keyboard users could not reach song inspection and playback. | Added a labeled keyboard song picker, map-region semantics, instructions, and the same selected-song controls used by pointer selection. |
| F1-004 | P2 | The page copy claimed vibe and artist connections while the Phase 1 preview graph only supplies temporary deterministic positions. | Reworded the description to state the interactions that the renderer currently provides. |
| F1-005 | P2 | Selected or hovered track objects could remain visible after the supplied library changed. | Derived visible interaction state from the current track index and deduplicated the keyboard picker from that same index. |
| F1-006 | P2 | Development from the canonical `127.0.0.1` host triggered Next.js cross-origin development-resource warnings. | Added `127.0.0.1` to `allowedDevOrigins`. |

### Confirming pass

- Result: clean at P0-P2 for the Phase 1 diff.
- Tests: 7 passed.
- Lint: passed with four pre-existing warnings only.
- Production build: passed on Next.js 16.2.10.
- Browser: rendered 1,283 image nodes; zoom, fit, fullscreen controls, keyboard selection, selected-song playback action, and the existing playlist view were present and responsive.
- Environment note: the verification Chrome profile injects an extension script into `<head>`, producing a development-only React hydration warning that identifies the extension-modified markup. It is not emitted by the production build and is outside the application diff.

## Phase 2: Similarity graph and communities

### Iteration 1

| ID | Severity | Finding | Resolution |
| --- | --- | --- | --- |
| F2-001 | P1 | The first ForceAtlas2 settings produced a single ring-like mass, and the DOM cluster label layer did not surface useful neighborhood landmarks. | Seeded ForceAtlas2 from deterministic topology-derived community positions, versioned the layout as `forceatlas2-v2`, added colored image padding, attached the ten largest deterministic labels to representative graph nodes, and added an accessible neighborhood navigator. |
| F2-002 | P2 | The first cache fingerprint used only a 32-bit hash of track IDs, so changed graph metadata or an input-order-dependent duplicate could reuse stale positions. | Made duplicate choice deterministic, included album/artist/genre inputs in a two-part fingerprint, and validate schema/model/layout/fingerprint before consuming any cached clusters or positions. |
| F2-003 | P2 | The worker remained alive after returning a result or handled error. | Terminate the graph worker after result, handled worker error, and runtime worker failure. |
| F2-004 | P2 | Cluster selection could retain an unrelated song inspector and used a fixed camera ratio that did not actually frame different-sized communities. | Cluster navigation now clears song state, song selection clears stale cluster state, and the target camera ratio is derived from the selected community's extent. |
| F2-005 | P2 | The graph status counted singleton isolates as neighborhoods, making the real-library result look like 302 coherent clusters. | Report multi-song neighborhoods separately from explicit islands: 129 neighborhoods and 173 islands in the current 1,283-song library. |
| F2-006 | P2 | Relationship construction ran while the progress UI still claimed it was only normalizing metadata. | Emit the relationship stage before pair construction begins and retain staged progress through communities and layout. |
| F2-007 | P2 | Reducer cleanup scheduled a Sigma render after the map container unmounted, producing zero-width and missing-node-program errors during view switches or hot reload. | Batch reducer changes on the next animation frame only while the container is connected and sized; cancel pending work on cleanup and let Sigma teardown own final rendering. |

### Confirming pass

- Result: clean at P0-P2 for the Phase 2 diff.
- Tests: 17 passed, including the 16-seed qualitative benchmark, deterministic cold layout/community output, metadata-sensitive cache invalidation, artist caps, missing metadata, and stored evidence.
- Lint: passed with four pre-existing warnings only.
- Production build: passed.
- Real library: 1,283 nodes, 2,667 sparse relationships, 129 multi-song neighborhoods, 173 explicit islands, and 443 same-artist edges (16.6% of edges).
- Performance: approximately 2.8-3.1 seconds cold and 1.4-1.7 seconds from cache on the development machine.
- Browser: neighborhood highlighting/explanations, cluster labels and navigation, zoom, cached restoration, and map-to-playlist view switching passed. After the render-race fix, the only new browser error was the previously documented extension-injected `<head>` hydration warning.

## Phase 3: Map-native discovery

### Iteration 1

| ID | Severity | Finding | Resolution |
| --- | --- | --- | --- |
| F3-001 | P1 | The configured `gemini-3-pro-preview` endpoint had been shut down, so every real discovery request failed before generation. | Updated the documented and application default to the current stable `gemini-3.5-flash` model and added its current standard token pricing. |
| F3-002 | P2 | A malformed nested server-action context could throw while reading artist or genre arrays, and one failed Spotify artist batch discarded otherwise valid resolved tracks. | Added bounded runtime sanitization for every discovery-context field and made artist enrichment degrade to empty genres per failed batch. |
| F3-003 | P2 | Clearing the discovery tray while a request was active allowed the late response to repopulate it. | Added request generations so clear cancels the visible request and stale success, error, and loading updates are ignored. |

### Iteration 2

| ID | Severity | Finding | Resolution |
| --- | --- | --- | --- |
| F3-004 | P2 | Candidate IDF weights were recalculated from the whole recommendation batch, so unrelated suggestions could move a candidate or change its confidence. | Calculate IDF from the liked library only, create candidate feature rows separately, and added a batch-invariance regression test. |
| F3-005 | P2 | Spotify search matches marked local, unavailable, or non-track could reach the discovery tray. | Reject local tracks, `is_playable: false`, missing URIs, and non-track records during catalog resolution. |

### Confirming pass

- Result: clean at P0-P2 for the Phase 3 diff.
- Tests: 22 passed, including all three discovery scopes, Spotify title/artist validation, liked/dismissed/duplicate exclusion, stable library-derived candidate scoring, weak-match shelving, deterministic anchor placement, and visible evidence edges.
- Lint: passed with four pre-existing warnings only.
- Production build: passed.
- Browser: song and neighborhood entry points, loading and cancellation states, and contained recommendation failure were verified against the authenticated 1,283-song library. Gemini's API rejected both current 3.5 Flash and compatible 2.5 Flash requests from this execution location with `User location is not supported for the API use`; the base graph remained fully interactive and the deterministic happy path is covered by the discovery tests.
- Model note: the retired-model 404 was fixed independently of the location-policy response. The local configuration now selects the current stable model.

## Phase 4: Save and feedback loop

### Iteration 1

| ID | Severity | Finding | Resolution |
| --- | --- | --- | --- |
| F4-001 | P1 | The initial save implementation targeted Spotify's deprecated track-specific library endpoint. | Implemented the current `PUT /me/library` Save Items API with canonical track-URI validation and added `user-library-modify` to the OAuth scope. |
| F4-002 | P2 | Discovery candidates, dismissals, and outcomes disappeared on reload and could not influence later batches. | Added a bounded, schema-versioned local session containing candidates, dismissals, exploration mode, and typed events; restored candidates reconcile against the current graph. |
| F4-003 | P2 | Exploration was only a prompt concept and did not affect graph confidence or ranking. | Added familiar/balanced/adventurous thresholds, novelty preferences, and feedback-aware reranking while preserving the underlying metadata score. |

### Iteration 2

| ID | Severity | Finding | Resolution |
| --- | --- | --- | --- |
| F4-004 | P2 | `preview_started` was recorded before Spotify acknowledged playback, including the no-device and failed-request paths. | Playback now returns an explicit success result; candidate preview feedback is recorded only after Spotify accepts the play request. |
| F4-005 | P2 | Rapid double clicks could launch duplicate Gemini requests or add the same track to a playlist twice. | Added synchronous per-request and per-track in-flight guards around discovery, playlist, and save mutations. |
| F4-006 | P2 | A candidate below the current exploration threshold lost its raw similarity score, so changing exploration mode appeared to change the similarity model itself. | Preserve the strongest raw anchor score separately from the filtered visible anchors; tests prove familiar/adventurous modes alter eligibility without altering score. |

### Confirming pass

- Result: clean at P0-P2 for the Phase 4 diff.
- Tests: 26 passed at the phase gate, including versioned restore/rejection, feedback reranking, exploration thresholds, dismissal exclusion, and Spotify URI validation.
- Lint: passed with the then-existing two image warnings only; those warnings were removed in Phase 5.
- Production build: passed.
- Browser: the prior Spotify access token expired during the gate and the app safely cleared its library cache and returned to login. Granting the new modify-library scope and performing a real save are intentionally left to the user; no external library or playlist mutation was made during automated review.

## Phase 5: Quality and richer similarity

### Iteration 1

| ID | Severity | Finding | Resolution |
| --- | --- | --- | --- |
| F5-001 | P1 | NextAuth persisted Spotify refresh tokens but never exchanged them, so every one-hour access-token expiry forced a new login. | Implemented Auth.js JWT refresh-token rotation with a one-minute skew, preservation of one-time refresh tokens, a process-local concurrency guard, and explicit refresh failure state. |
| F5-002 | P1 | Playlist creation and item mutations still used Spotify routes removed or deprecated in February 2026. | Migrated to `POST /me/playlists` and `/playlists/{id}/items`; retained the current `PUT /me/library` save path. |
| F5-003 | P2 | Existing playlist server actions accepted arbitrary IDs and URI arrays before forwarding them to Spotify. | Validate canonical 22-character Spotify resource IDs, bounded track URI arrays, playlist names, and descriptions before external mutations. |

### Iteration 2

| ID | Severity | Finding | Resolution |
| --- | --- | --- | --- |
| F5-004 | P2 | Concurrent server requests could attempt to refresh the same Spotify token simultaneously in one runtime. | Reuse one in-flight refresh promise per refresh token and clear it after settlement; the expiry skew further reduces the refresh boundary window. |
| F5-005 | P2 | A semantic similarity layer could not be compared reliably because no covered source or live Gemini evaluation was available. | Kept the measured `metadata-v1` model, documented its real-library quality/performance and limitations, and required a versioned comparative benchmark before semantic placement can ship. |

### Confirming pass

- Result: clean at P0-P2 for the Phase 5 diff.
- Quality report: see `NETWORK_MAP_QUALITY_REPORT.md`.
- Tests: 29 passed across seven files.
- TypeScript: passed with no emit.
- Lint: passed with no warnings or errors.
- Production build: passed on Next.js 16.2.10.
- Dependency audit: no high or critical production advisories. The three previously documented moderate reports remain in Next.js's embedded PostCSS; npm still offers no compatible non-breaking fix and the application does not stringify untrusted CSS.
- Live-boundary note: the browser is at the Spotify sign-in boundary because the previous access token expired. The new refresh logic applies after the next login supplies a fresh refresh token and the added scope.
