// The fetch lives here rather than in the content script so it carries the
// extension's host permissions and is not subject to the shop page's CORS.

const DEFAULT_API = "https://patchtest.fly.dev";

async function apiBase() {
  const { apiBase } = await chrome.storage.local.get("apiBase");
  return apiBase || DEFAULT_API;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "CHECK_CART") {
    (async () => {
      try {
        const { profile } = await chrome.storage.local.get("profile");
        const res = await fetch(`${await apiBase()}/api/check-cart`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: message.items, profile: profile ?? {} }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
        sendResponse({ ok: true, data, hasProfile: Boolean(profile) });
      } catch (err) {
        sendResponse({ ok: false, error: String(err.message || err) });
      }
    })();
    return true;
  }

  if (message?.type === "SAVE_PROFILE") {
    (async () => {
      await chrome.storage.local.set({ profile: message.profile, savedAt: Date.now() });
      sendResponse({ ok: true });
    })();
    return true;
  }

  if (message?.type === "GET_STATE") {
    (async () => {
      const state = await chrome.storage.local.get(["profile", "savedAt", "apiBase"]);
      sendResponse({ ok: true, ...state, apiBase: state.apiBase || DEFAULT_API });
    })();
    return true;
  }

  return false;
});
