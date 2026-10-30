/**
 * Writes video/demo/index.html from the real assets.
 *
 * Durations are read from the narration manifest and probed off the recorded
 * clips, never guessed, so the picture can never run out before the voice does.
 * Run after `pnpm narrate --generate` and `node scripts/record-clips.mjs`.
 */
import { execFile } from "node:child_process";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);
const PROJECT = "video/demo";
const LEAD = 0.3;   // beat before the voice starts
const TAIL = 0.3;   // beat after it ends
const XFADE = 0.5;  // crossfade overlap between scenes

const probe = async (f) =>
  Number((await run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f])).stdout);

/** Scene order, and which narration block and clip each one carries. */
const SCENES = [
  { id: "hook",      block: "01", kind: "card" },
  { id: "pregnant",  block: "02", kind: "clip", clip: "preset-pregnant" },
  { id: "peel",      block: "03", kind: "clip", clip: "preset-peel" },
  { id: "refer",     block: "04", kind: "clip", clip: "preset-refer" },
  { id: "extension", block: "05", kind: "clip", clip: "extension" },
  { id: "methods",   block: "06", kind: "clip", clip: "methods" },
  { id: "evalpage",  block: "07", kind: "clip", clip: "eval" },
  { id: "endcard",   block: "08", kind: "card", hold: 3.2 },
];

async function main() {
  const manifest = JSON.parse(await readFile("media/voiceover/manifest.json", "utf8"));
  const narration = (block) => manifest.clips.find((c) => c.file.startsWith(block));

  await mkdir(`${PROJECT}/assets/audio`, { recursive: true });
  await mkdir(`${PROJECT}/assets/clips`, { recursive: true });
  await mkdir(`${PROJECT}/assets/img`, { recursive: true });

  let t = 0;
  const timeline = [];
  for (const scene of SCENES) {
    const vo = narration(scene.block);
    if (!vo) throw new Error(`No narration recorded for block ${scene.block}`);
    await copyFile(`media/voiceover/${vo.file}`, `${PROJECT}/assets/audio/${vo.file}`);

    let duration = LEAD + vo.seconds + TAIL + (scene.hold ?? 0);
    let clipFile = null;
    if (scene.kind === "clip") {
      const src = `media/clips/${scene.clip}.mp4`;
      const available = await probe(src);
      // The scene can never outlast its footage.
      duration = Math.min(duration, available);
      if (duration < LEAD + vo.seconds) {
        throw new Error(`${scene.clip}.mp4 is ${available.toFixed(1)}s, too short for ${vo.seconds.toFixed(1)}s of narration`);
      }
      clipFile = `${scene.clip}.mp4`;
      await copyFile(src, `${PROJECT}/assets/clips/${clipFile}`);
    }

    timeline.push({ ...scene, start: Math.round(t * 100) / 100, duration: Math.round(duration * 100) / 100,
      audio: vo.file, audioStart: Math.round((t + LEAD) * 100) / 100, clipFile });
    t += duration - XFADE;
  }

  const total = Math.round((t + XFADE) * 100) / 100;
  await copyFile("docs/screenshots/landing.webp", `${PROJECT}/assets/img/landing.webp`);

  const html = render(timeline, total);
  await writeFile(`${PROJECT}/index.html`, html);

  console.log(`${timeline.length} scenes, ${Math.floor(total / 60)}:${String(Math.round(total % 60)).padStart(2, "0")} (${total}s)\n`);
  for (const s of timeline) {
    console.log(`  ${String(s.start).padStart(6)}s  ${s.id.padEnd(10)} ${String(s.duration).padStart(5)}s  ${s.clipFile ?? "card"}`);
  }
  if (total > 180) console.log(`\n  OVER the three minute cap by ${(total - 180).toFixed(1)}s`);
  else console.log(`\n  ${(180 - total).toFixed(1)}s under the three minute cap`);
}

function render(scenes, total) {
  const scene = (s) => s.kind === "clip" ? clipScene(s) : cardScene(s);
  const audio = (s, i) =>
    `    <audio id="a-${s.id}" data-start="${s.audioStart}" data-duration="${scenes[i].kind === "card" ? "" : ""}" data-track-index="${20 + i}" src="assets/audio/${s.audio}" data-volume="1"></audio>`
      .replace(' data-duration=""', "");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1920, height=1080" />
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
    <style>
      /* The real files, so the cards are set in the same faces as the product
         the clips are showing. The clips carry their own fonts already. */
      @font-face { font-family: "Source Serif 4"; src: url("assets/fonts/SourceSerif4-400.woff2") format("woff2"); font-weight: 400; font-display: block; }
      @font-face { font-family: "Source Serif 4"; src: url("assets/fonts/SourceSerif4-600.woff2") format("woff2"); font-weight: 600; font-display: block; }
      @font-face { font-family: "Geist"; src: url("assets/fonts/Geist-400.woff2") format("woff2"); font-weight: 400; font-display: block; }
      @font-face { font-family: "Geist"; src: url("assets/fonts/Geist-500.woff2") format("woff2"); font-weight: 500; font-display: block; }

      /* Taken from the product's own tokens, see video/design.md. */
      :root {
        --paper: #fbfaf7;
        --surface: #ffffff;
        --ink: #191c1a;
        --muted: #5f6660;
        --faint: #6f756f;
        --accent: #2f5d4f;
        --block: #a5342b;
      }
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body {
        width: 1920px; height: 1080px; overflow: hidden;
        background: var(--paper);
        font-family: "Geist", "Inter", system-ui, sans-serif;
        -webkit-font-smoothing: antialiased;
      }
      #root { width: 100%; height: 100%; position: relative; }

      .scene { position: absolute; inset: 0; }
      .scene video { width: 100%; height: 100%; object-fit: cover; display: block; }

      .card {
        width: 100%; height: 100%;
        display: flex; flex-direction: column; justify-content: center;
        padding: 150px 190px; gap: 30px;
        background: var(--paper);
      }
      .eyebrow {
        font-size: 24px; letter-spacing: 0.14em; text-transform: uppercase;
        font-weight: 500; color: var(--accent);
      }
      .stat {
        font-family: "Source Serif 4", Georgia, serif;
        font-size: 128px; line-height: 1.02; letter-spacing: -0.02em; color: var(--ink);
        max-width: 1480px;
      }
      .stat em { font-style: normal; color: var(--block); }
      .sub { font-size: 34px; line-height: 1.45; color: var(--muted); max-width: 1280px; }
      .cite { font-size: 24px; color: var(--faint); font-style: italic; }

      .endcard { align-items: flex-start; gap: 26px; }
      .wordmark {
        font-family: "Source Serif 4", Georgia, serif;
        font-size: 104px; letter-spacing: -0.02em; color: var(--ink);
      }
      .wordmark span { color: var(--accent); }
      .tagline { font-size: 40px; color: var(--ink); }
      .apis { font-size: 27px; line-height: 1.6; color: var(--muted); }
      .url { font-size: 34px; color: var(--accent); font-weight: 500; }
      .smallprint { font-size: 21px; line-height: 1.6; color: var(--faint); }

      .shot {
        position: absolute; inset: 0;
        display: flex; align-items: center; justify-content: center;
        background: var(--paper);
      }
      .shot img { width: 78%; border-radius: 16px;
        box-shadow: 0 2px 4px rgb(25 28 26 / 0.05), 0 18px 48px rgb(25 28 26 / 0.14); }
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="${total}" data-width="1920" data-height="1080">
${scenes.map(scene).join("\n")}

${scenes.map(audio).join("\n")}
    </div>
    <script>
      const tl = gsap.timeline({ paused: true });
${scenes.map((s, i) => tweens(s, i, scenes)).join("\n")}
      window.__timelines["main"] = tl;
      tl.seek(0);
    </script>
  </body>
</html>
`;
}

const clipScene = (s) => `      <div class="scene" id="sc-${s.id}" style="z-index:${s.start | 0}">
        <video id="v-${s.id}" data-start="${s.start}" data-duration="${s.duration}" data-track-index="${s.start | 0}" src="assets/clips/${s.clipFile}" muted playsinline></video>
      </div>`;

const cardScene = (s) =>
  s.id === "hook"
    ? `      <div class="scene" id="sc-hook" style="z-index:0">
        <div id="hook-card" class="clip card" data-start="${s.start}" data-duration="${(s.duration * 0.62).toFixed(2)}" data-track-index="1">
          <p class="eyebrow" id="hook-eyebrow">Pediatrics, 2025</p>
          <h1 class="stat" id="hook-stat">The top-viewed children&rsquo;s skincare routines on TikTok average <em>11 potentially irritating active ingredients</em>.</h1>
          <p class="sub" id="hook-sub">Only 26% include sunscreen.</p>
        </div>
        <div class="shot clip" id="hook-shot" data-start="${(s.start + s.duration * 0.6).toFixed(2)}" data-duration="${(s.duration * 0.42).toFixed(2)}" data-track-index="2">
          <img src="assets/img/landing.webp" alt="" crossorigin="anonymous" />
        </div>
      </div>`
    : `      <div class="scene" id="sc-${s.id}" style="z-index:99">
        <div id="end-card" class="clip card endcard" data-start="${s.start}" data-duration="${s.duration}" data-track-index="3">
          <h1 class="wordmark" id="end-wordmark">Patch<span>Test</span></h1>
          <p class="tagline" id="end-tagline">A patch test for your cart.</p>
          <p class="apis" id="end-apis">Web app, and a browser extension for everyone else&rsquo;s shop.<br />Built with the YouCam AI Skin Analysis API and the YouCam AI Fitzpatrick Skin Type Analysis API.</p>
          <p class="url" id="end-url">patchtest.fly.dev</p>
          <p class="smallprint" id="end-small">Every face and product image shown is AI generated. &ldquo;Lumen &amp; Leaf&rdquo; and &ldquo;Verdant Row&rdquo; are fictional stores. Not a medical device.</p>
        </div>
      </div>`;

/** Entrances only. The crossfade is the exit, except on the final scene. */
function tweens(s, i, scenes) {
  const lines = [];
  const el = `#sc-${s.id}`;
  if (i === 0) {
    lines.push(`      tl.from("#hook-eyebrow", { y: 26, opacity: 0, duration: 0.6, ease: "power3.out" }, 0.25);`);
    lines.push(`      tl.from("#hook-stat", { y: 48, opacity: 0, duration: 0.9, ease: "expo.out" }, 0.45);`);
    lines.push(`      tl.from("#hook-sub", { y: 30, opacity: 0, duration: 0.7, ease: "power2.out" }, 0.95);`);
    lines.push(`      tl.fromTo("#hook-shot", { opacity: 0, scale: 1.04 }, { opacity: 1, scale: 1, duration: 0.8, ease: "power2.out" }, ${(s.start + s.duration * 0.6).toFixed(2)});`);
  } else {
    // Crossfade in over the scene before it.
    lines.push(`      tl.fromTo("${el}", { opacity: 0 }, { opacity: 1, duration: ${XFADE}, ease: "power1.inOut" }, ${s.start.toFixed(2)});`);
  }
  if (s.id === "endcard") {
    lines.push(`      tl.from("#end-wordmark", { y: 34, opacity: 0, duration: 0.7, ease: "expo.out" }, ${(s.start + 0.35).toFixed(2)});`);
    lines.push(`      tl.from("#end-tagline", { y: 24, opacity: 0, duration: 0.6, ease: "power3.out" }, ${(s.start + 0.6).toFixed(2)});`);
    lines.push(`      tl.from("#end-apis", { opacity: 0, duration: 0.6, ease: "power2.out" }, ${(s.start + 0.85).toFixed(2)});`);
    lines.push(`      tl.from("#end-url", { y: 18, opacity: 0, duration: 0.5, ease: "power3.out" }, ${(s.start + 1.05).toFixed(2)});`);
    lines.push(`      tl.from("#end-small", { opacity: 0, duration: 0.5, ease: "power1.out" }, ${(s.start + 1.3).toFixed(2)});`);
    // Final scene is the only one allowed to animate out.
    lines.push(`      tl.to("#sc-endcard", { opacity: 0, duration: 0.7, ease: "power2.in" }, ${(s.start + s.duration - 0.75).toFixed(2)});`);
  }
  return lines.join("\n");
}

main().catch((e) => { console.error(e.message); process.exitCode = 1; });
