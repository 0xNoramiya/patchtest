/*
 * Finds skincare in the page's cart, asks PatchTest about it, and writes the
 * answer next to each item.
 *
 * Extraction is layered, most reliable first. A shop that publishes structured
 * data gets read properly; one that does not falls back to a heuristic, and the
 * panel says which happened. Anything unreadable is reported as unknown rather
 * than quietly treated as fine.
 */

const PT = {
  BLOCK: { label: "Not for you right now", cls: "pt-block" },
  ADJUST: { label: "Adjust", cls: "pt-adjust" },
  UNNECESSARY: { label: "You don't need this", cls: "pt-unnecessary" },
  REFER: { label: "See a professional", cls: "pt-refer" },
  OK: { label: "Looks fine", cls: "pt-ok" },
  UNKNOWN: { label: "Could not read this", cls: "pt-unknown" },
};

function textOf(el) {
  return (el?.textContent || "").replace(/\s+/g, " ").trim();
}

/** 1. Explicit opt-in markup. Any shop can add this and get exact results. */
function fromDataAttributes() {
  return [...document.querySelectorAll("[data-patchtest-item]")].map((el) => ({
    el,
    name: el.getAttribute("data-patchtest-name") || textOf(el.querySelector("[data-patchtest-name]")) || textOf(el),
    price: Number(el.getAttribute("data-patchtest-price") || 0),
    source: "data attributes",
  }));
}

/** 2. schema.org Product in JSON-LD, which real shops already publish. */
function fromJsonLd() {
  const out = [];
  for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
    let parsed;
    try {
      parsed = JSON.parse(script.textContent);
    } catch {
      continue;
    }
    const queue = Array.isArray(parsed) ? [...parsed] : [parsed];
    while (queue.length) {
      const node = queue.shift();
      if (!node || typeof node !== "object") continue;
      const type = [].concat(node["@type"] || []);
      if (type.includes("Product") && node.name) {
        out.push({
          el: null,
          name: String(node.name),
          price: Number(node.offers?.price ?? node.offers?.[0]?.price ?? 0),
          source: "structured data",
        });
      }
      for (const value of Object.values(node)) {
        if (value && typeof value === "object") queue.push(value);
      }
    }
  }
  return out;
}

/** 3. Microdata, the older structured format. */
function fromMicrodata() {
  return [...document.querySelectorAll('[itemtype$="/Product"]')].map((el) => ({
    el,
    name: textOf(el.querySelector('[itemprop="name"]')) || textOf(el),
    price: Number(el.querySelector('[itemprop="price"]')?.getAttribute("content") || 0),
    source: "microdata",
  }));
}

/**
 * 4. Last resort. Rows that look like cart lines, filtered to ones whose text
 * actually mentions a skincare ingredient, so we do not annotate shipping rows.
 */
const INGREDIENT_HINT =
  /\b(retinol|retinal|adapalene|tretinoin|salicylic|glycolic|lactic|mandelic|benzoyl|niacinamide|azelaic|ascorbic|vitamin c|ceramide|hyaluronic|peptide|centella|spf|sunscreen|peel|serum|cleanser|moisturi[sz]er|toner|exfoliat)\b/i;

function fromHeuristic() {
  const rows = document.querySelectorAll(
    '[class*="cart-item" i], [class*="cart_item" i], [class*="line-item" i], [class*="basket-item" i], li[class*="product" i], tr[class*="item" i]',
  );
  return [...rows]
    .map((el) => ({ el, name: textOf(el).slice(0, 160), price: 0, source: "page text" }))
    .filter((item) => INGREDIENT_HINT.test(item.name));
}

function collectItems() {
  for (const extract of [fromDataAttributes, fromJsonLd, fromMicrodata, fromHeuristic]) {
    const found = extract();
    if (found.length > 0) {
      const seen = new Set();
      return found.filter((i) => {
        const key = i.name.toLowerCase();
        if (!i.name || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }
  }
  return [];
}

function badgeFor(result) {
  const meta = PT[result.verdict] || PT.UNKNOWN;
  const badge = document.createElement("div");
  badge.className = `pt-badge ${meta.cls}`;

  const head = document.createElement("div");
  head.className = "pt-badge-head";
  head.textContent = meta.label;
  badge.append(head);

  for (const finding of result.findings.slice(0, 2)) {
    const line = document.createElement("p");
    line.className = "pt-badge-body";
    line.textContent = finding.message;
    badge.append(line);

    if (finding.sourceUrls?.length) {
      const link = document.createElement("a");
      link.className = "pt-badge-link";
      link.href = finding.sourceUrls[0];
      link.target = "_blank";
      link.rel = "noreferrer";
      link.textContent = `Source (${finding.ruleId})`;
      badge.append(link);
    }
  }

  if (result.verdict === "UNKNOWN") {
    const line = document.createElement("p");
    line.className = "pt-badge-body";
    line.textContent = "PatchTest could not read an ingredient out of this title, so it has no view. That is not a safety clearance.";
    badge.append(line);
  }
  return badge;
}

function renderPanel(data, items, hasProfile) {
  document.querySelector(".pt-panel")?.remove();
  const counts = data.items.reduce((acc, i) => ((acc[i.verdict] = (acc[i.verdict] || 0) + 1), acc), {});
  const panel = document.createElement("aside");
  panel.className = "pt-panel";

  const title = document.createElement("div");
  title.className = "pt-panel-title";
  title.textContent = "PatchTest";
  panel.append(title);

  if (!hasProfile) {
    const warn = document.createElement("p");
    warn.className = "pt-panel-warn";
    warn.textContent = "No skin profile connected. These verdicts use ingredient rules only. Open PatchTest, run a scan, then press Connect.";
    panel.append(warn);
  }

  const summary = document.createElement("p");
  summary.className = "pt-panel-body";
  const parts = Object.entries(counts)
    .filter(([v]) => v !== "OK")
    .map(([v, n]) => `${n} ${(PT[v] || PT.UNKNOWN).label.toLowerCase()}`);
  summary.textContent = parts.length
    ? `${items.length} items checked. ${parts.join(", ")}.`
    : `${items.length} items checked. Nothing flagged.`;
  panel.append(summary);

  for (const referral of data.referrals || []) {
    const refer = document.createElement("p");
    refer.className = "pt-panel-refer";
    refer.textContent = referral.message;
    panel.append(refer);
  }

  const source = document.createElement("p");
  source.className = "pt-panel-foot";
  source.textContent = `Read from ${items[0]?.source ?? "the page"}. Not a medical device.`;
  panel.append(source);

  const close = document.createElement("button");
  close.className = "pt-panel-close";
  close.setAttribute("aria-label", "Dismiss PatchTest");
  close.textContent = "×";
  close.addEventListener("click", () => panel.remove());
  panel.append(close);

  // Attached to the document element, not the body. A framework that hydrates
  // after us owns the body's children and will happily remove anything it did
  // not render.
  document.documentElement.append(panel);
}

async function run() {
  const items = collectItems();
  if (items.length === 0) return { checked: 0 };

  const response = await chrome.runtime.sendMessage({
    type: "CHECK_CART",
    items: items.map((i) => ({ name: i.name, price: i.price })),
  });
  if (!response?.ok) return { checked: 0, error: response?.error };

  document.querySelectorAll(".pt-badge").forEach((n) => n.remove());
  response.data.items.forEach((result, index) => {
    const host = items[index]?.el;
    if (!host || result.verdict === "OK") return;
    host.classList.add("pt-host");
    host.append(badgeFor(result));
  });

  renderPanel(response.data, items, response.hasProfile);
  return { checked: items.length };
}

/** On PatchTest itself, pick up the profile the site left for us. */
function syncProfileFromSite() {
  if (!/patchtest\.fly\.dev|localhost:3000/.test(location.host)) return;
  try {
    const raw = window.localStorage.getItem("patchtest.profile");
    if (raw) chrome.runtime.sendMessage({ type: "SAVE_PROFILE", profile: JSON.parse(raw) });
  } catch {
    // Storage can be blocked. Nothing to do.
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "RUN_CHECK") {
    run().then(sendResponse);
    return true;
  }
  return false;
});

/**
 * A cart is not always at a url with "cart" in it. Check the page itself for the
 * cues a checkout page always has, so the extension runs where it should without
 * running on every product listing on the web.
 */
function looksLikeCart() {
  if (/cart|basket|checkout|bag/i.test(location.pathname)) return true;
  const text = document.body?.innerText || "";
  return /\b(subtotal|your bag|your cart|order summary|proceed to checkout)\b/i.test(text);
}

/** Wait for the page to settle, since a hydrating framework can wipe what we add. */
function runWhenSettled() {
  const start = () => setTimeout(run, 600);
  if (document.readyState === "complete") start();
  else window.addEventListener("load", start, { once: true });
}

syncProfileFromSite();
if (looksLikeCart()) runWhenSettled();
