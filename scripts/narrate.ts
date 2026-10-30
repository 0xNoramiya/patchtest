/**
 * Narrates docs/VIDEO_SCRIPT.md with ElevenLabs, one clip per voiceover block.
 *
 *   pnpm narrate              dry run: what would be spoken, and what it costs
 *   pnpm narrate --generate   actually calls the API and writes the mp3s
 *
 * Blocks are stitched: each request is told the text either side of it, so the
 * clips do not drift in tone or pop at the joins when they are laid end to end.
 * Durations are measured with ffprobe afterwards and checked against the budget
 * the script sets for each block, because the whole point of that budget is that
 * the finished video fits inside three minutes.
 */
import { createWriteStream } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

process.loadEnvFile(path.join(process.cwd(), ".env.local"));

const run = promisify(execFile);

const SCRIPT = "docs/VIDEO_SCRIPT.md";
const OUT_DIR = path.join("media", "voiceover");

/** George, narrative. Override with --voice or ELEVENLABS_VOICE_ID. */
const DEFAULT_VOICE = "JBFqnCBsd6RMkjVDRZzb";
const MODEL = "eleven_v4";
/** The narration preset from the ElevenLabs text-to-speech skill. */
const VOICE_SETTINGS = { stability: 0.7, similarityBoost: 0.75 };
/** The pace the script's word budgets assume. */
const WORDS_PER_MINUTE = 165;

type Block = { index: number; section: string; claimedWords: number; text: string };

function parseBlocks(markdown: string): Block[] {
  const blocks: Block[] = [];
  // Prefer the nearest sub-heading, so the three cart clips get distinct names
  // rather than three files called the same thing.
  const headings = [...markdown.matchAll(/^###? (.+)$/gm)];
  const findSection = (at: number) =>
    headings.filter((h) => (h.index ?? 0) < at).at(-1)?.[1] ?? "unknown";

  const pattern = /\*\*Voiceover \((\d+) words\):\*\*\n((?:>.*\n)+)/g;
  for (const match of markdown.matchAll(pattern)) {
    const text = match[2]
      .split("\n")
      .map((line) => line.replace(/^>\s?/, ""))
      .join("\n")
      .trim()
      // Blank line between paragraphs tells the model to take a breath.
      .replace(/\n{3,}/g, "\n\n");
    blocks.push({
      index: blocks.length,
      section: findSection(match.index ?? 0),
      claimedWords: Number(match[1]),
      text,
    });
  }
  return blocks;
}

const wordsIn = (text: string) => text.match(/[A-Za-z0-9][A-Za-z0-9'’\-]*/g)?.length ?? 0;
const slug = (section: string) =>
  section
    .replace(/\(\d+:\d+[^)]*\)/g, "")
    .replace(/^[\d:\s]+to[\d:\s]+,?\s*/i, "")
    .replace(/^Preset (\d+),\s*/i, "preset-$1-")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 46);

async function durationOf(file: string): Promise<number> {
  const { stdout } = await run("ffprobe", [
    "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file,
  ]);
  return Number(stdout.trim());
}

async function main() {
  const args = process.argv.slice(2);
  const generate = args.includes("--generate");
  const voiceFlag = args.indexOf("--voice");
  const voiceId = voiceFlag > -1 ? args[voiceFlag + 1] : (process.env.ELEVENLABS_VOICE_ID ?? DEFAULT_VOICE);

  const blocks = parseBlocks(await readFile(SCRIPT, "utf8"));
  if (blocks.length === 0) throw new Error(`No voiceover blocks found in ${SCRIPT}`);

  const chars = blocks.reduce((n, b) => n + b.text.length, 0);
  const words = blocks.reduce((n, b) => n + wordsIn(b.text), 0);

  console.log(`${blocks.length} voiceover blocks in ${SCRIPT}`);
  console.log(`${words} words, ${chars} characters`);
  console.log(`At ${WORDS_PER_MINUTE} wpm that is about ${Math.round((words / WORDS_PER_MINUTE) * 60)}s of speech\n`);

  for (const b of blocks) {
    const actual = wordsIn(b.text);
    const drift = actual === b.claimedWords ? "" : `  (script claims ${b.claimedWords})`;
    console.log(`  ${String(b.index + 1).padStart(2)}. ${slug(b.section).padEnd(26)} ${String(actual).padStart(3)}w  ${String(b.text.length).padStart(4)} chars${drift}`);
  }

  if (!generate) {
    console.log(`\nDry run. Nothing was sent to ElevenLabs and nothing was charged.`);
    console.log(`Re-run with --generate to produce ${blocks.length} mp3 files in ${OUT_DIR}/`);
    console.log(`That request would bill ${chars} characters.`);
    return;
  }

  const { ElevenLabsClient } = await import("@elevenlabs/elevenlabs-js");
  const client = new ElevenLabsClient();

  await mkdir(OUT_DIR, { recursive: true });
  console.log(`\nVoice ${voiceId}, model ${MODEL}\n`);

  const manifest: Array<{ file: string; section: string; words: number; seconds: number }> = [];

  for (const b of blocks) {
    const name = `${String(b.index + 1).padStart(2, "0")}-${slug(b.section)}.mp3`;
    const file = path.join(OUT_DIR, name);

    const audio = await client.textToSpeech.convert(voiceId, {
      text: b.text,
      modelId: MODEL,
      voiceSettings: VOICE_SETTINGS,
      // Request stitching, so the joins between clips do not shift in tone.
      previousText: blocks[b.index - 1]?.text,
      nextText: blocks[b.index + 1]?.text,
    });

    await pipeline(Readable.fromWeb(audio as Parameters<typeof Readable.fromWeb>[0]), createWriteStream(file));
    const seconds = await durationOf(file);
    manifest.push({ file: name, section: b.section, words: wordsIn(b.text), seconds });
    console.log(`  ${name.padEnd(34)} ${seconds.toFixed(1)}s`);
  }

  const total = manifest.reduce((n, m) => n + m.seconds, 0);
  await writeFile(
    path.join(OUT_DIR, "manifest.json"),
    `${JSON.stringify({ generated_at: new Date().toISOString(), voiceId, model: MODEL, totalSeconds: Math.round(total * 10) / 10, clips: manifest }, null, 2)}\n`,
  );

  const mins = Math.floor(total / 60);
  console.log(`\nNarration total: ${mins}:${String(Math.round(total % 60)).padStart(2, "0")} (${total.toFixed(1)}s)`);
  console.log(`Visual pauses and the final card add to this. The cap is 3:00.`);
  if (total > 165) {
    console.log(`\nOver the 2:45 narration budget by ${(total - 165).toFixed(0)}s. Trim words, not the ending.`);
  }
  console.log(`\nWritten to ${OUT_DIR}/ with manifest.json`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
