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
