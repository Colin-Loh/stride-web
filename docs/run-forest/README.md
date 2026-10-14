# Run forest

The active Run screen shows the selected character (Chase or Shooshy) running through a framed 8-bit forest, in the same frame style as the Shop fitting room and Status room.

## Code

- `src/components/RunArt.tsx`: forest layers drawn as character grids through `PixelArt` (clouds, far trees, near trees, ground).
- `src/retro/run.css`: stage frame, layer scroll animation, reduced-motion rule.
- `src/screens/RunScreen.tsx`: wraps the existing `RunnerSprite` in `.run-stage` and sets `data-motion` to `ready`, `running` or `paused`. No change to `useRunSession`, plan data, routes or rewards.

## Motion

- Each layer scrolls by exactly one tile per loop with `steps()` timing, using only `transform`. Cloud loop 70s, far trees 20s, near trees 9s, ground 1.6s.
- `data-motion="running"` plays the layers. `ready` and `paused` set `animation-play-state: paused`, so the scene freezes in place.
- Under `prefers-reduced-motion: reduce` the layer animation is `none` in every state.
- Decorative layers are `aria-hidden`, have `pointer-events: none` and contain no focusable elements.

## Typography

Unchanged. H1 Press Start 2P, buttons Pixelify Sans, numbers and paragraphs Greybeard (computed styles recorded in `results.txt`).

## Evidence

Screenshots of a production `vite preview` build, named `<character>-<state>-<width>.png` and `<character>-running-reduced-<width>.png`, at 320, 375 and 1280px. `results.txt` holds the computed animation state, overflow, stage size, sprite count and fonts for each capture.
