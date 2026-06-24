/* GitHub profile card app — static snapshot of github.com/MIXIDtheSilly. */

import { wm } from "../wm.js";

const profile = {
  login: "MIXIDtheSilly",
  name: "MIXID_MBB",
  avatar: "https://avatars.githubusercontent.com/u/88791723?v=4",
  bio: "A really silly person who likes making VR games, and lowk farm github boxes >:P",
  blog: "https://furrowlvr.com",
  html_url: "https://github.com/MIXIDtheSilly",
  repos: 3,
  followers: 6,
  following: 7,
};

// GitHub mark; uses currentColor so it adopts the dock/button text color.
const ghIcon = `<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z"/></svg>`;

function buildCard() {
  const el = document.createElement("div");
  el.className = "gh-card";
  el.innerHTML = `
    <div class="gh-head">
      <img class="gh-avatar" src="${profile.avatar}" alt="${profile.name}" />
      <div>
        <div class="gh-name">${profile.name}</div>
        <div class="gh-login">@${profile.login}</div>
      </div>
    </div>
    <div class="gh-bio">${profile.bio}</div>
    <div class="gh-blog">&#128279; <a href="${profile.blog}" target="_blank" rel="noopener">${profile.blog.replace(/^https?:\/\//, "")}</a></div>
    <div class="gh-stats">
      <div class="gh-stat"><div class="num">${profile.repos}</div><div class="lbl">Repos</div></div>
      <div class="gh-stat"><div class="num">${profile.followers}</div><div class="lbl">Followers</div></div>
      <div class="gh-stat"><div class="num">${profile.following}</div><div class="lbl">Following</div></div>
    </div>
    <a class="gh-btn" href="${profile.html_url}" target="_blank" rel="noopener">${ghIcon}<span>View on GitHub</span></a>
  `;
  return el;
}

export const githubApp = {
  id: "github",
  name: "GitHub — MIXIDtheSilly",
  icon: ghIcon,
  iconBg: "#181717", // black tile, like the GitHub app icon
  launch() {
    return wm.createWindow({
      id: "github",
      title: "GitHub",
      content: buildCard(),
      width: 380,
      height: 470,
      center: true,
    });
  },
};
