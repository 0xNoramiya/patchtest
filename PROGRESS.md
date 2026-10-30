# PatchTest progress

Updated: Sat Oct 31 2026, 01:45 UTC+8

**Live:** https://patchtest.fly.dev
**Repo:** https://github.com/0xNoramiya/patchtest
**Extension:** https://github.com/0xNoramiya/patchtest/releases/latest
**Demo shop for the extension:** https://patchtest.fly.dev/store

## Units spent

| What | Units | Running total |
|---|---|---|
| M0 smoke test, synthetic-01, both APIs | 22 | 22 of 1000 |
| Scan bank, 7 faces | 154 | 176 of 1000 |
| Fitzpatrick IV face | 22 | 198 of 1000 |
| Live-path testing | 0 | 198 of 1000 |

**198 of 1000.** Under the 300 dev target, 802 left for judges. The live-path
testing cost nothing: a face-less image exercised upload, task creation and error
mapping for free, because YouCam does not charge for a failed task, and the
success path was exercised by re-polling an already-booked task.

The deployed site enforces tighter caps than development: 3 live scans a day, with
the 900 hard stop permitting about 31 more live scans in total, ever.

## Done

**M0.** Scaffold, secrets hygiene, unit ledger with circuit breaker, YouCam client,
image normalizer, smoke test. Ten documented differences between the API docs and
the real responses in `docs/API_NOTES.md`.

**M1.** 26-SKU fictional catalogue. 24 rules as data in `rules/rules.yaml` with a
quote and access date on each. Pure-function engine. All 21 source URLs fetched and
checked: 14 verified, 7 partial, 3 heuristic rules with no source by design. Nine
disclosed synthetic faces scanned and recorded. Thresholds calibrated against the
real distribution, which caught three bugs that would have shipped.

**M3.** Browser extension, Manifest V3, downloadable from Releases. It reads a
cart on any shop's page and applies the same 24 rules. `lib/match.ts` parses a
product title into actives, percentages, tags, rinse-off and body area, with 24
tests. Extraction prefers the schema.org data shops already publish. A title it
cannot read returns UNKNOWN and says that is not a clearance.
`scripts/test-extension.mjs` loads the packaged extension into a real browser and
asserts it annotates the demo cart against production.

**M2.** Agent loop with the fair baseline. Claim linter, build-time and runtime.
40-scenario eval, both arms, three runs each. Full UI: landing, consent, intake,
cart picker, scan selection, results with mask overlays, `/methods`, `/eval`.
Live scan path with a client-side quality check. Deployed to Fly with a persistent
volume.

## Eval headline

| | With guardrail | Plain advisor |
|---|---|---|
| Sold an item the gold calls unsafe | **0%** | **22.5%** |
| Sold an item needing a caveat, with none | 11.1% | 100% |
| Same cart on all three runs | 65% | 65% |
| Mean cart value | $82.70 | $90.99 |

23 of 24 rules fired exactly when they should and stayed quiet exactly when they
should. The 24th is the sunscreen rule, which never needed to fire because the
advisor had already added sunscreen.

## Still open for Rifqi

1. **Record the video.** `docs/VIDEO_SCRIPT.md` is a shot-by-shot 2:30 script.
   This is the only required submission item that is not done.
2. **Submit to Devpost.** `docs/DEVPOST.md` is the write-up, ready to paste.
3. **Two gold labels want a second look.** Both are flagged in `eval/gold.json`
   and named on the `/eval` page. S19 asks whether a 30% at-home peel should carry
   a caveat for everyone rather than only for Fitzpatrick IV to VI. S36 asks
   whether someone who only flushes with warmth and wine should trip the
   reactive-skin rule. Neither was edited to improve our own score.
4. **S18's gold is over-specified.** It labels the whole benzoyl peroxide class as
   needing a caveat, while the rule is strength-specific and correctly says
   nothing about the 2.5%. This is the entire source of the guarded arm's 11.1%.
   Your call whether to narrow the label.
5. **Rotate both API keys after judging closes on 20 Nov.** They were pasted into
   chat.
6. **The scan bank has no Fitzpatrick I.** Five of six types are covered.

## Design and assets

- 26 generated product images, unbranded with no text, and nine disclosed
  synthetic faces. Every image in the project is generated.
- Favicon is a patch test grid with one site reacting. No default Next.js assets
  remain.
- Design pass: alpha borders, layered shadows, a verdict colour rail on cart
  rows, and the scan panel drawing the measured score against the one YouCam
  shows so the compression is visible. The OK verdict no longer shares the brand
  green, and the focus ring is neutral.

## Fixed after review

- **The pregnancy preset was showing a man.** The acne face was regenerated to
  read as clearly adult and became male; nothing re-checked which scenarios
  pointed at it. Four eval scenarios had the same fault. Both corrected, and two
  tests now fail the build if it recurs.
- **The eval page promised one thing and showed another.** Its "where the plain
  advisor fell short" section printed our own gold rationale instead of what the
  advisor did. It now names the product sold uncaveated and quotes what PatchTest
  said about the same item.

## Not built

- The MCP tool `check_cart`, which was a stretch goal. The HTTP endpoint the
  extension uses is already that shape, so it is a thin wrapper away.
- A Bahasa Indonesia interface, also a stretch goal.
- MediaPipe face detection in the browser. The pre-check uses resolution,
  brightness and framing instead. The reason is in `docs/API_NOTES.md`: YouCam
  charges nothing for a task that fails validation, so a face check in the browser
  saves the shopper time rather than saving units, and the API's own face checks
  are authoritative. Their error codes are mapped to plain messages.
