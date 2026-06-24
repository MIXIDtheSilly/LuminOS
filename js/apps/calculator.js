/* Calculator app — basic four-function calculator. */

import { wm } from "../wm.js";

// Calculator glyph; currentColor so it adopts the dock/button text color.
const calcIcon = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 2h12a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm0 2v4h12V4H6zm1 7h2v2H7v-2zm4 0h2v2h-2v-2zm4 0h2v6h-2v-6zM7 15h2v2H7v-2zm4 0h2v2h-2v-2z"/></svg>`;

// Keypad layout. Each entry: label + the action it performs.
const KEYS = [
  { label: "C", action: "clear", span: 2, variant: "fn" },
  { label: "←", action: "back", variant: "fn" },
  { label: "÷", action: "op", op: "/", variant: "op" },
  { label: "7", action: "num" },
  { label: "8", action: "num" },
  { label: "9", action: "num" },
  { label: "×", action: "op", op: "*", variant: "op" },
  { label: "4", action: "num" },
  { label: "5", action: "num" },
  { label: "6", action: "num" },
  { label: "−", action: "op", op: "-", variant: "op" },
  { label: "1", action: "num" },
  { label: "2", action: "num" },
  { label: "3", action: "num" },
  { label: "+", action: "op", op: "+", variant: "op" },
  { label: "0", action: "num" },
  { label: ".", action: "dot" },
  { label: "=", action: "equals", span: 2, variant: "eq" },
];

function buildCalc() {
  const el = document.createElement("div");
  el.className = "calc";

  el.innerHTML = `
    <div class="calc-display">
      <div class="calc-history"></div>
      <div class="calc-current">0</div>
    </div>
    <div class="calc-keys"></div>
  `;

  const historyEl = el.querySelector(".calc-history");
  const currentEl = el.querySelector(".calc-current");
  const keysEl = el.querySelector(".calc-keys");

  // Calculator state.
  let current = "0"; // digits being typed
  let stored = null; // the left operand
  let op = null; // pending operator
  let fresh = true; // next digit starts a new number

  function symbol(o) {
    return { "/": "÷", "*": "×", "-": "−", "+": "+" }[o] || "";
  }

  // Trim floating-point noise (e.g. 0.1 + 0.2) without forcing trailing zeros.
  function format(n) {
    if (n === "Error") return n;
    const num = Number(n);
    if (!isFinite(num)) return "Error";
    return String(Math.round(num * 1e10) / 1e10);
  }

  function render() {
    currentEl.textContent = current;
    historyEl.textContent = stored !== null ? `${stored} ${symbol(op)}` : "";
  }

  function compute(a, b, o) {
    a = parseFloat(a);
    b = parseFloat(b);
    switch (o) {
      case "+": return a + b;
      case "-": return a - b;
      case "*": return a * b;
      case "/": return b === 0 ? "Error" : a / b; // can't divide by zero
      default: return b;
    }
  }

  function inputDigit(d) {
    if (current === "Error") current = "0";
    if (fresh) { current = d; fresh = false; }
    else current = current === "0" ? d : current + d;
    render();
  }

  function inputDot() {
    if (current === "Error") current = "0";
    if (fresh) { current = "0."; fresh = false; }
    else if (!current.includes(".")) current += ".";
    render();
  }

  function setOp(nextOp) {
    if (current === "Error") return;
    if (op !== null && !fresh) {
      // Chain: evaluate the pending op before starting the next one.
      stored = format(compute(stored, current, op));
      current = stored;
    } else {
      stored = current;
    }
    op = nextOp;
    fresh = true;
    render();
  }

  function equals() {
    if (op === null || fresh) return;
    current = format(compute(stored, current, op));
    stored = null;
    op = null;
    fresh = true;
    render();
  }

  function clear() {
    current = "0";
    stored = null;
    op = null;
    fresh = true;
    render();
  }

  function backspace() {
    if (fresh || current === "Error") return;
    current = current.length > 1 ? current.slice(0, -1) : "0";
    if (current === "0") fresh = true;
    render();
  }

  function press(key) {
    switch (key.action) {
      case "num": inputDigit(key.label); break;
      case "dot": inputDot(); break;
      case "op": setOp(key.op); break;
      case "equals": equals(); break;
      case "clear": clear(); break;
      case "back": backspace(); break;
    }
  }

  // Build the keypad.
  KEYS.forEach((key) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "calc-key";
    if (key.variant) btn.classList.add(`calc-key--${key.variant}`);
    if (key.span === 2) btn.classList.add("calc-key--wide");
    btn.textContent = key.label;
    btn.addEventListener("click", () => press(key));
    keysEl.appendChild(btn);
  });

  render();
  return el;
}

export const calculatorApp = {
  id: "calculator",
  name: "Calculator",
  icon: calcIcon,
  iconBg: "#211833", // surface-2 tile; matches the purple chrome
  launch() {
    return wm.createWindow({
      id: "calculator",
      title: "Calculator",
      content: buildCalc(),
      width: 280,
      height: 420,
      center: true,
    });
  },
};
