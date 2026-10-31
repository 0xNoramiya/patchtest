# Submission checklist

Checked against the rules on 2026-10-31.

## Required

| Requirement | Status |
|---|---|
| Working web app on a public URL | **Done.** https://patchtest.fly.dev |
| Public GitHub repo | **Done.** https://github.com/0xNoramiya/patchtest |
| MIT licence in the repo | **Done.** `LICENSE`, copyright Rifqi Haikal |
| English text description | **Done.** `docs/DEVPOST.md`, ready to paste |
| YouTube demo, 1 to 3 minutes | **Done.** https://youtu.be/gih0cIAdp7E — 2:53, and it plays without a login. Checked rather than assumed: YouTube's oEmbed endpoint answers 200 for it, which it does not do for a private video |
| Video names the YouCam APIs used | Script puts both names on screen as a persistent lower third for the whole "how it works" section, and says them aloud |
| Video runtime fits the cap | **Measured, not estimated.** The composition is 172.52s (2:53), 7.5s under the cap. Every clip length is probed with `ffprobe` by `scripts/build-video.mjs`, so the timeline cannot drift from the audio |
| Narration | 163.9s of recorded voiceover across eight blocks, generated with ElevenLabs by `scripts/narrate.ts` and request-stitched so the blocks share one voice |
| Subtitles | 61 burned-in cues. Timed by ASR over the narration, worded from the script, so a judge watching muted still gets every number. Contrast checked: 29/29 pass WCAG AA |
| How it is made | The narrative is motion graphics, not screen recording, built in HTML and GSAP by `scripts/build-video.mjs`. Every figure, quote, price and rule id in it is read out of `rules/rules.yaml`, `data/catalog.json` and the scan fixtures at build time, so the film cannot drift from the app it describes |
| Every spoken number matches the site | Checked against `eval/results.json`: 120 runs per arm, 22.5% unsafe, 100% versus 11.1% uncaveated, 35% cart instability in both arms |

## Keeps working without babysitting until 20 Nov

- One Fly machine with `min_machines_running = 1`, so it never scales to zero.
- Every preset is served from recorded fixtures and needs no API key.
- Live scanning is capped at 5 a day, and the 900 unit hard stop permits about 31
  more live scans in total, ever. Past either cap the breaker refuses and falls
  back to a recorded scan with a message saying why.
- **The daily cap counts successful scans only.** A photo the API rejects costs
  nothing, so it no longer counts. Before this fix three bad selfies from three
  judges would have closed the live path for everyone for the rest of the UTC day.
  Verified: three rejected photos now count 0 against the cap.
- The agent falls back to recorded responses if the LLM key is removed or rate
  limited.

## No real brands

- The store is fictional: "Lumen & Leaf". All 26 products and prices are invented.
  The second shop the extension is demonstrated on, "Verdant Row", is also ours.
- No real brand, logo or trademark appears in the UI, the fixtures, the catalogue
  or the video.
- **The video's b-roll is generated, not filmed.** Four shots: hands at a shelf of
  unlabelled bottles, a mass of unlabelled bottles, a face lit by a phone, and a
  fingertip over a screen. Every bottle in them is blank — checked frame by frame,
  no legible text, mark or trade dress appears on any of them. The end card
  discloses that every face, product and scene in the video is AI generated.
- The statistic about children's skincare is placed over the bottles, never over
  the face, and the generated face reads as an adult. No shot in the video implies
  a real child was filmed.
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
