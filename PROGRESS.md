# PatchTest progress

Updated: Fri Oct 30 2026, 23:20 UTC+8

## Units spent

| What | Units | Running total |
|---|---|---|
| M0 smoke test, synthetic-01, both APIs | 22 | 22 of 1000 |

Dev budget target is under 300 units. `pnpm units` prints the live total from `data/ledger.json`.

## Done

- **M0 scaffold**: Next.js 16 App Router, TypeScript, Tailwind 4, pnpm.
- **Secrets**: `.env*` ignored before the first commit, `.env.local` is mode 600, `scripts/scan-secrets.sh` blocks credential-shaped strings and tracked env files.
- **Env config** (`lib/env.ts`): secrets read lazily and never echoed in errors; caps read from env.
- **Unit ledger and circuit breaker** (`lib/ledger.ts`): append-only `data/ledger.json`, records endpoint, units, status, SHA-256 image hash (never the image), task id. Refuses live calls past `UNIT_HARD_STOP` or `LIVE_SCAN_DAILY_CAP` and logs the refusal.
- **YouCam client** (`lib/youcam/client.ts`): File API plus pre-signed PUT, task create and poll for both APIs, units booked only on `success`, raw-response capture sink for fixtures.
- **Image normalizer** (`lib/image.ts`): one JPEG that satisfies both APIs, EXIF stripped.
- **Smoke test** (`scripts/smoke.ts`), **unit report** (`pnpm units`).
- **Scan parser** (`lib/youcam/parse.ts`): normalizes the real 13-item response into
  a `ScanSummary`. Verified against the recorded fixture.
- **Deploy target**: Fly.io with a persistent volume at `/data`, so the ledger and
  the daily cap survive restarts. `Dockerfile`, `fly.toml`, `output: "standalone"`.
- **First fixture**: `fixtures/scans/synthetic-01/`, a real recorded scan with all
  11 mask PNGs downloaded, signed URLs stripped.

## Confirmed against a real response

Full detail in `docs/API_NOTES.md`. The ten differences that changed code:

- `format` defaults to `zip`, so `"json"` is passed explicitly.
- Fitzpatrick needs `version: "1.0"`.
- 8 requested actions returned **13** output items. `skin_type` comes back three
  times, by region, with a label and no scores. `all`, `skin_age` and
  `resize_image` are undocumented extras. Scored items have no `region` key.
- `all.score` is the mean of the **ui** scores, not the raw ones. 79.14 against a
  raw mean of 72.77.
- `ui_score` compresses toward the middle. Texture raw 17.8 displays as 53.
- Mask URLs are signed with `X-Amz-Expires=7200`, so two hours, not 24.
- `timed` is milliseconds despite the spec saying seconds.
- v2.1 adds only `pf_camera_kit`. Staying on v2.0.
- A face at 77% of image width with a cropped crown was accepted by both APIs.
- 8 SD concerns billed 12 units, Fitzpatrick 10, as expected.

## Verified from the docs before the call

- `format` defaults to `zip`. We pass `"json"` explicitly.
- Fitzpatrick needs `version: "1.0"` in the request body. Result is `data.results.fitzpatrick_scale`, one of `I` to `VI`, with no confidence value.
- v2.1 is not preferable: same cost, same schema, adds only `pf_camera_kit`. Staying on v2.0.
- Output items carry `region` and a third `score` field next to `raw_score` and `ui_score`.
- 8 SD concerns including `skin_type` falls in the 5 to 8 band, so 12 units. Fitzpatrick is 10. One scan is 22.

## Next

1. Replay mode and the scan cache on top of the recorded fixture.
2. Catalogue of 25 fictional SKUs.
3. Rules engine, `rules.yaml`, Vitest tests, source verification. **Stops for your rule sign-off.**
4. Scan bank. **Needs approval before spending.**

## Open questions for Rifqi

1. MIT license holder name: `LICENSE` currently says "Rifqi". Tell me the name you want on it.
2. The API keys were pasted into chat. Rotate both after judging closes on Nov 20.
3. The synthetic face scored acne 100 and redness 100, so it cannot calibrate the
   acne or redness thresholds. The scan bank needs faces with visible inflammatory
   acne and visible flushing, or your own selfie, or those thresholds stay guesses.
