/**
 * Writes video/demo/index.html from the real assets.
 *
 * Durations are read from the narration manifest and probed off the files,
 * never guessed, so the picture can never run out before the voice does. The
 * number slams are placed from silencedetect boundaries in the narration, so
 * they land on the word rather than near it.
 */
import { execFile } from "node:child_process";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);
const CUES = JSON.parse(await readFile("video/captions/cues.json", "utf8"));
const PROJECT = "video/demo";
const LEAD = 0.2, TAIL = 0.15, XFADE = 0.65;

const probe = async (f) =>
  Number((await run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f])).stdout);

/** The turn shot: the mirror if it generated, otherwise the hover macro slowed
 *  to length. The hover is arguably the better read for "the helpful answer is
 *  no" anyway, being the held moment before a tap. */
const TURN = existsSync("media/broll/04-mirror.mp4") ? "04-mirror" : "04-turn-fallback";
const BROLL = ["01-shelf", "02-pile", "03-scroll", TURN, "05-hover"];

async function main() {
  const manifest = JSON.parse(await readFile("media/voiceover/manifest.json", "utf8"));
  const vo = (block) => {
    const c = manifest.clips.find((x) => x.file.startsWith(block));
    if (!c) throw new Error(`No narration for block ${block}`);
    return c;
  };

  for (const d of ["audio", "clips", "broll", "score", "img"]) {
    await mkdir(`${PROJECT}/assets/${d}`, { recursive: true });
  }
  const bring = async (from, to) => { await copyFile(from, to); return path.basename(to); };

  for (const c of manifest.clips) await bring(`media/voiceover/${c.file}`, `${PROJECT}/assets/audio/${c.file}`);
  for (const s of ["score", "riser", "impact", "whoosh"]) {
    await bring(`media/score/${s}.mp3`, `${PROJECT}/assets/score/${s}.mp3`);
  }
  for (const b of BROLL) await bring(`media/broll/${b}.mp4`, `${PROJECT}/assets/broll/${b}.mp4`);
  for (const c of ["preset-pregnant", "preset-peel", "preset-refer", "extension", "methods", "eval"]) {
    await bring(`media/clips/${c}.mp4`, `${PROJECT}/assets/clips/${c}.mp4`);
  }

  const S = [];
  let t = 0;
  const place = (o) => {
    const duration = round(o.duration);
    S.push({ ...o, duration, start: round(t) });
    t += duration - XFADE;
  };
  const round = (n) => Math.round(n * 100) / 100;

  // Cold open: three beats of b-roll carrying the statistic, no narration.
  place({ id: "open-shelf",  kind: "broll", src: "01-shelf.mp4",  duration: 2.3, beat: "none" });
  place({ id: "open-pile",   kind: "broll", src: "02-pile.mp4",   duration: 3.1, beat: "eleven" });
  place({ id: "open-scroll", kind: "broll", src: "03-scroll.mp4", duration: 2.9, beat: "sunscreen" });

  // The turn, over the mirror shot.
  const v1 = vo("01");
  place({ id: "turn", kind: "broll", src: `${TURN}.mp4`, duration: LEAD + v1.seconds + TAIL, audio: v1.file, voSeconds: v1.seconds, audioStart: round(t + LEAD) });

  place({ id: "logo", kind: "logo", duration: 2.9 });

  // The address is shown in the frame, so a judge can see which surface each
  // beat is on. "verdant-row.example" is the fictional second shop; .example is
  // reserved by RFC 2606 and can never be a real domain.
  const screens = [
    ["pregnant", "02", "preset-pregnant.mp4", "patchtest.fly.dev"],
    ["peel", "03", "preset-peel.mp4", "patchtest.fly.dev"],
    ["refer", "04", "preset-refer.mp4", "patchtest.fly.dev"],
    ["extension", "05", "extension.mp4", "verdant-row.example/cart"],
    ["methods", "06", "methods.mp4", "patchtest.fly.dev/methods"],
    ["evalpage", "07", "eval.mp4", "patchtest.fly.dev/eval"],
  ];
  for (const [id, block, src, addr] of screens) {
    const v = vo(block);
    const avail = await probe(`media/clips/${src.replace(".mp4", "")}.mp4`);
    const want = LEAD + v.seconds + TAIL;
    if (avail < LEAD + v.seconds) throw new Error(`${src} is ${avail.toFixed(1)}s, too short for ${v.seconds.toFixed(1)}s of narration`);
    place({ id, kind: "screen", src, addr, duration: round(Math.min(want, avail)), audio: v.file, voSeconds: v.seconds, audioStart: round(t + LEAD) });
  }

  const v8 = vo("08");
  place({ id: "endcard", kind: "card", duration: LEAD + v8.seconds + 1.9, audio: v8.file, voSeconds: v8.seconds, audioStart: round(t + LEAD) });

  const total = round(t + XFADE);
  const evalScene = S.find((s) => s.id === "evalpage");
  // From silencedetect on the narration: the 22.5% sentence runs 24.9s to 30.7s
  // into that block, and the hundred-percent line 39.6s to 46.4s.
  const slams = [
    { at: round(evalScene.audioStart + 24.6), duration: 6.4, big: "22.5%", small: "of runs ended with an unsafe item still in the cart", foot: "without the guardrail" },
    { at: round(evalScene.audioStart + 39.3), duration: 7.0, big: "100%", small: "of items needing a usage caveat went out without one", foot: "against 11.1% with the guardrail" },
  ];

  await writeFile(`${PROJECT}/index.html`, html(S, total, slams));

  console.log(`${S.length} scenes, ${Math.floor(total / 60)}:${String(Math.round(total % 60)).padStart(2, "0")} (${total}s)\n`);
  for (const s of S) console.log(`  ${String(s.start).padStart(6)}s  ${s.id.padEnd(12)} ${String(s.duration).padStart(5)}s  ${s.kind}`);
  console.log(total > 180 ? `\n  OVER the cap by ${(total - 180).toFixed(1)}s` : `\n  ${(180 - total).toFixed(1)}s under the three minute cap`);
}

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

function sceneMarkup(s, i) {
  const z = i + 1;
  if (s.kind === "broll") {
    // The beat text is its own timed clip. As an untimed child it would sit in
    // the DOM for the whole film and cover every later scene.
    const beat = s.beat === "eleven"
      ? `<div class="beat clip" id="beat-eleven" data-start="${s.start}" data-duration="${s.duration}" data-track-index="${z + 20}"><p class="huge" id="beat-eleven-n">11</p><p class="beat-line" id="beat-eleven-l">potentially irritating active ingredients in the average top-viewed children&rsquo;s skincare video</p></div>`
      : s.beat === "sunscreen"
        ? `<div class="beat clip" id="beat-sun" data-start="${s.start}" data-duration="${s.duration}" data-track-index="${z + 20}"><p class="mid" id="beat-sun-t">Only <em>26%</em> of daytime routines included sunscreen.</p><p class="cite" id="beat-sun-c">Pediatrics, 2025</p></div>`
        : "";
    return `      <div class="scene" id="sc-${s.id}" style="z-index:${z}">
        <video class="broll" id="v-${s.id}" data-start="${s.start}" data-duration="${s.duration}" data-track-index="${z}" src="assets/broll/${s.src}" muted playsinline></video>
        ${beat}
      </div>`;
  }
  if (s.kind === "logo") {
    return `      <div class="scene" id="sc-${s.id}" style="z-index:${z}">
        <div class="clip logo-card" id="logo-card" data-start="${s.start}" data-duration="${s.duration}" data-track-index="${z}">
          <p class="wordmark" id="logo-word">Patch<span>Test</span></p>
          <p class="logo-tag" id="logo-tag">a patch test for your cart</p>
        </div>
      </div>`;
  }
  if (s.kind === "screen") {
    // The chrome is its own timed clip, not a wrapper around the video: an
    // untimed opaque element would cover every scene after this one.
    return `      <div class="scene" id="sc-${s.id}" style="z-index:${z}">
        <div class="clip chrome" id="ch-${s.id}" data-start="${s.start}" data-duration="${s.duration}" data-track-index="${z + 60}">
          <div class="win">
            <div class="bar"><i></i><i></i><i></i><span class="addr">${esc(s.addr)}</span></div>
          </div>
        </div>
        <video class="framed" id="v-${s.id}" data-start="${s.start}" data-duration="${s.duration}" data-track-index="${z}" src="assets/clips/${s.src}" muted playsinline></video>
      </div>`;
  }
  return `      <div class="scene" id="sc-${s.id}" style="z-index:${z}">
        <div class="clip card endcard" id="end-card" data-start="${s.start}" data-duration="${s.duration}" data-track-index="${z}">
          <p class="wordmark" id="end-word">Patch<span>Test</span></p>
          <p class="tagline" id="end-tag">A patch test for your cart.</p>
          <p class="apis" id="end-apis">Web app, and a browser extension for everyone else&rsquo;s shop.<br />Built with the YouCam AI Skin Analysis API and the YouCam AI Fitzpatrick Skin Type Analysis API.</p>
          <p class="url" id="end-url">patchtest.fly.dev</p>
          <p class="smallprint" id="end-small">Every face, product and scene shown is AI generated. &ldquo;Lumen &amp; Leaf&rdquo; and &ldquo;Verdant Row&rdquo; are fictional stores. Not a medical device.</p>
        </div>
      </div>`;
}

function html(S, total, slams) {
  const audios = S.filter((s) => s.audio).map((s, i) =>
    `      <audio id="a-${s.id}" data-start="${s.audioStart}" data-duration="${round2(s.voSeconds)}" data-track-index="${40 + i}" src="assets/audio/${s.audio}" data-volume="1"></audio>`);

  const logo = S.find((s) => s.id === "logo");
  const score = [
    `      <audio id="m-open" data-start="0" data-duration="${round2(logo.start + 1.2)}" data-track-index="30" src="assets/score/score.mp3" data-volume="0.46"></audio>`,
    `      <audio id="m-body" data-start="${round2(logo.start + 1.2)}" data-duration="${round2(total - logo.start - 1.2)}" data-media-start="${round2(logo.start + 1.2)}" data-track-index="31" src="assets/score/score.mp3" data-volume="0.13"></audio>`,
    `      <audio id="s-riser" data-start="${round2(logo.start - 3.1)}" data-duration="3.5" data-track-index="32" src="assets/score/riser.mp3" data-volume="0.5"></audio>`,
    `      <audio id="s-impact" data-start="${round2(logo.start)}" data-duration="2.5" data-track-index="33" src="assets/score/impact.mp3" data-volume="0.62"></audio>`,
    ...S.filter((s) => s.beat === "eleven" || s.beat === "sunscreen").map((s, i) =>
      `      <audio id="s-wh-${i}" data-start="${s.start}" data-duration="1" data-track-index="${34 + i}" src="assets/score/whoosh.mp3" data-volume="0.4"></audio>`),
    ...slams.map((s, i) =>
      `      <audio id="s-slam-${i}" data-start="${s.at}" data-duration="2.5" data-track-index="${50 + i}" src="assets/score/impact.mp3" data-volume="0.5"></audio>`),
  ];

  // Captions. Timing is measured off the narration, wording comes from the
  // script; see scripts/subtitles.mjs. One track, so two can never co-exist.
  const cues = [];
  for (const sc of S.filter((x) => x.audio)) {
    const key = sc.audio.replace(/\.mp3$/, "");
    for (const c of CUES[key] ?? []) {
      const start = round2(sc.audioStart + c.start);
      const duration = round2(Math.max(c.end - c.start - 0.01, 0.4));
      cues.push({ id: `cue-${cues.length}`, start, duration, text: c.text });
    }
  }
  const cueMarkup = cues.map((c) => `      <div class="scene" style="z-index:95">
        <p class="clip cue" id="${c.id}" data-start="${c.start}" data-duration="${c.duration}" data-track-index="110">${esc(c.text)}</p>
      </div>`);

  const slamMarkup = slams.map((s, i) => `      <div class="scene" style="z-index:90">
        <div class="clip slam" id="slam-${i}" data-start="${s.at}" data-duration="${s.duration}" data-track-index="${80 + i}">
          <p class="slam-big" id="slam-big-${i}">${esc(s.big)}</p>
          <p class="slam-small" id="slam-small-${i}">${esc(s.small)}</p>
          <p class="slam-foot" id="slam-foot-${i}">${esc(s.foot)}</p>
        </div>
      </div>`);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1920, height=1080" />
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
    <style>
      @font-face { font-family: "Source Serif 4"; src: url("assets/fonts/SourceSerif4-400.woff2") format("woff2"); font-weight: 400; font-display: block; }
      @font-face { font-family: "Source Serif 4"; src: url("assets/fonts/SourceSerif4-600.woff2") format("woff2"); font-weight: 600; font-display: block; }
      @font-face { font-family: "Geist"; src: url("assets/fonts/Geist-400.woff2") format("woff2"); font-weight: 400; font-display: block; }
      @font-face { font-family: "Geist"; src: url("assets/fonts/Geist-500.woff2") format("woff2"); font-weight: 500; font-display: block; }

      /* The product's own tokens. See video/design.md. */
      :root {
        --paper: #fbfaf7; --ink: #191c1a; --muted: #5f6660; --faint: #6f756f;
        --accent: #2f5d4f; --block: #a5342b;
      }
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { width: 1920px; height: 1080px; overflow: hidden; background: #0c0e0d;
        font-family: "Geist", system-ui, sans-serif; -webkit-font-smoothing: antialiased; }
      #root { width: 100%; height: 100%; position: relative; }
      .scene { position: absolute; inset: 0; }
      .scene video { width: 100%; height: 100%; object-fit: cover; display: block; }

      /* The grade is a filter on the footage, not an overlay element. An untimed
         overlay would darken the entire film, not just the b-roll. */
      video.broll { filter: saturate(0.82) contrast(1.06) brightness(0.86); }

      /* --- browser frame for the screen captures -------------------------
         Geometry is fixed so the footage keeps its 16:9 and is never squashed:
         a 1640x922 content area, with the 44px bar above it, centred. */
      .chrome { position: absolute; inset: 0;
        background: radial-gradient(120% 120% at 50% 0%, #1d211e 0%, #0c0e0d 70%); }
      .chrome .win { position: absolute; left: 140px; top: 57px; width: 1640px; height: 966px;
        background: var(--paper); border-radius: 16px;
        box-shadow: 0 2px 4px rgb(0 0 0 / 0.3), 0 18px 40px rgb(0 0 0 / 0.38), 0 50px 110px rgb(0 0 0 / 0.42); }
      .chrome .bar { position: absolute; inset: 0 0 auto 0; height: 44px; border-radius: 16px 16px 0 0;
        background: #ecebe6; border-bottom: 1px solid rgb(25 28 26 / 0.09);
        display: flex; align-items: center; gap: 9px; padding: 0 18px; }
      .chrome .bar i { width: 11px; height: 11px; border-radius: 50%; background: #cfccc4; }
      .chrome .addr { margin: 0 auto; transform: translateX(-28px);
        font-size: 17px; color: var(--faint); letter-spacing: 0.01em;
        background: #fbfaf7; border: 1px solid rgb(25 28 26 / 0.07);
        border-radius: 7px; padding: 4px 20px; }
      video.framed { position: absolute; left: 140px; top: 101px; width: 1640px; height: 922px;
        object-fit: cover; border-radius: 0 0 16px 16px; }

      /* --- captions -------------------------------------------------------
         The app is warm paper, so white text needs its own dark plate to stay
         readable; it is pinned to the bottom and never moves. */
      .cue { position: absolute; left: 50%; bottom: 52px; transform: translateX(-50%);
        max-width: 1480px; text-align: center; text-wrap: balance;
        font-size: 37px; line-height: 1.26; color: #fbfaf7; letter-spacing: -0.003em;
        background: rgb(12 14 13 / 0.72); padding: 11px 30px 14px; border-radius: 11px; }

      .beat { position: absolute; inset: 0; display: flex; flex-direction: column;
        justify-content: flex-end; padding: 130px 150px; gap: 18px; }
      .huge { font-family: "Source Serif 4", Georgia, serif; font-size: 400px; line-height: 0.82;
        color: #fbfaf7; letter-spacing: -0.04em; }
      .beat-line { font-size: 40px; line-height: 1.3; color: rgba(251,250,247,0.9); max-width: 1180px; }
      .mid { font-family: "Source Serif 4", Georgia, serif; font-size: 118px; line-height: 1.05;
        color: #fbfaf7; letter-spacing: -0.02em; max-width: 1350px; }
      .mid em { font-style: normal; color: #e8a33d; }
      .cite { font-size: 27px; color: rgba(251,250,247,0.72); font-style: italic; }

      .logo-card { position: absolute; inset: 0; background: var(--paper);
        display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 20px; }
      .wordmark { font-family: "Source Serif 4", Georgia, serif; font-size: 170px;
        letter-spacing: -0.03em; color: var(--ink); }
      .wordmark span { color: var(--accent); }
      .logo-tag { font-size: 34px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--faint); }

      /* Starts hidden: the wrapper is full-frame and not a timed clip, so
         without this it covers the film from the first frame. GSAP owns it. */
      .slam { position: absolute; inset: 0; background: rgba(12,14,13,0.92);
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        gap: 22px; padding: 0 160px; text-align: center; }
      .slam-big { font-family: "Source Serif 4", Georgia, serif; font-size: 340px; line-height: 0.86;
        color: #fbfaf7; letter-spacing: -0.04em; }
      .slam-small { font-size: 44px; line-height: 1.3; color: rgba(251,250,247,0.92); max-width: 1320px; }
      .slam-foot { font-size: 30px; color: #e8a33d; letter-spacing: 0.02em; }

      .card { width: 100%; height: 100%; display: flex; flex-direction: column; justify-content: center;
        padding: 150px 190px; gap: 24px; background: var(--paper); }
      .endcard { align-items: flex-start; }
      .tagline { font-size: 44px; color: var(--ink); }
      .apis { font-size: 28px; line-height: 1.6; color: var(--muted); }
      .url { font-size: 38px; color: var(--accent); font-weight: 500; }
      .smallprint { font-size: 22px; line-height: 1.6; color: var(--faint); max-width: 1400px; }
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="${total}" data-width="1920" data-height="1080">
${S.map(sceneMarkup).join("\n")}

${slamMarkup.join("\n")}

${cueMarkup.join("\n")}

${audios.join("\n")}
${score.join("\n")}
    </div>
    <script>
      const tl = gsap.timeline({ paused: true });
${S.map((s, i) => tweens(s, i)).join("\n")}
${slams.map((s, i) => slamTweens(s, i)).join("\n")}
${cues.map((c) => `      tl.fromTo("#${c.id}", { opacity: 0 }, { opacity: 1, duration: 0.14, ease: "power1.out" }, ${c.start});`).join("\n")}
      window.__timelines["main"] = tl;
      tl.seek(0);
    </script>
  </body>
</html>
`;
}

const round2 = (n) => Math.round(n * 100) / 100;

/** Entrances only. The crossfade is the exit, except on the final scene. */
function tweens(s, i) {
  const L = [];
  const el = `#sc-${s.id}`;
  const at = s.start.toFixed(2);
  if (i > 0) L.push(`      tl.fromTo("${el}", { opacity: 0 }, { opacity: 1, duration: ${XFADE}, ease: "power1.inOut" }, ${at});`);

  if (s.kind === "broll") {
    // A slow push, so generated footage reads as photographed rather than looped.
    L.push(`      tl.fromTo("#v-${s.id}", { scale: 1.06 }, { scale: 1.0, duration: ${(s.duration + 0.6).toFixed(2)}, ease: "none" }, ${at});`);
    if (s.beat === "eleven") {
      L.push(`      tl.fromTo("#beat-eleven-n", { y: 90, opacity: 0, scale: 1.14 }, { y: 0, opacity: 1, scale: 1, duration: 0.62, ease: "expo.out" }, ${(s.start + 0.15).toFixed(2)});`);
      L.push(`      tl.fromTo("#beat-eleven-l", { y: 34, opacity: 0 }, { y: 0, opacity: 1, duration: 0.55, ease: "power3.out" }, ${(s.start + 0.5).toFixed(2)});`);
    }
    if (s.beat === "sunscreen") {
      L.push(`      tl.fromTo("#beat-sun-t", { y: 56, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, ease: "expo.out" }, ${(s.start + 0.15).toFixed(2)});`);
      L.push(`      tl.fromTo("#beat-sun-c", { opacity: 0 }, { opacity: 1, duration: 0.5, ease: "power1.out" }, ${(s.start + 0.6).toFixed(2)});`);
    }
  }

  if (s.kind === "logo") {
    L.push(`      tl.fromTo("#logo-word", { scale: 1.16, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.5, ease: "expo.out" }, ${(s.start + 0.1).toFixed(2)});`);
    L.push(`      tl.fromTo("#logo-tag", { y: 22, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: "power3.out" }, ${(s.start + 0.45).toFixed(2)});`);
  }

  if (s.kind === "screen") {
    L.push(`      tl.fromTo("#v-${s.id}", { scale: 1.03 }, { scale: 1.0, duration: ${(s.duration + 0.6).toFixed(2)}, ease: "none" }, ${at});`);
  }

  if (s.kind === "card") {
    const b = s.start;
    L.push(`      tl.fromTo("#end-word", { y: 36, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7, ease: "expo.out" }, ${(b + 0.35).toFixed(2)});`);
    L.push(`      tl.fromTo("#end-tag", { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, ease: "power3.out" }, ${(b + 0.6).toFixed(2)});`);
    L.push(`      tl.fromTo("#end-apis", { opacity: 0 }, { opacity: 1, duration: 0.6, ease: "power2.out" }, ${(b + 0.85).toFixed(2)});`);
    L.push(`      tl.fromTo("#end-url", { y: 18, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: "power3.out" }, ${(b + 1.05).toFixed(2)});`);
    L.push(`      tl.fromTo("#end-small", { opacity: 0 }, { opacity: 1, duration: 0.5, ease: "power1.out" }, ${(b + 1.3).toFixed(2)});`);
    L.push(`      tl.to("#sc-endcard", { opacity: 0, duration: 0.8, ease: "power2.in" }, ${(b + s.duration - 0.85).toFixed(2)});`);
  }
  return L.join("\n");
}

function slamTweens(s, i) {
  const a = s.at;
  return [
    `      tl.fromTo("#slam-${i}", { opacity: 0 }, { opacity: 1, duration: 0.26, ease: "power2.out" }, ${a.toFixed(2)});`,
    `      tl.fromTo("#slam-big-${i}", { scale: 1.22, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.46, ease: "expo.out" }, ${(a + 0.06).toFixed(2)});`,
    `      tl.fromTo("#slam-small-${i}", { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: "power3.out" }, ${(a + 0.34).toFixed(2)});`,
    `      tl.fromTo("#slam-foot-${i}", { opacity: 0 }, { opacity: 1, duration: 0.45, ease: "power1.out" }, ${(a + 0.62).toFixed(2)});`,
    `      tl.to("#slam-${i}", { opacity: 0, duration: 0.45, ease: "power2.in" }, ${(a + s.duration - 0.45).toFixed(2)});`,
  ].join("\n");
}

main().catch((e) => { console.error(e.message); process.exitCode = 1; });
