const statusEl = document.getElementById("status");
const resultEl = document.getElementById("result");

async function refresh() {
  const state = await chrome.runtime.sendMessage({ type: "GET_STATE" });
  if (state?.profile?.scanLabel || state?.profile?.scan) {
    const fitz = state.profile.fitzpatrick || state.profile.scan?.fitzpatrick || "unknown";
    statusEl.className = "status ok";
    statusEl.textContent = `Skin profile connected. Fitzpatrick ${fitz}.`;
  } else {
    statusEl.className = "status warn";
    statusEl.textContent = "No skin profile yet. Open PatchTest, run a scan, then come back.";
  }
}

document.getElementById("check").addEventListener("click", async () => {
  resultEl.textContent = "Reading the page…";
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  try {
    const res = await chrome.tabs.sendMessage(tab.id, { type: "RUN_CHECK" });
    resultEl.textContent = res?.checked
      ? `Checked ${res.checked} item${res.checked === 1 ? "" : "s"}.`
      : "No skincare found on this page.";
  } catch {
    resultEl.textContent = "This page cannot be read. Try a cart page.";
  }
});

document.getElementById("open").addEventListener("click", async () => {
  const state = await chrome.runtime.sendMessage({ type: "GET_STATE" });
  chrome.tabs.create({ url: state.apiBase });
});

refresh();
