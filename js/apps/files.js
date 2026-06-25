import { wm } from "../wm.js";
import { fs } from "../fs.js";
import { editorApp } from "./editor.js";

const filesIcon = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M10 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-8l-2-2z"/></svg>`;

const folderGlyph = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M10 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-8l-2-2z"/></svg>`;
const fileGlyph = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 2h8l6 6v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm7 1.5V9h5.5L13 3.5z"/></svg>`;

function buildFiles() {
  const el = document.createElement("div");
  el.className = "files";
  el.innerHTML = `
    <div class="files-toolbar">
      <button class="files-btn files-up" type="button" title="Up one folder" aria-label="Up one folder">↑</button>
      <div class="files-crumbs"></div>
      <div class="files-spacer"></div>
      <button class="files-btn" data-act="newfolder" type="button" title="New folder">New Folder</button>
      <button class="files-btn" data-act="newfile" type="button" title="New file">New File</button>
      <button class="files-btn" data-act="import" type="button" title="Import from your disk">Import…</button>
    </div>
    <ul class="files-grid"></ul>
    <div class="files-prompt hidden">
      <input class="files-input" type="text" spellcheck="false" />
    </div>
    <div class="files-statusbar">
      <span class="files-count"></span>
      <div class="files-actions">
        <button class="files-btn" data-act="open" type="button" disabled>Open</button>
        <button class="files-btn" data-act="rename" type="button" disabled>Rename</button>
        <button class="files-btn" data-act="save" type="button" disabled title="Save to your real disk">Save to disk</button>
        <button class="files-btn files-danger" data-act="delete" type="button" disabled>Delete</button>
      </div>
    </div>
  `;

  const upBtn = el.querySelector(".files-up");
  const crumbsEl = el.querySelector(".files-crumbs");
  const gridEl = el.querySelector(".files-grid");
  const countEl = el.querySelector(".files-count");
  const promptEl = el.querySelector(".files-prompt");
  const inputEl = el.querySelector(".files-input");
  const actionBtns = el.querySelectorAll(".files-actions [data-act]");

  let cwd = "/";
  let selected = null; // selected entry path
  let pending = null; // { mode: "newfile" | "newfolder" | "rename", path? }

  function setSelected(path) {
    selected = path;
    const isFile = path && fs.isFile(path);
    el.querySelectorAll(".files-item").forEach((li) =>
      li.classList.toggle("selected", li.dataset.path === path));
    actionBtns.forEach((b) => {
      const act = b.dataset.act;
      if (act === "open" || act === "rename" || act === "delete") b.disabled = !path;
      if (act === "save") b.disabled = !isFile; // only files go to disk
    });
  }

  function renderCrumbs() {
    crumbsEl.innerHTML = "";
    const parts = cwd === "/" ? [] : cwd.split("/").filter(Boolean);
    const addCrumb = (label, path) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "files-crumb" + (path === cwd ? " current" : "");
      b.textContent = label;
      b.addEventListener("click", () => navigate(path));
      crumbsEl.appendChild(b);
    };
    addCrumb("LuminOS", "/");
    let acc = "";
    parts.forEach((part) => {
      acc += "/" + part;
      const sep = document.createElement("span");
      sep.className = "files-sep";
      sep.textContent = "›";
      crumbsEl.appendChild(sep);
      addCrumb(part, acc);
    });
    upBtn.disabled = cwd === "/";
  }

  function render() {
    if (!fs.isDir(cwd)) cwd = "/"; // folder vanished under us
    renderCrumbs();
    gridEl.innerHTML = "";
    const entries = fs.list(cwd);
    entries.forEach((item) => {
      const li = document.createElement("li");
      li.className = "files-item";
      li.dataset.path = item.path;
      li.innerHTML = `
        <span class="files-ico files-ico--${item.type}">${item.type === "dir" ? folderGlyph : fileGlyph}</span>
        <span class="files-name"></span>`;
      li.querySelector(".files-name").textContent = item.name;
      li.addEventListener("click", () => setSelected(item.path));
      li.addEventListener("dblclick", () => activate(item));
      gridEl.appendChild(li);
    });
    countEl.textContent = `${entries.length} item${entries.length === 1 ? "" : "s"}`;
    if (selected && !fs.exists(selected)) selected = null;
    setSelected(selected);
  }

  function navigate(path) {
    cwd = fs.normalize(path);
    selected = null;
    render();
  }

  function activate(item) {
    if (item.type === "dir") navigate(item.path);
    else editorApp.openPath(item.path);
  }

  // --- inline prompt for create / rename
  function startPrompt(mode, initial = "") {
    pending = { mode, path: selected };
    promptEl.classList.remove("hidden");
    inputEl.value = initial;
    inputEl.placeholder =
      mode === "newfolder" ? "Folder name  ⏎" :
      mode === "rename" ? "New name  ⏎" : "filename.txt  ⏎";
    inputEl.focus();
    inputEl.select();
  }
  function endPrompt() {
    pending = null;
    promptEl.classList.add("hidden");
    inputEl.value = "";
  }
  inputEl.addEventListener("keydown", (e) => {
    if (e.key === "Escape") return endPrompt();
    if (e.key !== "Enter" || !pending) return;
    const name = inputEl.value.trim();
    const { mode, path } = pending;
    endPrompt();
    if (!name) return;
    try {
      if (mode === "newfolder") {
        fs.mkdir(fs.normalize(name, cwd));
      } else if (mode === "newfile") {
        const fname = /\./.test(name) ? name : name + ".txt";
        const p = fs.normalize(fname, cwd);
        if (!fs.exists(p)) fs.write(p, "");
        editorApp.openPath(p);
      } else if (mode === "rename" && path) {
        const dest = fs.normalize(name, fs.dirname(path));
        fs.move(path, dest);
        selected = dest;
      }
    } catch (err) {
      countEl.textContent = String(err.message || err);
    }
    render();
  });
  inputEl.addEventListener("blur", endPrompt);

  // --- toolbar
  upBtn.addEventListener("click", () => navigate(fs.dirname(cwd)));

  el.querySelectorAll("[data-act]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const act = btn.dataset.act;
      try {
        if (act === "newfolder") startPrompt("newfolder");
        else if (act === "newfile") startPrompt("newfile");
        else if (act === "rename" && selected) startPrompt("rename", fs.basename(selected));
        else if (act === "open" && selected) activate(fs.list(cwd).find((e) => e.path === selected) || { type: fs.isDir(selected) ? "dir" : "file", path: selected });
        else if (act === "delete" && selected) {
          fs.remove(selected);
          selected = null;
          render();
        } else if (act === "save" && selected && fs.isFile(selected)) {
          await fs.saveToDisk(selected);
        } else if (act === "import") {
          await fs.importFromDisk(cwd);
          render();
        }
      } catch (err) {
        countEl.textContent = String(err.message || err);
      }
    });
  });

  // Clicking empty space clears selection
  gridEl.addEventListener("click", (e) => {
    if (e.target === gridEl) setSelected(null);
  });

  // Keep in sync with changes from the Terminal / Editor. Self-clean once the window is gone
  const unsubscribe = fs.onChange(() => {
    if (!el.isConnected) return unsubscribe();
    render();
  });

  render();
  return el;
}

export const filesApp = {
  id: "files",
  name: "Files",
  icon: filesIcon,
  iconBg: "#e4b51b",
  launch() {
    return wm.createWindow({
      id: "files",
      title: "Files",
      content: buildFiles(),
      width: 720,
      height: 500,
      center: true,
    });
  },
};
