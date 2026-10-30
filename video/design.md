# PatchTest video design

Not invented for the video. Every value below is lifted from the running product,
`app/globals.css` and `app/layout.tsx`, so the film and the thing it is showing
are the same object.

## Palette

| Token | Hex | Use |
|---|---|---|
| paper | `#fbfaf7` | Background. Warm off-white, the product's canvas |
| surface | `#ffffff` | Cards sitting on paper |
| sunken | `#f5f3ee` | Recessed panels inside a card |
| ink | `#191c1a` | Primary text |
| muted | `#5f6660` | Secondary text |
| faint | `#6f756f` | Labels and small print |
| accent | `#2f5d4f` | Deep green. The brand. Primary action only |
| accent-soft | `#edf4f0` | Accent background wash |
| block | `#a5342b` | Clay red. "Not for you right now" |
| block-soft | `#fbedeb` | |
| adjust | `#8a5a14` | Ochre. "Adjust" |
| adjust-soft | `#fdf3e2` | |
| unnecessary | `#4a5159` | Slate. "You don't need this" |
| refer | `#2b5579` | Blue. "Worth showing a professional" |
| refer-soft | `#eaf1f8` | |

The four verdict colours are load bearing. They mean one thing each in the
product and must mean the same thing on screen. Never use a verdict colour
decoratively.

## Typography

- **Display:** Source Serif 4, weights 400 and 600. Headlines and numbers.
  Letter-spacing `-0.015em`.
- **Body:** Geist Sans. Everything else.
- **Mono:** Geist Mono. Rule ids, code, `raw_score`.
- Tabular numerals on anything numeric.

## Corners and depth

- Radius 12px on cards, 8px on inner panels, 999px on badges.
- Borders are alpha, `rgb(25 28 26 / 0.09)`, so they recede rather than sit on
  top. Never a solid hex border on light.
- Shadows are layered, never one big drop:
  `0 1px 1px rgb(25 28 26 / 0.04), 0 4px 8px rgb(25 28 26 / 0.04), 0 12px 24px rgb(25 28 26 / 0.05)`

## Motion

Calm and editorial. The product's own easing is `cubic-bezier(0.32, 0.72, 0, 1)`
for entrances, 240ms to 260ms, with a 45ms stagger on lists. Match it. Nothing
bounces. Nothing spins.

## What NOT to do

- No purple, indigo or violet. No gradient text. No glassmorphism or blur panels.
- No emoji, anywhere.
- No real brand name, logo or product. "Lumen & Leaf" and "Verdant Row" are
  fictional and are the only shop names that may appear.
- No colour outside the palette above.
- Do not restate on screen what the narrator is already saying. The voice carries
  the argument; the screen carries the evidence.
- No stock-video energy: no whooshes, no flares, no kinetic text for its own sake.
  This is a clinical safety tool and should feel like one.
