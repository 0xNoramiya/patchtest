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

**The cover is generated art.** It was made with Higgsfield (`gpt_image_2_5`) and
is an illustration, not a photograph: no real person, place or product appears in
it, and every container in it is deliberately blank, with no label, logo or trade
dress of any kind. The unmodified generator output is kept at
`source/cover-generated-1024.png`, because a generative API bills per call and
does not return the same image twice; `scripts/gallery-cover.mjs` crops it to an
exact 3:2 and resizes it.

One note on that, since it is the sort of thing that is easy to miss: the 2K model
upscale of this cover came back with scrawled lettering hallucinated into the
blank paper at the bottom. It was faint, but it read as handwriting. The cover
here is a plain Lanczos resize of the original instead, which is very slightly
softer and has nothing in it that nobody wrote.
