/* Web Browser app — start page + iframe, with an "open in new tab"
   fallback for sites that refuse embedding (X-Frame-Options / CSP). */

import { wm } from "../wm.js";

const browserIcon = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>`;

// Sites that allow being embedded in an iframe.
const BOOKMARKS = [
  { name: "Wikipedia", url: "https://www.wikipedia.org", desc: "The free encyclopedia" },
  { name: "MDN Web Docs", url: "https://developer.mozilla.org", desc: "Web reference" },
  { name: "Example", url: "https://example.com", desc: "Test page" },
  { name: "furrowlvr", url: "https://furrowlvr.com", desc: "MIXID's site" },
];

// Hosts known to send X-Frame-Options/CSP that block embedding.
const BLOCKED_HOSTS = new Set([
  "google.com", "www.google.com",
  "youtube.com", "www.youtube.com",
  "x.com", "twitter.com",
  "facebook.com", "www.facebook.com",
  "instagram.com", "www.instagram.com",
  "reddit.com", "www.reddit.com",
  "github.com", "www.github.com",
]);

function normalize(raw) {
  let u = raw.trim();
  if (!u) return null;
  if (!/^https?:\/\//i.test(u)) u = "https://" + u;
  try {
    const parsed = new URL(u);
    return { url: parsed.href, host: parsed.host.toLowerCase() };
  } catch {
    return null;
  }
}

function buildBrowser() {
  const el = document.createElement("div");
  el.className = "browser";

  el.innerHTML = `
    <div class="browser-bar">
      <button class="browser-btn browser-home" type="button" title="Home" aria-label="Home"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5"/></svg></button>
      <input class="browser-url" type="text" spellcheck="false" placeholder="Search or enter address" />
      <button class="browser-btn browser-go" type="button">Go</button>
      <button class="browser-btn browser-newtab" type="button" title="Open in new tab" aria-label="Open in new tab">↗</button>
    </div>
    <div class="browser-stage">
      <div class="browser-home-page">
        <h2 class="browser-home-title">LuminOS Browser</h2>
        <p class="browser-home-sub">Pick a site below, or type an address above.</p>
        <div class="browser-bookmarks"></div>
      </div>
      <iframe class="browser-frame hidden" title="Web view"></iframe>
      <div class="browser-blocked hidden">
        <div class="browser-blocked-title">This site can’t be embedded</div>
        <div class="browser-blocked-sub"></div>
        <button class="browser-btn browser-blocked-open" type="button">Open in new tab ↗</button>
      </div>
    </div>
  `;

  const input = el.querySelector(".browser-url");
  const frame = el.querySelector(".browser-frame");
  const homePage = el.querySelector(".browser-home-page");
  const blocked = el.querySelector(".browser-blocked");
  const blockedSub = el.querySelector(".browser-blocked-sub");
  const bookmarks = el.querySelector(".browser-bookmarks");

  let currentUrl = "";

  // Render bookmark cards.
  BOOKMARKS.forEach((b) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "bookmark";
    card.innerHTML = `<span class="bookmark-name"></span><span class="bookmark-desc"></span><span class="bookmark-host"></span>`;
    card.querySelector(".bookmark-name").textContent = b.name;
    card.querySelector(".bookmark-desc").textContent = b.desc;
    card.querySelector(".bookmark-host").textContent = b.url.replace(/^https?:\/\//, "");
    card.addEventListener("click", () => navigate(b.url));
    bookmarks.appendChild(card);
  });

  function showHome() {
    homePage.classList.remove("hidden");
    frame.classList.add("hidden");
    blocked.classList.add("hidden");
    currentUrl = "";
  }

  function showBlocked(url) {
    homePage.classList.add("hidden");
    frame.classList.add("hidden");
    blocked.classList.remove("hidden");
    blockedSub.textContent = url;
  }

  function navigate(raw) {
    const target = normalize(raw);
    if (!target) return;
    currentUrl = target.url;
    input.value = target.url;
    if (BLOCKED_HOSTS.has(target.host)) {
      showBlocked(target.url);
      return;
    }
    homePage.classList.add("hidden");
    blocked.classList.add("hidden");
    frame.classList.remove("hidden");
    frame.src = target.url;
  }

  function openInTab() {
    const target = currentUrl || (normalize(input.value) || {}).url;
    if (target) window.open(target, "_blank", "noopener");
  }

  el.querySelector(".browser-go").addEventListener("click", () => navigate(input.value));
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") navigate(input.value); });
  el.querySelector(".browser-home").addEventListener("click", showHome);
  el.querySelector(".browser-newtab").addEventListener("click", openInTab);
  el.querySelector(".browser-blocked-open").addEventListener("click", openInTab);

  return el;
}

export const browserApp = {
  id: "browser",
  name: "Web Browser",
  icon: browserIcon,
  iconBg: "#3663c4",
  launch() {
    return wm.createWindow({
      id: "browser",
      title: "Web Browser",
      content: buildBrowser(),
      width: 860,
      height: 600,
      center: true,
    });
  },
};
