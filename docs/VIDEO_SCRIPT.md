# PatchTest, demo video script

**Target length 2:50.** Screen recording with voiceover. No music, or a silent
track. No real brand, logo or product appears at any point. Every face shown is AI
generated and the video says so on screen.

Record at 1280x800 so text stays readable when Devpost scales it down.

---

## 0:00 to 0:15, the hook

**On screen:** black card, white text, one line at a time.

> The top-viewed children's skincare routines on TikTok
> average **11 potentially irritating active ingredients**.
>
> Only **26%** of daytime routines include sunscreen.
>
> *Pediatrics, 2025*

Cut to the landing page hero.

**Voiceover:**
> Skincare shopping has an advice problem. The fix everyone reaches for is a
> chatbot. But a chatbot is built to be helpful, and sometimes the helpful answer
> is no.

---

## 0:15 to 1:30, three carts

Three presets, roughly 25 seconds each. Click from the landing page each time so
the one-click flow is visible.

### Preset 1, "Eight weeks pregnant, breaking out" (0:15 to 0:40)

Click the preset. Let the results load. Scroll to the adapalene line and pause on
the expanded verdict.

**On screen, highlight:** the **Not for you right now** badge, rule `R-PREG-01`,
the quote, and **Try Azelaic Acid 10% Cream instead**.

**Voiceover:**
> She put the retinoid back in her cart. It was working for her before. PatchTest
> blocks it, says why in plain English, shows the guideline it is quoting, and
> offers the thing she can actually use. The adapalene stays visible. She is told
> why, instead of it quietly disappearing.

### Preset 2, "Dark patches and a 30% peel" (0:40 to 1:05)

Click the preset. Pause on the peel verdict, then scroll to the scan panel and
click the **Texture** row so the mask overlays the face.

**On screen, highlight:** `R-FITZ-01`, then the score table showing
**texture 17.8 measured / 53 shown**.

**Voiceover:**
> Her scan comes back Fitzpatrick five. A thirty percent at-home peel on deeper
> skin is a common way to end up with marks that outlast the thing you were
> treating, so it is blocked and the retinol is adjusted rather than refused.
> Now look at the scores. This API returns two numbers for every concern. The
> measured one is seventeen point eight. The one it shows shoppers is fifty three.
> Perfect Corp documents that second number as a psychological motivator.
> PatchTest decides on the measured one, and shows you both.

### Preset 3, "Painful lumps that leave marks" (1:05 to 1:30)

Click the preset. Pause on the blue referral panel at the top, then show the two
blocked items underneath.

**On screen, highlight:** **Worth showing a professional**, rule `R-REF-01`, and
the AAD and NHS source links.

**Voiceover:**
> This one is the whole point. She described deep painful lumps that scar, and
> asked for the strongest things in the shop. PatchTest does not sell them to her.
> It refers her, cites the guideline, and holds back the strong actives while
> leaving the gentle basics and the sunscreen in her cart. This is the moment a
> shop normally takes the money.

---

## 1:30 to 1:55, it works on other people's shops

Cut to **https://patchtest.fly.dev/store**, the fictional Verdant Row cart, with
the extension installed. Let the verdicts appear on load.

**On screen, highlight:** the two **Not for you right now** badges sitting inside
somebody else's cart, each with its rule id and source link.

**Voiceover:**
> That is PatchTest inside the web app. But the moment before checkout usually
> happens on somebody else's website. So it also ships as a browser extension.
> This is a different shop, with products that are not in our catalogue at all.
> It reads the cart the shop already publishes for search engines, pulls the
> active ingredient and the strength straight out of each product title, and
> applies the same twenty four rules. Same verdicts, same sources, somebody
> else's checkout.

---

## 1:55 to 2:25, how it works

Cut to the Methods page. Scroll slowly through the YouCam table, then the rules
list, expanding one rule to show the quote and the source link.

**On screen, as a persistent lower third for this whole section:**

> **YouCam AI Skin Analysis API**
> **YouCam AI Fitzpatrick Skin Type Analysis API**

**Voiceover:**
> One photo, two APIs. The YouCam AI Skin Analysis API measures eight concerns at
> the SD tier for twelve units. The YouCam AI Fitzpatrick Skin Type Analysis API
> reads skin tone for ten. Twenty two units a scan, charged only when the task
> succeeds, and every call is written to a ledger with a hash of the image and
> never the image itself.
>
> Then a language model proposes a routine. It never sets a verdict. Twenty four
> rules, held as data with a source and a quote on each, decide what the shopper
> is allowed to buy. When the rules reject something, it goes back to the model to
> revise, and the rules still have the last word.
>
> We read all twenty one sources rather than remembering them. Fourteen support
> their rule outright. Seven say less than the rule claims, and those seven say so
> on this page.

---

## 2:25 to 2:50, the numbers and the limits

Cut to the Eval page. Pause on the amber "Read this before the numbers" panel,
then on the results table.

**Voiceover:**
> Here is the part most demos skip. We built the comparison arm with the same
> model, the same prompt and the same inputs, differing only in the guardrail.
> Across two hundred and forty runs it recommended nothing our labels call unsafe.
> A good model with a careful prompt is mostly safe, and we are reporting that
> rather than hiding it.
>
> What it did do was leave things unsaid. It sold items needing a usage caveat with
> no caveat in forty four percent of applicable runs, against eleven percent here.
> And it gave the same shopper a different cart forty percent of the time.
>
> The labels come from one physician. The thresholds were calibrated on nine AI
> generated faces. It is not a medical device and it does not diagnose anything.
> All of that is on the page, because a tool that tells people when to stop
> shopping should be the first to say what it does not know.

**Final card:**

> **PatchTest**
> A patch test for your cart.
>
> Web app, and a browser extension for everyone else's shop.
>
> Built with the YouCam AI Skin Analysis API
> and the YouCam AI Fitzpatrick Skin Type Analysis API
>
> Every face shown is AI generated. "Lumen & Leaf" is a fictional store.
> https://patchtest.fly.dev

---

## Shot list checklist

- [ ] No real brand name, logo or product visible, including in browser tabs and bookmarks
- [ ] Browser in a clean profile, no personal bookmarks bar
- [ ] No music, or a silent/public-domain track only
- [ ] Both YouCam API names on screen as text, not only spoken
- [ ] The synthetic-faces disclosure appears at least once
- [ ] Final card shows the live URL
- [ ] Total runtime between 1:00 and 3:00
- [ ] The extension is shown annotating the Verdant Row cart, not just described
- [ ] Verdant Row is visibly a different shop, not PatchTest with a new header
