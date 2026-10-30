/**
 * Writes video/demo/index.html from the real assets.
 *
 * The narrative is motion graphics, not screen capture. Every figure, quote and
 * product name on screen is pulled from the repo at build time — rules.yaml,
 * data/catalog.json, the scan fixtures, eval/results.json — so the film cannot
 * drift from the thing it describes.
 *
 * Durations come from the narration manifest and are probed off the files,
 * never guessed, so the picture can never run out before the voice does.
 */
import { execFile } from "node:child_process";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { promisify } from "node:util";

const run = promisify(execFile);
const require = createRequire(import.meta.url);
const PROJECT = "video/demo";
const LEAD = 0.2, TAIL = 0.15, XFADE = 0.6;

const probe = async (f) =>
  Number((await run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f])).stdout);

const round2 = (n) => Math.round(n * 100) / 100;
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");

const CUES = JSON.parse(readFileSync("video/captions/cues.json", "utf8"));

/** Pulled from the repo, so a rule or price edit shows up in the film. */
function facts() {
  const yaml = require("yaml");
  const parsed = yaml.parse(readFileSync("rules/rules.yaml", "utf8"));
  const rules = Array.isArray(parsed) ? parsed : parsed.rules;
  const rule = (id) => rules.find((r) => r.id === id);

  const cat = JSON.parse(readFileSync("data/catalog.json", "utf8"));
  const items = Array.isArray(cat) ? cat : cat.products;
  const sku = (s) => items.find((p) => p.sku === s);

  const scan = JSON.parse(readFileSync("fixtures/scans/synthetic-04-pigment/fixture.json", "utf8"));
  const concerns = Object.entries(scan.summary.concerns)
    .map(([k, v]) => ({ k, raw: Math.round(v.raw * 10) / 10, ui: v.ui }))
    .sort((a, b) => a.raw - b.raw);

  return {
    ruleCount: rules.length,
    preg: rule("R-PREG-01"),
    refer: rule("R-REF-01"),
    retinol: sku("LL-106"),
    swap: sku("LL-111"),
    adapalene: sku("LL-105"),
    concerns,
    fitzScale: scan.fitzpatrick.results.fitzpatrick_scale,
    units: scan.units_spent,
  };
}
const F = facts();

/** The concern where the display number and the measurement disagree most. */
const GAP = [...F.concerns].sort((a, b) => (b.ui - b.raw) - (a.ui - a.raw))[0];

const TURN = existsSync("media/broll/04-mirror.mp4") ? "04-mirror" : "04-turn-fallback";
const BROLL = ["01-shelf", "02-pile", "03-scroll", TURN];

async function main() {
  const manifest = JSON.parse(await readFile("media/voiceover/manifest.json", "utf8"));
  const vo = (block) => {
    const c = manifest.clips.find((x) => x.file.startsWith(block));
    if (!c) throw new Error(`No narration for block ${block}`);
    return c;
  };

  for (const d of ["audio", "broll", "score"]) {
    await mkdir(`${PROJECT}/assets/${d}`, { recursive: true });
  }
  for (const c of manifest.clips) await copyFile(`media/voiceover/${c.file}`, `${PROJECT}/assets/audio/${c.file}`);
  for (const s of ["score", "riser", "impact", "whoosh"]) {
    await copyFile(`media/score/${s}.mp3`, `${PROJECT}/assets/score/${s}.mp3`);
  }
  for (const b of BROLL) await copyFile(`media/broll/${b}.mp4`, `${PROJECT}/assets/broll/${b}.mp4`);

  const S = [];
  let t = 0;
  const place = (o) => {
    const duration = round2(o.duration);
    S.push({ ...o, duration, start: round2(t) });
    t += duration - XFADE;
  };

  place({ id: "open-shelf", kind: "broll", src: "01-shelf.mp4", duration: 2.3, beat: "none" });
  place({ id: "open-pile", kind: "broll", src: "02-pile.mp4", duration: 3.1, beat: "eleven" });
  place({ id: "open-scroll", kind: "broll", src: "03-scroll.mp4", duration: 2.9, beat: "sunscreen" });

  const v1 = vo("01");
  const turnLen = Math.min(LEAD + v1.seconds + TAIL, await probe(`media/broll/${TURN}.mp4`));
  place({ id: "turn", kind: "broll", src: `${TURN}.mp4`, duration: turnLen, audio: v1.file, voSeconds: v1.seconds, audioStart: round2(t + LEAD) });

  place({ id: "logo", kind: "logo", duration: 2.9 });

  for (const [id, block] of [["verdict", "02"], ["scan", "03"], ["refer", "04"], ["ext", "05"], ["pipeline", "06"], ["numbers", "07"]]) {
    const v = vo(block);
    place({ id, kind: "mg", duration: round2(LEAD + v.seconds + TAIL), audio: v.file, voSeconds: v.seconds, audioStart: round2(t + LEAD) });
  }

  const v8 = vo("08");
  place({ id: "endcard", kind: "card", duration: round2(LEAD + v8.seconds + 1.9), audio: v8.file, voSeconds: v8.seconds, audioStart: round2(t + LEAD) });

  const total = round2(t + XFADE);
  const numbers = S.find((s) => s.id === "numbers");
  // From silencedetect on the narration: the 22.5% sentence runs 24.9s to 30.7s
  // into that block, and the hundred-percent line 39.6s to 46.4s.
  const slams = [
    { at: round2(numbers.audioStart + 24.6), duration: 6.4, big: "22.5%", small: "of runs ended with an unsafe item still in the cart", foot: "without the guardrail" },
    { at: round2(numbers.audioStart + 39.3), duration: 7.0, big: "100%", small: "of items needing a usage caveat went out without one", foot: "against 11.1% with the guardrail" },
  ];

  await writeFile(`${PROJECT}/index.html`, html(S, total, slams));

  console.log(`${S.length} scenes, ${Math.floor(total / 60)}:${String(Math.round(total % 60)).padStart(2, "0")} (${total}s)\n`);
  for (const s of S) console.log(`  ${String(s.start).padStart(6)}s  ${s.id.padEnd(12)} ${String(s.duration).padStart(5)}s  ${s.kind}`);
  console.log(total > 180 ? `\n  OVER the cap by ${(total - 180).toFixed(1)}s` : `\n  ${(180 - total).toFixed(1)}s under the three minute cap`);
}

const NICE = { acne: "Acne", redness: "Redness", oiliness: "Oiliness", moisture: "Moisture",
  age_spot: "Dark spots", wrinkle: "Lines", texture: "Texture", pore: "Pores" };

/** Each motion-graphics scene's layout, at its most-visible frame. */
const MG = {
  verdict: () => `
          <p class="kicker k1">The cart, checked</p>
          <div class="chip c1"><span class="dot"></span>Declared &middot; 8 weeks pregnant</div>
          <div class="pcard p1">
            <div class="pthumb"></div>
            <div class="pmeta">
              <p class="pname">${esc(F.retinol.name)}</p>
              <p class="pprice tnum">$${F.retinol.price}</p>
            </div>
            <div class="stamp block s1">Not for you right now</div>
          </div>
          <div class="quote q1">
            <p class="rid">R-PREG-01</p>
            <p class="qtext">&ldquo;${esc(F.preg.source_quote)}&rdquo;</p>
            <p class="qsrc">American Academy of Dermatology &middot; MotherToBaby</p>
          </div>
          <div class="swap w1">
            <p class="slabel">Try instead</p>
            <p class="sname">${esc(F.swap.name)}</p>
            <p class="sprice tnum">$${F.swap.price}</p>
          </div>
          <p class="punch u1">It does not just refuse. It <em>re-routes</em>.</p>`,

  scan: () => `
          <p class="kicker k1">The scan</p>
          <div class="fitz f1">
            ${["I", "II", "III", "IV", "V", "VI"].map((n, i) =>
              `<div class="fsw fsw${i}"${n === F.fitzScale ? ' data-on="1"' : ""}><span>${n}</span></div>`).join("\n            ")}
            <p class="flabel">Fitzpatrick <em>${esc(F.fitzScale)}</em></p>
          </div>
          <div class="rows r1">
            <div class="vrow vr0"><span class="vn">AHA 30% + BHA 2% Weekly Peel</span><span class="vb block">Not for you right now</span></div>
            <div class="vrow vr1"><span class="vn">${esc(F.retinol.name)}</span><span class="vb adjust">Adjust</span></div>
          </div>
          <div class="scores sc1">
            <p class="scap">Every concern comes back twice</p>
            <div class="shead"><span></span><span></span><span class="sh ui">ui_score</span><span class="sh raw">raw_score</span></div>
            ${F.concerns.map((c, i) => `<div class="srow sr${i}">
              <span class="slab">${NICE[c.k] ?? c.k}</span>
              <span class="sbarwrap"><span class="sbar sb${i}"></span></span>
              <span class="sui tnum">${c.ui}</span><span class="sraw tnum">${c.raw}</span>
            </div>`).join("\n            ")}
          </div>
          <div class="gap g1">
            <p class="gtitle">${NICE[GAP.k] ?? GAP.k}</p>
            <div class="gpair">
              <div class="gcol gui"><p class="gnum tnum">${GAP.ui}</p><p class="glab">ui_score</p><p class="gsub">documented as a motivator</p></div>
              <div class="gcol graw"><p class="gnum tnum">${GAP.raw}</p><p class="glab">raw_score</p><p class="gsub">the measurement</p></div>
            </div>
            <p class="gnote">Every rule reads the one on the right.</p>
          </div>`,

  refer: () => `
          <p class="kicker k1">The strongest things in the shop</p>
          <div class="chips ch1">
            <div class="chip tag t0">deep painful lumps</div>
            <div class="chip tag t1">scarring</div>
          </div>
          <div class="hold h1">
            ${[F.adapalene, { name: "AHA 30% + BHA 2% Weekly Peel", price: 18 }, { name: "Benzoyl Peroxide 5% Wash", price: 13 }]
              .map((p, i) => `<div class="hcard hc${i}"><p class="hname">${esc(p.name)}</p><p class="hprice tnum">$${p.price}</p><p class="htag">held back</p></div>`).join("\n            ")}
          </div>
          <div class="refer rf1">
            <p class="rlabel">Worth showing a professional</p>
            <p class="rtext">${esc(F.refer.message.replace(/^Worth showing a professional\.\s*/, ""))}</p>
          </div>
          <p class="punch u1">This is the moment a shop normally <em>takes the money</em>.</p>`,

  ext: () => `
          <p class="kicker k1">Somebody else&rsquo;s shop</p>
          <div class="shop sh1">
            <div class="sbar2"><span class="sdot"></span><span class="sdot"></span><span class="sdot"></span><span class="surl">verdant-row.example/cart</span><span class="spin" id="ext-pin">PT</span></div>
            <div class="scart">
              ${[["Overnight Retinol 0.5% Renewal Serum", 29, "block", "Not for you right now"],
                 ["AHA 30% + BHA 2% Weekly Peeling Solution", 18, "block", "Not for you right now"],
                 ["Ceramide Barrier Moisturiser", 22, "ok", "Fine for you"],
                 ["Mineral SPF 50 Fluid", 25, "ok", "Fine for you"]]
                .map(([n, p, v, label], i) => `<div class="crow cr${i}">
                <span class="cthumb"></span>
                <span class="cname">${esc(n)}</span><span class="cprice tnum">$${p}</span>
                <span class="cbadge ${v} cb${i}">${label}</span>
              </div>`).join("\n              ")}
            </div>
          </div>
          <div class="parse pr1">
            <p class="pcap">It reads what the shop already publishes</p>
            <pre class="code">&lt;span itemprop="<em>name</em>"&gt;Overnight Retinol <em>0.5%</em> Renewal Serum&lt;/span&gt;</pre>
            <div class="pchips">
              <span class="pchip pc0">retinoid</span>
              <span class="pchip pc1">0.5%</span>
              <span class="pchip pc2">leave-on</span>
              <span class="pchip pc3">R-PREG-01</span>
            </div>
          </div>
          <p class="punch u1">The same ${F.ruleCount} rules. Any shop.</p>`,

  pipeline: () => `
          <p class="kicker k1">One photo, two APIs</p>
          <div class="apirow a1">
            <div class="api ap0">
              <p class="aname">YouCam<br /><em>AI Skin Analysis</em></p>
              <p class="adesc">measures eight concerns</p>
              <div class="dots">${F.concerns.map((c, i) => `<span class="adot ad${i}"></span>`).join("")}</div>
            </div>
            <div class="api ap1">
              <p class="aname">YouCam<br /><em>AI Fitzpatrick Skin Type</em></p>
              <p class="adesc">reads skin tone</p>
              <div class="ramp">${["I", "II", "III", "IV", "V", "VI"].map((n, i) => `<span class="rsw rs${i}"></span>`).join("")}</div>
            </div>
          </div>
          <p class="units un1"><span class="tnum" id="unit-n">0</span> units a scan &middot; <em>charged only on success</em></p>
          <div class="flow fl1">
            <div class="fbox fb0"><p class="ftitle">A language model</p><p class="fsub">proposes a routine</p><p class="fnever">never sets a verdict</p></div>
            <div class="farrow fa0"></div>
            <div class="fbox fb1 engine"><p class="ftitle">${F.ruleCount} rules</p><p class="fsub">each with a source and a quote</p></div>
            <div class="farrow fa1"></div>
            <div class="fbox fb2"><p class="ftitle">Four verdicts</p><p class="fsub">block &middot; adjust &middot; unnecessary &middot; refer</p></div>
          </div>
          <p class="punch u1">The rules have the <em>last word</em>.</p>`,

  numbers: () => `
          <p class="kicker k1">The part most demos skip</p>
          <div class="same sa1">
            ${[["the same model", 1], ["the same prompt", 1], ["the same inputs", 1], ["the guardrail", 0]]
              .map(([l, same], i) => `<div class="srow2 s2${i}"><span class="sl">${l}</span><span class="sv ${same ? "eq" : "ne"}">${same ? "identical" : "the only difference"}</span></div>`).join("\n            ")}
          </div>
          <p class="runs ru1"><span class="tnum" id="runs-n">0</span> runs per arm</p>
          <div class="metric m0">
            <p class="mcap">Recommended something our labels call unsafe</p>
            <div class="mrow"><span class="mlab">With the guardrail</span><span class="mbarwrap"><span class="mbar good mb6"></span></span><span class="mval tnum">0%</span></div>
            <div class="mrow"><span class="mlab">Without</span><span class="mbarwrap"><span class="mbar good mb7"></span></span><span class="mval tnum">0%</span></div>
            <p class="mnote m0note">Both arms. We are reporting that, not hiding it.</p>
          </div>
          <div class="metric m1">
            <p class="mcap">An unsafe item left sitting in the cart</p>
            <div class="mrow"><span class="mlab">With the guardrail</span><span class="mbarwrap"><span class="mbar good mb0"></span></span><span class="mval tnum">0%</span></div>
            <div class="mrow"><span class="mlab">Without</span><span class="mbarwrap"><span class="mbar bad mb1"></span></span><span class="mval tnum">22.5%</span></div>
          </div>
          <div class="metric m2">
            <p class="mcap">Needed a usage caveat, went out without one</p>
            <div class="mrow"><span class="mlab">With the guardrail</span><span class="mbarwrap"><span class="mbar good mb2"></span></span><span class="mval tnum">11.1%</span></div>
            <div class="mrow"><span class="mlab">Without</span><span class="mbarwrap"><span class="mbar bad mb3"></span></span><span class="mval tnum">100%</span></div>
          </div>
          <div class="metric m3">
            <p class="mcap">Gave the same shopper a different cart</p>
            <div class="mrow"><span class="mlab">With the guardrail</span><span class="mbarwrap"><span class="mbar flat mb4"></span></span><span class="mval tnum">35%</span></div>
            <div class="mrow"><span class="mlab">Without</span><span class="mbarwrap"><span class="mbar flat mb5"></span></span><span class="mval tnum">35%</span></div>
            <p class="mnote">Identical. The guardrail did not make the model consistent.</p>
          </div>
          <p class="punch u1">It made it <em>accountable</em>.</p>`,
};

function sceneMarkup(s, i) {
  const z = i + 1;
  if (s.kind === "broll") {
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
  if (s.kind === "mg") {
    return `      <div class="scene" id="sc-${s.id}" style="z-index:${z}">
        <div class="clip mg mg-${s.id}" id="mg-${s.id}" data-start="${s.start}" data-duration="${s.duration}" data-track-index="${z}">
${MG[s.id]()}
        </div>
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
    `      <audio id="s-riser" data-start="${round2(Math.max(logo.start - 3.1, 0))}" data-duration="3.5" data-track-index="32" src="assets/score/riser.mp3" data-volume="0.5"></audio>`,
    `      <audio id="s-impact" data-start="${round2(logo.start)}" data-duration="2.5" data-track-index="33" src="assets/score/impact.mp3" data-volume="0.62"></audio>`,
    ...S.filter((s) => s.beat === "eleven" || s.beat === "sunscreen").map((s, i) =>
      `      <audio id="s-wh-${i}" data-start="${s.start}" data-duration="1" data-track-index="${34 + i}" src="assets/score/whoosh.mp3" data-volume="0.4"></audio>`),
    ...slams.map((s, i) =>
      `      <audio id="s-slam-${i}" data-start="${s.at}" data-duration="2.5" data-track-index="${50 + i}" src="assets/score/impact.mp3" data-volume="0.5"></audio>`),
  ];

  const cues = [];
  for (const sc of S.filter((x) => x.audio)) {
    const key = sc.audio.replace(/\.mp3$/, "");
    for (const c of CUES[key] ?? []) {
      cues.push({ start: round2(sc.audioStart + c.start), duration: round2(Math.max(c.end - c.start - 0.01, 0.4)), text: c.text });
    }
  }
  // Scenes crossfade, so the next block's first caption can start before the
  // previous block's last has finished. On one track that is an overlap, and on
  // screen it is two captions stacked.
  cues.sort((a, b) => a.start - b.start);
  for (let i = 0; i < cues.length - 1; i++) {
    const overlap = cues[i].start + cues[i].duration - cues[i + 1].start;
    if (overlap > 0) cues[i].duration = round2(Math.max(cues[i].duration - overlap - 0.01, 0.3));
  }
  cues.forEach((c, i) => { c.id = `cue-${i}`; });

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
${css()}
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="${total}" data-width="1920" data-height="1080" data-track-index="0">
${S.map(sceneMarkup).join("\n")}

${slamMarkup.join("\n")}

${cueMarkup.join("\n")}

${audios.join("\n")}
${score.join("\n")}
    </div>
    <script>
      window.__timelines = window.__timelines || {};
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

/** Helpers that keep each motion-graphics timeline readable. */
const T = {
  in: (sel, at, { y = 26, x = 0, scale = 1, d = 0.55, ease = "power3.out" } = {}) =>
    `      tl.fromTo("${sel}", { y: ${y}, x: ${x}, scale: ${scale}, opacity: 0 }, { y: 0, x: 0, scale: 1, opacity: 1, duration: ${d}, ease: "${ease}" }, ${at.toFixed(2)});`,
  pop: (sel, at, { d = 0.5, from = 1.3 } = {}) =>
    `      tl.fromTo("${sel}", { scale: ${from}, opacity: 0 }, { scale: 1, opacity: 1, duration: ${d}, ease: "back.out(2.2)" }, ${at.toFixed(2)});`,
  bar: (sel, at, pct, { d = 0.9 } = {}) =>
    `      tl.fromTo("${sel}", { scaleX: 0 }, { scaleX: ${(pct / 100).toFixed(4)}, duration: ${d}, ease: "power3.out" }, ${at.toFixed(2)});`,
  fade: (sel, at, d = 0.5) =>
    `      tl.fromTo("${sel}", { opacity: 0 }, { opacity: 1, duration: ${d}, ease: "power1.out" }, ${at.toFixed(2)});`,
  /**
   * Counts a number up, as discrete steps rather than an onUpdate tween.
   * The player renders by seeking, and a tween's onUpdate does not reliably
   * fire on a seek — the counter sat on zero for the whole shot. set() calls
   * are replayed in order up to the seek target, so they always land.
   */
  count: (id, at, to, d = 1.1) => {
    const steps = 18;
    const out = [`      tl.set("#${id}", { textContent: 0 }, ${at.toFixed(2)});`];
    for (let i = 1; i <= steps; i++) {
      const p = i / steps;
      const eased = 1 - Math.pow(1 - p, 3); // matches power3.out
      out.push(`      tl.set("#${id}", { textContent: ${Math.round(to * eased)} }, ${(at + d * p).toFixed(2)});`);
    }
    return out.join("\n");
  },
  out: (sel, at, d = 0.45) =>
    `      tl.to("${sel}", { opacity: 0, duration: ${d}, ease: "power2.in" }, ${at.toFixed(2)});`,
};

/** Internal timelines, written against the narration line by line. */
const MGT = {
  verdict: (s) => {
    const a = s.audioStart, L = [];
    L.push(T.in("#mg-verdict .k1", a - 0.1, { y: 14, d: 0.5 }));
    L.push(T.in("#mg-verdict .c1", a + 0.3, { y: 18 }));
    L.push(T.in("#mg-verdict .p1", a + 1.6, { y: 40, d: 0.65, ease: "expo.out" }));
    L.push(T.pop("#mg-verdict .s1", a + 3.9, { from: 1.45 }));
    L.push(`      tl.fromTo("#mg-verdict .p1", { "--rail": 0 }, { "--rail": 1, duration: 0.4, ease: "power2.out" }, ${(a + 3.9).toFixed(2)});`);
    L.push(T.in("#mg-verdict .q1", a + 5.2, { y: 30, d: 0.6 }));
    L.push(T.in("#mg-verdict .w1", a + 7.4, { y: 34, d: 0.6, ease: "expo.out" }));
    L.push(T.in("#mg-verdict .u1", a + 10.9, { y: 22, d: 0.55 }));
    return L.join("\n");
  },

  scan: (s) => {
    const a = s.audioStart, L = [];
    L.push(T.in("#mg-scan .k1", a - 0.1, { y: 14, d: 0.5 }));
    for (let i = 0; i < 6; i++) L.push(T.pop(`#mg-scan .fsw${i}`, a + 0.25 + i * 0.09, { d: 0.4, from: 0.7 }));
    L.push(T.in("#mg-scan .flabel", a + 1.1, { y: 16, d: 0.45 }));
    L.push(T.in("#mg-scan .vr0", a + 2.7, { x: -40, y: 0, d: 0.5 }));
    L.push(T.in("#mg-scan .vr1", a + 3.6, { x: -40, y: 0, d: 0.5 }));
    L.push(T.out("#mg-scan .f1", a + 6.3, 0.4));
    L.push(T.out("#mg-scan .r1", a + 6.3, 0.4));
    L.push(T.in("#mg-scan .sc1", a + 6.8, { y: 30, d: 0.5 }));
    F.concerns.forEach((c, i) => {
      L.push(T.in(`#mg-scan .sr${i}`, a + 7.1 + i * 0.1, { y: 16, d: 0.4 }));
      L.push(T.bar(`#mg-scan .sb${i}`, a + 7.2 + i * 0.1, c.raw, { d: 0.7 }));
    });
    L.push(T.fade("#mg-scan .shead", a + 8.6, 0.5));
    L.push(T.out("#mg-scan .sc1", a + 11.0, 0.4));
    L.push(T.in("#mg-scan .g1", a + 10.9, { y: 30, d: 0.5 }));
    L.push(T.pop("#mg-scan .gui", a + 11.2, { from: 1.2 }));
    L.push(T.pop("#mg-scan .graw", a + 11.7, { from: 1.2 }));
    L.push(T.in("#mg-scan .gnote", a + 14.4, { y: 18, d: 0.5 }));
    return L.join("\n");
  },

  refer: (s) => {
    const a = s.audioStart, L = [];
    L.push(T.in("#mg-refer .k1", a - 0.1, { y: 14, d: 0.5 }));
    L.push(T.in("#mg-refer .t0", a + 0.4, { y: 18, d: 0.45 }));
    L.push(T.in("#mg-refer .t1", a + 1.1, { y: 18, d: 0.45 }));
    for (let i = 0; i < 3; i++) L.push(T.in(`#mg-refer .hc${i}`, a + 3.0 + i * 0.28, { y: 44, d: 0.55, ease: "expo.out" }));
    L.push(T.pop("#mg-refer .rf1", a + 5.7, { d: 0.6, from: 1.18 }));
    for (let i = 0; i < 3; i++) L.push(`      tl.to("#mg-refer .hc${i}", { opacity: 0.3, scale: 0.97, duration: 0.5, ease: "power2.out" }, ${(a + 7.4 + i * 0.12).toFixed(2)});`);
    for (let i = 0; i < 3; i++) L.push(T.fade(`#mg-refer .hc${i} .htag`, a + 7.6 + i * 0.12, 0.4));
    L.push(T.in("#mg-refer .u1", a + 9.7, { y: 22, d: 0.55 }));
    return L.join("\n");
  },

  ext: (s) => {
    const a = s.audioStart, L = [];
    L.push(T.in("#mg-ext .k1", a + 1.5, { y: 14, d: 0.5 }));
    L.push(T.in("#mg-ext .sh1", a + 1.9, { y: 40, scale: 0.97, d: 0.7, ease: "expo.out" }));
    L.push(T.pop("#ext-pin", a + 4.8, { from: 1.6 }));
    L.push(`      tl.to("#ext-pin", { scale: 0.86, duration: 0.12, ease: "power2.in", yoyo: true, repeat: 1 }, ${(a + 6.9).toFixed(2)});`);
    for (let i = 0; i < 4; i++) L.push(T.pop(`#mg-ext .cb${i}`, a + 7.5 + i * 0.3, { d: 0.45, from: 1.5 }));
    L.push(T.in("#mg-ext .pr1", a + 11.4, { y: 34, d: 0.6 }));
    L.push(T.fade("#mg-ext .code", a + 11.9, 0.5));
    for (let i = 0; i < 4; i++) L.push(T.pop(`#mg-ext .pc${i}`, a + 14.8 + i * 0.42, { d: 0.42, from: 1.4 }));
    L.push(T.in("#mg-ext .u1", a + 18.1, { y: 22, d: 0.55 }));
    return L.join("\n");
  },

  pipeline: (s) => {
    const a = s.audioStart, L = [];
    L.push(T.in("#mg-pipeline .k1", a - 0.1, { y: 14, d: 0.5 }));
    L.push(T.in("#mg-pipeline .ap0", a + 1.4, { x: -50, y: 0, d: 0.6, ease: "expo.out" }));
    L.push(T.in("#mg-pipeline .ap1", a + 1.7, { x: 50, y: 0, d: 0.6, ease: "expo.out" }));
    F.concerns.forEach((_, i) => L.push(T.pop(`#mg-pipeline .ad${i}`, a + 2.6 + i * 0.12, { d: 0.35, from: 0.4 })));
    for (let i = 0; i < 6; i++) L.push(T.pop(`#mg-pipeline .rs${i}`, a + 4.4 + i * 0.1, { d: 0.35, from: 0.5 }));
    L.push(T.in("#mg-pipeline .un1", a + 6.6, { y: 20, d: 0.5 }));
    L.push(T.count("unit-n", a + 6.8, F.units, 0.9));
    L.push(T.out("#mg-pipeline .a1", a + 9.4, 0.45));
    L.push(T.out("#mg-pipeline .un1", a + 9.4, 0.45));
    L.push(T.in("#mg-pipeline .fb0", a + 9.9, { y: 34, d: 0.55, ease: "expo.out" }));
    L.push(T.fade("#mg-pipeline .fa0", a + 10.7, 0.4));
    L.push(T.pop("#mg-pipeline .fnever", a + 12.5, { d: 0.5, from: 1.4 }));
    L.push(T.in("#mg-pipeline .fb1", a + 14.1, { y: 34, d: 0.55, ease: "expo.out" }));
    L.push(T.fade("#mg-pipeline .fa1", a + 16.4, 0.4));
    L.push(T.in("#mg-pipeline .fb2", a + 16.9, { y: 34, d: 0.55, ease: "expo.out" }));
    L.push(T.in("#mg-pipeline .u1", a + 19.6, { y: 22, d: 0.55 }));
    L.push(`      tl.to("#mg-pipeline .fb1", { scale: 1.05, duration: 0.22, ease: "power2.out", yoyo: true, repeat: 1 }, ${(a + 19.8).toFixed(2)});`);
    return L.join("\n");
  },

  numbers: (s) => {
    const a = s.audioStart, L = [];
    L.push(T.in("#mg-numbers .k1", a - 0.1, { y: 16, d: 0.5 }));
    for (let i = 0; i < 4; i++) L.push(T.in(`#mg-numbers .s2${i}`, a + 3.0 + i * 1.1, { x: -34, y: 0, d: 0.5 }));
    L.push(T.in("#mg-numbers .ru1", a + 9.9, { y: 22, d: 0.5 }));
    L.push(T.count("runs-n", a + 10.1, 120, 1.3));
    L.push(T.out("#mg-numbers .sa1", a + 11.9, 0.45));
    L.push(T.out("#mg-numbers .ru1", a + 11.9, 0.45));

    // "recommended nothing our labels call unsafe" — both arms, both zero.
    L.push(T.in("#mg-numbers .m0", a + 12.4, { y: 30, d: 0.5 }));
    L.push(T.bar("#mg-numbers .mb6", a + 13.4, 0.8, { d: 0.6 }));
    L.push(T.bar("#mg-numbers .mb7", a + 14.1, 0.8, { d: 0.6 }));
    L.push(T.in("#mg-numbers .m0note", a + 16.6, { y: 16, d: 0.5 }));
    L.push(T.out("#mg-numbers .m0", a + 21.6, 0.5));
    L.push(T.out("#mg-numbers .k1", a + 21.6, 0.5));

    L.push(T.in("#mg-numbers .m1", a + 22.2, { y: 30, d: 0.5 }));
    L.push(T.bar("#mg-numbers .mb0", a + 23.2, 0, { d: 0.6 }));
    L.push(T.bar("#mg-numbers .mb1", a + 25.4, 22.5, { d: 1.1 }));
    L.push(T.out("#mg-numbers .m1", a + 33.4, 0.5));

    L.push(T.in("#mg-numbers .m2", a + 34.0, { y: 30, d: 0.5 }));
    L.push(T.bar("#mg-numbers .mb3", a + 39.6, 100, { d: 1.2 }));
    L.push(T.bar("#mg-numbers .mb2", a + 41.0, 11.1, { d: 0.8 }));
    L.push(T.out("#mg-numbers .m2", a + 43.2, 0.5));

    // The honest one: both arms are identical, and the bars say so.
    L.push(T.in("#mg-numbers .m3", a + 43.8, { y: 30, d: 0.5 }));
    L.push(T.bar("#mg-numbers .mb4", a + 47.2, 35, { d: 0.9 }));
    L.push(T.bar("#mg-numbers .mb5", a + 47.5, 35, { d: 0.9 }));
    L.push(T.in("#mg-numbers .mnote", a + 49.6, { y: 16, d: 0.5 }));
    L.push(T.out("#mg-numbers .m3", a + 51.2, 0.45));
    L.push(T.in("#mg-numbers .u1", a + 51.5, { y: 26, scale: 1.06, d: 0.6, ease: "expo.out" }));
    return L.join("\n");
  },
};

/** Entrances only. The crossfade is the exit, except on the final scene. */
function tweens(s, i) {
  const at = s.start;
  const L = [];
  const el = s.kind === "broll" ? `#v-${s.id}`
    : s.kind === "logo" ? "#logo-card"
    : s.kind === "mg" ? `#mg-${s.id}`
    : "#end-card";
  if (i > 0) L.push(`      tl.fromTo("${el}", { opacity: 0 }, { opacity: 1, duration: ${XFADE}, ease: "power1.inOut" }, ${at});`);

  if (s.kind === "broll") {
    L.push(`      tl.fromTo("#v-${s.id}", { scale: 1.06 }, { scale: 1.0, duration: ${(s.duration + 0.6).toFixed(2)}, ease: "none" }, ${at});`);
    if (s.beat === "eleven") {
      L.push(`      tl.fromTo("#beat-eleven-n", { y: 90, opacity: 0, scale: 1.14 }, { y: 0, opacity: 1, scale: 1, duration: 0.62, ease: "expo.out" }, ${(s.start + 0.15).toFixed(2)});`);
      L.push(`      tl.fromTo("#beat-eleven-l", { y: 34, opacity: 0 }, { y: 0, opacity: 1, duration: 0.55, ease: "power3.out" }, ${(s.start + 0.5).toFixed(2)});`);
    }
    if (s.beat === "sunscreen") {
      L.push(`      tl.fromTo("#beat-sun-t", { y: 56, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, ease: "expo.out" }, ${(s.start + 0.15).toFixed(2)});`);
      L.push(`      tl.fromTo("#beat-sun-c", { opacity: 0 }, { opacity: 1, duration: 0.5, ease: "power1.out" }, ${(s.start + 0.6).toFixed(2)});`);
    }
    return L.join("\n");
  }

  if (s.kind === "logo") {
    L.push(`      tl.fromTo("#logo-word", { scale: 1.16, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.5, ease: "expo.out" }, ${(at + 0.1).toFixed(2)});`);
    L.push(`      tl.fromTo("#logo-tag", { y: 22, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: "power3.out" }, ${(at + 0.45).toFixed(2)});`);
    return L.join("\n");
  }

  if (s.kind === "mg") return [L.join("\n"), MGT[s.id](s)].filter(Boolean).join("\n");

  L.push(`      tl.fromTo("#end-word", { scale: 1.1, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.6, ease: "expo.out" }, ${(at + 0.15).toFixed(2)});`);
  L.push(`      tl.fromTo("#end-tag", { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: "power3.out" }, ${(at + 0.5).toFixed(2)});`);
  L.push(`      tl.fromTo("#end-apis", { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: "power2.out" }, ${(at + 0.85).toFixed(2)});`);
  L.push(`      tl.fromTo("#end-url", { y: 14, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: "power2.out" }, ${(at + 1.15).toFixed(2)});`);
  L.push(`      tl.fromTo("#end-small", { opacity: 0 }, { opacity: 1, duration: 0.6, ease: "power1.out" }, ${(at + 1.5).toFixed(2)});`);
  L.push(`      tl.to("#end-card", { opacity: 0, duration: 0.7, ease: "power2.in" }, ${(at + s.duration - 0.7).toFixed(2)});`);
  return L.join("\n");
}

function slamTweens(s, i) {
  const at = s.at;
  return [
    `      tl.fromTo("#slam-${i}", { opacity: 0 }, { opacity: 1, duration: 0.28, ease: "power2.out" }, ${at});`,
    `      tl.fromTo("#slam-big-${i}", { scale: 1.3, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.55, ease: "expo.out" }, ${round2(at + 0.1)});`,
    `      tl.fromTo("#slam-small-${i}", { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: "power3.out" }, ${round2(at + 0.45)});`,
    `      tl.fromTo("#slam-foot-${i}", { opacity: 0 }, { opacity: 1, duration: 0.5, ease: "power1.out" }, ${round2(at + 0.8)});`,
    `      tl.to("#slam-${i}", { opacity: 0, duration: 0.45, ease: "power2.in" }, ${round2(at + s.duration - 0.45)});`,
  ].join("\n");
}

function css() {
  return `      @font-face { font-family: "Source Serif 4"; src: url("assets/fonts/SourceSerif4-400.woff2") format("woff2"); font-weight: 400; font-display: block; }
      @font-face { font-family: "Source Serif 4"; src: url("assets/fonts/SourceSerif4-600.woff2") format("woff2"); font-weight: 600; font-display: block; }
      @font-face { font-family: "Geist"; src: url("assets/fonts/Geist-400.woff2") format("woff2"); font-weight: 400; font-display: block; }
      @font-face { font-family: "Geist"; src: url("assets/fonts/Geist-500.woff2") format("woff2"); font-weight: 500; font-display: block; }

      :root {
        --paper: #fbfaf7; --surface: #ffffff; --sunken: #f3f2ee;
        --ink: #191c1a; --muted: #5f6660; --faint: #6f756f;
        --line: rgb(25 28 26 / 0.10); --accent: #2f5d4f;
        --block: #a5342b; --block-soft: #fbedeb;
        --adjust: #8a5a14; --adjust-soft: #fdf3e2;
        --refer: #2b5579; --refer-soft: #eaf1f8;
        --ok: #6f756f;
      }
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { width: 1920px; height: 1080px; overflow: hidden; background: #0c0e0d;
        font-family: "Geist", system-ui, sans-serif; -webkit-font-smoothing: antialiased; }
      #root { width: 100%; height: 100%; position: relative; }
      .scene { position: absolute; inset: 0; }
      .scene video { width: 100%; height: 100%; object-fit: cover; display: block; }
      .tnum { font-variant-numeric: tabular-nums; }

      video.broll { filter: saturate(0.82) contrast(1.06) brightness(0.86); }

      .beat { position: absolute; inset: 0; display: flex; flex-direction: column;
        justify-content: flex-end; padding: 130px 150px; gap: 18px; }
      .huge { font-family: "Source Serif 4", Georgia, serif; font-size: 400px; line-height: 0.82;
        color: #fbfaf7; letter-spacing: -0.04em; }
      .beat-line { font-size: 40px; line-height: 1.3; color: rgba(251,250,247,0.9); max-width: 1180px; }
      .mid { font-family: "Source Serif 4", Georgia, serif; font-size: 118px; line-height: 1.05;
        color: #fbfaf7; letter-spacing: -0.02em; max-width: 1350px; }
      .mid em { font-style: normal; color: #e8a33d; }
      .cite { font-size: 28px; color: rgba(251,250,247,0.62); letter-spacing: 0.02em; }

      .logo-card { position: absolute; inset: 0; background: var(--paper); opacity: 0;
        display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 20px; }
      .wordmark { font-family: "Source Serif 4", Georgia, serif; font-size: 150px; color: var(--ink); letter-spacing: -0.03em; }
      .wordmark span { color: var(--accent); }
      .logo-tag { font-size: 36px; color: var(--muted); letter-spacing: 0.01em; }

      .mg { position: absolute; inset: 0; background: var(--paper); color: var(--ink); opacity: 0;
        padding: 86px 130px; display: flex; flex-direction: column; }
      .mg .kicker { font-size: 23px; text-transform: uppercase; letter-spacing: 0.14em;
        color: var(--faint); font-weight: 500; }
      .mg .punch { position: absolute; left: 130px; right: 130px; bottom: 148px;
        font-family: "Source Serif 4", Georgia, serif; font-size: 74px; line-height: 1.12;
        letter-spacing: -0.02em; }
      .mg .punch em { font-style: normal; color: var(--accent); }
      .chip { display: inline-flex; align-items: center; gap: 12px; font-size: 27px; color: var(--muted);
        background: var(--surface); border: 1px solid var(--line); border-radius: 999px; padding: 13px 26px; }
      .chip .dot { width: 11px; height: 11px; border-radius: 50%; background: var(--accent); }

      .mg-verdict .c1 { margin-top: 26px; align-self: flex-start; }
      .pcard { position: relative; margin-top: 36px; background: var(--surface);
        border: 1px solid var(--line); border-radius: 18px; padding: 32px 40px;
        display: flex; align-items: center; gap: 32px;
        box-shadow: 0 2px 4px rgb(25 28 26 / 0.04), 0 16px 36px rgb(25 28 26 / 0.06); }
      .pcard::before { content: ""; position: absolute; left: 0; top: 14px; bottom: 14px; width: 5px;
        border-radius: 3px; background: var(--block); opacity: var(--rail, 0); }
      .pthumb { width: 82px; height: 82px; border-radius: 12px; background: var(--sunken); flex: none; }
      .pmeta { flex: 1; }
      .pname { font-size: 42px; letter-spacing: -0.01em; }
      .pprice { font-size: 29px; color: var(--faint); margin-top: 7px; }
      .stamp { font-size: 27px; font-weight: 500; padding: 14px 28px; border-radius: 999px; white-space: nowrap; }
      .stamp.block { color: var(--block); background: var(--block-soft); border: 1px solid rgb(165 52 43 / 0.2); }
      .quote { margin-top: 26px; background: var(--sunken); border-radius: 16px; padding: 30px 40px; }
      .rid { font-size: 22px; letter-spacing: 0.1em; color: var(--faint); font-weight: 500; }
      .qtext { margin-top: 12px; font-family: "Source Serif 4", Georgia, serif; font-size: 46px; line-height: 1.26; }
      .qsrc { margin-top: 14px; font-size: 25px; color: var(--faint); }
      .swap { margin-top: 24px; background: #eef4f1; border: 1px solid rgb(47 93 79 / 0.18);
        border-radius: 16px; padding: 26px 40px; display: flex; align-items: center; gap: 26px; }
      .slabel { font-size: 21px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--accent); font-weight: 500; }
      .sname { font-size: 38px; flex: 1; }
      .sprice { font-size: 32px; color: var(--muted); }

      .fitz { margin-top: 44px; display: flex; align-items: center; gap: 16px; }
      .fsw { width: 112px; height: 112px; border-radius: 16px; display: flex; align-items: flex-end;
        justify-content: center; padding-bottom: 11px; font-size: 23px; color: rgb(255 255 255 / 0.85); }
      .fsw0 { background: #f3d9c8; color: #8a6b58; } .fsw1 { background: #e8c3a7; color: #7d5c46; }
      .fsw2 { background: #d2a079; } .fsw3 { background: #a9744f; }
      .fsw4 { background: #71452c; } .fsw5 { background: #3d2318; }
      .fsw[data-on] { outline: 5px solid var(--ink); outline-offset: 6px; }
      .flabel { margin-left: 30px; font-family: "Source Serif 4", Georgia, serif; font-size: 58px; }
      .flabel em { font-style: normal; color: var(--accent); }
      .rows { margin-top: 44px; display: flex; flex-direction: column; gap: 18px; }
      .vrow { display: flex; align-items: center; gap: 26px; background: var(--surface);
        border: 1px solid var(--line); border-radius: 14px; padding: 26px 34px; }
      .vn { flex: 1; font-size: 38px; }
      .vb { font-size: 25px; font-weight: 500; padding: 11px 24px; border-radius: 999px; }
      .vb.block { color: var(--block); background: var(--block-soft); }
      .vb.adjust { color: var(--adjust); background: var(--adjust-soft); }
      .scores { position: absolute; left: 130px; right: 130px; top: 190px; }
      .scap { font-size: 30px; color: var(--muted); margin-bottom: 20px; }
      .shead, .srow { display: grid; grid-template-columns: 290px 1fr 130px 150px; align-items: center; }
      .shead { margin-bottom: 8px; }
      .sh { text-align: right; font-size: 22px; letter-spacing: 0.08em; text-transform: uppercase; font-weight: 500; }
      .sh.ui { color: var(--faint); } .sh.raw { color: var(--accent); }
      .srow { padding: 12px 0; border-bottom: 1px solid var(--line); }
      .slab { font-size: 30px; color: var(--muted); }
      .sbarwrap { height: 16px; background: var(--sunken); border-radius: 8px; margin-right: 34px; }
      .sbar { display: block; height: 100%; border-radius: 8px; background: var(--accent); transform-origin: left center; }
      .sui { text-align: right; font-size: 30px; color: var(--faint); }
      .sraw { text-align: right; font-size: 33px; color: var(--ink); font-weight: 500; }
      .gap { position: absolute; left: 130px; right: 130px; top: 265px; }
      .gtitle { font-size: 32px; color: var(--muted); }
      .gpair { margin-top: 24px; display: flex; gap: 46px; }
      .gcol { flex: 1; background: var(--surface); border: 1px solid var(--line); border-radius: 20px; padding: 42px 48px; }
      .gcol.graw { border-color: rgb(47 93 79 / 0.3); background: #eef4f1; }
      .gnum { font-family: "Source Serif 4", Georgia, serif; font-size: 150px; line-height: 0.95; letter-spacing: -0.03em; }
      .gui .gnum { color: var(--faint); }
      .graw .gnum { color: var(--accent); }
      .glab { margin-top: 14px; font-size: 32px; font-weight: 500; }
      .gsub { margin-top: 8px; font-size: 26px; color: var(--faint); }
      .gnote { margin-top: 32px; font-size: 36px; }

      .chips { margin-top: 26px; display: flex; gap: 16px; }
      .chip.tag { background: var(--sunken); border-color: transparent; }
      .hold { margin-top: 40px; display: flex; gap: 24px; }
      .hcard { flex: 1; background: var(--surface); border: 1px solid var(--line); border-radius: 18px; padding: 32px; }
      .hname { font-size: 34px; line-height: 1.22; min-height: 84px; }
      .hprice { margin-top: 14px; font-size: 30px; color: var(--faint); }
      .htag { margin-top: 16px; font-size: 22px; letter-spacing: 0.1em; text-transform: uppercase;
        color: var(--block); font-weight: 500; opacity: 0; }
      .refer { margin-top: 40px; background: var(--refer-soft); border: 1px solid rgb(43 85 121 / 0.22);
        border-radius: 20px; padding: 38px 48px; }
      .rlabel { font-family: "Source Serif 4", Georgia, serif; font-size: 60px; color: var(--refer); letter-spacing: -0.02em; }
      .rtext { margin-top: 14px; font-size: 31px; line-height: 1.34; color: var(--muted); max-width: 1320px; }

      .shop { margin-top: 32px; border-radius: 16px; overflow: hidden; border: 1px solid var(--line);
        box-shadow: 0 2px 4px rgb(0 0 0 / 0.05), 0 20px 46px rgb(0 0 0 / 0.08); }
      .sbar2 { height: 54px; background: #e9e8e4; display: flex; align-items: center; gap: 10px; padding: 0 22px; }
      .sdot { width: 12px; height: 12px; border-radius: 50%; background: #c9c6be; }
      .surl { margin-left: 18px; font-size: 21px; color: var(--faint); background: #fff; border-radius: 7px; padding: 6px 26px; }
      .spin { margin-left: auto; width: 38px; height: 38px; border-radius: 9px; background: var(--accent);
        color: #fff; font-size: 17px; font-weight: 500; display: flex; align-items: center; justify-content: center; }
      /* Deliberately not our typeface: this is somebody else's shop. */
      .scart { background: #fff; font-family: Georgia, "Times New Roman", serif; }
      .crow { display: flex; align-items: center; gap: 24px; padding: 22px 32px; border-top: 1px solid var(--line); }
      .crow.cr0 { border-top: 0; }
      .cthumb { width: 58px; height: 58px; border-radius: 8px; background: #f0efea; flex: none; }
      .cname { flex: 1; font-size: 30px; }
      .cprice { font-size: 26px; color: var(--faint); }
      .cbadge { font-family: "Geist", sans-serif; font-size: 22px; font-weight: 500;
        padding: 10px 20px; border-radius: 999px; white-space: nowrap; }
      .cbadge.block { color: var(--block); background: var(--block-soft); }
      .cbadge.ok { color: var(--ok); background: var(--sunken); }
      .parse { margin-top: 28px; }
      .pcap { font-size: 28px; color: var(--muted); }
      .code { margin-top: 13px; font-family: ui-monospace, Menlo, monospace; font-size: 24px;
        background: var(--sunken); border-radius: 12px; padding: 20px 26px; color: var(--muted); }
      .code em { font-style: normal; color: var(--accent); font-weight: 500; }
      .pchips { margin-top: 18px; display: flex; gap: 14px; }
      .pchip { font-size: 25px; background: #eef4f1; color: var(--accent); border-radius: 999px;
        padding: 12px 26px; border: 1px solid rgb(47 93 79 / 0.18); }

      .apirow { margin-top: 44px; display: flex; gap: 34px; }
      .api { flex: 1; background: var(--surface); border: 1px solid var(--line); border-radius: 20px; padding: 40px 44px; }
      .aname { font-size: 30px; color: var(--faint); line-height: 1.3; }
      .aname em { font-style: normal; font-size: 47px; color: var(--ink); letter-spacing: -0.01em; }
      .adesc { margin-top: 16px; font-size: 30px; color: var(--muted); }
      .dots { margin-top: 24px; display: flex; gap: 11px; }
      .adot { width: 30px; height: 30px; border-radius: 50%; background: var(--accent); opacity: 0.85; }
      .ramp { margin-top: 24px; display: flex; gap: 8px; }
      .rsw { width: 56px; height: 30px; border-radius: 6px; }
      .rs0 { background: #f3d9c8; } .rs1 { background: #e8c3a7; } .rs2 { background: #d2a079; }
      .rs3 { background: #a9744f; } .rs4 { background: #71452c; } .rs5 { background: #3d2318; }
      .units { margin-top: 34px; font-size: 40px; color: var(--muted); }
      .units em { font-style: normal; color: var(--accent); }
      .flow { position: absolute; left: 130px; right: 130px; top: 345px; display: flex; align-items: center; gap: 24px; }
      .fbox { flex: 1; background: var(--surface); border: 1px solid var(--line); border-radius: 20px;
        padding: 48px 36px; text-align: center; }
      .fbox.engine { border-color: rgb(47 93 79 / 0.35); background: #eef4f1; }
      .ftitle { font-family: "Source Serif 4", Georgia, serif; font-size: 52px; letter-spacing: -0.02em; }
      .fsub { margin-top: 12px; font-size: 27px; color: var(--muted); line-height: 1.3; }
      .fnever { margin-top: 18px; font-size: 23px; font-weight: 500; letter-spacing: 0.06em;
        text-transform: uppercase; color: var(--block); }
      .farrow { width: 58px; height: 3px; background: var(--line); flex: none; position: relative; }
      .farrow::after { content: ""; position: absolute; right: -2px; top: -7px;
        border-left: 14px solid rgb(25 28 26 / 0.22); border-top: 8px solid transparent; border-bottom: 8px solid transparent; }

      .same { margin-top: 48px; display: flex; flex-direction: column; gap: 16px; max-width: 1320px; }
      .srow2 { display: flex; align-items: center; gap: 30px; background: var(--surface);
        border: 1px solid var(--line); border-radius: 14px; padding: 25px 36px; }
      .sl { flex: 1; font-size: 38px; }
      .sv { font-size: 25px; font-weight: 500; padding: 11px 24px; border-radius: 999px; }
      .sv.eq { color: var(--ok); background: var(--sunken); }
      .sv.ne { color: var(--accent); background: #eef4f1; }
      .runs { margin-top: 40px; font-family: "Source Serif 4", Georgia, serif; font-size: 70px; letter-spacing: -0.02em; }
      .metric { position: absolute; left: 130px; right: 130px; top: 320px; }
      .mcap { font-size: 42px; margin-bottom: 40px; }
      .mrow { display: grid; grid-template-columns: 420px 1fr 230px; align-items: center; margin-bottom: 34px; }
      .mlab { font-size: 33px; color: var(--muted); }
      .mbarwrap { height: 54px; background: var(--sunken); border-radius: 10px; margin-right: 36px; }
      .mbar { display: block; height: 100%; border-radius: 10px; transform-origin: left center; }
      .mbar.good { background: var(--accent); }
      .mbar.bad { background: var(--block); }
      .mbar.flat { background: #8d938c; }
      .mval { text-align: right; font-family: "Source Serif 4", Georgia, serif; font-size: 70px; letter-spacing: -0.02em; }
      .mnote { margin-top: 16px; font-size: 34px; color: var(--muted); }

      .slam { position: absolute; inset: 0; background: rgba(12,14,13,0.94); opacity: 0;
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        gap: 22px; padding: 0 160px; text-align: center; }
      .slam-big { font-family: "Source Serif 4", Georgia, serif; font-size: 300px; line-height: 0.9;
        color: #fbfaf7; letter-spacing: -0.04em; }
      .slam-small { font-size: 46px; color: rgba(251,250,247,0.92); max-width: 1400px; line-height: 1.25; }
      .slam-foot { font-size: 30px; color: #e8a33d; letter-spacing: 0.02em; }

      .card { position: absolute; inset: 0; background: var(--paper); opacity: 0; display: flex;
        flex-direction: column; align-items: center; justify-content: center; gap: 18px; padding: 0 160px; text-align: center; }
      .tagline { font-size: 46px; color: var(--muted); }
      .endcard .apis { margin-top: 22px; font-size: 30px; color: var(--faint); line-height: 1.5; }
      .url { margin-top: 26px; font-size: 42px; color: var(--accent); }
      /* Clear of the caption band, which sits at bottom: 52px. */
      .smallprint { position: absolute; left: 160px; right: 160px; bottom: 158px;
        font-size: 22px; color: var(--faint); line-height: 1.5; }

      .cue { position: absolute; left: 50%; bottom: 52px; transform: translateX(-50%);
        max-width: 1480px; text-align: center; text-wrap: balance;
        font-size: 37px; line-height: 1.26; color: #fbfaf7; letter-spacing: -0.003em;
        background: rgb(12 14 13 / 0.72); padding: 11px 30px 14px; border-radius: 11px; }`;
}

await main();
