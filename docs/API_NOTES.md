# YouCam API field notes

Notes for the next person integrating the YouCam AI Skin Analysis and AI
Fitzpatrick Skin Type APIs, written while doing it. Thirteen places where the
published spec and a real response differ, each with the response that proves it.

If you are about to write this integration, reading this first is worth about a
day. If you work on these docs, every item below is a one-line fix and we would
be glad to see them land upstream.

Recorded from a real call on 2026-10-30. One image, 8 SD concerns plus
Fitzpatrick, 22 units. The raw responses are in `fixtures/scans/synthetic-01/`.

Where the documentation and a real response disagree, PatchTest follows the real
response. Each difference below changed code.

## 1. `format` defaults to `zip`, not JSON

The OpenAPI spec lists `format` as optional with a default of `zip`. Omitting it
returns a URL to a zip archive valid for two hours instead of inline scores. We
pass `format: "json"` explicitly on every call.

## 2. Fitzpatrick requires an undocumented-in-the-guide `version` field

The guide page shows no request body. The OpenAPI spec marks `version` as required
with the single allowed value `"1.0"`. Omitting it fails the request. We send
`{ src_file_id, version: "1.0", index: 0 }`.

## 3. Eight requested actions return thirteen output items

Requesting `acne, redness, oiliness, moisture, age_spot, wrinkle, texture, skin_type`
produced 13 items, not 8:

| Item | Shape | Note |
|---|---|---|
| 7 scored concerns | `raw_score`, `ui_score`, `mask_urls` | No `region` key, though the spec says there is one |
| `skin_type` x3 | `region` of `whole`, `t_zone`, `u_zone`, plus a `skin_type` label | No scores at all |
| `all` | `score` only | Undocumented in the reference page |
| `skin_age` | `score` only | Undocumented in the reference page |
| `resize_image` | `mask_urls` only | Undocumented. The resized input the engine actually used |

Every item also carries a `url` key that the spec does not mention. It was `null`
in every item of every response we recorded.

Consequence: a parser written from the spec breaks on the first response, because
`skin_type` items have no `raw_score` and the three extra item types are unexpected.
See `lib/youcam/parse.ts`.

## 4. The overall score is built from the ui_score values

The `all` item returned `79.14285714285714`. That is exactly the mean of the seven
`ui_score` values (554 / 7). The mean of the seven `raw_score` values is
`72.77124433858054`.

So the single headline number is an average of the presentation scores, not of the
measured ones. That is a reasonable default for a product meant to encourage
someone. It is worth knowing before you build a decision on top of it.

## 5. `ui_score` compresses the scale toward the middle

The two numbers do two jobs. `ui_score` is documented as a motivator, the number
you show someone. `raw_score` is the measurement. What the transform does on our
fixture is squeeze the range toward the middle:

| Concern | raw_score | ui_score | Difference |
|---|---|---|---|
| texture | 17.79 | 53 | +35.2 |
| moisture | 38.97 | 66 | +27.0 |
| oiliness | 83.16 | 82 | -1.2 |
| wrinkle | 84.50 | 78 | -6.5 |
| age_spot | 84.97 | 77 | -8.0 |
| acne | 100.00 | 99 | -1.0 |
| redness | 100.00 | 99 | -1.0 |

Poor scores are lifted a long way, good scores nudged down slightly. For a product
designed to keep someone engaged that is sensible. For a tool deciding what not to
sell it is the wrong input: the worst finding on this face, texture at 17.8 out of
100, presents as 53.

So PatchTest reads the measurement and shows the motivator, side by side and
labelled. Both numbers are useful. They are just useful for different things.

## 6. `skin_age` is an estimate, and we do not gate on it

The engine returned `skin_age: 37` for a face generated from a prompt describing a
29 year old. This is one synthetic image and not evidence of systematic error, so
we make no claim about accuracy. It does show why age should come from what the
shopper declares rather than from a photo. Age bands drive blocking rules, and a
blocking rule should not rest on an estimate the vendor does not describe as an
identity check. We display `skin_age` and never read it in a rule.

## 7. Mask URLs expire in two hours, not twenty four

Results are retained for about 24 hours, but the mask URLs are pre-signed with
`X-Amz-Expires=7200`. The signature dies after two hours even though the path
segment reads `ttl30`. Masks must be downloaded promptly, so the smoke test and the
scan cache fetch them immediately and store the bytes next to the scores.

The signed query string also contains an AWS access key id, which our secrets scan
flags. Committed fixtures store the URL path with the signature stripped.

## 8. v2.1 is not worth using

The v2.1 create and poll endpoints have identical paths, identical unit costs and
an identical response schema. The only difference in the spec is one extra request
field, `pf_camera_kit`, for Perfect Corp's own camera kit. We stay on v2.0.

## 9. Fitzpatrick `timed` is milliseconds, not seconds

The spec describes `timed` as engine processing time in seconds. The task returned
`timed: 2129` after completing in a few seconds. It is milliseconds.

## 10. Framing in practice

The image was 1536x2048 with the face about 77% of the image width and the top of
the head cropped above the hairline. Both APIs accepted it. The 60% face width floor
is about the face, not the whole head, so a tight portrait is fine.

## 11. The skin_type label vocabulary is undocumented and compound

`skin_type` returns a label, not a score, and the labels are not what we expected.
Across 9 scans and 27 regions we saw exactly six values:

`Dry`, `Oily`, `Normal`, `Dry & Sensitive`, `Oily & Sensitive`, `Normal & Sensitive`

There is no `Redness` label. Sensitivity is expressed as an `& Sensitive` suffix on
one of the three base types. Any rule comparing the label by equality silently
never fires, which is what happened to our first version of R-SENS-01. Every
comparison is now a substring test.

## 12. The concern scales are not comparable to each other

From the 9 scan bank:

| Concern | Range observed | Usable? |
|---|---|---|
| redness | 7.1 to 100.0 | Yes, the widest and most discriminating |
| wrinkle | 1.1 to 92.8 | Yes, tracked intended face age closely |
| texture | 17.6 to 90.1 | Yes |
| oiliness | 32.9 to 95.1 | Yes |
| acne | 61.2 to 100.0 | Bunched: 8 of 9 faces sit above 81 |
| age_spot | 74.4 to 97.3 | Narrow |
| moisture | 20.6 to 59.2 | Never reached 70 on any face |

Two of these changed our thresholds. A face with clearly visible pustules scored
`acne` 81.7 while the clearest face scored 96.9, so our first cutoff of 80 called
both of them healthy and would have marked every acne product "you don't need
this". The ninth face, added after this table was first written, scored 61.2 and
is the only one below 81 — so the scale is not quite as compressed as eight faces
suggested, and the cutoff was still in the wrong place. And `moisture` never
reaches 70, so a moisturizer is never called unnecessary on moisture grounds. We
left that as it is, because it fails in the safe direction.

A single number out of 100 reads as if the seven scales mean the same thing. They
do not. The UI shows the raw score next to each verdict for that reason.

## 13. skin_age across the bank

| Face, as prompted | skin_age returned |
|---|---|
| 29 | 37 |
| 28 | 38 |
| 42 | 61 |
| 38 | 58 |
| 63 | 67 |
| 24 | 30 |
| 27 | 26 |
| 34 | 34 |

These are generated faces, so the "as prompted" column is our intent and not a
real age. It is not evidence of error rates on real photos and we make no such
claim. What it does show is a spread wide enough that gating a blocking rule on it
would be indefensible. Age comes from what the shopper declares.

## Billing confirmed

Eight SD concerns including `skin_type` fell in the 5 to 8 band at 12 units.
Fitzpatrick cost 10. One scan is 22 units, charged only on success.
