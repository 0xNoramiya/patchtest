# PatchTest, demo video script

**Target length 2:45. As built: 2:53.** The rules cap it at three minutes. No real
brand, logo or product appears at any point. Every face, product and scene is AI
generated and the end card says so.

> **This file is the script. For what actually shipped, read "As built" below** —
> the finished video adds a cold open and a score, so the timings in the table
> below are the plan, not the cut.

## As built

| | Planned | Shipped |
|---|---|---|
| Runtime | 2:45, estimated from word count | **2:53**, measured by `ffprobe` on every clip |
| Audio | "No music, or a silent track" | ElevenLabs narration, a 182s score, and four SFX |
| Capture | 1280x800 | 1920x1080 — `recordVideo` captures at the CSS viewport and ignores `deviceScaleFactor`, so the viewport has to *be* the frame; readability comes from a 1.6x page zoom injected before load |
| Opening | A static black card | A three-shot cold open over generated b-roll, with the two statistics as kinetic type |
| Scenes | 6 | 12 |

The composition is HTML. `scripts/build-video.mjs` generates
`video/demo/index.html` from the probed duration of every asset, so the timeline
cannot drift out of sync with the audio — change a clip and the timings move with
it. `scripts/record-clips.mjs` captures the screen footage, `scripts/narrate.ts`
records the voiceover, and `scripts/score.ts` the music and effects.

The b-roll was generated, not filmed. One of the five planned shots (a mirror
turn) was refused twice by the image model, so that beat is the hover shot slowed
2.35x rather than a sixth attempt.

## Timing, and why it is written this way

An earlier draft listed section timings that its own narration could not fit: read
at a normal pace it ran close to four minutes, which would have cut off the
limitations and the live URL, the two things worth protecting most.

Every block below is budgeted in **words**, at roughly **165 words per minute**,
which is an unhurried narration pace. Keep to the counts and it lands at 2:45. If
a block needs more words, take them from another block, not from the runtime.

| Block | Runs | Budget | Words |
|---|---|---|---|
| Hook | 0:00–0:10 | 10s | 27 |
| Three carts | 0:10–0:57 | 47s | 113 |
| It works on other shops | 0:57–1:20 | 23s | 58 |
| How it works | 1:20–1:42 | 22s | 54 |
| The numbers | 1:42–2:35 | 53s | 141 |
| Limits, then the card | 2:35–2:45 | 10s | 24 |
| | | **2:45** | **417** |

417 words at 165 wpm is 152 seconds of speech. The remaining thirteen seconds are
the pauses the visuals need: the mask overlay landing, the scroll to the scan
panel, and the final card.

Numbers spoken aloud are checked against `eval/results.json`. If that file is
regenerated, re-check this script before recording.

---

## 0:00 to 0:10, the hook

**On screen:** black card, white text, both lines at once so it can be read in
four seconds.

> The top-viewed children's skincare videos on TikTok average
> **11 potentially irritating active ingredients**.
> Only **26%** of daytime routines included sunscreen.
>
> *Pediatrics, 2025*

Cut to the landing page hero on the last sentence.

**Voiceover (27 words):**
> Skincare shopping has an advice problem. The usual fix is a chatbot. But a
> chatbot is built to be helpful, and sometimes the helpful answer is no.

---

## 0:10 to 0:57, three carts

Three presets, roughly sixteen seconds each. Click each from the landing page so
the one-click flow is visible. **Let the screen do the work. Do not narrate what
is already legible.**

### Preset 1, "Eight weeks pregnant, breaking out" (0:10–0:26)

Click it. Scroll to the adapalene line, pause on the expanded verdict.

**On screen, highlight:** the **Not for you right now** badge, rule `R-PREG-01`,
the quote, and **Try instead: Azelaic Acid 10% Cream**.

**Voiceover (37 words):**
> She is eight weeks pregnant and put the retinoid back in her cart. PatchTest
> blocks it, quotes the guideline it is reading, and offers the thing she can
> actually use. It does not just refuse. It re-routes.

### Preset 2, "Dark patches and a 30% peel" (0:26–0:42)

Click it. Pause on the peel verdict, then scroll to the scan panel and click the
**Texture** row so the mask overlays the face.

**On screen, highlight:** `R-FITZ-01`, then the score track showing
**17.6 measured, 53 shown**.

**Voiceover (40 words):**
> Her scan comes back Fitzpatrick five, so the at-home peel is blocked and the
> retinol is adjusted. Now the scores. This API returns two numbers per concern,
> and they do two different jobs. Most integrations never notice there are two.

### Preset 3, "Painful lumps that leave marks" (0:42–0:57)

Click it. Pause on the blue referral panel, then the two blocked items beneath.

**On screen, highlight:** **Worth showing a professional**, `R-REF-01`, the AAD and
NHS links.

**Voiceover (36 words):**
> She described deep painful lumps that scar, and asked for the strongest things
> in the shop. PatchTest refers her instead, and holds the strong actives back.
> This is the moment a shop normally takes the money.

---

## 0:57 to 1:20, it works on other people's shops

Cut to **patchtest.fly.dev/store**, the fictional Verdant Row cart, extension
installed. Let the verdicts appear on load.

**On screen, highlight:** two **Not for you right now** badges inside somebody
else's cart, each with a rule id and a source link.

**Voiceover (58 words):**
> That is the web app. But checkout usually happens on somebody else's website, so
> PatchTest also ships as a browser extension. This is a different shop, selling
> products that are not in our catalogue. It reads the structured data the shop
> already publishes, pulls the ingredient and the strength out of each title, and
> applies the same rules.

---

## 1:20 to 1:42, how it works

Cut to the Methods page. Scroll the YouCam table, then the rules list, expanding
one rule to show its quote and source.

**On screen, as a persistent lower third for this whole section:**

> **YouCam AI Skin Analysis API**
> **YouCam AI Fitzpatrick Skin Type Analysis API**

**Voiceover (54 words):**
> One photo, two APIs. Skin Analysis measures eight concerns, Fitzpatrick reads
> skin tone. Twenty-two units a scan, charged only on success. Then a language
> model proposes a routine. It never sets a verdict. Twenty-four rules, each
> carrying a source and a quote, decide what the shopper may buy. The rules have
> the last word.

---

## 1:42 to 2:35, the numbers

Cut to the Eval page. Pause on the amber "Read this before the numbers" panel,
then the results table.

**Voiceover (141 words):**
> Here is the part most demos skip. The comparison arm is the same model, the same
> prompt, the same inputs, differing only in the guardrail. Across a hundred and
> twenty runs it recommended nothing our labels call unsafe. A good model with a
> careful prompt is mostly safe, and we are reporting that rather than hiding it.
>
> What it did was leave things sitting. An item our labels call unsafe stayed in
> the cart in twenty-two and a half percent of runs. Not recommended. Just not
> removed. And of the items that needed a usage caveat, it attached one to none of
> them. A hundred percent went out bare, against eleven percent here.
>
> The guardrail did not make the model consistent. Both arms gave the same shopper
> a different cart a third of the time. What it made it was accountable.

---

## 2:35 to 2:45, the limits, then the card

**On screen, as a list, held long enough to read.** This is faster to read than to
narrate, which is why it is not spoken in full.

> One clinician wrote the labels. No external validation.
> Thresholds calibrated on nine AI generated faces.
> Twenty-four rules is finite coverage.
> Not a medical device. It does not diagnose anything.

**Voiceover (24 words):**
> All of that is on the page, because a tool that tells people when to stop
> shopping should say what it does not know.

**Final card:**

> **PatchTest**
> A patch test for your cart.
>
> Web app, and a browser extension for everyone else's shop.
>
> Built with the YouCam AI Skin Analysis API
> and the YouCam AI Fitzpatrick Skin Type Analysis API
>
> Every face and product image shown is AI generated.
> "Lumen & Leaf" and "Verdant Row" are fictional stores.
> https://patchtest.fly.dev

---

## Shot list checklist

- [ ] Every spoken number re-checked against `eval/results.json` on the day
- [ ] Runtime under 3:00, ideally 2:45
- [ ] No real brand name, logo or product visible, including browser tabs and bookmarks
- [ ] Browser in a clean profile, no personal bookmarks bar
- [ ] No music, or a silent/public-domain track only
- [ ] Both YouCam API names on screen as text, not only spoken
- [ ] The extension is shown annotating the Verdant Row cart, not just described
- [ ] Verdant Row is visibly a different shop, not PatchTest with a new header
- [ ] The synthetic-faces disclosure appears at least once
- [ ] Final card shows the live URL
