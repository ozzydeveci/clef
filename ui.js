/* Clef: ortak arayüz yardımcıları (bildirim, pencere, dosya kaydetme, yazdırma). */
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
function h(tag, props, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (k === "class") e.className = v; else if (k === "style") e.style.cssText = v;
    else if (k.startsWith("on")) e.addEventListener(k.slice(2), v); else if (v !== false && v != null) e.setAttribute(k, v === true ? "" : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(c));
  return e;
}
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function toast(msg) {
  const t = $("#toast"); t.textContent = msg; t.hidden = false;
  clearTimeout(toast._t); toast._t = setTimeout(() => (t.hidden = true), 2800);
}

/** Pencere: {title, body (Node), buttons:[{label, primary, onClick}]}. Kapatma işlevini döndürür. */
function modal({ title, body, buttons, onCancel }) {
  const m = $("#modal");
  const close = () => { m.hidden = true; m.innerHTML = ""; };
  const box = h("div", { class: "box" }, title ? h("h3", {}, title) : null, h("div", { class: "bd" }, body),
    buttons && buttons.length ? h("div", { class: "btns" }, buttons.map((b) => h("button", { class: b.primary ? "p" : "", onclick: () => { if (b.onClick && b.onClick() === false) return; close(); } }, b.label))) : null);
  m.innerHTML = ""; m.append(box); m.hidden = false;
  m.onclick = (e) => { if (e.target === m) { close(); onCancel && onCancel(); } };
  return close;
}
/** Seçenek listesi; seçilen sıra numarasını (iptalde -1) döndürür. */
function choose(title, items, checked) {
  return new Promise((res) => {
    let done = false;
    const fin = (v) => { if (!done) { done = true; res(v); } };
    const close = modal({
      title, onCancel: () => fin(-1),
      body: h("div", { style: "margin:0 -18px" }, items.map((t, i) => h("button", { class: "opt" + (i === checked ? " on" : ""), onclick: () => { close(); fin(i); } }, t))),
      buttons: [{ label: "İptal", onClick: () => fin(-1) }],
    });
  });
}
function promptText(title, initial, okLabel, placeholder) {
  return new Promise((res) => {
    const inp = h("input", { value: initial || "", placeholder: placeholder || "", autocomplete: "off" });
    let done = false; const fin = (v) => { if (!done) { done = true; res(v); } };
    modal({ title, body: inp, onCancel: () => fin(null), buttons: [{ label: "İptal", onClick: () => fin(null) }, { label: okLabel || "Tamam", primary: true, onClick: () => fin(inp.value) }] });
    setTimeout(() => inp.focus(), 50);
  });
}
function confirmBox(message, okLabel, title) {
  return new Promise((res) => {
    let done = false; const fin = (v) => { if (!done) { done = true; res(v); } };
    modal({ title: title || null, body: h("div", {}, message), onCancel: () => fin(false), buttons: [{ label: "İptal", onClick: () => fin(false) }, { label: okLabel || "Tamam", primary: true, onClick: () => fin(true) }] });
  });
}
/** Şarkı bilgileri formu (yeni şarkı ve "Bilgiler" için). */
function infoDialog(song, onOk) {
  const f = (ph, v) => h("input", { placeholder: ph, value: v || "", autocomplete: "off" });
  const title = f("Şarkı adı", song && song.title), comp = f("Besteci", song && song.composer), style = f("Tarz (Pop, Swing…)", song && song.style);
  const key = f("Ton (örn. Gm, Bb, F#m)", song && song.key), bpm = f("Tempo (BPM)", song && song.bpm); bpm.inputMode = "numeric";
  modal({
    title: song ? "Şarkı bilgileri" : "Yeni şarkı", body: h("div", {}, title, comp, style, key, bpm),
    buttons: [{ label: "İptal" }, { label: song ? "Kaydet" : "Oluştur", primary: true, onClick: () => {
      const t = title.value.trim();
      if (!t) { toast("Şarkı adı boş olamaz"); return false; }
      onOk(t, comp.value.trim(), style.value.trim(), key.value.trim(), bpm.value.trim());
    } }],
  });
  setTimeout(() => title.focus(), 50);
}

/** Dosyayı iOS paylaşım ekranıyla ("Dosyalara Kaydet") ya da indirme olarak verir. */
async function saveFile(name, mime, text) {
  const blob = new Blob([text], { type: mime });
  try {
    const file = new File([blob], name, { type: mime });
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: name }); return; }
  } catch (e) { if (e && e.name === "AbortError") return; }
  const a = h("a", { href: URL.createObjectURL(blob), download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

/** Verilen HTML'i yazdırma ekranına gönderir (iPhone'da: Paylaş → "PDF olarak kaydet"). */
async function printHtml(bodyHtml, title) {
  const old = $("#printFrame"); if (old) old.remove();
  const css = `@font-face{font-family:Hand;src:url(${new URL("caveat.ttf", document.baseURI).href}) format('truetype');font-weight:400 700}` +
    `@page{margin:14mm}body{margin:0;background:#fff;font-family:Hand,cursive}` + Sheet.CSS + Sheet.LIGHT_CSS;
  const f = h("iframe", { id: "printFrame", style: "position:fixed;left:-9999px;top:0;width:794px;height:1123px;border:0" });
  f.srcdoc = `<!doctype html><html><head><meta charset=utf-8><title>${esc(title)}</title><style>${css}</style></head><body>${bodyHtml}</body></html>`;
  document.body.append(f);
  await new Promise((r) => (f.onload = r));
  try { await f.contentDocument.fonts.ready; } catch (e) {}
  setTimeout(() => { f.contentWindow.focus(); f.contentWindow.print(); }, 150);
}
