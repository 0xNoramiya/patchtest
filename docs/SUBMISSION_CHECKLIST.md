# Submission checklist

Checked against the rules on 2026-10-31.

## Required

| Requirement | Status |
|---|---|
| Working web app on a public URL | **Done.** https://patchtest.fly.dev |
| Public GitHub repo | **Done.** https://github.com/0xNoramiya/patchtest |
| MIT licence in the repo | **Done.** `LICENSE`, copyright Rifqi Haikal |
| English text description | **Done.** `docs/DEVPOST.md`, ready to paste |
| YouTube demo, 1 to 3 minutes | **Not done.** Script ready at `docs/VIDEO_SCRIPT.md` |
| Video names the YouCam APIs used | Script puts both names on screen as a persistent lower third for the whole "how it works" section, and says them aloud |

## Keeps working without babysitting until 20 Nov

- One Fly machine with `min_machines_running = 1`, so it never scales to zero.
- Every preset is served from recorded fixtures and needs no API key.
- Live scanning is capped at 3 a day, and the 900 unit hard stop permits about 31
  more live scans in total. Past either cap the breaker refuses and falls back to a
  recorded scan with a message saying why.
- The agent falls back to recorded responses if the LLM key is removed or rate
  limited.

## No real brands

- The store is fictional: "Lumen & Leaf". All 26 products and prices are invented.
- No real brand, logo or trademark appears in the UI, the fixtures, the catalogue
  or the video script.
- Hydroquinone is deliberately absent from the catalogue.

## Secrets

- `.env*` was in `.gitignore` before the first commit.
- `.env.local` is mode 600 and has never been tracked.
- `scripts/scan-secrets.sh` blocks tracked env files and credential-shaped strings,
  and passes.
- Committed scan fixtures have their signed query strings stripped, because those
  URLs carry an AWS access key id.
- **Open item: rotate both keys after 20 Nov.** They were pasted into a chat.

## Honesty

- The `/eval` page states up front that the guarded arm's 0% unsafe rate is true by
  construction and is not evidence.
- The baseline shares the model, the prompt and the first API call with the guarded
  arm. It is not a strawman.
- Gold labels are marked draft and attributed to one clinician with no external
  validation.
- Two gold labels that disagree with the engine are reported as open questions
  rather than edited to improve the score.
- Seven of 21 sources say less than the rule they back, and each says so in its own
  notes, shown on the Methods page.
- Thresholds are labelled heuristic and the calibration basis, nine AI generated
  faces, is stated.
