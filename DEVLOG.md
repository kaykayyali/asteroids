# Development log

## 2026-07-26 — v1: complete playable foundation

Built the standalone Canvas game: vector ship physics, toroidal movement, three-stage asteroid splitting, bullets, collisions, progressive waves, UFO fire, hyperspace, score/lives/high-score state, synthesized audio, overlay states, and touch controls. I chose a permanent single `requestAnimationFrame` loop and one-time input registration so restarts reset state rather than duplicate loops/listeners. Syntax verification is recorded with the initial commit. Rejected an external engine or audio files because direct opening and the brief's no-build requirement are better served by native browser APIs.

## 2026-07-26 — iteration 1: impactful fragmentation

Fragment velocities now inherit a controlled share of their parent rock's momentum, which makes a hit read as a split rather than two unrelated spawns. Large impacts add a very short canvas shake. I rejected longer camera movement because it would obscure the intentionally precise vector controls.
