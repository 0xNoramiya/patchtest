# PatchTest

**A patch test for your cart.** An AI skincare advisor for the moment before
checkout that knows when not to sell.

**Live app: https://patchtest.fly.dev**

**Demo video: https://youtu.be/gih0cIAdp7E**

## Inspiration

I am a physician. The thing that gets me is not people buying the wrong
moisturizer. It is the eleven-year-old with a basket of acids, the woman eight
weeks pregnant who does not know her retinoid is the one ingredient every
pregnancy guideline agrees on, and the person with deep painful cysts being sold a
stronger face wash instead of being told to see someone.

A study in *Pediatrics* in 2025 looked at children's skincare routines on TikTok
and found the top-viewed videos contained **an average of 11 potentially irritating
active ingredients**, while **only 26% of daytime routines included sunscreen**.
California tried to do something about exactly this. AB 2491 would have barred
selling over-the-counter products containing vitamin A derivatives or alpha
hydroxy acids to anyone under 13. It died in committee in May 2024. So the
obligation does not exist in law, and any store that wants it has to build it.

Meanwhile the obvious fix, pointing a chatbot at the problem, has its own
measurement. *npj Digital Medicine* published a study in 2026 finding that
**between 5% and 13.5% of answers to patient-posed medical questions were rated
unsafe** across four major language models, collected in late 2024.

So: a shopping assistant that can say no, where the "no" is not produced by a
model at all.

## What it does

A shopper answers a 30 second intake, picks what is already in their cart, and
takes or chooses a selfie. Two YouCam APIs analyze it. A language model proposes a
routine. Then a deterministic rules engine gives every item one of four verdicts:
**Not for you right now**, **Adjust**, **You don't need this**, or **Worth showing
a professional**.

Every verdict shows the rule that produced it, the measured score or the intake
answer that triggered it, a 25-word quote from the source, and a link to that
source. Where something is blocked, it offers a swap.

It also ships as a **browser extension**, because the moment before checkout
usually happens on somebody else's website. The extension reads the cart on a
shop's own page and applies the same rules there. It is
[downloadable from Releases](https://github.com/0xNoramiya/patchtest/releases/latest) and loads unpacked in about thirty seconds.

And it ships as an **MCP server** at `https://patchtest.fly.dev/api/mcp`, with no key
and nothing to install, so an agent can call the guardrail before it sells. Three
tools, all read-only: `check_cart` for the verdicts, `list_rules` for the whole cited
corpus, and `list_scans` for the recorded scans a check can be judged against. The
server's instructions tell the calling model, in as many words, that the verdicts
come from a rules engine rather than a model and are not its to rewrite, and that an
item it cannot parse comes back `UNKNOWN`, which is not a safety clearance. That
makes the guardrail infrastructure any beauty agent can adopt — including one already
talking to Perfect Corp's own beauty MCP server — rather than a feature of our shop.
https://patchtest.fly.dev/mcp has the setup, and `docs/MCP.md` has the protocol
notes.

Three decisions shape the whole thing.

**It decides on `raw_score`, and shows `ui_score`.** Perfect Corp returns two
numbers for every concern because they do two different jobs. `ui_score` is
documented as a motivator, the number you show someone to keep them engaged.
`raw_score` is the measurement. Most integrations never notice there are two.
PatchTest is built on the distinction: it shows the motivator and decides on the
measurement, side by side and labelled, so the shopper can see both.

**It never reads age off a face.** The API returns a `skin_age`. We display it and
no rule touches it. Age bands drive blocking rules, and a blocking rule should not
rest on an estimate the vendor does not call an identity check.

**Scores trigger questions, never diagnoses.** A low acne score does not say "you
have acne". It decides that it is worth asking "do you get deep, painful bumps, or
marks that stay behind?". The answer to that question, from the shopper, is what
moves the verdict.

## How we built it

Next.js and TypeScript on Fly.io, with the unit ledger on a persistent volume.

**The YouCam integration.** The File API returns a pre-signed URL, the bytes go up
with a PUT, and one normalized JPEG serves both analyses. AI Skin Analysis runs at
the SD tier with 8 concerns for 12 units, AI Fitzpatrick for 10, so a full scan is
22 units. Units are charged only when a task succeeds.

**The budget.** Every live call is appended to a ledger with the endpoint, units,
status, task id and a SHA-256 of the image. The image is never stored. A circuit
breaker refuses live calls past a hard stop or a daily cap and falls back to a
recorded scan, saying so on screen. Total spend building this was 198 units.

**The rules.** 24 rules live in a YAML file as data: conditions, message, swap,
source URLs, a quote of 25 words or less, the access date, and an evidence class of
guideline, label, review or heuristic. The engine is a pure TypeScript function
over that file, with 81 tests over it — a positive and a negative case for every
rule, out of 154 in the suite. One test replaces every `ui_score` with nonsense and
asserts the verdicts come back byte for byte identical, so "the rules never read the
flattering number" is enforced rather than claimed.

**Source verification.** All 21 source URLs were fetched and read against the rule
they back. 14 support it fully, 7 say less than the rule claims, and those 7 say so
in their own notes, which are shown on the Methods page. One link, the Ovid copy of
the AAD 2024 acne guideline, returns HTTP 402, so it was replaced with the PubMed
record carrying the same abstract.

**Working outside our own catalogue.** The extension has to judge products we
have never seen. It can, because the rules key on active classes and strengths,
and skincare titles almost always carry both: "Retinol 0.5% Night Serum", "AHA
30% + BHA 2% Peeling Solution". A parser turns a title into actives, percentages,
tags, rinse-off versus leave-on and body area, and the same engine judges the
result. Extraction from the page is layered, preferring schema.org structured
data that shops already publish, with a heuristic as the last resort. A title the
parser cannot read gets no verdict and says so on screen, because a missing
verdict must never look like a clearance.

**The agent.** The model proposes a cart as structured JSON. The engine evaluates
it. Violations go back and it revises, at most twice. The engine always computes
the final verdicts. Anything the model writes in prose passes a claim filter that
rewrites or drops diagnostic language before a shopper sees it.

**The revision loop fired zero times in a hundred and twenty runs.** The model
never proposed anything the rules reject, so it was never asked to revise. We are
leaving the loop in, tested, because it is the correct shape for a weaker or
cheaper model, but the honest reading is that the engine's real work is on the
cart the shopper walked in with, not on the model's output. That is the same
finding as the baseline result, from the other direction.

## Challenges

**The documentation and the API disagree, thirteen times.** Writing a parser from the
OpenAPI spec produces code that breaks on the first real response. Eight requested
concerns come back as thirteen output items: seven scored ones with no `region`
key despite the spec promising one, three `skin_type` entries carrying a label and
no scores at all, and three undocumented extras (`all`, `skin_age`,
`resize_image`). `format` defaults to `zip`, so asking for JSON means saying so.
Fitzpatrick rejects a request without a `version` field the guide page never
mentions. Mask URLs are signed for two hours, not the documented 24. All thirteen are
written up in `docs/API_NOTES.md` as field notes for the next integrator, and we
trusted the response over the docs every time.

**`ui_score` is a compression, not a lift.** We expected it to be uniformly
flattering. What it actually does is squeeze the scale toward the middle: on one
face a texture `raw_score` of **17.8 is presented as 53**, while a redness score of
100 is nudged down to 99. We also found that the overall score the API returns is
**exactly the mean of the `ui_score` values**, not the measured ones: 79.14 on a
face whose raw mean is 72.77. So the one headline number is built from the adjusted
numbers.

**Calibrating on real scores caught three bugs that would have shipped.** Our first
thresholds were guesses. Scanning a bank of nine faces and printing the
distribution showed that the acne scale only ever uses its top fifth: the face with
visible pustules scored **81.7**, the clearest face **96.9**. Our "healthy" cutoff
of 80 therefore called all eight faces healthy and would have marked every acne
product "you don't need this", including for the shopper with acne. The threshold
for asking the referral question was set so low it would have asked nobody. And the
`skin_type` label vocabulary turned out to be compound strings like
`"Dry & Sensitive"`, with no `"Redness"` label at all, so a rule comparing by
equality could never fire.

**The baseline refused to be a strawman, and that changed the project.** We built
the comparison arm with the same model, the same prompt and the same inputs,
differing only in the guardrail. Across 240 runs it *recommended* zero items our
labels call unsafe. Our first eval therefore showed no difference between the arms,
which was a real result and a useless demo.

The fix was realising the eval was measuring the wrong thing. PatchTest is called a
patch test for your cart, and we had been evaluating only the routine the model
proposed, never the cart the shopper arrived with. A plain advisor does not empty
your basket. Once the eval scored what the shopper actually walks out with, the
unsafe rate for the unguarded arm went from 0% to 22.5%, and the per-rule coverage
went from most rules never firing to 23 of 24 firing exactly as designed. The
lesson was about our measurement, not about the model.

## Accomplishments

The eval is the part worth being proud of, because it is honest about its own
headline.

Across 40 scenarios covering all 24 rules, both arms, three runs each:

- **23 of the 24 rules fired exactly when they should and stayed quiet exactly
  when they should**, across every run. The twenty fourth is the sunscreen rule,
  which never needed to fire because the advisor had already added sunscreen.
- The guarded arm is 0% unsafe on covered rules **by construction**, which is not
  evidence of anything, and we say so on the page.
- **The plain advisor let an unsafe item through on 22.5% of runs.** Not by
  recommending it. Asked to recommend a routine it never proposed anything our
  labels call unsafe. It simply left what the shopper had already chosen sitting in
  the cart, unremarked: the retinol a pregnant shopper wanted, the wax strips
  someone on isotretinoin wanted, the thirty percent peel a twelve-year-old wanted.
  **A shop assistant who does not recommend the peel, and also does not stop you
  buying it, has not helped.**
- **Neither arm is consistent.** Both gave the same shopper a different cart on
  35% of repeated runs. The guardrail does not make a language model deterministic
  and we are not claiming it does. What it makes it is *accountable*: the verdict
  on whatever gets proposed is a pure function, and a test asserts identical
  output for identical input.
- **It re-routes carts rather than emptying them.** Of the eleven rules that can
  remove an item, five carry a swap that resolves to a real product, and the six
  that do not are exactly the cases where offering a substitute would be wrong:
  the four referrals, the hydroquinone rule that says ask your prescriber, and
  waxing on isotretinoin. Every block that *should* offer an alternative does.
  Mean cart size goes 4.2 to 3.8 while R-SPF-01 puts the sunscreen in. Mean cart
  value goes $90.99 to $82.70, and that difference is concentrated in the items
  that come back as returns, bad reviews and chargebacks.

Also: 198 units of a 1,000 unit budget, with the rest left for judges.

## What we learned

**A good model plus a good prompt is mostly safe, and that is not the same as
being accountable.** The interesting failure of an LLM advisor is no longer that it
recommends something dangerous. It is that it is silently inconsistent, gives no
reason you can check, and cannot tell you which rule it applied. A deterministic
layer is worth less than we assumed as a safety net and more than we assumed as an
accountability mechanism.

**Calibrate before you trust a threshold.** Every number we guessed was wrong in a
way that only showed up against real scores.

**Verifying sources changes the rules.** Reading all 21 pages instead of
remembering them moved one rule's primary citation, reclassified seven as partial,
and gave us a hard number (alpha hydroxy acids are considered safe in pregnancy up
to 10%) that we would otherwise have guessed at.

## What's next

- Hand `docs/API_NOTES.md` to Perfect Corp's docs team. Thirteen places where the
  published spec and a real response differ, each with the response that proves
  it, is a day of work for whoever writes the next integration and we would rather
  nobody repeated it.
- A Bahasa Indonesia interface. The pregnancy and skin tone rules matter at least
  as much in a market where hydroquinone cosmetics are banned and sold anyway.
- More clinicians on the gold labels. One physician is a starting point, not a
  validation.

## Limitations

- Fitzpatrick from a photo is a proxy for a scale that is really about how skin
  responds to sun. The shopper can override it.
- Scan scores are not clinical grades, and the seven scales are not comparable to
  each other.
- The gold labels come from one clinician with no external validation.
- Thresholds were calibrated on nine AI generated faces. A generated face is not a
  sample of real skin, and the bank has no Fitzpatrick I.
- 24 rules is finite coverage. A missing verdict is not a safety claim.
- The extension's parser reads product titles, not full ingredient lists, so a
  product that hides its actives behind a brand name gets no verdict.
- English only.
- Not a medical device. It does not diagnose anything.

Every face used is AI generated and disclosed. No real person was scanned, and no
minor was scanned: the under-13 preset uses an adult synthetic face with a declared
age. "Lumen & Leaf" is a fictional store and every product in it is invented. The
cover image in this gallery is generated art and contains no real person, place or
product; the five screenshots beside it are the deployed app, unretouched.

## Built with

Next.js, TypeScript, Tailwind, Vitest, the Vercel AI SDK, Claude Sonnet 5.5,
the Model Context Protocol, a Chrome Manifest V3 extension, Playwright, Fly.io,
and the **YouCam AI Skin
Analysis API** and **YouCam AI Fitzpatrick Skin Type Analysis API** from Perfect
Corp.

Every face in the demo and every product image is AI generated and disclosed as
such. No real person was photographed and no real brand appears anywhere.
