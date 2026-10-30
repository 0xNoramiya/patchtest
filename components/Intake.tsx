"use client";

import type { Intake } from "@/lib/intake";

const AGE = [
  ["under_13", "Under 13"],
  ["13_17", "13 to 17"],
  ["18_plus", "18 or over"],
] as const;

const PREGNANCY = [
  ["none", "None of these"],
  ["pregnant", "Pregnant"],
  ["trying", "Trying to conceive"],
  ["breastfeeding", "Breastfeeding"],
] as const;

const ISO = [
  ["no", "No"],
  ["now", "Taking it now"],
  ["stopped_under_6m", "Stopped less than 6 months ago"],
] as const;

const USING = [
  ["tretinoin", "Tretinoin"],
  ["tazarotene", "Tazarotene"],
  ["hydroquinone", "Hydroquinone"],
  ["other_prescription_cream", "Another prescription cream"],
  ["retinol", "Retinol"],
  ["benzoyl_peroxide", "Benzoyl peroxide"],
  ["salicylic_acid", "Salicylic acid"],
  ["glycolic_acid", "Glycolic acid"],
  ["vitamin_c", "Vitamin C"],
  ["azelaic_acid", "Azelaic acid"],
] as const;

const PROCEDURES = [
  ["chemical_peel", "A chemical peel"],
  ["laser", "Laser"],
  ["microneedling", "Microneedling"],
  ["waxing", "Waxing"],
  ["dermabrasion", "Dermabrasion"],
] as const;

const SYMPTOMS = [
  ["deep_painful_bumps", "Deep, painful bumps under the skin"],
  ["scarring", "Marks or scars left behind"],
  ["flushing", "Flushing that comes and goes"],
  ["persistent_redness", "Redness that stays"],
  ["eye_irritation", "Gritty or irritated eyes"],
  ["mole_changed", "A mole that has changed"],
  ["sore_not_healing", "A sore that will not heal"],
  ["mood_impact", "It is affecting how I feel"],
  ["otc_no_change", "Tried shop products for 2 to 3 months, no change"],
] as const;

const FITZ = ["I", "II", "III", "IV", "V", "VI"] as const;

function Fieldset({ legend, hint, children }: { legend: string; hint?: string; children: React.ReactNode }) {
  return (
    <fieldset className="border-t border-line pt-5">
      <legend className="font-display text-base">{legend}</legend>
      {hint ? <p className="mt-0.5 text-xs text-faint">{hint}</p> : null}
      <div className="mt-3">{children}</div>
    </fieldset>
  );
}

function Pill({
  checked, onChange, children, type = "radio", name,
}: {
  checked: boolean;
  onChange: () => void;
  children: React.ReactNode;
  type?: "radio" | "checkbox";
  name?: string;
}) {
  return (
    <label
      className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
        checked ? "border-accent bg-accent-soft text-accent" : "border-line bg-surface hover:border-accent/40"
      }`}
    >
      <input
        type={type}
        name={name}
        checked={checked}
        onChange={onChange}
        className="h-4 w-4 accent-[var(--accent)]"
      />
      {children}
    </label>
  );
}

export function IntakeForm({
  value,
  onChange,
}: {
  value: Intake;
  onChange: (next: Intake) => void;
}) {
  const set = <K extends keyof Intake>(key: K, v: Intake[K]) => onChange({ ...value, [key]: v });
  const toggle = <K extends "currentlyUsing" | "recentProcedures" | "symptoms">(key: K, item: string) => {
    const list = value[key] as string[];
    const next = list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
    onChange({ ...value, [key]: next } as Intake);
  };

  return (
    <div className="space-y-6">
      <Fieldset legend="How old are you?" hint="You tell us. We never read age off your face.">
        <div className="flex flex-wrap gap-2">
          {AGE.map(([v, label]) => (
            <Pill key={v} name="age" checked={value.ageBand === v} onChange={() => set("ageBand", v)}>
              {label}
            </Pill>
          ))}
        </div>
      </Fieldset>

      <Fieldset legend="Are you pregnant or breastfeeding?">
        <div className="flex flex-wrap gap-2">
          {PREGNANCY.map(([v, label]) => (
            <Pill key={v} name="pregnancy" checked={value.pregnancy === v} onChange={() => set("pregnancy", v)}>
              {label}
            </Pill>
          ))}
        </div>
      </Fieldset>

      <Fieldset legend="Are you taking isotretinoin?" hint="Sometimes sold as Roaccutane or Accutane.">
        <div className="flex flex-wrap gap-2">
          {ISO.map(([v, label]) => (
            <Pill key={v} name="iso" checked={value.isotretinoin === v} onChange={() => set("isotretinoin", v)}>
              {label}
            </Pill>
          ))}
        </div>
      </Fieldset>

      <Fieldset legend="Are you already using any of these?">
        <div className="flex flex-wrap gap-2">
          {USING.map(([v, label]) => (
            <Pill key={v} type="checkbox" checked={value.currentlyUsing.includes(v)} onChange={() => toggle("currentlyUsing", v)}>
              {label}
            </Pill>
          ))}
        </div>
      </Fieldset>

      <Fieldset legend="Any of these in the last few months?">
        <div className="flex flex-wrap gap-2">
          {PROCEDURES.map(([v, label]) => (
            <Pill key={v} type="checkbox" checked={value.recentProcedures.includes(v)} onChange={() => toggle("recentProcedures", v)}>
              {label}
            </Pill>
          ))}
        </div>
      </Fieldset>

      <Fieldset legend="Have you noticed any of these?" hint="Tick anything that applies. Some of these change what we will show you.">
        <div className="grid gap-2 sm:grid-cols-2">
          {SYMPTOMS.map(([v, label]) => (
            <Pill key={v} type="checkbox" checked={value.symptoms.includes(v)} onChange={() => toggle("symptoms", v)}>
              {label}
            </Pill>
          ))}
        </div>
      </Fieldset>

      <Fieldset legend="Your skin tone, if you want to set it yourself" hint="The scan estimates this. Your own answer wins.">
        <div className="flex flex-wrap gap-2">
          <Pill checked={!value.fitzpatrickSelfReported} onChange={() => set("fitzpatrickSelfReported", null)}>
            Use the scan
          </Pill>
          {FITZ.map((v) => (
            <Pill key={v} checked={value.fitzpatrickSelfReported === v} onChange={() => set("fitzpatrickSelfReported", v)}>
              Type {v}
            </Pill>
          ))}
        </div>
      </Fieldset>

      <Fieldset legend="What are you hoping for?">
        <textarea
          value={value.goal}
          onChange={(e) => set("goal", e.target.value)}
          aria-label="What are you hoping for?"
          rows={3}
          placeholder="For example: my skin is breaking out along my jaw and I want it to stop"
          className="w-full rounded-lg border border-line bg-surface p-3 text-base leading-relaxed placeholder:text-faint"
        />
      </Fieldset>
    </div>
  );
}
