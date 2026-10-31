# Devpost form answers

Ready to paste. Every figure here is from `eval/results.json`, `docs/API_NOTES.md`
or the unit ledger, and the long-form description lives in `DEVPOST.md`.

---

## If Existing, explain what you updated during the submission period.

PatchTest is not an existing project. It was built entirely during the submission
period and nothing in it was carried over from earlier work.

The repository history is public and the build is checkable commit by commit
rather than asserted here. First commit 30 October 2026: the scaffold, secrets
hygiene, the unit ledger and the YouCam client, then a live smoke test against
both APIs that recorded the real response schema. Then the catalogue and the rules
engine, the recorded scan bank and threshold calibration, then the agent loop, the
comparison arm and the 40-scenario eval, then the browser extension, and finally
the MCP server.

---

## Provide a text description explaining the features, functionality, and consumer or retail value of your project.

**PatchTest is a skincare shopping advisor for the moment before checkout. It
judges a cart against what the shopper declared and what the YouCam skin APIs
measured, and it is built so that a language model cannot be the thing that clears
a product.**

A shopper answers a 30-second intake, picks what is already in their cart, and
takes or chooses a selfie. The YouCam AI Skin Analysis API measures seven
concerns; the YouCam AI Fitzpatrick Skin Type Analysis API reads skin tone. A
language model proposes a routine. Then a deterministic rules engine gives every
item in the cart one of four verdicts:

- **Not for you right now** — unsafe given what the shopper told us or what the
  scan measured
- **Adjust** — fine, with a change: lower strength, alternate nights, add sunscreen
- **You don't need this** — the scan or the declared age shows nothing for it to do
- **Worth showing a professional** — reported signs that shopping should not try
  to solve

Every verdict shows the rule that produced it, the measured score or intake answer
that triggered it, a quote of 25 words or fewer from the source behind it, and a
link to that source. The 24 rules live in a YAML file as data, not code, and are
validated at build time.

**The one invariant: the model proposes, the rules decide.** The model never sets
a verdict and never reaches into the engine. Three consequences, each enforced by
a test:

- **No rule may read `ui_score`.** The skin API returns two numbers per concern.
  `ui_score` is documented as a motivator; `raw_score` is the measurement.
  PatchTest shows the motivator and decides on the measurement. A test replaces
  every `ui_score` with nonsense and asserts the verdicts come back byte for byte
  identical.
- **Age comes from the declared intake, never from the photo.** The API returns a
  `skin_age`. We display it and never gate on it. A face is not a date of birth.
- **A low scan score never asserts a finding.** It can only make a question worth
  asking.

**Three places it runs.** The web app, for our own fictional store. A **browser
extension**, which reads the cart on any shop's own page, parses each product
title into active ingredients and strengths, and applies the same 24 rules there.
And an **MCP server**, so an agent can check a cart before it buys — three
read-only tools, no key, nothing to install. An item whose title cannot be parsed
comes back as `UNKNOWN`, never `OK`: an absent verdict must never read as a safety
clearance, and the MCP server tells the calling model so in its own instructions.

**Evidence.** A comparison arm shares the model, the prompt and the inputs, and
differs only in the guardrail. Across 120 runs each, the unguarded arm left an
item our labels call unsafe sitting in the cart in **22.5%** of runs, and of the
items that needed a usage caveat it attached one to **none** of them, against
11.1% here. It is not a strawman and we report where it matched us: both arms gave
the same shopper a different cart about a third of the time, so the guardrail did
not make the model consistent. It made it accountable.

**Retail value.** The guardrail took the mean cart from 4.2 items and $90.99 to
3.8 items and $82.70. That is about eight dollars off a cart, and read cold it is
a reason not to install it — so the important half is what happens to the eight
dollars. It is substitution, not subtraction: every block carries a swap where one
exists, and the rules add the sunscreen a routine needs. The pregnancy case blocks
an adapalene gel and offers an azelaic acid cream in its place.

The argument for a retailer is that the removed items are disproportionately the
ones that come back — as returns, as bad reviews, as chargebacks, and
occasionally as the complaint that becomes a news story. We should be straight
that this is an argument and not something we measured; what we measured is the
cart.

What we can say plainly is that the obligation does not exist in law. California
AB 2491 would have barred selling over-the-counter retinoids and alpha hydroxy
acids to under-13s and died in committee in May 2024. No store has to do this,
which means a store that does it has something to say that its competitors do not.
And because the guardrail ships as an extension and an MCP server as well as a
site, it is infrastructure a retailer can adopt rather than a feature of our shop.

Not a medical device. It does not diagnose anything. Every face is AI generated
and disclosed, no real person was scanned, and both stores in the demo are
fictional.

---

## Provide a URL to your code repository for judging and testing.

https://github.com/0xNoramiya/patchtest

The README has a "For judges, in 60 seconds" section at the top. The live app is
at https://patchtest.fly.dev and needs no key: five one-click presets replay scans
that really were run through both YouCam APIs. `/methods` lists every rule with
its source and quote, and `/eval` shows the comparison arm including the places it
beat us.

---

## Was there a moment during the hackathon where the API surprised you — in a good or frustrating way?

Yes, and it became the spine of the project.

We expected `ui_score` to be a uniformly flattering version of `raw_score`. It is
not. What it actually does is **compress the scale toward the middle**. On one
recorded face a `texture` raw score of **17.79 presents as 53**, a lift of 35
points, while a `redness` score of 100 is nudged *down* to 99. Poor scores are
lifted a long way; good scores are trimmed slightly.

Then we checked the overall score. The `all` item came back as
`79.14285714285714`, which is exactly 554/7 — the mean of the seven `ui_score`
values. The mean of the seven `raw_score` values on that face is 72.77. So the
single headline number is built from the presentation scores, not the measured
ones.

**The good surprise is that the API hands you both numbers at all.** Most APIs
would return one. Two numbers for two different jobs — one to motivate someone,
one to measure them — is a deliberate and genuinely thoughtful piece of design,
and our strong impression is that most integrations never notice there are two.
The entire project is built on that distinction: show the motivator, decide on the
measurement, and put both on screen side by side and labelled so the shopper can
see the difference themselves.

**The frustrating half was the documentation, not the API.** Eight requested
actions return thirteen output items: seven scored concerns with no `region` key
although the spec promises one, three `skin_type` entries carrying a label and no
scores at all, and three undocumented extras (`all`, `skin_age`, `resize_image`).
`format` defaults to `zip`, so getting JSON means asking for it. Fitzpatrick
rejects a request without a `version` field the guide page never shows. Mask URLs
are signed for two hours, not the documented 24. A parser written from the spec
breaks on the first real response.

We wrote all thirteen differences up in `docs/API_NOTES.md`, each with the real
response that proves it, as field notes for the next person doing this
integration. Every one of them is a one-line docs fix and we would be glad to see
them land upstream.

---

## Are there industries or use cases you think Perfect Corp.'s API could serve that nobody is talking about yet?

Four, and the thread connecting them is that each one needs the API to be allowed
to say no. All of these are triage and routing, not diagnosis.

**1. Home IPL and laser hair removal, as a safety interlock.** Fitzpatrick type is
the single gating variable for these devices: manufacturers' own guidance says the
darkest skin types should not use them, because melanin absorbs the light and the
result is a burn rather than a treatment. Today that gate is a self-declared
dropdown on a setup screen or a chart on the side of a box. A measured Fitzpatrick
type could gate the energy setting, or the sale. Everyone is pitching the
Fitzpatrick API as a shade matcher for foundation. Nobody seems to be pitching it
as a safety interlock for a device that can injure someone, which is the higher
duty and the harder thing to buy elsewhere.

**2. Occupational skin surveillance.** Irritant contact dermatitis is one of the
most common work-related illnesses in catering, healthcare, cleaning and
hairdressing, and in some jurisdictions periodic skin checks are an employer duty
rather than a benefit. That is a longitudinal, same-person, same-conditions
scoring problem, which is exactly what these scores are good at: we found the
seven concern scales are not comparable *to each other*, but each is consistent
within itself, which is all a trend needs. The honest caveat is that the API is
framed around the face and this work is mostly about hands.

**3. The pharmacy counter rather than the beauty counter.** A community
pharmacist's job at the over-the-counter shelf is "sell, adjust, or refer" —
which is four verdicts, not a product recommendation. It is the same software we
built, pointed at a different shelf, with considerably higher stakes per
interaction and an existing professional standard to be measured against.

**4. The category itself: a refusal API.** Every beauty API on the market answers
"what should this person buy?" None of them answers "what should this person *not*
buy, and why, with a citation." That second question is becoming the valuable one,
because agents are starting to do the buying and an agent will cheerfully add the
thing to the basket. It is why we shipped the guardrail as an MCP server as well
as a website: a beauty agent talking to Perfect Corp's own MCP server should be
able to ask one more question before it checks out.

---

## Where did you hit a wall technically? How did you work around it?

**The wall was rules that could never fire, and nothing threw an error.**

Two independent causes turned up the same afternoon.

The first: `skin_type` does not return the vocabulary we assumed. Across the nine recorded
scans and their 27 regions it returns exactly six values, and three of them are compound —
`Dry & Sensitive`, `Oily & Sensitive`, `Normal & Sensitive`. There is no
`Redness` label at all. Our sensitivity rule compared the label by equality, so it
matched nothing, ever.

The second: our thresholds were guesses. We had set the "healthy" cutoff for acne
at 80. Calibrating against a bank of nine recorded faces showed that the acne
scale only ever uses its top fifth — the face with visible pustules scored
**81.7**, the clearest face **96.9**. So a cutoff of 80 called every face healthy,
and would have marked every acne product "you don't need this", including for the
shopper who has acne.

Neither of these fails loudly. A rule that can never fire looks exactly like a
rule that was not needed, and a test suite that only asserts the happy path will
pass all day. Three things came out of it:

- **`pnpm calibrate`**, which prints the real distribution of every concern across
  the whole scan bank. No threshold gets chosen before we have seen the scale it
  has to live on. `rules/thresholds.json` records what each number was before it
  moved and why.
- **A positive and a negative case for every rule**, so a rule that can never fire
  fails the build rather than sitting there looking fine.
- **One finding we deliberately did not fix.** `moisture` never reached 70 on any
  recorded face, so a moisturiser can never be called unnecessary on moisture
  grounds. That fails in the safe direction, so we left it and documented it
  instead of tuning the number until the metric looked better.

**A second wall was that we could not iterate against the live API.** A scan costs
22 YouCam units. Every live call is appended to a ledger with the endpoint, units,
status, task id and a SHA-256 of the normalised image — never the image. A circuit
breaker checks the budget before any billable request and falls back to a recorded
scan, and units are charged only on success, so a rejected photo is free. Replay
is the default; live is opt-in per scan. The entire project cost **198 units
across 18 calls**, and the deployed app still runs with a daily cap and a hard
stop so a judge cannot exhaust it.

**The third wall was the one that changed the project: the baseline refused to be
a strawman.** We built the comparison arm with the same model, the same prompt and
the same inputs, differing only in the guardrail, and across its 120 runs it
*recommended* zero items our labels call unsafe. Our first eval showed no
difference between the arms. That is a real result and a useless demo.

The fix was realising the eval was measuring the wrong thing. We had been scoring
only the routine the model proposed, and never the cart the shopper arrived with
— but a plain advisor does not empty your basket, it just talks past what is
already in it. Once the eval scored what the shopper actually walks out with, the
unguarded arm's unsafe rate went from 0% to 22.5% and per-rule coverage went from
most rules never firing to 23 of 24 firing exactly as designed. The lesson was
about our measurement, not about the model.
