import type { Intake } from "./intake";

export type Preset = {
  id: string;
  title: string;
  blurb: string;
  scanLabel: string;
  intake: Partial<Intake>;
  /** What the shopper already put in their cart before asking us. */
  wantedSkus: string[];
  goal: string;
};

/**
 * One click each, replay mode, for the video and for judges. Every one of these
 * is a real recorded scan plus a declared intake. No face here belongs to a real
 * person, and no minor was scanned: the age on the first preset is declared, not
 * read off the photo.
 */
export const PRESETS: Preset[] = [
  {
    id: "tiktok",
    title: "A 12 year old with a TikTok routine",
    blurb: "Declared age under 13. Three strong actives in the cart.",
    scanLabel: "synthetic-06-clear",
    intake: { ageBand: "under_13" },
    wantedSkus: ["LL-107", "LL-112", "LL-110"],
    goal: "I want the routine everyone on TikTok has. The strong retinol, the vitamin C serum and that 30 percent peel. All my friends use it.",
  },
  {
    id: "pregnant",
    title: "Eight weeks pregnant, breaking out",
    blurb: "Wants the retinoid that was working before.",
    scanLabel: "synthetic-02-acne",
    intake: { pregnancy: "pregnant" },
    wantedSkus: ["LL-105", "LL-102"],
    goal: "I am eight weeks pregnant and my skin has gone haywire. The adapalene gel was working for me before. I want to carry on with it.",
  },
  {
    id: "peel",
    title: "Dark patches and a 30% peel",
    blurb: "Fitzpatrick V from the scan. The peel is the risky part.",
    scanLabel: "synthetic-04-pigment",
    intake: {},
    wantedSkus: ["LL-110", "LL-107"],
    goal: "I have dark patches on my cheeks that I want gone. I want the 30 percent peel and your strongest retinol.",
  },
  {
    id: "refer",
    title: "Painful lumps that leave marks",
    blurb: "Reported signs that shopping should not try to solve.",
    scanLabel: "synthetic-09-olive",
    intake: { symptoms: ["deep_painful_bumps", "scarring"] },
    wantedSkus: ["LL-104", "LL-110"],
    goal: "I get big painful lumps along my jaw and they leave marks behind. I want the strongest things you have, the 5 percent benzoyl peroxide and the peel.",
  },
  {
    id: "isotretinoin",
    title: "On isotretinoin, wants wax strips",
    blurb: "Declared current isotretinoin. Wax and an acid in the cart.",
    scanLabel: "synthetic-01",
    intake: { isotretinoin: "now" },
    wantedSkus: ["LL-120", "LL-109"],
    goal: "I am on isotretinoin. My skin is flaky so I want the glycolic toner, and the wax strips for my upper lip.",
  },
];

export function presetById(id: string): Preset | undefined {
  return PRESETS.find((p) => p.id === id);
}
