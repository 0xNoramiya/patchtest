# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

PatchTest is a Next.js app that judges a skincare cart against what a shopper
declared and what the YouCam skin APIs measured. `README.md` is the user-facing
tour. This file covers the parts you cannot see from one file.

## Commands

Needs Node >= 22.12 (`engines`) and pnpm. `.nvmrc` pins 22.

| Command | What it does |
|---|---|
| `pnpm dev` | Local dev server. Runs in `replay` mode with no keys needed |
| `pnpm test` | vitest over `lib/**/*.test.ts`, `eval/**`, `app/**` |
| `pnpm build` | `vitest run && next build`. Tests gate the build |
| `pnpm lint` | eslint |
| `pnpm preview` | Standalone production build served locally with static assets copied into place |
| `pnpm units` | Units spent, from the ledger |
| `pnpm scan <image>` | One real YouCam scan. **Spends 22 units.** `--all` for the face bank, `--force` to rescan a label |
| `pnpm calibrate` | raw_score distribution across the recorded bank. Free, fixtures only |
| `pnpm eval` | Both arms over 40 scenarios, replay-only and free. `--live` records new LLM responses, `--runs N` for fewer repeats |
| `pnpm agent <scan-label>` | One scenario through both arms, for eyeballing |
| `pnpm record-presets` | Re-records the demo presets' agent responses. Needs `ANTHROPIC_API_KEY` |
| `pnpm package:extension` | Release zip into `dist/` |
| `node scripts/test-extension.mjs [baseUrl]` | Loads the packaged extension into a real browser and asserts it annotates a cart |
| `scripts/scan-secrets.sh` | Run before pushing. Fails if env files or credential-shaped strings are tracked |

Single test: `pnpm vitest run -t "R-PREG-01"` or `pnpm vitest run lib/match.test.ts`.

Everything resolves paths from `process.cwd()`, so run scripts from the repo root.

## The one invariant

**The LLM proposes a cart. A deterministic rules engine decides.** The model never
sets a verdict, never writes a rule, and never reaches into `lib/rules/engine.ts`.
Three corollaries, each enforced by a test:

- No rule reads `ui_score` (YouCam's flattered display number) or `skin_age`.
  Only `raw_score`. `lib/rules/fixtures.ts` deliberately sets `ui: 99` and
  `skinAge: 14` on test scans so a rule that peeked would show up.
- Age gating comes from the declared intake, never from the photo estimate.
- A low scan score never asserts a finding. It can only make a question worth
  asking, via a rule's `ask_when` → `evaluation.suggestedQuestions`.

## Pipeline

`lib/advise.ts#advise()` is the whole thing for one shopper:

1. `loadScanFixture(label)` reads `fixtures/scans/<label>/fixture.json`.
2. `runGuardedAgent` and `runBaselineAgent` run in parallel on the *identical*
   prompt. The baseline's only missing piece is the guardrail. Keep it that way
   or the eval is worthless.
3. The guarded loop proposes → `evaluate()` → BLOCK findings go back as revision
   feedback → at most `MAX_REVISION_ROUNDS` (2). Anything still carrying a BLOCK
   after the last round is removed by the engine, and `ADD` rules inject SKUs.
4. One final `evaluate()` over the *merged* cart: what the shopper wanted plus
   what the agent proposed. This is deliberate. An item the agent silently drops
   still gets a verdict and a reason, so the shopper learns why.

Two HTTP entry points share the engine: `app/api/advise/route.ts` for the site's
own catalogue, and `app/api/check-cart/route.ts` (CORS, used by the extension) for
any shop's cart. The latter is a thin wrapper over `lib/check-cart.ts`, which builds
an *ephemeral* catalogue from titles parsed by `lib/match.ts`. A title it cannot read
returns `UNKNOWN`, never `OK`. An absent verdict must never read as a safety
clearance.

## The MCP server

`app/api/mcp/route.ts` exposes the same guardrail to agents. `lib/mcp/server.ts` is
the wire protocol as a pure function over one JSON-RPC message, which is what the
tests drive; `lib/mcp/tools.ts` holds the three tools. It is **dual-era**: revision
`2026-07-28` removed the `initialize` handshake and sessions, earlier revisions
require them, and this endpoint answers both because every tool is stateless and
read-only. `docs/MCP.md` records the one place it deliberately departs from the
transport spec. Update that file if you change the departure.

Two things to keep true. Every tool carries `readOnlyHint` and a test asserts it:
nothing over MCP may write a rule, set a verdict or spend a unit. And the judging
lives in `lib/check-cart.ts`, not in the tool, so the extension and an agent cannot
drift apart. Put shared behaviour there rather than in either caller.

## Rules are data

`rules/rules.yaml` holds 24 rules, validated by Zod in `lib/rules/types.ts`.
Adding or changing a `when` predicate means touching three places together:

1. the Zod schema in `lib/rules/types.ts`,
2. the matcher in `lib/rules/engine.ts` (`matchScan` / `matchItem` / `matchCart` /
   `matchContext`),
3. the condition vocabulary comment at the top of `rules/rules.yaml`.

`evaluate()` skips only `status: retired`. Tests also require every shipped rule
to be `status: approved` and `verification` not `pending`. Unless its evidence is
`heuristic`, a rule must carry a source URL, a quote of 25 words or fewer, and an
access date.

`rules/thresholds.json` holds every number, each marked as a heuristic, with its
calibration note. Re-run `pnpm calibrate` after changing the scan bank; the file
records what each value was before and why it moved. `HIGH_ACID_PCT` is the one
threshold overridable by env at deploy time.

### Verdict precedence is subtle

`VERDICT_RANK` in `lib/rules/types.ts` makes `UNNECESSARY` outrank `BLOCK` as the
*headline* label, because leading with "you don't need this" is the least
alarming way to refuse a sale. But `evaluation.blocked` keys off the individual findings, not the
headline, so an item carrying a BLOCK finding always leaves the cart and is always
fed back to the agent as off-limits. Do not "fix" the ranking to match the removal
behaviour; two tests pin both halves.

## Replay, fixtures, and the two budgets

Scans and model calls are budgeted separately on purpose.

**Scans cost 22 YouCam units each**, so they default to replay from
`fixtures/scans/`. `lib/ledger.ts` appends every live call to
`$DATA_DIR/ledger.json` (endpoint, units, status, task id, SHA-256 of the
normalized image, never the image). `budget()` is the circuit breaker: check
`liveAllowed` before any billable request and fall back to replay. Units are
charged only on `success`, so a rejected photo is free, and a repeat poll of an
already-booked task is free. Production seeds the volume from the committed
`data/ledger.json` so the deployed app knows what development already spent.

**Model calls cost cents**, so they run live whenever `ANTHROPIC_API_KEY` is set
and fall back to `fixtures/agent/<key>.json` otherwise. The key is
`sha256(model#run, system, user)`. See `lib/agent/replay.ts`.

> **Gotcha:** editing `lib/agent/prompts.ts`, `data/catalog.json`, or anything else
> that lands in the prompt invalidates all 142 recorded agent fixtures. The demo
> presets then fail in replay mode with "No recorded agent response". Re-record
> with `pnpm record-presets` (presets) and `pnpm eval --live` (eval), both of which
> cost real LLM calls.

## YouCam API reality

`docs/API_NOTES.md` lists thirteen documented differences between the docs and the
real responses. The ones that shape the code:

- Eight requested actions return thirteen output items. `lib/youcam/parse.ts`
  normalizes them; `format` must be set to `json` or you get a zip.
- Upload is two steps: ask the File API for a pre-signed URL, then PUT the bytes
  with exactly the headers it returned. Skipping the PUT makes the later task fail
  with a confusing 404 or 500.
- Mask URLs are pre-signed and expire in two hours, so `lib/scan-runner.ts`
  downloads them at scan time and commits them next to the scores. The fixture
  writer strips query signatures before writing.
- `skin_type` returns compound labels ("Dry & Sensitive") and is matched by
  substring, not equality.

## Claim safety

`lib/claims.ts` enforces cosmetic-only language two ways: `lintClaims` runs at
build time over every rule message, product blurb, and `{app,components}/**/*.tsx`
source file (it globs the real components, so a new string cannot sneak in), and
`sanitizeClaims` runs at runtime over everything the LLM wrote, rewriting what it
can and dropping the sentence when it cannot.

## Eval honesty

`eval/gold.json` labels are written from clinical intent, not from the engine's
behaviour, so a gap between the two shows as a miss rather than hiding. Entries
that want a second look are flagged in the file and named on `/eval`. Do not edit
a gold label to improve a score. The baseline has no verdicts, so whether it warned
the shopper is read from its prose by the regex cues in `eval/score.ts`; those are
generous on purpose, in the baseline's favour.

## Fixtures and imagery

Every face in `fixtures/faces/` is AI-generated and disclosed; no real person was
scanned and no minor was photographed (the under-13 preset's age is declared, not
read off the photo). Two faces read as men, and a test fails the build if a
pregnancy or breastfeeding preset or eval scenario is pointed at one of them.
That bug shipped once already.

## Deployment

Fly.io, `output: "standalone"`, Debian base so `sharp` uses its prebuilt glibc
binaries (and `serverExternalPackages` keeps it unbundled). The Dockerfile copies
`rules/`, `data/`, `fixtures/`, and `eval/` into the runtime image because all
four are read at runtime. `DATA_DIR=/data` is a persistent volume holding the
ledger, runtime scan cache, and runtime agent recordings. Production runs
`DEMO_MODE=live` with tighter caps than development (see `fly.toml`).

## Next.js version

This is Next 16.4.3 and `AGENTS.md` is right: read the relevant guide under
`node_modules/next/dist/docs/` before writing Next-specific code. `next dev`
rewrites that `AGENTS.md` block, so commit it along with your work rather than
reverting it.
