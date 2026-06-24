/* LuminOS boot: register apps, wire the dock, open the default app. */

import { wm } from "./wm.js";
import { Dock } from "./dock.js";
import { githubApp } from "./apps/github.js";
import { browserApp } from "./apps/browser.js";
import { calculatorApp } from "./apps/calculator.js";

const apps = [githubApp, browserApp, calculatorApp];

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
