/* LuminOS dock: builds icons from the app registry and tracks running state. */

import { wm } from "./wm.js";

export class Dock {
  constructor(el, apps) {
    this.el = el;
    this.apps = apps;
    this.items = new Map(); // app id -> button element
    this._render();
    wm.onChange(() => this._update());
  }

  _render() {
    this.el.innerHTML = "";
    this.apps.forEach((app) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "dock-item";
      btn.title = app.name;
      btn.setAttribute("aria-label", app.name);
      if (app.iconBg) btn.style.backgroundColor = app.iconBg;
      btn.innerHTML = `${app.icon}<span class="run-dot"></span>`;
      btn.addEventListener("click", () => this._handleClick(app));
      this.el.appendChild(btn);
      this.items.set(app.id, btn);
    });
  }

  _handleClick(app) {
    if (!wm.isOpen(app.id)) {
      app.launch();
      return;
    }
    const win = wm.get(app.id);
    if (win.isMinimized()) {
      win.restore();
      win.focus();
    } else if (wm.focused === win) {
      win.minimize();
    } else {
      win.focus();
    }
  }

  _update() {
    this.items.forEach((btn, id) => {
      btn.classList.toggle("running", wm.isOpen(id));
    });
  }
}
