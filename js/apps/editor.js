import { wm } from "../wm.js";
import { fs } from "../fs.js";

const editorIcon = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M9.4 16.6 4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0L19.2 12l-4.6-4.6L16 6l6 6-6 6-1.4-1.4z"/></svg>`;

const MONACO_VERSION = "0.52.2";
const MONACO_BASE = `https://cdn.jsdelivr.net/npm/monaco-editor@${MONACO_VERSION}/min/vs`;
const EMMET_URL = "https://cdn.jsdelivr.net/npm/emmet-monaco-es@5.5.0/dist/emmet-monaco.min.js";

let monacoPromise = null;

// Resolves once an editor window is up and ready to open files. Other apps
// (Files, Terminal) await this to drive "open in editor". Reset on each launch.
let editorReady = null;
let resolveReady = null;
function freshReady() {
  editorReady = new Promise((r) => (resolveReady = r));
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load " + src));
    document.head.appendChild(s);
  });
}

function loadMonaco() {
  if (monacoPromise) return monacoPromise;
  monacoPromise = new Promise((resolve, reject) => {

    window.MonacoEnvironment = {
      getWorkerUrl() {
        const shim =
          `self.MonacoEnvironment={baseUrl:"${MONACO_BASE}/"};` +
          `importScripts("${MONACO_BASE}/base/worker/workerMain.js");`;
        return URL.createObjectURL(new Blob([shim], { type: "text/javascript" }));
      },
    };

    loadScript(EMMET_URL)
      .catch(() => {}) // Emmet is optional — keep going if it fails
      .then(() => loadScript(`${MONACO_BASE}/loader.js`))
      .then(() => {
        window.require.config({ paths: { vs: MONACO_BASE } });
        window.require(["vs/editor/editor.main"], () => {
          setupMonaco(window.monaco);
          resolve(window.monaco);
        });
      })
      .catch(reject);
  });
  return monacoPromise;
}

function setupMonaco(monaco) {
  monaco.editor.defineTheme("luminos-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "9b90b8", fontStyle: "italic" },
      { token: "keyword", foreground: "9b6bff" },
      { token: "string", foreground: "c4b5ff" },
      { token: "number", foreground: "d8b4fe" },
      { token: "type", foreground: "b794ff" },
    ],
    colors: {
      "focusBorder": "#00000000",
      "editor.background": "#00000000", // transparent → window frost shows through
      "editor.foreground": "#ece8f5",
      "editorLineNumber.foreground": "#4a3a6e",
      "editorLineNumber.activeForeground": "#9b6bff",
      "editor.selectionBackground": "#6f4fd155",
      "editor.lineHighlightBackground": "#ffffff08",
      "editorCursor.foreground": "#9b6bff",
      "editorIndentGuide.background1": "#2e2247",
      "editorWidget.background": "#1b1430",
      "editorWidget.border": "#3a2c5a",
      "editorSuggestWidget.background": "#1b1430",
      "editorSuggestWidget.border": "#3a2c5a",
      "editorSuggestWidget.foreground": "#ece8f5",
      "editorSuggestWidget.selectedBackground": "#6f4fd133",
      "editorSuggestWidget.selectedForeground": "#ffffff",
      "editorSuggestWidget.highlightForeground": "#b794ff",
      "editorSuggestWidget.focusHighlightForeground": "#c4b5ff",
      "editorSuggestWidgetStatus.foreground": "#9b90b8",
      "editorHoverWidget.background": "#1b1430",
      "editorHoverWidget.border": "#3a2c5a",
      "editorHoverWidget.foreground": "#ece8f5",
      "editorHoverWidget.statusBarBackground": "#211833",
      "editorParameterHints.background": "#1b1430",
      "editorCodeLens.foreground": "#9b90b8",
      "list.hoverBackground": "#ffffff0c",
      "list.focusBackground": "#6f4fd133",
      "list.highlightForeground": "#b794ff",
      "input.background": "#211833",
      "inputOption.activeBorder": "#9b6bff",
      "scrollbarSlider.background": "#2e224788",
      "scrollbarSlider.hoverBackground": "#3a2c5aaa",
    },
  });

  const ts = monaco.languages.typescript;
  [ts.javascriptDefaults, ts.typescriptDefaults].forEach((d) => {
    d.setCompilerOptions({
      target: ts.ScriptTarget.ESNext,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.NodeJs,
      allowNonTsExtensions: true,
      allowJs: true,
      checkJs: false,
      lib: ["esnext", "dom", "dom.iterable"], // document/window/console/Array…
    });
    d.setEagerModelSync(true);
  });
  ts.javascriptDefaults.setDiagnosticsOptions({ noSemanticValidation: true, noSyntaxValidation: false });
  ts.typescriptDefaults.setDiagnosticsOptions({ noSemanticValidation: false, noSyntaxValidation: false });

  // Emmet: "!" / "div.box>p*3" + Tab in markup and style files.
  if (window.emmetMonaco) {
    window.emmetMonaco.emmetHTML(monaco, ["html", "markdown"]);
    window.emmetMonaco.emmetCSS(monaco, ["css", "scss", "less"]);
    window.emmetMonaco.emmetJSX(monaco, ["javascript", "typescript"]);
  }

  // VS Code-style JS/TS snippets (Monaco doesn't have these).
  const JS_SNIPPETS = [
    ["clg", "console.log", "console.log($1);$0"],
    ["cle", "console.error", "console.error($1);$0"],
    ["clw", "console.warn", "console.warn($1);$0"],
    ["fn", "function", "function ${1:name}(${2:args}) {\n\t$0\n}"],
    ["afn", "arrow function", "const ${1:name} = (${2:args}) => {\n\t$0\n};"],
    ["for", "for loop", "for (let ${1:i} = 0; ${1:i} < ${2:n}; ${1:i}++) {\n\t$0\n}"],
    ["forof", "for…of", "for (const ${1:item} of ${2:iterable}) {\n\t$0\n}"],
    ["forin", "for…in", "for (const ${1:key} in ${2:object}) {\n\t$0\n}"],
    ["foreach", "forEach", "${1:array}.forEach((${2:item}) => {\n\t$0\n});"],
    ["map", "map", "${1:array}.map((${2:item}) => $0);"],
    ["filter", "filter", "${1:array}.filter((${2:item}) => $0);"],
    ["reduce", "reduce", "${1:array}.reduce((${2:acc}, ${3:cur}) => $0, ${4:init});"],
    ["if", "if", "if (${1:cond}) {\n\t$0\n}"],
    ["ife", "if…else", "if (${1:cond}) {\n\t$2\n} else {\n\t$0\n}"],
    ["tc", "try…catch", "try {\n\t$1\n} catch (${2:err}) {\n\t$0\n}"],
    ["imp", "import module", "import ${1:mod} from \"${2:module}\";$0"],
    ["imd", "import named", "import { $1 } from \"${2:module}\";$0"],
    ["exp", "export", "export ${1:member};$0"],
    ["expd", "export default", "export default ${1:member};$0"],
    ["prom", "Promise", "return new Promise((resolve, reject) => {\n\t$0\n});"],
    ["timeout", "setTimeout", "setTimeout(() => {\n\t$0\n}, ${1:1000});"],
    ["aw", "await", "await $0"],
    ["asfn", "async function", "async function ${1:name}(${2:args}) {\n\t$0\n}"],
  ];
  monaco.languages.registerCompletionItemProvider(["javascript", "typescript"], {
    provideCompletionItems(model, position) {
      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber, endLineNumber: position.lineNumber,
        startColumn: word.startColumn, endColumn: word.endColumn,
      };
      return {
        suggestions: JS_SNIPPETS.map(([label, detail, body]) => ({
          label,
          kind: monaco.languages.CompletionItemKind.Snippet,
          detail: `${detail}  ·  snippet`,
          insertText: body,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: { value: "```js\n" + body.replace(/\$\{?\d+:?|\}|\$0/g, "") + "\n```" },
          range,
        })),
      };
    },
  });
} 

// --- App view

function buildEditor() {
  const el = document.createElement("div");
  el.className = "editor";
  el.innerHTML = `
    <aside class="editor-sidebar">
      <div class="editor-sidebar-head">
        <span class="editor-sidebar-title">Files</span>
        <button class="editor-newfile" type="button" title="New file" aria-label="New file">+</button>
      </div>
      <input class="editor-newinput hidden" type="text" spellcheck="false" placeholder="filename.js  ⏎" />
      <ul class="editor-files"></ul>
    </aside>
    <div class="editor-main">
      <div class="editor-tabs"></div>
      <div class="editor-mount"></div>
      <div class="editor-status"><span class="editor-lang"></span></div>
      <div class="editor-loading">Loading editor…</div>
    </div>
  `;

  const filesEl = el.querySelector(".editor-files");
  const tabsEl = el.querySelector(".editor-tabs");
  const langEl = el.querySelector(".editor-lang");
  const newBtn = el.querySelector(".editor-newfile");
  const newInput = el.querySelector(".editor-newinput");
  const mountEl = el.querySelector(".editor-mount");
  const loadingEl = el.querySelector(".editor-loading");

  loadMonaco()
    .then((monaco) => {
      loadingEl.remove();

      // Detect language from the file name using Monaco's
      const extMap = new Map();
      const nameMap = new Map();
      const labelMap = new Map();
      monaco.languages.getLanguages().forEach((lang) => {
        (lang.extensions || []).forEach((ext) => extMap.set(ext.toLowerCase(), lang.id));
        (lang.filenames || []).forEach((fn) => nameMap.set(fn.toLowerCase(), lang.id));
        labelMap.set(lang.id, (lang.aliases && lang.aliases[0]) || lang.id);
      });
      const langForName = (name) => {
        const lower = name.toLowerCase();
        if (nameMap.has(lower)) return nameMap.get(lower);
        const dot = lower.lastIndexOf(".");
        return extMap.get(dot >= 0 ? lower.slice(dot) : "") || "plaintext";
      };
      const labelForLang = (id) => labelMap.get(id) || id;

      const editor = monaco.editor.create(mountEl, {
        theme: "luminos-dark",
        automaticLayout: true,
        fontFamily: getComputedStyle(document.documentElement).getPropertyValue("--code-mono").trim(),
        fontLigatures: true,
        fontSize: 13,
        lineHeight: 21,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        padding: { top: 12 },
        tabSize: 2,
        smoothScrolling: true,
        cursorBlinking: "smooth",
        cursorSmoothCaretAnimation: "on",
        renderLineHighlight: "all",
        bracketPairColorization: { enabled: true },
        guides: { bracketPairs: "active", indentation: true },
        matchBrackets: "always",
        autoClosingBrackets: "languageDefined",
        autoClosingQuotes: "languageDefined",
        formatOnPaste: true,
        linkedEditing: true,

        // IntelliSense tuned to match VS Code.
        quickSuggestions: { other: true, comments: false, strings: true },
        quickSuggestionsDelay: 10,
        suggestOnTriggerCharacters: true,
        acceptSuggestionOnEnter: "on",
        acceptSuggestionOnCommitCharacter: true,
        tabCompletion: "on",
        suggestSelection: "recentlyUsedByPrefix",
        snippetSuggestions: "top",
        wordBasedSuggestions: "matchingDocuments",
        inlineSuggest: { enabled: true, mode: "subwordSmart" },
        parameterHints: { enabled: true, cycle: true },
        hover: { enabled: true, delay: 200, sticky: true },
        suggest: {
          insertMode: "insert",
          filterGraceful: true,
          localityBonus: true,
          shareSuggestSelections: true,
          selectionMode: "always",
          preview: true,
          previewMode: "subwordSmart",
          showInlineDetails: true,
          showStatusBar: true,
          showIcons: true,
          showMethods: true, showFunctions: true, showConstructors: true,
          showDeprecated: true, showFields: true, showVariables: true,
          showClasses: true, showStructs: true, showInterfaces: true,
          showModules: true, showProperties: true, showEvents: true,
          showOperators: true, showUnits: true, showValues: true,
          showConstants: true, showEnums: true, showEnumMembers: true,
          showKeywords: true, showWords: true, showColors: true,
          showFiles: true, showReferences: true, showFolders: true,
          showTypeParameters: true, showSnippets: true,
        },
      });

      // Auto-close HTML tags
      const TAG_LANGS = new Set(["html", "xml", "markdown", "javascript", "typescript", "php", "vue", "svelte"]);
      const VOID_TAGS = new Set(["area","base","br","col","embed","hr","img","input","link","meta","param","source","track","wbr"]);
      let autoClosing = false;
      editor.onDidChangeModelContent((e) => {
        if (autoClosing) return;
        const model = editor.getModel();
        if (!model || !TAG_LANGS.has(model.getLanguageId())) return;
        const change = e.changes[0];
        if (!change || change.text !== ">") return;
        const pos = editor.getPosition();
        const line = model.getValueInRange({
          startLineNumber: pos.lineNumber, startColumn: 1,
          endLineNumber: pos.lineNumber, endColumn: pos.column,
        });
        if (line.endsWith("/>")) return;
        const m = line.match(/<([a-zA-Z][\w-]*)(?:\s[^<>]*)?>$/);
        if (!m || VOID_TAGS.has(m[1].toLowerCase())) return;
        autoClosing = true;
        editor.executeEdits("auto-close-tag", [{
          range: new monaco.Range(pos.lineNumber, pos.column, pos.lineNumber, pos.column),
          text: `</${m[1]}>`,
        }]);
        editor.setPosition(pos);
        autoClosing = false;
      });

      // --- Models, file list and open-file tabs
      const models = new Map(); // path -> monaco model
      const openTabs = []; // paths
      let active = null;
      const emptyModel = monaco.editor.createModel("", "plaintext");
      const label = (path) => path.replace(/^\//, "");

      function modelFor(path) {
        let model = models.get(path);
        if (!model) {
          const value = fs.exists(path) ? fs.read(path) : "";
          model = monaco.editor.createModel(value, langForName(fs.basename(path)));
          // Persist edits back to the filesystem (debounced).
          let timer = null;
          model.onDidChangeContent(() => {
            clearTimeout(timer);
            timer = setTimeout(() => saveModel(path), 350);
          });
          models.set(path, model);
        }
        return model;
      }

      let savingFromEditor = false;
      function saveModel(path) {
        const model = models.get(path);
        if (!model) return;
        savingFromEditor = true; // don't let our own write bounce back as a refresh
        try {
          fs.write(path, model.getValue());
        } finally {
          savingFromEditor = false;
        }
      }

      function renderTabs() {
        tabsEl.innerHTML = "";
        openTabs.forEach((path) => {
          const tab = document.createElement("div");
          tab.className = "editor-tabitem" + (path === active ? " active" : "");
          tab.innerHTML = `<span class="dot"></span><span class="nm"></span><button class="editor-tabclose" type="button" title="Close">×</button>`;
          tab.querySelector(".nm").textContent = fs.basename(path);
          tab.title = label(path);
          tab.addEventListener("mousedown", (e) => {
            if (e.target.closest(".editor-tabclose")) return;
            open(path);
          });
          tab.querySelector(".editor-tabclose").addEventListener("click", (e) => {
            e.stopPropagation();
            closeTab(path);
          });
          tabsEl.appendChild(tab);
        });
      }

      function syncFileList() {
        [...filesEl.children].forEach((li) =>
          li.classList.toggle("active", li.dataset.path === active));
      }

      function open(path) {
        path = fs.normalize(path);
        if (!fs.exists(path)) return;
        if (!openTabs.includes(path)) openTabs.push(path);
        active = path;
        const model = modelFor(path);
        editor.setModel(model);
        editor.updateOptions({ readOnly: false });
        langEl.textContent = labelForLang(model.getLanguageId());
        renderTabs();
        syncFileList();
        editor.focus();
      }

      function closeTab(path) {
        const i = openTabs.indexOf(path);
        if (i === -1) return;
        saveModel(path);
        openTabs.splice(i, 1);
        if (active !== path) return renderTabs();
        const next = openTabs[i] || openTabs[i - 1] || null;
        if (next) {
          open(next);
        } else {
          active = null;
          editor.setModel(emptyModel);
          editor.updateOptions({ readOnly: true });
          langEl.textContent = "";
          renderTabs();
          syncFileList();
        }
      }

      function addFileEntry(path) {
        const li = document.createElement("li");
        li.className = "editor-file";
        li.dataset.path = path;
        li.title = label(path);
        li.innerHTML = `<span class="dot"></span><span></span>`;
        li.lastElementChild.textContent = label(path);
        li.addEventListener("click", () => open(path));
        filesEl.appendChild(li);
      }

      // rebuild the sidebar from the filesystem, keeping selection in sync.
      function rebuildFileList() {
        filesEl.innerHTML = "";
        fs.allFiles().forEach(addFileEntry);
        syncFileList();
      }

      rebuildFileList();
      const first = fs.allFiles()[0];
      if (first) open(first);

      // Reflect filesystem changes made by other apps
      const unsubscribe = fs.onChange(() => {
        if (!el.isConnected) return unsubscribe(); // window closed — stop listening
        if (savingFromEditor) return;
        const present = new Set(fs.allFiles());
        // Drop tabs/models for files that disappeared.
        for (const path of [...openTabs]) {
          if (!present.has(path)) {
            const m = models.get(path);
            if (m) { m.dispose(); models.delete(path); }
            closeTab(path);
          }
        }
        for (const [path, model] of models) {
          if (present.has(path) && model !== editor.getModel()) {
            const onDisk = fs.read(path);
            if (model.getValue() !== onDisk) model.setValue(onDisk);
          }
        }
        rebuildFileList();
      });
      editor.onDidDispose?.(() => unsubscribe());

      // --- New file creation
      const showNew = () => { newInput.classList.remove("hidden"); newInput.value = ""; newInput.focus(); };
      const hideNew = () => newInput.classList.add("hidden");
      newBtn.addEventListener("click", showNew);
      newInput.addEventListener("keydown", (e) => {
        if (e.key === "Escape") return hideNew();
        if (e.key !== "Enter") return;
        let name = newInput.value.trim();
        if (!name) return hideNew();
        if (!/\./.test(name)) name += ".txt";
        const path = name.startsWith("/") ? fs.normalize(name) : "/" + name;
        if (!fs.exists(path)) fs.write(path, "");
        hideNew();
        open(path);
      });
      newInput.addEventListener("blur", hideNew);

      // Ctrl+S flushes the active file to disk immediately.
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
        if (active) saveModel(active);
      });

      // Signal that this editor instance can now open files on request.
      resolveReady?.({ open });
    })
    .catch(() => {
      loadingEl.textContent = "Couldn’t load the editor (offline?).";
    });

  return el;
}

export const editorApp = {
  id: "editor",
  name: "Code Editor",
  icon: editorIcon,
  iconBg: "#812fce",
  launch() {
    if (wm.isOpen("editor")) {
      const win = wm.get("editor");
      win.restore();
      win.focus();
      return win;
    }
    freshReady();
    return wm.createWindow({
      id: "editor",
      title: "Code Editor",
      content: buildEditor(),
      width: 900,
      height: 600,
      center: true,
    });
  },
  // Open path in the editor, launching the app first if needed
  openPath(path) {
    this.launch();
    editorReady.then((api) => api.open(path)).catch(() => {});
  },
};