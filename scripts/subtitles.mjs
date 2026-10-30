// Builds caption cues for the demo video.
//
// Timing comes from the ASR pass over the recorded narration (word-level, in
// video/captions/*.words.json). Wording comes from docs/VIDEO_SCRIPT.md, which
// is what was actually sent to the voice API.
//
// Neither alone is good enough. The ASR mishears the odd word, and a wrong word
// burned into a subtitle is worse than no subtitle. But it renders spoken
// numbers as digits — "twenty-two and a half percent" becomes "22.5%" — and on
// screen that is both easier to read and the same form the /eval page uses. So
// where the two disagree, a numeric ASR token wins and anything else loses.
//
// Run: node scripts/subtitles.mjs   (writes video/captions/cues.json)

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const SCRIPT = join(ROOT, "docs/VIDEO_SCRIPT.md");
const CAPS = join(ROOT, "video/captions");

const MAX_CHARS = 46; // a comfortable single line at the size we render
const MAX_WORDS = 8;
const MIN_CUE = 0.85; // a cue that flashes shorter than this cannot be read

const slug = (section) =>
  section
    .replace(/\(\d+:\d+[^)]*\)/g, "")
    .replace(/^[\d:\s]+to[\d:\s]+,?\s*/i, "")
    .replace(/^Preset (\d+),\s*/i, "preset-$1-")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** The same block parse narrate.ts uses, so captions track what was spoken. */
function parseBlocks(markdown) {
  const headings = [...markdown.matchAll(/^###? (.+)$/gm)];
  const sectionAt = (index) => {
    let found = "";
    for (const h of headings) {
      if ((h.index ?? 0) < index) found = h[1];
      else break;
    }
    return found;
  };
  const blocks = [];
  const pattern = /\*\*Voiceover \((\d+) words\):\*\*\n((?:>.*\n)+)/g;
  for (const match of markdown.matchAll(pattern)) {
    const text = match[2]
      .trim()
      .split("\n")
      .map((line) => line.replace(/^>\s?/, ""))
      .join("\n")
      .replace(/\n{3,}/g, "\n\n");
    blocks.push({ index: blocks.length, section: sectionAt(match.index ?? 0), text });
  }
  return blocks;
}

const norm = (w) => w.toLowerCase().replace(/[^a-z0-9]/g, "");
const isNumeric = (w) => /\d/.test(w);

/** Longest common subsequence over normalized tokens, as difflib-style opcodes. */
function opcodes(a, b) {
  const n = a.length;
  const m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const ops = [];
  let i = 0;
  let j = 0;
  const flush = (i1, i2, j1, j2) => {
    if (i2 > i1 || j2 > j1) ops.push({ tag: i2 > i1 && j2 > j1 ? "replace" : i2 > i1 ? "delete" : "insert", i1, i2, j1, j2 });
  };
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      const si = i;
      const sj = j;
      while (i < n && j < m && a[i] === b[j]) {
        i++;
        j++;
      }
      ops.push({ tag: "equal", i1: si, i2: i, j1: sj, j2: j });
    } else {
      const si = i;
      const sj = j;
      while (i < n && j < m && a[i] !== b[j]) {
        if (dp[i + 1][j] >= dp[i][j + 1]) i++;
        else j++;
      }
      flush(si, i, sj, j);
    }
  }
  flush(i, n, j, m);
  return ops;
}

/** Spread one timed span evenly across k tokens, so substituted words still move. */
function spread(span, k) {
  const out = [];
  const step = (span.end - span.start) / Math.max(k, 1);
  for (let x = 0; x < k; x++) {
    out.push({ start: span.start + step * x, end: span.start + step * (x + 1) });
  }
  return out;
}

function alignBlock(scriptText, words) {
  // Keep punctuation on the script side; it is what tells us where a cue ends.
  const scriptTokens = scriptText.match(/[A-Za-z0-9][A-Za-z0-9'’\-]*[.,;:!?]*/g) ?? [];
  const a = scriptTokens.map(norm);
  const b = words.map((w) => norm(w.text));
  const out = [];

  for (const op of opcodes(a, b)) {
    if (op.tag === "equal") {
      for (let k = 0; k < op.i2 - op.i1; k++) {
        const w = words[op.j1 + k];
        out.push({ text: scriptTokens[op.i1 + k], start: w.start, end: w.end });
      }
      continue;
    }
    const asr = words.slice(op.j1, op.j2);
    const script = scriptTokens.slice(op.i1, op.i2);
    const span = asr.length
      ? { start: asr[0].start, end: asr[asr.length - 1].end }
      : { start: out.at(-1)?.end ?? 0, end: out.at(-1)?.end ?? 0 };

    // A number the ASR wrote in digits: keep its form, it reads better on screen.
    if (asr.length && asr.every((w) => isNumeric(w.text)) && script.length) {
      const trailing = script.at(-1).match(/[.,;:!?]+$/)?.[0] ?? "";
      asr.forEach((w, k) => {
        out.push({ text: w.text + (k === asr.length - 1 ? trailing : ""), start: w.start, end: w.end });
      });
      continue;
    }
    // Otherwise the script is right and the ASR misheard.
    if (script.length) {
      spread(span, script.length).forEach((t, k) => out.push({ text: script[k], ...t }));
    }
  }
  return out;
}

/** Group timed tokens into readable cues, breaking on sentences first. */
function toCues(tokens) {
  const cues = [];
  let cur = [];
  const push = () => {
    if (!cur.length) return;
    const text = cur.map((t) => t.text).join(" ");
    cues.push({ text, start: cur[0].start, end: Math.max(cur.at(-1).end, cur[0].start + MIN_CUE) });
    cur = [];
  };
  for (const t of tokens) {
    cur.push(t);
    const chars = cur.reduce((n, x) => n + x.text.length + 1, -1);
    const sentenceEnd = /[.!?]$/.test(t.text);
    const clauseEnd = /[,;:]$/.test(t.text);
    if (sentenceEnd || cur.length >= MAX_WORDS || chars >= MAX_CHARS || (clauseEnd && cur.length >= 5)) push();
  }
  push();

  // A two-word tail left over from a long sentence reads as a glitch. Fold it
  // back into the cue before it where that still fits on one line.
  for (let i = cues.length - 1; i > 0; i--) {
    const words = cues[i].text.split(" ").length;
    const joined = `${cues[i - 1].text} ${cues[i].text}`;
    if (words <= 2 && joined.length <= 58) {
      cues[i - 1] = { text: joined, start: cues[i - 1].start, end: cues[i].end };
      cues.splice(i, 1);
    }
  }

  // Close each gap so a cue holds until the next one, rather than blinking out.
  for (let i = 0; i < cues.length - 1; i++) {
    const gap = cues[i + 1].start - cues[i].end;
    if (gap > 0 && gap < 0.6) cues[i].end = cues[i + 1].start;
  }
  return cues;
}

const blocks = parseBlocks(readFileSync(SCRIPT, "utf8"));
const result = {};
let total = 0;

for (const b of blocks) {
  const name = `${String(b.index + 1).padStart(2, "0")}-${slug(b.section)}`;
  const file = join(CAPS, `${name}.words.json`);
  if (!existsSync(file)) {
    console.error(`  no word timings for ${name} — run hyperframes transcribe first`);
    continue;
  }
  const raw = JSON.parse(readFileSync(file, "utf8"));
  const words = Array.isArray(raw) ? raw : raw.words;
  const cues = toCues(alignBlock(b.text, words));
  result[name] = cues;
  total += cues.length;
  console.log(`  ${name.padEnd(44)} ${String(cues.length).padStart(3)} cues  ${words.length} words`);
}

writeFileSync(join(CAPS, "cues.json"), `${JSON.stringify(result, null, 2)}\n`);
console.log(`\n${total} cues across ${Object.keys(result).length} blocks -> video/captions/cues.json`);
