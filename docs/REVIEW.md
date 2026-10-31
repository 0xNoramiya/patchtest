# Pre-submission review

Written 2026-10-31 against the live site, the deployed API, `eval/results.json`,
and the four Devpost judging criteria. Deadline **Nov 3 00:45 GMT+8** — about two
and a half days.

Ordered by what moves the score, not by effort. P0 items are the submission.

---

## P0-1. Record the video

It is the only missing required item. Script is at `docs/VIDEO_SCRIPT.md`. Nothing
else on this list matters if this does not exist. **Fix the numbers below before
recording** — re-recording a voiceover is expensive.

## P0-2. The video script quotes numbers the site contradicts

A judge can open `/eval` while the video plays. These do not match
`eval/results.json`:

Still wrong as of commit `339b029`:

| Script says | `eval/results.json` says |
|---|---|
| caveat-less in "forty four percent of applicable runs" | baseline `unflagged_adjust_rate` = **100** |
| "against eleven percent here" | guarded = 11.1 ✓ correct |
| baseline "gave the same shopper a different cart forty percent of the time" | **65% stable in both arms** — 35%, and identical |
| "across two hundred and forty runs it recommended nothing unsafe" | the baseline ran **120** times; 240 is both arms combined |
| never mentions the unsafe rate at all | baseline `unsafe_item_rate` = **22.5** vs guarded 0 |

The third one is the dangerous one. Cart stability is **65% in both arms**, so
presenting instability as a baseline flaw is a claim the eval page refutes on the
same screen. For a project whose entire argument is "every number here is
checkable," that is the one error that costs more than it gains.

And the script omits 22.5%, which is the strongest number in the project.

Replacement for the 2:05–2:30 voiceover:

> Here is the part most demos skip. The comparison arm is the same model, the same
> prompt, the same inputs, differing only in the guardrail. Across a hundred and
> twenty runs per arm it *recommended* nothing our labels call unsafe — we are
> reporting that rather than hiding it.
>
> What it did was leave things sitting. An item our labels call unsafe stayed in
> the cart in twenty-two and a half percent of runs. Not recommended. Just not
> removed. And of the items that needed a usage caveat, it attached one to none of
> them — a hundred percent went out bare, against eleven percent here.
>
> The guardrail did not make the model consistent. Both arms gave the same shopper
> a different cart a third of the time. What it made it was *accountable*.

That last line is the project's actual thesis and it is honest.

## P0-3. The revision loop never fires, and the write-up implies it does

`mean_revision_rounds: 0` across all 120 runs. `violationsFor()` filters to SKUs
the model proposed, and the model never proposes a blocked item — every block
comes from the cart the shopper arrived with. So the loop is real, tested, and has
never run in anger.

`docs/DEVPOST.md` presents it as a live mechanism ("Violations go back and it
revises, at most twice"). Do not quietly drop it — say it:

> The revision loop fired zero times in a hundred and twenty runs. The model never
> proposed anything the rules reject, so the engine's real work is on the cart the
> shopper walked in with, not on the model's output. That is the same finding as
> the baseline result, from the other direction.

This strengthens the central claim instead of weakening it. Silence here is the
only version that looks bad.

---

## P1-1. Live scanning is currently switched off for judges

`/api/budget` on production right now:

```
liveAvailable: false
reason: "Daily live scan cap reached (9/3)"
spent: 198   (unchanged — all 9 were non-billable)
```

`scansOn()` in `lib/ledger.ts` counts every entry with `status !== "refused"`, so a
**failed** scan — no face, bad lighting, a judge's blurry selfie — burns the daily
cap even though YouCam charges nothing for it. Three bad photos from three
different judges kills the live path globally for that UTC day.

The cap exists to protect the unit budget, but units are only charged on success
and the 900 hard stop already guarantees the ceiling absolutely (702 units left =
31 more scans, ever). Counting failures buys nothing and costs the demo.

Fix: count only billable scans against the daily cap.

```ts
/** Distinct scans that actually cost units on a given UTC day. */
export function scansOn(entries: LedgerEntry[], day = new Date().toISOString().slice(0, 10)): number {
  const ids = new Set(
    entries.filter((e) => e.ts.startsWith(day) && e.status === "success").map((e) => e.scan_id),
  );
  return ids.size;
}
```

Then raise `LIVE_SCAN_DAILY_CAP` in `fly.toml` from 3 to 5. Judging runs Nov 3–20;
at 5/day the hard stop still binds first, and a judge who wants to see a real API
call — the thing the Technological Implementation criterion is actually about —
has a real chance of getting one.

Check `/api/budget` after deploying. If today's UTC day is still blown, it clears
at 00:00 UTC.

## P1-2. Video runtime is now at the three-minute ceiling

**Done** in `339b029` — the extension got its own 25-second beat at 1:30, which was
the right call. It is the strongest argument the project has for Potential Impact,
because it makes the guardrail infrastructure rather than a demo, and the six-step
install means no judge would have seen it otherwise.

One consequence: the script now ends its last section at **2:50**, and the final
card pushes it to roughly 3:00. The rules cap it at three minutes and say judges
need not watch past that, so the ending — the limitations, the live URL — is
exactly what gets cut off. Trim ~20 seconds out of the hook and the methods
section to land at 2:40.

Still worth doing: a short looping capture of the extension on the landing page,
so a judge who skips the video still sees that it works off-site.

## P1-3. Reframe the commercial story: substitution, not subtraction

The judge works at a company selling to 800+ beauty brands. Right now the headline
economic claim is "the guardrail costs the store about eight dollars per cart."
Read cold by a retail audience, that is a reason not to install it.

The data says something better. On the pregnancy preset the blocked adapalene comes
with a swap, and the engine *adds* sunscreen. Mean cart size falls 4.2 → 3.8 while
the cart gets re-routed, not emptied. Lead with that:

> It does not just refuse. Every block carries a swap where one exists, and the
> rules add the sunscreen the routine needs. The eight dollars it takes off the
> cart is concentrated in the items that come back as returns, bad reviews and
> chargebacks.

If there is time, compute one number for the Devpost: **what share of BLOCK
verdicts shipped with a swap_hint that resolves to a real SKU.** That single figure
converts the whole project from anti-commerce to risk-managed commerce.

## P1-4. Numbers drift across the submission docs

The project's credibility is that everything is checkable, so these matter more
here than they would elsewhere. Sync every one to `eval/results.json` and a fresh
`pnpm test`:

| Claim | Where | Reality |
|---|---|---|
| mean cart $90.61 → $82.50 | `docs/DEVPOST.md` | **$90.99 → $82.70** |
| "96 tests" | `DEVPOST.md`, `README.md` | **125** |
| "ten times" / "All ten" docs disagreements | `DEVPOST.md` | `API_NOTES.md` has **13** sections |
| "different cart on 35% of repeated runs" listed as a baseline flaw | `DEVPOST.md` | true but **identical in both arms** — say so |

## P1-5. Turn the `ui_score` finding from a critique into a compliment

This is the most impressive technical finding in the project and it currently reads
as "your API flatters people." The judge is from the company that ships it. Same
facts, better valence, and it scores higher on Technological Implementation because
it positions the integration as the deepest in the field:

> Perfect Corp returns two numbers for every concern because they do two different
> jobs: `ui_score` is documented as a motivator, `raw_score` is the measurement.
> Most integrations never notice there are two. PatchTest is built on the
> distinction — it shows the motivator and decides on the measurement.

Same move for `docs/API_NOTES.md`: retitle it as field notes for the next
integrator and offer them to the docs team in "What's next." A list of thirteen
documentation bugs is a gift if it is framed as one.

---

## P2. Only after the video exists

**Ship `check_cart` as an MCP server.** **Done.** `/api/mcp`, dual-era Streamable
HTTP, three read-only tools (`check_cart`, `list_rules`, `list_scans`), 24 tests,
plus `mcp/stdio.mjs` for clients that only speak stdio. The judging moved into
`lib/check-cart.ts` so the extension's endpoint and the MCP tool share one code
path. `docs/MCP.md` documents it, and the line moved out of "What's next" and into
"What it does" in `docs/DEVPOST.md`.

One thing the move surfaced: rules carry a swap as a bare SKU, which means nothing
to a caller outside our catalogue. Swaps now resolve to a name and a price
everywhere, including in the extension's HTTP response.

**Check the two side awards.** Women in Tech and Rising Star (student) are $1,000
each with far smaller fields than the main prize. If either applies, the submission
form is the only place it can be claimed.
