# Development log

## 2026-07-26 — v1: complete playable foundation

Built the standalone Canvas game: vector ship physics, toroidal movement, three-stage asteroid splitting, bullets, collisions, progressive waves, UFO fire, hyperspace, score/lives/high-score state, synthesized audio, overlay states, and touch controls. I chose a permanent single `requestAnimationFrame` loop and one-time input registration so restarts reset state rather than duplicate loops/listeners. Syntax verification is recorded with the initial commit. Rejected an external engine or audio files because direct opening and the brief's no-build requirement are better served by native browser APIs.

## 2026-07-26 — iteration 1: impactful fragmentation

Fragment velocities now inherit a controlled share of their parent rock's momentum, which makes a hit read as a split rather than two unrelated spawns. Large impacts add a very short canvas shake. I rejected longer camera movement because it would obscure the intentionally precise vector controls.

## 2026-07-26 — iteration 2: safer re-entry

Ship spawning now samples a clear location when debris occupies the center rather than relying only on invulnerability. This avoids a frustrating respawn directly inside a large rock while retaining the short visual re-entry grace period. I kept the central spawn as the first choice for predictability.

## 2026-07-26 — iteration 3: reliable UFO passes

UFO entry direction is now coupled to its velocity, guaranteeing every saucer crosses the playfield instead of occasionally drifting straight back off screen. Its speed increases gently with wave number. I rejected aggressive homing movement because classic UFOs should remain readable lateral threats.

## 2026-07-26 — iteration 4: single-fire touch hyperspace

Removed a duplicate touch-path invocation for hyperspace. The shared input update now consumes both keyboard and touch H presses exactly once, preventing accidental double teleports. I retained the short cooldown to prevent a held control from chaining jumps.

## 2026-07-26 — iteration 5: pause control

Added a non-destructive P-key pause with an explicit centered status message. Simulation stops while rendering continues, and restart always clears the paused state. I chose not to auto-pause on browser blur because that can be surprising on mobile; blur still clears held inputs to avoid stuck thrust.

## 2026-07-26 — iteration 6: accessible sound toggle

Added a visible M-key sound toggle that silences synthesized effects without suspending the game or creating extra audio contexts. This is useful in shared/mobile environments and preserves immediate resumption. A volume slider was rejected because it would clutter the deliberately sparse arcade HUD.

## 2026-07-26 — iteration 7: thrust feedback

Added a sparse amber particle exhaust behind the ship during thrust, using the existing particle pool and velocity so it reinforces direction without compromising vector clarity. I rejected a continuous smoke trail because it made slow navigation noisier than it was helpful.

## 2026-07-26 — iteration 8: wave transition cue

Each fresh field now gets a brief, fading wave announcement. This makes the increasing difficulty legible without interrupting play or requiring a modal. I rejected a pause between waves because the empty-field moment is a useful breather and classic arcade pacing benefits from continuity.

## 2026-07-26 — iteration 9: reduced-motion support

The game now detects the platform reduced-motion preference and removes impact shake, suppresses exhaust, and substantially reduces explosion/background particle density. Core movement remains intact. I rejected altering ship or asteroid speed because that would change play rather than only presentation.

## 2026-07-26 — iteration 10: resilient live high score

High score now updates immediately as a record is beaten and local-storage access is safely guarded for privacy-restricted browser contexts. A blocked storage API no longer prevents initialization or play. I rejected cloud scoreboards because they conflict with the no-service, directly-openable design.

## 2026-07-26 — iteration 11: UFO warning signal

The HUD now reports a short UFO signal before a saucer arrives. Separating the countdown from spawn logic made this a reliable warning rather than a random flash. I rejected a directional indicator: it would over-explain a threat that should stay surprising but fair.

## 2026-07-26 — iteration 12: resize-state integrity

All active entities now wrap immediately after a viewport resize, including while paused. This closes the edge case where a narrower resized viewport could leave a ship or projectile visually outside the field until simulation resumed. I retained the device-pixel-ratio cap because it protects performance on very dense displays.

## 2026-07-26 — Exhausted

Verified the final JavaScript with `node --check game.js`; no headless browser is installed in this environment for an automated console pass. The game is intentionally dependency-free and uses only browser-native Canvas, input, storage, and Web Audio APIs, so opening `index.html` remains the complete runtime path.

I considered and rejected: multiplayer/network scoreboards (would break the standalone design), an external asset pack (contrary to synthesized/vector presentation), procedural missions (would dilute the focused arcade loop), a settings panel (would overcrowd the cabinet UI), stronger UFO homing (less fair/readable), unlimited late-wave asteroid count (poor performance/readability), and a build tool/framework (unnecessary surface area). The remaining ideas are stylistic variants rather than meaningful improvements to the requested 1979 Asteroids loop.

## 2026-07-26 — code-quality refactor: readable source layout

Replaced the compressed source with conventionally formatted HTML, CSS, and JavaScript. The game state and update/render responsibilities are now separated into named functions, every source line is at or below 100 characters, and narrow screens receive appropriately smaller touch controls. Pointer capture was added so touch presses release reliably even if a finger leaves its original button. This deliberately preserves the existing game rules; documentation is added in the following commit so the formatting diff remains reviewable on its own.

## 2026-07-26 — code-quality refactor: explanatory subsystem comments

Added a file header and explicit sections for state, audio, lifecycle, physics/collisions, rendering, and input. Comments now document the design reasons behind delta-time clamping, toroidal distance, drag conversion, resize wrapping, audio envelopes, and pointer capture rather than paraphrasing syntax. I rejected line-by-line commentary because it would add noise without improving maintenance decisions.

## 2026-07-26 — code-quality verification: lifecycle and narrow viewport

Ran `node --check` over every JavaScript file and a whitespace/line-length check over all browser source files. Re-read `frame`, `startGame`, `resetGame`, and `resize`: exactly one animation loop and one set of input listeners are installed at boot; restart replaces state only; resize recalculates the DPR backing store, wraps every active entity, and rebuilds stars even when paused. Narrow-viewport CSS reduces button width/gaps below 440px, while pointer capture and cancellation handling preserve touch release behavior. No browser binary is installed here for a headless console pass.
