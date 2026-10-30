# Synthetic faces

Every image in this folder is **AI generated**. No real person is depicted and no
photo of a real person was used to make them. They exist so the scan bank and the
demo presets never rely on a real shopper's face.

All generated with Higgsfield Soul 2.0 on 2026-10-30, from a text prompt only, with no reference photograph of any person.

| File | Fitzpatrick the API returned | What it exercises |
|---|---|---|
| `synthetic-01.jpg` | Fitzpatrick VI returned | Deeper skin tone, visible texture, dry |
| `synthetic-02-acne.jpg` | III | Visible inflammatory papules and pustules, oily |
| `synthetic-03-flushing.jpg` | II | Centrofacial flushing. Scored redness 7.1, the lowest in the bank |
| `synthetic-04-pigment.jpg` | V | Uneven pigmentation across cheeks and forehead |
| `synthetic-05-mature.jpg` | III | Deep lines. Scored wrinkle 1.1, the lowest in the bank |
| `synthetic-06-clear.jpg` | III | Clear even skin. The control |
| `synthetic-07-oily.jpg` | III | Shiny T-zone, enlarged pores |
| `synthetic-08-dry.jpg` | II | Dry, flaking, mildly pink |
| `synthetic-09-olive.jpg` | IV | Olive skin with moderate breakouts. Scored acne 61.2, the lowest in the bank |

The prompts asked for an unretouched, bare, evenly lit frontal portrait so the
scan has real texture to work with rather than a smoothed studio face.

These files are stored as JPEG to keep the repository small. The exact bytes that
were sent to the YouCam API are the `input.jpg` inside each
`fixtures/scans/<label>/` folder, alongside the response they produced.

This is disclosed on the Methods page as well. Synthetic faces are a limitation,
not a feature: a generated face is not a real distribution of real skin.
