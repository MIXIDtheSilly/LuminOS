/* LuminOS boot: register apps, wire the dock, open the default app. */

import { wm } from "./wm.js";
import { Dock } from "./dock.js";
import "./clock.js";
import { githubApp } from "./apps/github.js";
import { browserApp } from "./apps/browser.js";
import { calculatorApp } from "./apps/calculator.js";
import { editorApp } from "./apps/editor.js";
import { filesApp } from "./apps/files.js";
import { terminalApp } from "./apps/terminal.js";

const apps = [githubApp, filesApp, terminalApp, browserApp, calculatorApp, editorApp];

function boot() {
  wm.init(document.getElementById("windows"));
  new Dock(document.getElementById("dock"), apps);

  // Don't greet the user with an empty desktop.
  githubApp.launch();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
