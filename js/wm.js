/* LuminOS window manager: create / drag / resize / focus / minimize / maximize. */

let zCounter = 10;
let cascadeStep = 0;
const DOCK_SPACE = 96; // px reserved at the bottom for the dock

class WindowManager {
  constructor() {
    this.layer = null;
    this.windows = new Map(); // app id -> handle
    this.focused = null;
    this.listeners = new Set();
  }

  init(layerEl) {
    this.layer = layerEl;
  }

  /** Subscribe to state changes (used by the dock to refresh running dots). */
  onChange(fn) {
    this.listeners.add(fn);
  }

  _emit() {
    this.listeners.forEach((fn) => fn());
  }

  isOpen(id) {
    return this.windows.has(id);
  }

  get(id) {
    return this.windows.get(id);
  }

  createWindow({ id, title = "", content, width = 360, height = 420, center = false }) {
    // Re-focus instead of duplicating an already-open app.
    if (id && this.windows.has(id)) {
      const existing = this.windows.get(id);
      existing.restore();
      existing.focus();
      return existing;
    }

    const el = document.createElement("div");
    el.className = "window";
    el.style.width = width + "px";
    el.style.height = height + "px";

    let left;
    let top;
    if (center) {
      left = Math.max(12, (window.innerWidth - width) / 2);
      top = Math.max(12, (window.innerHeight - DOCK_SPACE - height) / 2);
    } else {
      const offset = (cascadeStep % 6) * 28;
      cascadeStep++;
      left = 120 + offset;
      top = 80 + offset;
    }
    el.style.left = left + "px";
    el.style.top = top + "px";

    el.innerHTML = `
      <div class="titlebar">
        <div class="traffic">
          <button class="light close" type="button" aria-label="Close"></button>
          <button class="light min" type="button" aria-label="Minimize"></button>
          <button class="light zoom" type="button" aria-label="Zoom"></button>
        </div>
        <div class="title"></div>
        <div class="spacer"></div>
      </div>
      <div class="window-body"></div>
      <div class="rz rz-n" data-dir="n"></div>
      <div class="rz rz-s" data-dir="s"></div>
      <div class="rz rz-e" data-dir="e"></div>
      <div class="rz rz-w" data-dir="w"></div>
      <div class="rz rz-ne" data-dir="ne"></div>
      <div class="rz rz-nw" data-dir="nw"></div>
      <div class="rz rz-se" data-dir="se"></div>
      <div class="rz rz-sw" data-dir="sw"></div>
    `;

    el.querySelector(".title").textContent = title;

    const body = el.querySelector(".window-body");
    if (content instanceof Node) body.appendChild(content);
    else if (typeof content === "string") body.innerHTML = content;

    this.layer.appendChild(el);

    let prevRect = null;
    let maximized = false;

    const handle = {
      id,
      el,
      focus: () => this._focus(handle),
      isMinimized: () => el.classList.contains("minimized"),
      restore: () => el.classList.remove("minimized"),
      close: () => {
        el.remove();
        if (id) this.windows.delete(id);
        if (this.focused === handle) this.focused = null;
        this._emit();
      },
      minimize: () => {
        el.classList.add("minimized");
        el.classList.remove("focused");
        if (this.focused === handle) this.focused = null;
        this._emit();
      },
      toggleMaximize: () => {
        if (maximized) {
          if (prevRect) Object.assign(el.style, prevRect);
          maximized = false;
        } else {
          prevRect = {
            left: el.style.left,
            top: el.style.top,
            width: el.style.width,
            height: el.style.height,
          };
          const pad = 12;
          el.style.left = pad + "px";
          el.style.top = pad + "px";
          el.style.width = window.innerWidth - pad * 2 + "px";
          el.style.height = window.innerHeight - pad - DOCK_SPACE + "px";
          maximized = true;
        }
      },
    };

    // Traffic-light controls.
    el.querySelector(".close").addEventListener("click", (e) => {
      e.stopPropagation();
      handle.close();
    });
    el.querySelector(".min").addEventListener("click", (e) => {
      e.stopPropagation();
      handle.minimize();
    });
    el.querySelector(".zoom").addEventListener("click", (e) => {
      e.stopPropagation();
      handle.toggleMaximize();
    });

    // Click anywhere brings the window forward.
    el.addEventListener("pointerdown", () => this._focus(handle));

    const titlebar = el.querySelector(".titlebar");
    this._enableDrag(el, titlebar);
    titlebar.addEventListener("dblclick", (e) => {
      if (e.target.closest(".light")) return;
      handle.toggleMaximize();
    });

    el.querySelectorAll(".rz").forEach((grip) =>
      this._enableResize(el, grip, grip.dataset.dir)
    );

    if (id) this.windows.set(id, handle);
    this._focus(handle);
    this._emit();
    return handle;
  }

  _focus(handle) {
    if (this.focused && this.focused !== handle) {
      this.focused.el.classList.remove("focused");
    }
    handle.el.style.zIndex = ++zCounter;
    handle.el.classList.add("focused");
    this.focused = handle;
    this._emit();
  }

  _enableDrag(win, grip) {
    let startX = 0;
    let startY = 0;
    let originLeft = 0;
    let originTop = 0;
    let dragging = false;

    grip.addEventListener("pointerdown", (e) => {
      if (e.target.closest(".light")) return; // don't drag from the controls
      e.preventDefault(); // suppress native text selection while dragging
      dragging = true;
      startX = e.clientX;
      startY = e.clientY;
      originLeft = parseFloat(win.style.left) || 0;
      originTop = parseFloat(win.style.top) || 0;
      grip.setPointerCapture(e.pointerId);
    });

    grip.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      let nx = originLeft + (e.clientX - startX);
      let ny = originTop + (e.clientY - startY);
      // Keep at least a slice of the window reachable on screen.
      nx = Math.min(Math.max(nx, 80 - win.offsetWidth), window.innerWidth - 80);
      ny = Math.min(Math.max(ny, 0), window.innerHeight - 40);
      win.style.left = nx + "px";
      win.style.top = ny + "px";
    });

    const end = (e) => {
      dragging = false;
      try {
        grip.releasePointerCapture(e.pointerId);
      } catch (_) {}
    };
    grip.addEventListener("pointerup", end);
    grip.addEventListener("pointercancel", end);
  }

  _enableResize(win, grip, dir) {
    const MIN_W = 280;
    const MIN_H = 180;
    let startX = 0;
    let startY = 0;
    let startW = 0;
    let startH = 0;
    let startL = 0;
    let startT = 0;
    let resizing = false;

    grip.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      e.preventDefault(); // suppress native text selection while resizing
      resizing = true;
      startX = e.clientX;
      startY = e.clientY;
      startW = win.offsetWidth;
      startH = win.offsetHeight;
      startL = parseFloat(win.style.left) || 0;
      startT = parseFloat(win.style.top) || 0;
      grip.setPointerCapture(e.pointerId);
    });

    grip.addEventListener("pointermove", (e) => {
      if (!resizing) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      if (dir.includes("e")) {
        win.style.width = Math.max(MIN_W, startW + dx) + "px";
      }
      if (dir.includes("s")) {
        win.style.height = Math.max(MIN_H, startH + dy) + "px";
      }
      // West/north edges move the origin while the far edge stays anchored.
      if (dir.includes("w")) {
        const w = Math.max(MIN_W, startW - dx);
        win.style.width = w + "px";
        win.style.left = startL + (startW - w) + "px";
      }
      if (dir.includes("n")) {
        const h = Math.max(MIN_H, startH - dy);
        win.style.height = h + "px";
        win.style.top = startT + (startH - h) + "px";
      }
    });

    const end = (e) => {
      resizing = false;
      try {
        grip.releasePointerCapture(e.pointerId);
      } catch (_) {}
    };
    grip.addEventListener("pointerup", end);
    grip.addEventListener("pointercancel", end);
  }
}

export const wm = new WindowManager();
