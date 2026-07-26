# Asteroids

A polished, dependency-free browser homage to Atari's 1979 vector arcade shooter. Open `index.html` in any modern browser—no install or build step is required.

## Play

- **Left / Right** or **A / D** — rotate
- **Up** or **W** — thrust
- **Space** or **X** — fire
- **H** — hyperspace
- **P** — pause / resume
- The illuminated on-screen buttons provide the same controls on touch devices.

Destroy rocks before they collide with your ship. Large rocks split twice, later waves add more and faster debris, and UFOs arrive from wave two. Every 10,000 points earns an extra ship. Your high score persists locally in the browser.

## Architecture

`game.js` holds a compact fixed-responsibility Canvas loop: input is registered once at boot, `update()` advances simulation state, and `draw()` renders the vector scene. Entities are plain objects with circular collision bounds and toroidal distance/wrapping. The Web Audio API synthesizes all effects directly; no assets or external dependencies are used. CSS makes the canvas fluid while JavaScript uses the device pixel ratio for sharp rendering.

## Accessibility and testing

The start/restart control is native and keyboard-focusable, touch buttons are labelled, and visual state is announced through the overlay. Basic syntax verification: `node --check game.js`.
