"use strict";
// Kleine Hilfsfunktionen, die salesforce.js sonst von der Leadgenerator-Seite bekommt.
const state = { tab: "salesforce" };
const $ = (sel) => document.querySelector(sel);
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const fmtDate = (iso) => (iso ? iso.split("-").reverse().join(".") : "");
function render() { renderSalesforce(); }
function message(text, loading = false) {
  const m = document.querySelector("#status-msg");
  if (!m) return alert(text);
  m.textContent = text;
  m.className = loading ? "loading" : "";
  m.hidden = false;
}
function download(name, content, type) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([content], { type }));
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
}
