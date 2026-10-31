# Devpost gallery

Six images, all 1800&times;1200 (exactly 3:2) and all well under the 5 MB cap.

| File | What it is |
|---|---|
| `thumbnail.png` | The cover |
| `01-verdicts.png` | The results page: a verdict, a rule and a source per item |
| `02-two-numbers.png` | The scan panel: `raw_score` against `ui_score` |
| `03-extension.png` | The extension annotating a third-party shop's cart |
| `04-eval.png` | `/eval`: the comparison arm, reported honestly |
| `05-mcp.png` | `/mcp`: the guardrail as an MCP server |

## Where they come from

**The five screenshots are the deployed app**, captured by `scripts/gallery.mjs`
against `https://patchtest.fly.dev` and laid into a frame that uses the site's own
colours and typefaces. Nothing in them is a mock-up or a redraw, so a figure in a
caption can be checked against the screenshot beside it. Rebuild them with:

```bash
node scripts/gallery.mjs
```

The extension pane is captured with the extension actually installed in the
browser, the same way `scripts/test-extension.mjs` does it.

**The cover is generated art with the pitch set over it.** The photograph was made
with Higgsfield (`gpt_image_2_5`), prompted so the objects sit on the right and
the left half stays empty paper, and it is an illustration rather than a
photograph of anything real: no real person, place or product appears in it, and
every container is deliberately blank, with no label, logo or trade dress of any
kind. Three stay together and one is set apart with a card beside it, which is
the product in one picture.

The headline, the four verdicts and the footer are set by
`scripts/gallery-cover.mjs` in the site's own typefaces rather than asked of the
image model. A cover has to spell a long sentence correctly and sit in the
product's own type, and neither is worth leaving to a sampler. Rebuild it with:

```bash
node scripts/gallery-cover.mjs docs/gallery/source/cover-generated-1024.png
```

The unmodified generator output is kept at `source/cover-generated-1024.png`,
because a generative API bills per call and does not return the same image twice.

Two notes, since both are easy to miss. The art is resized with a plain Lanczos
filter and not a model upscale: the 2K upscale of an earlier cover came back with
scrawled lettering hallucinated into the blank paper, faint but legible as
handwriting, and invented text on a submission cover is worse than a slightly
softer one. And the first cover was a pretty still life that said nothing &mdash;
it could have belonged to any skincare brand. A gallery cover has about one second
to land the pitch, which is why this one carries the headline.

The type is sized for the card, not for the file. A gallery grid renders these at
roughly 460px, a quarter of their real width, so anything under about 26px at full
size is texture rather than copy. That is why the sub-line is one sentence: the
fewer words there are, the bigger they can be. Checked by rendering the cover down
to 460px and again to 300px, where the headline and the URL both still read.
