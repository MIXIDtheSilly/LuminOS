const STORAGE_KEY = "luminos.fs.v1";

let nodes = Object.create(null);
const listeners = new Set();

// ---- path helpers

export function normalize(path, cwd = "/") {
  if (path == null || path === "") path = cwd;
  if (path[0] !== "/") path = (cwd === "/" ? "" : cwd) + "/" + path;
  const stack = [];
  for (const part of path.split("/")) {
    if (part === "" || part === ".") continue;
    if (part === "..") { stack.pop(); continue; }
    stack.push(part);
  }
  return "/" + stack.join("/");
}

export function basename(path) {
  const p = normalize(path);
  if (p === "/") return "/";
  return p.slice(p.lastIndexOf("/") + 1);
}

export function dirname(path) {
  const p = normalize(path);
  if (p === "/") return "/";
  const i = p.lastIndexOf("/");
  return i === 0 ? "/" : p.slice(0, i);
}

// ---- persistence
let saveQueued = false;
function persist() {
  if (saveQueued) return;
  saveQueued = true;
  queueMicrotask(() => {
    saveQueued = false;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nodes));
    } catch (_) {
      // storage full or blocked 
    }
  });
}

function emit() {
  listeners.forEach((fn) => {
    try { fn(); } catch (_) {}
  });
}

function changed() {
  persist();
  emit();
}

export function onChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// ---- queries

export function exists(path) {
  return normalize(path) in nodes;
}

export function isDir(path) {
  const n = nodes[normalize(path)];
  return !!n && n.type === "dir";
}

export function isFile(path) {
  const n = nodes[normalize(path)];
  return !!n && n.type === "file";
}

export function read(path) {
  const p = normalize(path);
  const n = nodes[p];
  if (!n) throw new Error(`no such file: ${p}`);
  if (n.type !== "file") throw new Error(`is a directory: ${p}`);
  return n.content;
}

export function list(dir = "/") {
  const base = normalize(dir);
  if (!isDir(base)) throw new Error(`not a directory: ${base}`);
  const prefix = base === "/" ? "/" : base + "/";
  const out = [];
  for (const path in nodes) {
    if (path === base) continue;
    if (!path.startsWith(prefix)) continue;
    if (path.slice(prefix.length).includes("/")) continue; // grandchild
    out.push(entry(path));
  }
  out.sort((a, b) =>
    a.type === b.type ? a.name.localeCompare(b.name) : a.type === "dir" ? -1 : 1
  );
  return out;
}

export function allFiles() {
  return Object.keys(nodes)
    .filter((p) => nodes[p].type === "file")
    .sort();
}

function entry(path) {
  const n = nodes[path];
  return { name: basename(path), path, type: n.type, modified: n.modified || 0 };
}

// ---- mutations

export function mkdir(path) {
  const p = normalize(path);
  let acc = "";
  for (const part of p.split("/").filter(Boolean)) {
    acc += "/" + part;
    if (!nodes[acc]) nodes[acc] = { type: "dir" };
    else if (nodes[acc].type !== "dir") throw new Error(`not a directory: ${acc}`);
  }
  changed();
  return p;
}

//write file
export function write(path, content = "") {
  const p = normalize(path);
  if (p === "/") throw new Error("cannot write to /");
  if (nodes[p] && nodes[p].type === "dir") throw new Error(`is a directory: ${p}`);
  const parent = dirname(p);
  if (parent !== "/" && !nodes[parent]) mkdirSilent(parent);
  nodes[p] = { type: "file", content: String(content), modified: Date.now() };
  changed();
  return p;
}

function mkdirSilent(path) {
  let acc = "";
  for (const part of normalize(path).split("/").filter(Boolean)) {
    acc += "/" + part;
    if (!nodes[acc]) nodes[acc] = { type: "dir" };
  }
}

// Create an empty file if it doesn't exist
export function touch(path) {
  const p = normalize(path);
  if (isFile(p)) {
    nodes[p].modified = Date.now();
    changed();
    return p;
  }
  return write(p, "");
}

// Remove a file, or a directory (recursively). Root cannot be removed.
export function remove(path) {
  const p = normalize(path);
  if (p === "/") throw new Error("cannot remove /");
  if (!nodes[p]) throw new Error(`no such file: ${p}`);
  if (nodes[p].type === "dir") {
    const prefix = p + "/";
    for (const key of Object.keys(nodes)) {
      if (key === p || key.startsWith(prefix)) delete nodes[key];
    }
  } else {
    delete nodes[p];
  }
  changed();
}

export function move(from, to) {
  const src = normalize(from);
  let dst = normalize(to);
  if (src === "/") throw new Error("cannot move /");
  if (!nodes[src]) throw new Error(`no such file: ${src}`);
  // Moving into an existing directory keeps the original name.
  if (isDir(dst)) dst = normalize(basename(src), dst);
  if (dst === src) return dst;
  if (dst.startsWith(src + "/")) throw new Error("cannot move a directory into itself");

  const parent = dirname(dst);
  if (parent !== "/" && !nodes[parent]) mkdirSilent(parent);

  if (nodes[src].type === "dir") {
    const prefix = src + "/";
    for (const key of Object.keys(nodes)) {
      if (key === src) {
        nodes[dst] = nodes[key];
      } else if (key.startsWith(prefix)) {
        nodes[dst + key.slice(src.length)] = nodes[key];
      } else continue;
      delete nodes[key];
    }
  } else {
    nodes[dst] = nodes[src];
    nodes[dst].modified = Date.now();
    delete nodes[src];
  }
  changed();
  return dst;
}

// Copy a file (directories not)
export function copy(from, to) {
  const src = normalize(from);
  if (!isFile(src)) throw new Error(`not a file: ${src}`);
  let dst = normalize(to);
  if (isDir(dst)) dst = normalize(basename(src), dst);
  return write(dst, nodes[src].content);
}

// ---- real-disk bridge (File System Access API + fallback)

export const canUseDisk =
  typeof window !== "undefined" && "showOpenFilePicker" in window;

export async function importFromDisk(destDir = "/") {
  const dest = normalize(destDir);
  if (window.showOpenFilePicker) {
    const handles = await window.showOpenFilePicker({ multiple: true });
    const created = [];
    for (const handle of handles) {
      const file = await handle.getFile();
      created.push(write(normalize(file.name, dest), await file.text()));
    }
    return created;
  }
  // Fallback: a hidden <input type=file>.
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.style.display = "none";
    input.addEventListener("change", async () => {
      const created = [];
      for (const file of input.files) {
        created.push(write(normalize(file.name, dest), await file.text()));
      }
      input.remove();
      resolve(created);
    });
    document.body.appendChild(input);
    input.click();
  });
}

// saves to disk duh
export async function saveToDisk(path) {
  const p = normalize(path);
  const content = read(p);
  const name = basename(p);
  if (window.showSaveFilePicker) {
    const handle = await window.showSaveFilePicker({ suggestedName: name });
    const writable = await handle.createWritable();
    await writable.write(content);
    await writable.close();
    return;
  }
  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

// boot

function seed() {
  write(
    "/Documents/welcome.md",
    `# Welcome to LuminOS

This file lives in your browser's storage, so it'll still be here next time.

- Open the **Files** app to browse, rename and delete files.
- Open the **Terminal** and try \`ls\`, \`cat Documents/welcome.md\` or \`tree\`.
- Double-click any file to edit it in the **Code Editor**.

Files you create in any app will also show up in others.

Oh btw PLEASE STAR THE PROJECT AHH https://github.com/MIXIDtheSilly/LuminOS
`
  );
  write(
    "/Documents/testing.txt",
    `Hello world! Im just here to test lol
`
  );
  write(
    "/Projects/hello.js",
    `function greet(name) {
  console.log(\`Hello, \${name}!\`);
}

greet("LuminOS");
`
  );
  mkdir("/Pictures");
}

function boot() {
  let loaded = null;
  try {
    loaded = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
  } catch (_) {
    loaded = null;
  }
  if (loaded && typeof loaded === "object") {
    nodes = loaded;
  }
  if (!nodes["/"]) nodes["/"] = { type: "dir" };
  if (!loaded) seed();
}

boot();

export const fs = {
  normalize, basename, dirname,
  exists, isDir, isFile, read, list, allFiles,
  mkdir, write, touch, remove, move, copy,
  onChange,
  canUseDisk, importFromDisk, saveToDisk,
};