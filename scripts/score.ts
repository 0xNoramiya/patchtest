/**
 * Generates the trailer's original score and sound effects with ElevenLabs.
 *
 *   pnpm score              dry run, charges nothing
 *   pnpm score --generate   writes media/score/
 *
 * The music is one continuous piece rather than three stitched sections, so the
 * key and tempo stay put across the cuts. The arc is described in the prompt and
 * the edit is laid against it, not the other way round.
 */
import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

process.loadEnvFile(path.join(process.cwd(), ".env.local"));
const run = promisify(execFile);
const OUT = path.join("media", "score");

/** Matches the cut: tense open, steady middle, lift under the numbers, resolve. */
const MUSIC_MS = 182_000;
const MUSIC_PROMPT = `Cinematic minimal instrumental score for a serious product film about health and safety. No drums for the first thirty seconds: start with a single low sustained synth drone and a sparse, hesitant piano figure, uneasy and spacious. Around thirty seconds a soft muted pulse enters, steady and restrained, and warm strings build slowly underneath. Keep the middle section calm, controlled and forward moving, never triumphant, supporting speech rather than competing with it. Around two minutes twenty the strings swell into a quiet, confident resolve with a warm major lift. End softly on a held chord that fades. Tasteful, modern, understated. No vocals, no lyrics, no claps, no big trailer brass hits, no electronic drops.`;

const SFX: Array<{ name: string; text: string; seconds: number }> = [
  { name: "riser", seconds: 3.5, text: "A smooth cinematic riser, soft filtered white noise and a rising synth swell, building tension, clean, no impact at the end" },
  { name: "impact", seconds: 2.5, text: "A deep soft cinematic sub impact, low frequency boom with a short warm tail, restrained and clean, no metallic clang, no reverb wash" },
  { name: "whoosh", seconds: 1.0, text: "A short soft air whoosh passing by, smooth and subtle, for a scene transition, no metallic tone" },
  { name: "tick", seconds: 0.6, text: "A single soft muted UI click, warm and quiet, like a small wooden tap, very short" },
];

async function seconds(file: string) {
  const { stdout } = await run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]);
  return Number(stdout.trim());
}

/** The SDK returns a Node stream for some endpoints and a web stream for others. */
async function write(body: unknown, file: string) {
  const node = typeof (body as { pipe?: unknown })?.pipe === "function"
    ? (body as NodeJS.ReadableStream)
    : Readable.fromWeb(body as Parameters<typeof Readable.fromWeb>[0]);
  await pipeline(node, createWriteStream(file));
}

async function main() {
  const generate = process.argv.includes("--generate");

  console.log(`Music: one continuous piece, ${(MUSIC_MS / 1000).toFixed(0)}s`);
  console.log(`Sound effects: ${SFX.map((s) => s.name).join(", ")}`);

  if (!generate) {
    console.log("\nDry run. Nothing sent to ElevenLabs and nothing charged.");
    console.log("Re-run with --generate to write media/score/");
    return;
  }

  const { ElevenLabsClient } = await import("@elevenlabs/elevenlabs-js");
  const client = new ElevenLabsClient();
  await mkdir(OUT, { recursive: true });

  console.log("\n  composing the score, this takes a minute");
  const music = await client.music.compose({
    prompt: MUSIC_PROMPT,
    musicLengthMs: MUSIC_MS,
    modelId: "music_v2_5",
  });
  const musicFile = path.join(OUT, "score.mp3");
  await write(music, musicFile);
  console.log(`  score.mp3         ${(await seconds(musicFile)).toFixed(1)}s`);

  for (const effect of SFX) {
    const file = path.join(OUT, `${effect.name}.mp3`);
    const audio = await client.textToSoundEffects.convert({
      text: effect.text,
      durationSeconds: effect.seconds,
    });
    await write(audio, file);
    console.log(`  ${`${effect.name}.mp3`.padEnd(18)}${(await seconds(file)).toFixed(1)}s`);
  }

  console.log(`\nWritten to ${OUT}/`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
