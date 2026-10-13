# Shop scene

The Shop screen is a pixel storefront layered on the retro theme. The rules live in `src/retro/shop.css` (loaded after `retro.css`); the art is drawn in code in `src/components/ShopArt.tsx` through `src/components/PixelArt.tsx`.

## Art inventory and provenance

All art is original, drawn as character grids and rendered as SVG `<rect>` runs with `shape-rendering: crispEdges`. No bitmap was added and nothing was extracted from or traced over any reference image. The art carries the repository's license.

| Element | Component | Notes |
| --- | --- | --- |
| Chef-hat mascots | `ShopMascot` | Shiba face for Chase, grey cat face for Shooshy; mirrored on the right |
| Marquee arch | `ShopCrest` | Stepped gold and orange arch above the sign |
| Currency icon | `ShopCurrencyIcon` | Bone for Chase, fish for Shooshy, on the wallet plaque and every price tag |
| Bunting | `ShopBunting` | Per-character pennant palette; also used in the Fitting Room |
| Star glints | `ShopGlint` | Four-point sparkle |
| Vines | `ShopVine` | Brick-top and Fitting Room frame |
| Door glyph | `ShopDoorIcon` | Fitting Room button |
| Mirror, stool, ornaments | `ShopMirror`, `ShopStool`, `ShopOrnament` | Fitting Room stage |

The sign, wallet plaque, card frames, floorboards and Fitting Room button are CSS (gradients, inset box-shadows, text-shadow extrusion).

## Behavior and accessibility

Catalog, prices, labels, confirm dialog, disabled states, equip and unequip, and persistence are unchanged. Every decorative SVG is `aria-hidden="true"` and `focusable="false"`. The wallet keeps its `aria-label` (for example "17 bones"); the count and word beside the icon are `aria-hidden`.

Motion is three stepped animations (sign glow, star twinkle, bunting sway). `prefers-reduced-motion: reduce` sets `animation: none` on all of them.

## Measured contrast (WCAG 2.x)

| Text on surface | Ratio |
| --- | --- |
| Sign title `#ffe9a8` on `#7a5233` | 5.67:1 |
| Wallet count `#ffe9a8` on `#5a3a22` | 8.47:1 |
| Wallet word `#fff4e8` on `#5a3a22` | 9.38:1 |
| Price `#f2c35e` on `#101b2d` | 10.47:1 |
| Unaffordable price `#8a8d99` on `#101b2d` | 5.22:1 |
| Fitting Room label `#fff4e8` on `#b3461a` | 5.08:1 |
| Fitting Room label on top half `#c04c1c` | 4.51:1 |

## Captures

`docs/shop-redesign/before/` and `docs/shop-redesign/after/` hold Chase (`shiba-*`) and Shooshy (`shooshy-*`) captures at 375px and 1280px, with the Fitting Room open (`*-fitting`). `after/` also holds owned, equipped plus unaffordable, focus and purchase-confirm states at 375px.
