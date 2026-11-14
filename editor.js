/* Clef şarkı editörü: ölçü/satır düzeni, akor klavyesi, notlar, usül, tekrarlar, sürükle-bırak. */
const Editor = (() => {
  const TYPES = ["m", "7", "maj7", "m7", "dim", "dim7", "m7b5", "sus2", "sus4", "7sus4", "6", "m6", "6/9", "9", "m9", "maj9", "11", "13", "add9", "aug", "7b9", "7#9", "7#11", "7b13", "mMaj7", "5"];
  const TIMESIGS = ["4/4", "2/4", "3/4", "6/8", "12/8", "2/2", "3/8", "5/8", "7/8", "8/8", "9/8", "10/8", "11/8", "15/8", "5/4", "6/4", "7/4", "9/4"];
  const MARKS = ["3. bitiş", "Segno", "Coda", "To Coda", "Fine", "D.C.", "D.S.", "D.C. al Fine", "D.S. al Coda", "İşareti kaldır"];
  const LABELS = ["Intro", "Verse", "Chorus", "Bridge", "A", "B", "C", "Solo", "Outro", "Başka…", "Adı kaldır"];

  let probe = null;
  function cellPx() {
    if (!probe) { probe = h("div", { style: "position:absolute;visibility:hidden;width:var(--cw);height:1px" }); document.body.append(probe); }
    return probe.getBoundingClientRect().width || 24;
  }

  function open(item, onClose) {
    const root = $("#editor");
    let sheet = Sheet.fromJson(item.song.sheet);
    let sel = { l: 0, b: 0, s: 0 };
    let mode = 0, noteTarget = 0, bass = false;
    let dragJustEnded = false;

    const titleEl = h("div", { class: "et" }, item.song.title);
    const sh = h("div", { id: "edSheet", class: "sheet" });
    const sc = h("div", { id: "edScroll" }, sh);
    const tabsEl = h("div", { class: "tabs" });
    const panel = h("div", { class: "panel" });
    root.innerHTML = ""; root.hidden = false;
    root.append(
      h("div", { class: "eb" }, h("button", { style: "color:var(--accent)", onclick: close }, "‹ Bitti"), titleEl, h("button", { style: "color:#8fb4e8;font-size:14px", onclick: editInfo }, "Bilgiler")),
      sc, h("div", { id: "edBottom" }, tabsEl, panel));

    function close() { save(); root.hidden = true; root.innerHTML = ""; onClose && onClose(); }
    function save() { item.song.sheet = Sheet.toJson(sheet); Lib.save(); }
    function clamp() {
      sel.l = Math.max(0, Math.min(sel.l, sheet.lines.length - 1));
      const l = sheet.lines[sel.l];
      sel.b = Math.max(0, Math.min(sel.b, l.bars.length - 1));
      sel.s = Math.max(0, Math.min(sel.s, l.bars[sel.b].chords.length - 1));
    }
    const line = () => { clamp(); return sheet.lines[sel.l]; };
    const bar = () => { clamp(); return sheet.lines[sel.l].bars[sel.b]; };
    const curChord = () => bar().chords[sel.s];
    function select(l, b, s) { sel = { l, b, s: s || 0 }; bass = false; clamp(); render(); buildPanel(); }
    function changed(panelToo) { clamp(); save(); render(); if (panelToo) buildPanel(); }

    function editInfo() {
      infoDialog(item.song, (t, c, s, k, b) => { Object.assign(item.song, { title: t, composer: c, style: s, key: k, bpm: b }); titleEl.textContent = t; Lib.save(); });
    }
    async function editLabel(li) {
      const l = sheet.lines[li]; if (!l) return;
      const i = await choose("Bölüm adı", LABELS);
      if (i < 0) return;
      if (LABELS[i] === "Adı kaldır") l.label = "";
      else if (LABELS[i] === "Başka…") { const t = await promptText("Bölüm adı", l.label); if (t === null) return; l.label = t.trim(); }
      else l.label = LABELS[i];
      changed(true);
    }

    // ---------------- Çizim ----------------
    function render() {
      let html = "";
      sheet.lines.forEach((l, li) => {
        if (l.label) html += `<div class=sl><span class="lab" data-lab="${li}" style="cursor:pointer">${esc(l.label)}</span></div>`;
        else if (mode === 2) html += `<div><span class=addlab data-lab="${li}">＋ bölüm adı</span></div>`;
        const brs = Sheet.brackets(l);
        html += `<div class=sr data-l="${li}">`;
        l.bars.forEach((_, bi) => {
          const isSel = li === sel.l && bi === sel.b;
          html += Sheet.barHtml(l, bi, 0, false, { editor: true, li, brs, selected: isSel, sel: isSel ? { s: sel.s } : null, handle: isSel && mode === 2 });
        });
        html += "</div>";
      });
      sh.innerHTML = html;
      fixDots(); wireHandle();
      const s = sh.querySelector(".bsel");
      if (s) { const r = s.getBoundingClientRect(), c = sc.getBoundingClientRect(); if (r.bottom > c.bottom - 8 || r.top < c.top + 8) s.scrollIntoView({ block: "center" }); }
    }
    /** Akorun üstüne denk gelen boş vuruş noktalarını gizler. */
    function fixDots() {
      $$(".g", sh).forEach((g) => {
        const dots = $$(".dot", g); if (!dots.length) return;
        const txt = $(".txt", g), tw = txt ? txt.offsetWidth : 0, gw = g.offsetWidth;
        dots.forEach((d) => { const k = +d.dataset.k, n = +d.dataset.n; if (k > 0 && tw && (k / n) * gw + 4 < tw + 9) d.style.display = "none"; });
      });
    }
    function wireHandle() {
      const hd = $(".handle", sh); if (!hd) return;
      const sb = hd.closest(".sb"), b = bar(), cells = b.chords.length;
      let x0 = 0, w0 = 1, on = false;
      hd.addEventListener("pointerdown", (e) => { on = true; x0 = e.clientX; w0 = b.weight; hd.setPointerCapture(e.pointerId); e.preventDefault(); });
      hd.addEventListener("pointermove", (e) => {
        if (!on) return;
        b.weight = Math.max(1, Math.min(4, w0 + (e.clientX - x0) / (cells * cellPx())));
        sb.style.minWidth = `calc(var(--cw)*${cells * b.weight})`;
      });
      const up = () => { if (!on) return; on = false; save(); buildPanel(); };
      hd.addEventListener("pointerup", up); hd.addEventListener("pointercancel", up);
    }

    sh.addEventListener("click", (e) => {
      if (dragJustEnded) return;
      const lab = e.target.closest("[data-lab]"); if (lab) { editLabel(+lab.dataset.lab); return; }
      if (e.target.closest(".handle")) return;
      const sb = e.target.closest(".sb"); if (!sb) return;
      const g = e.target.closest(".g");
      select(+sb.dataset.l, +sb.dataset.b, g ? +g.dataset.s : 0);
    });

    // ---- Sürükle-bırak: ölçüye uzun bas, sürükle, bırak ----
    let press = null, dragging = false, ghost = null, over = null;
    sh.addEventListener("pointerdown", (e) => {
      if (e.target.closest(".handle")) return;
      const sb = e.target.closest(".sb"); if (!sb) return;
      press = { x: e.clientX, y: e.clientY, sb, timer: setTimeout(startDrag, 380) };
    });
    function startDrag() {
      if (!press) return;
      dragging = true;
      const r = press.sb.getBoundingClientRect();
      ghost = press.sb.cloneNode(true); ghost.classList.add("ghost");
      ghost.style.width = r.width + "px"; ghost.style.left = r.left + "px"; ghost.style.top = r.top + "px";
      ghost.dataset.dx = press.x - r.left; ghost.dataset.dy = press.y - r.top;
      document.body.append(ghost);
      if (navigator.vibrate) navigator.vibrate(15);
    }
    sh.addEventListener("pointermove", (e) => {
      if (!press) return;
      if (!dragging) { if (Math.hypot(e.clientX - press.x, e.clientY - press.y) > 10) { clearTimeout(press.timer); press = null; } return; }
      ghost.style.left = e.clientX - ghost.dataset.dx + "px"; ghost.style.top = e.clientY - ghost.dataset.dy + "px";
      const t = document.elementFromPoint(e.clientX, e.clientY), tb = t && t.closest(".sb");
      if (over && over !== tb) over.classList.remove("dragover");
      over = tb && tb !== press.sb ? tb : null;
      if (over) over.classList.add("dragover");
    });
    sh.addEventListener("touchmove", (e) => { if (dragging) e.preventDefault(); }, { passive: false });
    function endPress(e, cancel) {
      if (!press) return;
      clearTimeout(press.timer);
      if (dragging) {
        const from = { l: +press.sb.dataset.l, b: +press.sb.dataset.b };
        const t = !cancel && document.elementFromPoint(e.clientX, e.clientY);
        ghost.remove(); ghost = null; if (over) over.classList.remove("dragover"); over = null;
        dragJustEnded = true; setTimeout(() => (dragJustEnded = false), 80);
        const tb = t && t.closest(".sb"), tr = t && t.closest(".sr");
        press = null; dragging = false;
        if (tb && !(+tb.dataset.l === from.l && +tb.dataset.b === from.b)) {
          const r = tb.getBoundingClientRect();
          moveBar(from, +tb.dataset.l, +tb.dataset.b + (e.clientX > r.left + r.width / 2 ? 1 : 0));
        } else if (!tb && tr) moveBar(from, +tr.dataset.l, sheet.lines[+tr.dataset.l].bars.length);
        return;
      }
      press = null;
    }
    sh.addEventListener("pointerup", (e) => endPress(e, false));
    sh.addEventListener("pointercancel", (e) => endPress(e, true));
    sh.addEventListener("contextmenu", (e) => e.preventDefault());

    function moveBar(from, toLine, toIndex) {
      const src = sheet.lines[from.l], dst = sheet.lines[toLine];
      if (!src || !dst) return;
      const [b] = src.bars.splice(from.b, 1);
      let idx = toIndex; if (src === dst && from.b < toIndex) idx--;
      dst.bars.splice(Math.max(0, Math.min(idx, dst.bars.length)), 0, b);
      if (!src.bars.length) sheet.lines.splice(sheet.lines.indexOf(src), 1);
      sel = { l: sheet.lines.indexOf(dst), b: sheet.lines[sheet.lines.indexOf(dst)].bars.indexOf(b), s: 0 };
      save(); render(); buildPanel();
    }

    // ---------------- Sekmeler ----------------
    function buildTabs() {
      tabsEl.innerHTML = "";
      ["Akor", "Not", "Düzen"].forEach((n, i) => tabsEl.append(h("button", { class: mode === i ? "on" : "", onclick: () => { mode = i; bass = false; buildTabs(); render(); buildPanel(); } }, n)));
      root.dataset.mode = mode;
    }
    const rowOf = (...ks) => panel.append(h("div", { class: "kr" }, ks.map((k) =>
      h("button", { class: [k.style || "", k.on ? "on" : ""].join(" "), style: `flex:${k.w || 1}${k.h ? `;min-height:${k.h}px` : ""}`, onclick: k.click }, k.label))));
    const K = (label, o) => Object.assign({ label }, o);
    const lbl = (t) => panel.append(h("div", { class: "lbl" }, t));
    function buildPanel() { panel.innerHTML = ""; (mode === 0 ? chordPanel : mode === 1 ? notePanel : layoutPanel)(); }

    // ---------------- Akor klavyesi ----------------
    function splitChord(c) {
      let bassP = "", main = c;
      const si = c.lastIndexOf("/");
      if (si > 0 && si + 1 < c.length && c[si + 1] >= "A" && c[si + 1] <= "G" && (c.length === si + 2 || (c.length === si + 3 && "#b".includes(c[si + 2])))) { bassP = c.slice(si); main = c.slice(0, si); }
      let root = main.slice(0, 1), rest = main.slice(1);
      if (rest.startsWith("b") || rest.startsWith("#")) { root += rest[0]; rest = rest.slice(1); }
      return [root, rest, bassP];
    }
    const noChord = (c) => !c || c === "%" || c === "N.C.";
    const curType = () => { const c = curChord(); return noChord(c) ? "" : splitChord(c)[1]; };
    function setChord(s) { bar().chords[sel.s] = s; changed(true); }
    function pressRoot(r) { if (bass) { setChord(curChord().split("/")[0] + "/" + r); bass = false; } else setChord(r); }
    function pressAcc(a) { const c = curChord(); if (c && c.slice(-1) >= "A" && c.slice(-1) <= "G") setChord(c + a); }
    function pressQuality(q) {
      const c = curChord();
      if (noChord(c)) { toast("Önce kök notayı seçin"); return; }
      const [root, type, b] = splitChord(c);
      setChord(root + (type === q ? "" : q) + b);
    }
    async function moreTypes() {
      const c = curChord();
      if (noChord(c)) { toast("Önce kök notayı seçin"); return; }
      const cur = splitChord(c)[1];
      const i = await choose("Akor türü", ["(tür yok)", ...TYPES], cur ? TYPES.indexOf(cur) + 1 || -1 : 0);
      if (i < 0) return;
      const [root, , b] = splitChord(curChord());
      setChord(root + (i === 0 ? "" : TYPES[i - 1]) + b);
    }
    function backspace() {
      const c = curChord();
      if (c) { setChord(c.slice(0, -1)); return; }
      const b = bar();
      if (b.chords.length > 1) { b.chords.splice(sel.s, 1); sel.s = Math.max(0, sel.s - 1); changed(); return; }
      if (b.above || b.below) return;
      const l = line();
      if (sel.b > 0) { l.bars.splice(sel.b, 1); sel.b--; sel.s = bar().chords.length - 1; changed(true); }
      else if (sel.l > 0 && l.bars.length === 1) { sheet.lines.splice(sel.l, 1); sel.l--; sel.b = line().bars.length - 1; sel.s = bar().chords.length - 1; changed(true); }
    }
    function space() { bar().chords.splice(sel.s + 1, 0, ""); sel.s++; bass = false; changed(true); }
    function nextBar() { line().bars.splice(sel.b + 1, 0, Sheet.newBar()); sel.b++; sel.s = 0; bass = false; changed(true); }
    function newLine() { sheet.lines.splice(sel.l + 1, 0, { label: "", bars: [Sheet.newBar()] }); sel.l++; sel.b = 0; sel.s = 0; bass = false; changed(true); }

    async function timeSigDialog() {
      const b = bar();
      const i = await choose("Usül", [...TIMESIGS, "Başka…", "Usulü kaldır"], TIMESIGS.indexOf(b.ts));
      if (i < 0) return;
      if (i < TIMESIGS.length) b.ts = TIMESIGS[i];
      else if (i === TIMESIGS.length) {
        const t = await promptText("Usül", b.ts, "Tamam", "örn. 13/8");
        if (t === null) return;
        if (/^\d{1,2}\/\d{1,2}$/.test(t.trim())) b.ts = t.trim(); else { toast("Usül 5/8 gibi yazılmalı"); return; }
      } else b.ts = "";
      changed(true);
    }
    async function marksDialog() {
      const i = await choose("Ölçü işareti", MARKS);
      if (i < 0) return;
      const b = bar();
      if (i === 0) b.ending = b.ending === 3 ? 0 : 3; else if (i === MARKS.length - 1) { b.mark = ""; b.ending = 0; } else b.mark = MARKS[i];
      changed(true);
    }

    function chordPanel() {
      const b = bar(), t = curType();
      lbl("KÖK");
      rowOf(..."C D E F G A B".split(" ").map((r) => K(r, { click: () => pressRoot(r) })));
      rowOf(K("♭", { style: "q", click: () => pressAcc("b") }), K("♯", { style: "q", click: () => pressAcc("#") }),
        K("/ bas", { w: 1.4, style: "q", on: bass, click: () => { bass = !bass; buildPanel(); } }));
      lbl("TÜR");
      const q1 = ["m", "7", "maj7", "m7", "dim"], q2 = ["sus4", "6", "9", "m7b5"];
      rowOf(...q1.map((q) => K(q, { style: "q", on: t === q, click: () => pressQuality(q) })));
      const other = t && !q1.includes(t) && !q2.includes(t);
      rowOf(...q2.map((q) => K(q, { style: "q", on: t === q, click: () => pressQuality(q) })), K(other ? t + " ▾" : "Diğer ▾", { w: 1.3, style: "q", on: !!other, click: moreTypes }));
      rowOf(K("Bölüm", { style: "st", click: () => editLabel(sel.l) }), K(b.ts || "Usül", { style: "st", on: !!b.ts, click: timeSigDialog }),
        K("␣ boşluk", { w: 1.4, click: space }), K("%", { w: 0.6, style: "st", click: () => setChord("%") }), K("N.C.", { w: 0.8, style: "st", click: () => setChord("N.C.") }));
      rowOf(K("|:", { style: "st", on: b.repStart, click: () => { b.repStart = !b.repStart; changed(true); } }), K(":|", { style: "st", on: b.repEnd, click: () => { b.repEnd = !b.repEnd; changed(true); } }),
        K("1.", { style: "st", on: b.ending === 1, click: () => { b.ending = b.ending === 1 ? 0 : 1; changed(true); } }),
        K("2.", { style: "st", on: b.ending === 2, click: () => { b.ending = b.ending === 2 ? 0 : 2; changed(true); } }),
        K(b.mark ? b.mark + " ▾" : "İşaret ▾", { w: 1.8, style: "st", on: !!b.mark, click: marksDialog }));
      rowOf(K("⌫", { w: 0.7, style: "st", click: backspace }), K("↵ Satır", { style: "st", click: newLine }), K("| Sonraki ölçü ›", { w: 2, style: "p", click: nextBar }));
    }

    // ---------------- Notlar ----------------
    function notePanel() {
      const b = bar();
      const field = ["above", "text", "below"][noteTarget], szField = ["aboveSz", "textSz", "belowSz"][noteTarget];
      lbl("NOTUN YERİ");
      rowOf(K("▲ Akor üstü", { style: "q", on: noteTarget === 0, click: () => { noteTarget = 0; buildPanel(); } }),
        K("■ Ölçü", { w: 0.8, style: "q", on: noteTarget === 1, click: () => { noteTarget = 1; buildPanel(); } }),
        K("▼ Akor altı", { style: "q", on: noteTarget === 2, click: () => { noteTarget = 2; buildPanel(); } }));
      const inp = h("input", { class: "ntin" + (noteTarget === 1 ? "" : " red"), value: b[field], placeholder: noteTarget === 1 ? "Ölçüye not (akor rengiyle)" : "Not yaz (ör. keman girer)", autocomplete: "off" });
      inp.addEventListener("input", () => { bar()[field] = inp.value; changed(); });
      panel.append(inp);
      const val = h("span", { style: "min-width:28px;text-align:center" }, b[szField]);
      const rng = h("input", { type: "range", min: 10, max: 36, value: b[szField] });
      rng.addEventListener("input", () => { bar()[szField] = +rng.value; val.textContent = rng.value; render(); });
      rng.addEventListener("change", save);
      panel.append(h("div", { class: "ctl" }, "Yazı boyutu", rng, val));
      rowOf(K("Notu sil", { style: "st", click: () => { inp.value = ""; bar()[field] = ""; changed(); } }),
        K("Sonraki ölçü ›", { w: 1.5, style: "p", click: () => {
          const l = line();
          if (sel.b < l.bars.length - 1) sel.b++; else if (sel.l < sheet.lines.length - 1) { sel.l++; sel.b = 0; } else return;
          sel.s = 0; changed(true);
        } }));
    }

    // ---------------- Düzen ----------------
    async function deleteLine() {
      const l = line();
      const filled = l.bars.some((b) => !Sheet.barBlank(b));
      if (filled && !(await confirmBox("Bu satır silinsin mi?", "Sil"))) return;
      sheet.lines.splice(sheet.lines.indexOf(l), 1);
      if (!sheet.lines.length) sheet.lines.push({ label: "", bars: [Sheet.newBar()] });
      sel.b = 0; sel.s = 0; changed(true);
    }
    function layoutPanel() {
      const b = bar();
      const rng = h("input", { type: "range", min: 0, max: 100, value: Math.round(((b.weight - 1) / 2.5) * 100) });
      rng.addEventListener("input", () => { bar().weight = 1 + (rng.value / 100) * 2.5; render(); });
      rng.addEventListener("change", save);
      panel.append(h("div", { class: "ctl" }, "Ek genişlik", rng));
      rowOf(K("Genişliği sıfırla", { style: "q", click: () => { line().bars.forEach((x) => (x.weight = 1)); changed(true); } }),
        K("Bölüm adı", { style: "q", click: () => editLabel(sel.l) }), K("Satırı sil", { style: "q", click: deleteLine }));
      panel.append(h("div", { class: "hint" }, "Genişlik için seçili ölçünün sağındaki sarı tutamacı sürükle. Taşımak için ölçüye uzun bas, sürükle ve bırak."));
    }

    buildTabs(); render(); buildPanel();
  }
  return { open };
})();
