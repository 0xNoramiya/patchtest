# PatchTest progress

Updated: Fri Oct 30 2026, 23:00 UTC+8

## Units spent

| What | Units | Running total |
|---|---|---|
| (nothing yet) | 0 | 0 of 1000 |

Dev budget target is under 300 units. `pnpm units` prints the live total from `data/ledger.json`.

## Done

- **M0 scaffold**: Next.js 16 App Router, TypeScript, Tailwind 4, pnpm.
- **Secrets**: `.env*` ignored before the first commit, `.env.local` is mode 600, `scripts/scan-secrets.sh` blocks credential-shaped strings and tracked env files.
- **Env config** (`lib/env.ts`): secrets read lazily and never echoed in errors; caps read from env.
- **Unit ledger and circuit breaker** (`lib/ledger.ts`): append-only `data/ledger.json`, records endpoint, units, status, SHA-256 image hash (never the image), task id. Refuses live calls past `UNIT_HARD_STOP` or `LIVE_SCAN_DAILY_CAP` and logs the refusal.
- **YouCam client** (`lib/youcam/client.ts`): File API plus pre-signed PUT, task create and poll for both APIs, units booked only on `success`, raw-response capture sink for fixtures.
- **Image normalizer** (`lib/image.ts`): one JPEG that satisfies both APIs, EXIF stripped.
- **Smoke test** (`scripts/smoke.ts`), **unit report** (`pnpm units`).

## Verified against the docs (not yet against a real response)

- `format` defaults to `zip`. We pass `"json"` explicitly.
- Fitzpatrick needs `version: "1.0"` in the request body. Result is `data.results.fitzpatrick_scale`, one of `I` to `VI`, with no confidence value.
- v2.1 is not preferable: same cost, same schema, adds only `pf_camera_kit`. Staying on v2.0.
- Output items carry `region` and a third `score` field next to `raw_score` and `ui_score`.
- 8 SD concerns including `skin_type` falls in the 5 to 8 band, so 12 units. Fitzpatrick is 10. One scan is 22.

## Next

1. Live smoke test on a real face, save fixtures, confirm the schema. **Needs approval: 22 units.**
2. Replay mode and cache on top of the fixtures.
3. Catalogue, rules engine, source verification. **Stops for rule sign-off.**

## Open questions for Rifqi

1. Path to your selfie for the smoke test.
2. MIT license holder name: `LICENSE` currently says "Rifqi". Tell me the name you want on it.
3. The API keys were pasted into chat. Rotate both after judging closes on Nov 20.
