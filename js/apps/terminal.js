

import { wm } from "../wm.js";
import { fs } from "../fs.js";
import { editorApp } from "./editor.js";

const termIcon = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3 3h18a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm2.5 5.5L9 12l-3.5 3.5L7 17l5-5-5-5-1.5 1.5zM12 16h6v1.6h-6V16z"/></svg>`;

const USER = "root";
const HOST = "LuminOs";

function tokenize(line) {
  const out = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let m;
  while ((m = re.exec(line))) out.push(m[1] ?? m[2] ?? m[3]);
  return out;
}

function buildTerminal() {
  const el = document.createElement("div");
  el.className = "term";
  el.innerHTML = `
    <div class="term-output"></div>
    <div class="term-inputline">
      <span class="term-prompt"></span>
      <input class="term-input" type="text" spellcheck="false" autocapitalize="off" autocomplete="off" autocorrect="off" />
    </div>
  `;

  const outEl = el.querySelector(".term-output");
  const promptEl = el.querySelector(".term-prompt");
  const inputEl = el.querySelector(".term-input");

  let cwd = "/";
  const history = [];
  let histIdx = 0;

  const promptText = () => `${USER}@${HOST}:${cwd}$ `;
  const refreshPrompt = () => (promptEl.textContent = promptText());

  function print(text = "", cls = "") {
    const line = document.createElement("div");
    line.className = "term-line" + (cls ? " " + cls : "");
    line.textContent = text;
    outEl.appendChild(line);
    outEl.scrollTop = outEl.scrollHeight;
  }

  const resolve = (arg) => fs.normalize(arg, cwd);

  // ---- commands
  const commands = {
    help() {
      print("Commands:");
      [
        "ls [path]        list a directory",
        "cd [path]        change directory",
        "pwd              print working directory",
        "cat <file>       print a file",
        "mkdir <dir>      make a directory",
        "touch <file>     create an empty file",
        "rm [-r] <path>   remove a file or folder",
        "mv <src> <dst>   move / rename",
        "cp <src> <dst>   copy a file",
        "echo <text>      print text ( > file, >> file to write )",
        "open <file>      open a file in the editor",
        "tree [path]      show the tree",
        "clear            clear the screen",
        "whoami / date    system info",
      ].forEach((l) => print("  " + l));
    },

    ls(args) {
      const target = args[0] ? resolve(args[0]) : cwd;
      if (fs.isFile(target)) return print(fs.basename(target));
      if (!fs.isDir(target)) throw new Error(`no such directory: ${args[0]}`);
      const entries = fs.list(target);
      if (!entries.length) return;
      entries.forEach((e) =>
        print(e.type === "dir" ? e.name + "/" : e.name, e.type === "dir" ? "term-dir" : ""));
    },

    cd(args) {
      const target = args[0] ? resolve(args[0]) : "/";
      if (!fs.isDir(target)) throw new Error(`not a directory: ${args[0] || "/"}`);
      cwd = target;
      refreshPrompt();
    },

    pwd() {
      print(cwd);
    },

    cat(args) {
      if (!args[0]) throw new Error("usage: cat <file>");
      print(fs.read(resolve(args[0])));
    },

    mkdir(args) {
      if (!args[0]) throw new Error("usage: mkdir <dir>");
      fs.mkdir(resolve(args[0]));
    },

    touch(args) {
      if (!args[0]) throw new Error("usage: touch <file>");
      fs.touch(resolve(args[0]));
    },

    rm(args) {
      const recursive = args[0] === "-r" || args[0] === "-rf";
      const target = recursive ? args[1] : args[0];
      if (!target) throw new Error("usage: rm [-r] <path>");
      const p = resolve(target);
      if (fs.isDir(p) && !recursive) throw new Error(`is a directory (use -r): ${target}`);
      fs.remove(p);
    },

    mv(args) {
      if (args.length < 2) throw new Error("usage: mv <src> <dst>");
      fs.move(resolve(args[0]), resolve(args[1]));
    },

    cp(args) {
      if (args.length < 2) throw new Error("usage: cp <src> <dst>");
      fs.copy(resolve(args[0]), resolve(args[1]));
    },

    echo(args) {
      print(args.join(" "));
    },

    open(args) {
      if (!args[0]) throw new Error("usage: open <file>");
      const p = resolve(args[0]);
      if (!fs.isFile(p)) throw new Error(`no such file: ${args[0]}`);
      editorApp.openPath(p);
      print(`opening ${fs.basename(p)} in the editor…`, "term-dim");
    },

    tree(args) {
      const root = args[0] ? resolve(args[0]) : cwd;
      if (!fs.isDir(root)) throw new Error(`not a directory: ${args[0] || cwd}`);
      print(root === "/" ? "/" : fs.basename(root), "term-dir");
      const walk = (dir, prefix) => {
        const entries = fs.list(dir);
        entries.forEach((e, i) => {
          const last = i === entries.length - 1;
          print(prefix + (last ? "└── " : "├── ") + e.name, e.type === "dir" ? "term-dir" : "");
          if (e.type === "dir") walk(e.path, prefix + (last ? "    " : "│   "));
        });
      };
      walk(root, "");
    },

    clear() {
      outEl.innerHTML = "";
    },

    whoami() {
      print(USER);
    },

    date() {
      print(new Date().toString());
    },
  };
  commands.edit = commands.open;
  commands.cls = commands.clear;

  function run(line) {
    const trimmed = line.trim();
    if (!trimmed) return;

    let writeTo = null;
    let append = false;
    const redir = trimmed.match(/\s(>>?)\s*(\S+)\s*$/);
    let body = trimmed;
    if (redir) {
      append = redir[1] === ">>";
      writeTo = redir[2];
      body = trimmed.slice(0, redir.index);
    }

    const [cmd, ...args] = tokenize(body);
    const fn = commands[cmd];
    if (!fn) return print(`${cmd}: command not found`, "term-err");

    try {
      if (writeTo && cmd === "echo") {
        const path = resolve(writeTo);
        const text = args.join(" ");
        const value = append && fs.isFile(path) ? fs.read(path) + "\n" + text : text;
        fs.write(path, value);
      } else {
        fn(args);
      }
    } catch (err) {
      print(String(err.message || err), "term-err");
    }
  }

  // ---- input
  inputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const line = inputEl.value;
      print(promptText() + line);
      if (line.trim()) {
        history.push(line);
        histIdx = history.length;
      }
      inputEl.value = "";
      run(line);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (histIdx > 0) inputEl.value = history[--histIdx] ?? "";
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (histIdx < history.length - 1) inputEl.value = history[++histIdx] ?? "";
      else { histIdx = history.length; inputEl.value = ""; }
    } else if (e.key === "l" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      commands.clear();
    }
  });

  // Clicking anywhere in the terminal focuses
  el.addEventListener("mousedown", (e) => {
    if (window.getSelection().toString()) return; // allow text selection
    if (e.target !== inputEl) setTimeout(() => inputEl.focus(), 0);
  });

  refreshPrompt();
  print(`LuminOS shell — type 'help' for commands.`, "term-dim");
  return el;
}

export const terminalApp = {
  id: "terminal",
  name: "Terminal",
  icon: termIcon,
  iconBg: "#16101f",
  launch() {
    const win = wm.createWindow({
      id: "terminal",
      title: "Terminal",
      content: buildTerminal(),
      width: 640,
      height: 420,
      center: true,
    });
    const input = win.el.querySelector(".term-input");
    if (input) setTimeout(() => input.focus(), 0);
    return win;
  },
};
