# Status room and UI font

## Status screen

The Status screen is a brick header with a hanging currency plaque, a framed pixel room behind the character, the exact health label, a wallet plaque and the Daily Food quest button, then Update answers and View past run. Styles are in `src/retro/status.css`; art is drawn in code in `src/components/StatusArt.tsx` (reusing `ShopBunting`, `ShopVine`, `ShopCurrencyIcon` and `BrickWall` from the Shop).

- Shooshy: cat tree, wall perch and food bowl. Chase: dog house, ball and bone.
- Everything inside `.status-decor` is `aria-hidden`, `pointer-events: none` and unfocusable.
- The character is locked after onboarding, so there is no switch control.
- Fish (Shooshy) and bone (Chase) glyphs match the Shop. Prices, rewards, persistence and routes are unchanged.
- Bunting sway and star twinkle stop under `prefers-reduced-motion: reduce`.

## Font

| Role | Face | Source and license | Fallback |
| --- | --- | --- | --- |
| Body, numerals, nav, cards, forms, controls (`--px-font`) | Atkinson Hyperlegible 400 and 700 | `@fontsource/atkinson-hyperlegible` 5.3.0, self-hosted woff2 in `src/retro/`, SIL OFL 1.1 (`OFL-AtkinsonHyperlegible.txt`) | system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif |
| Short `h1` headings only (`--px-display`) | Pixelify Sans | `src/retro/PixelifySans.ttf`, SIL OFL 1.1 (`OFL.txt`) | Atkinson Hyperlegible, system-ui |

Sizes and line height are unchanged: body 1.125rem, small 1rem, title 1.75rem, line height 1.3. Both faces use `font-display: swap`.

## Measured contrast (WCAG 2.x)

| Text on surface | Ratio |
| --- | --- |
| Body `#fff4e8` on panel `#222034` | 14.62:1 |
| Muted `#cbdbfc` on panel | 11.39:1 |
| Header subtext `#9fc4f0` on brick `#1d4a3a` | 5.56:1 |
| Eyebrow `#99e550` on brick | 6.54:1 |
| Heading `#f2c35e` on brick | 6.09:1 |
| Health label `#f2c35e` on panel | 9.62:1 |
| Balance `#f2c35e` on `#171b2a` | 10.39:1 |
| Disabled `#8a8d99` on `#171b2a` | 5.18:1 |

## Captures

`before/` is origin/main, `after/` is this branch: Status for both characters at 320, 375 and 1280 where noted, quest ready and claimed, a 7-digit balance at 320, focus, and the 320px plan, Shop and onboarding screens.
