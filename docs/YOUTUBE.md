# YouTube upload

The rendered file is `video/patchtest-trailer.mp4` (1920x1080, 2:53). It is not in
the repo — `.gitignore` keeps rendered video out, because the copy that matters is
the one on YouTube.

Upload it **unlisted or public**, not private. A private video cannot be opened by
a judge, and that is the single most common way a submission loses its demo.

## Title

```
PatchTest — an AI skincare advisor that knows when not to sell
```

## Description

```
PatchTest is a skincare shopping advisor for the moment before checkout. It judges
a cart against what the shopper declared and what the YouCam skin APIs measured,
and it is built so the model cannot be the thing that clears a product.

The LLM proposes a cart. A deterministic, cited rules engine decides. Every item
comes back as one of four verdicts — Not for you right now, Adjust, You don't need
this, or Worth showing a professional — each carrying the rule and the source
behind it.

Built with:
- YouCam AI Skin Analysis API
- YouCam AI Fitzpatrick Skin Type Analysis API

Two things the integration does that most do not. The skin API returns two numbers
per concern, because they do two different jobs: ui_score is documented as a
motivator, raw_score is the measurement. PatchTest shows the motivator and decides
on the measurement. And age gating comes only from the declared intake, never from
the photo's age estimate — a face is not a date of birth.

There is also a browser extension, so the same guardrail runs on shops that are
not ours.

Live app: https://patchtest.fly.dev
Code: https://github.com/0xNoramiya/patchtest

Honesty notes, because the numbers in this video are checkable:
- The guarded arm's 0% unsafe rate is true by construction, not evidence. The /eval
  page says so before it shows a single number.
- The comparison arm shares the model, the prompt and the inputs. Only the
  guardrail differs.
- The guardrail did not make the model consistent. Both arms gave the same shopper
  a different cart about a third of the time. It made it accountable.
- Gold labels are draft, written by one clinician, with no external validation. Two
  of them disagree with the engine and are reported as open questions rather than
  edited to improve the score.

Every face, product and scene in this video is AI generated. No real person was
scanned and no minor was photographed. "Lumen & Leaf" and "Verdant Row" are
fictional stores and every product and price in them is invented. Not a medical
device, and nothing here diagnoses or treats anything.

Statistic in the opening: Hales M, Rigali S, Paller A, Liszewski W, Lagu T.
"Pediatric Skin Care Regimens on TikTok." Pediatrics, 2025.
```

## After uploading

1. Paste the URL into the "YouTube demo" row of `SUBMISSION_CHECKLIST.md`.
2. Paste it into the Devpost submission form.
3. Open it in a logged-out browser to confirm it actually plays.
