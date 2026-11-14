/* Clef: kitaplık, görüntüleyici, çekmece menü, dışa aktarma, MP3 oynatıcı. */
(() => {
  document.head.append(h("style", {}, Sheet.CSS));   // şarkı sayfası stilleri
  Lib.load();
  let activePl = null, query = "", shown = [], selMode = false;
  const picked = new Set();
  const norm = (s) => s.toLocaleLowerCase("tr").normalize("NFD").replace(/\p{M}+/gu, "").replace(/ı/g, "i");
  const sel = () => Lib.selected();

  // ---------------- Çekmece ----------------
  const openDrawer = () => { $("#drawer").classList.add("on"); $("#scrim").classList.add("on"); };
  const closeDrawer = () => { $("#drawer").classList.remove("on"); $("#scrim").classList.remove("on"); };
  $("#btnMenu").onclick = openDrawer; $("#scrim").onclick = closeDrawer;

  // ---------------- Görüntüleyici ----------------
  function refresh() {
    refreshChips(); refreshList();
    const e = sel(), sheet = $("#sheet");
    $("#empty").hidden = !!e; $("#btnEdit").hidden = !e;
    if (!e) { sheet.innerHTML = ""; $("#songTitle").textContent = ""; $("#trVal").textContent = "0"; renderPlayer(); return; }
    const l = currentList(), pos = l.findIndex((x) => x.id === e.id);
    $("#songTitle").textContent = l.length > 1 && pos >= 0 ? `${e.song.title}  (${pos + 1}/${l.length})` : e.song.title;
    $("#trVal").textContent = e.transpose > 0 ? "+" + e.transpose : String(e.transpose);
    sheet.innerHTML = Sheet.songHtml(e.song, e.transpose);
    renderPlayer();
  }
  function transpose(d) { const e = sel(); if (!e) return; e.transpose = (((e.transpose + d + 6) % 12) + 12) % 12 - 6; Lib.save(); refresh(); }
  $("#trMinus").onclick = () => transpose(-1); $("#trPlus").onclick = () => transpose(1);
  $("#trVal").onclick = () => { const e = sel(); if (e) { e.transpose = 0; Lib.save(); refresh(); } };
  $("#btnEdit").onclick = () => { const e = sel(); if (e) Editor.open(e, refresh); };

  const currentList = () => (shown.some((x) => x.id === Lib.store.selectedId) ? shown : Lib.store.items);
  function go(d) {
    const l = currentList(), i = l.findIndex((x) => x.id === Lib.store.selectedId);
    if (i < 0) return;
    const n = i + d;
    if (n < 0 || n >= l.length) { toast(d > 0 ? "Listenin sonu" : "Listenin başı"); return; }
    Lib.store.selectedId = l[n].id; Lib.save(); refresh(); $("#view").scrollTop = 0;
  }
  // yatay kaydırma: sola = sonraki şarkı, sağa = önceki
  (() => {
    let t0 = null;
    const v = $("#view");
    v.addEventListener("touchstart", (e) => { t0 = e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() } : null; }, { passive: true });
    v.addEventListener("touchend", (e) => {
      if (!t0) return;
      const t = e.changedTouches[0], dx = t.clientX - t0.x, dy = t.clientY - t0.y, dt = Date.now() - t0.t;
      if (Math.abs(dx) > 100 && Math.abs(dx) > Math.abs(dy) * 2 && dt < 600) go(dx < 0 ? 1 : -1);
      t0 = null;
    }, { passive: true });
  })();

  // ---------------- Liste ----------------
  function refreshChips() {
    if (activePl && !Lib.store.playlists.includes(activePl)) activePl = null;
    const c = $("#chips"); c.innerHTML = "";
    c.append(h("button", { class: "chip" + (!activePl ? " on" : ""), onclick: () => { activePl = null; refresh(); } }, `Tümü (${Lib.store.items.length})`));
    for (const p of Lib.store.playlists) c.append(h("button", { class: "chip" + (activePl === p ? " on" : ""), onclick: () => { activePl = p; refresh(); } }, `${p.name} (${p.ids.length})`));
    c.append(h("button", { class: "chip", onclick: () => newPlaylist() }, "＋ Yeni liste"));
    $("#plActions").hidden = !activePl; $("#plName").textContent = activePl ? "Liste: " + activePl.name : "";
  }
  function refreshList() {
    const base = activePl ? activePl.ids.map(Lib.byId).filter(Boolean) : Lib.store.items;
    const q = norm(query.trim());
    shown = q ? base.filter((e) => norm(`${e.song.title} ${e.song.composer} ${e.song.style} ${e.song.key}`).includes(q)) : base;
    for (const id of [...picked]) if (!Lib.byId(id)) picked.delete(id);
    $("#selCount").textContent = `${picked.size} şarkı seçili`;
    $("#sRemove").hidden = !activePl;
    const ul = $("#list"); ul.innerHTML = "";
    for (const e of shown) {
      const isSel = e.id === Lib.store.selectedId, isPk = picked.has(e.id);
      const sub = [e.song.composer, e.song.style].filter((x) => x && x !== "-" && x !== ".").join(" · ");
      const li = h("li", { class: (isPk ? "pk " : "") + (isSel && !selMode ? "sel" : "") },
        selMode ? h("span", { style: `font-size:22px;color:${isPk ? "var(--accent)" : "#888"}` }, isPk ? "☑" : "☐") : null,
        h("div", { class: "m" }, h("div", { class: "t" }, e.song.title), sub ? h("div", { class: "s" }, sub) : null),
        selMode ? null : h("button", { class: "mo", onclick: (ev) => { ev.stopPropagation(); songMenu(e); } }, "⋯"));
      li.onclick = () => { if (selMode) { picked.has(e.id) ? picked.delete(e.id) : picked.add(e.id); refreshList(); } else { Lib.store.selectedId = e.id; Lib.save(); refresh(); closeDrawer(); } };
      let lp = null;
      li.addEventListener("pointerdown", () => { if (!selMode) lp = setTimeout(() => { lp = "fired"; setSel(true); picked.add(e.id); refreshList(); }, 500); });
      const cancel = () => { if (lp && lp !== "fired") clearTimeout(lp); };
      li.addEventListener("pointerup", cancel); li.addEventListener("pointerleave", cancel); li.addEventListener("pointermove", cancel);
      ul.append(li);
    }
  }
  $("#search").addEventListener("input", (e) => { query = e.target.value; refreshList(); });

  function setSel(on) {
    selMode = on; if (!on) picked.clear();
    $("#btnSelect").textContent = on ? "Bitti" : "Seç"; $("#selBar").hidden = !on; refreshList();
  }
  $("#btnSelect").onclick = () => setSel(!selMode);
  const needPicked = () => { if (!picked.size) toast("Önce şarkı seçin"); return picked.size > 0; };
  $("#sAll").onclick = () => { const ids = shown.map((e) => e.id); if (ids.length && ids.every((i) => picked.has(i))) ids.forEach((i) => picked.delete(i)); else ids.forEach((i) => picked.add(i)); refreshList(); };
  $("#sAdd").onclick = async () => { if (needPicked()) { const ok = await addToPlaylists([...picked]); if (ok) { setSel(false); refresh(); } } };
  $("#sRemove").onclick = () => { if (!activePl || !needPicked()) return; const n = [...picked].filter((i) => activePl.ids.includes(i)).length; Lib.setMembership(activePl, [...picked], false); toast(`${n} şarkı “${activePl.name}” listesinden çıkarıldı`); setSel(false); refresh(); };
  $("#sDel").onclick = async () => { if (!needPicked()) return; if (await confirmBox(`${picked.size} şarkı kitaplıktan silinsin mi?`, "Sil")) { Lib.removeMany([...picked]); setSel(false); refresh(); } };
  $("#sExport").onclick = () => { if (needPicked()) exportDialog([...picked].map(Lib.byId).filter(Boolean), activePl ? activePl.name : "Clef şarkılar"); };

  // ---------------- Playlistler ----------------
  async function newPlaylist() {
    const n = await promptText("Yeni playlist", "", "Oluştur");
    if (n === null) return null;
    const p = Lib.createPlaylist(n);
    if (!p) { toast("Ad boş olamaz veya bu adla bir liste var"); return null; }
    activePl = p; refresh(); return p;
  }
  $("#plRename").onclick = async () => { if (!activePl) return; const n = await promptText("Playlist adı", activePl.name, "Kaydet"); if (n !== null) { if (!Lib.renamePlaylist(activePl, n)) toast("Geçersiz veya var olan ad"); refresh(); } };
  $("#plDelete").onclick = async () => { if (activePl && await confirmBox(`“${activePl.name}” listesi silinsin mi? (Şarkılar kitaplıkta kalır.)`, "Sil")) { Lib.deletePlaylist(activePl); activePl = null; refresh(); } };

  /** Çoklu seçim penceresi: "ok" / "new" / "cancel" döndürür. */
  function multiChoose(title, names, checked) {
    return new Promise((res) => {
      let done = false; const fin = (v) => { if (!done) { done = true; res(v); } };
      const boxes = names.map((n, i) => h("input", { type: "checkbox", checked: checked[i], style: "width:22px;height:22px;margin:0 12px 0 0;flex:none" }));
      modal({
        title, onCancel: () => fin({ r: "cancel" }),
        body: h("div", {}, names.map((n, i) => h("label", { style: "display:flex;align-items:center;padding:10px 0;font-size:16px" }, boxes[i], n))),
        buttons: [{ label: "İptal", onClick: () => fin({ r: "cancel" }) }, { label: "Yeni liste…", onClick: () => fin({ r: "new" }) }, { label: "Tamam", primary: true, onClick: () => fin({ r: "ok", checked: boxes.map((b) => b.checked) }) }],
      });
    });
  }
  /** Şarkıları (kimlikler) seçilen listelere ekler. Tek şarkıda mevcut üyelik işaretli gelir ve kaldırma da yapılabilir. */
  async function addToPlaylists(ids) {
    const mk = async (p) => { Lib.setMembership(p, ids, true); toast(`${ids.length} şarkı “${p.name}” listesine eklendi`); return true; };
    if (!Lib.store.playlists.length) { const p = await newPlaylist(); return p ? mk(p) : false; }
    const single = ids.length === 1;
    const pre = Lib.store.playlists.map((p) => single && p.ids.includes(ids[0]));
    const r = await multiChoose(single ? "Listeye ekle" : `${ids.length} şarkıyı şu listelere ekle`, Lib.store.playlists.map((p) => p.name), pre);
    if (r.r === "new") { const p = await newPlaylist(); return p ? mk(p) : false; }
    if (r.r !== "ok") return false;
    Lib.store.playlists.forEach((p, i) => { if (single) Lib.setMembership(p, ids, r.checked[i]); else if (r.checked[i]) Lib.setMembership(p, ids, true); });
    return true;
  }

  async function songMenu(e) {
    const opts = ["Düzenle", "Listeye ekle…", "Dışa aktar…"]; if (activePl) opts.push("Bu listeden çıkar"); opts.push("Şarkıyı sil");
    const i = await choose(e.song.title, opts); if (i < 0) return;
    const o = opts[i];
    if (o === "Düzenle") { Lib.store.selectedId = e.id; Lib.save(); closeDrawer(); refresh(); Editor.open(e, refresh); }
    else if (o === "Listeye ekle…") { await addToPlaylists([e.id]); refresh(); }
    else if (o === "Dışa aktar…") exportDialog([e], e.song.title);
    else if (o === "Bu listeden çıkar") { Lib.setMembership(activePl, [e.id], false); refresh(); }
    else if (await confirmBox(`“${e.song.title}” kitaplıktan silinsin mi?`, "Sil")) { Lib.removeMany([e.id]); refresh(); }
  }

  // ---------------- İçe aktarma ----------------
  function importSongs(all) {
    if (!all.length) { toast("iReal bağlantısı ya da .clef şarkısı bulunamadı"); return; }
    const before = Lib.store.items.length;
    Lib.store.selectedId = Lib.add(all, activePl); Lib.save();
    toast(`${Lib.store.items.length - before} yeni şarkı eklendi` + (activePl ? ` · “${activePl.name}” listesine konuldu` : ""));
    closeDrawer(); refresh();
  }
  $("#btnOpen").onclick = () => $("#fileIn").click();
  $("#fileIn").onchange = async (e) => {
    const files = [...e.target.files]; e.target.value = "";
    if (!files.length) return;
    const per = await Promise.all(files.map(async (f) => Lib.songsFromText(await f.text())));
    const none = per.filter((p) => !p.length).length;
    importSongs(per.flat());
    if (files.length > 1 && none) toast(`${files.length} dosyadan ${none} tanesinde şarkı bulunamadı`);
  };
  $("#btnPaste").onclick = () => {
    const ta = h("textarea", { placeholder: "irealb:// bağlantısını ya da .clef metnini buraya yapıştırın" });
    modal({ title: "Yapıştır", body: ta, buttons: [{ label: "İptal" }, { label: "Ekle", primary: true, onClick: () => importSongs(Lib.songsFromText(ta.value)) }] });
    navigator.clipboard && navigator.clipboard.readText && navigator.clipboard.readText().then((t) => { if (t && !ta.value) ta.value = t; }).catch(() => {});
  };
  $("#btnNew").onclick = () => infoDialog(null, (t, c, s, k, b) => {
    const e = Lib.create({ title: t, composer: c, style: s, key: k, bpm: b, sheet: Sheet.toJson(Sheet.blankSheet()) }, activePl);
    closeDrawer(); refresh(); Editor.open(e, refresh);
  });

  // ---------------- Dışa aktarma ----------------
  const safeName = (n) => n.replace(/[\\/:*?"<>|]/g, "_").trim() || "Clef";
  async function exportDialog(list, base) {
    if (!list.length) { toast("Dışa aktarılacak şarkı yok"); return; }
    const i = await choose(`Dışa aktar · ${list.length} şarkı`, ["Clef dosyası (.clef)", "PDF"]); if (i < 0) return;
    if (i === 0) saveFile(safeName(base) + ".clef", "application/json", Lib.clefFile(list.map((e) => e.song)));
    else {
      const body = list.map((e, k) => `<div class="sheet sheet-light" style="${k ? "page-break-before:always" : ""}">${Sheet.songHtml(e.song, e.transpose)}</div>`).join("");
      toast("PDF hazırlanıyor. Açılan ekranda “PDF olarak kaydet”i seçin."); printHtml(body, safeName(base));
    }
  }

  // ---------------- MP3 oynatıcı ----------------
  let au = null, auId = null, auUrl = null;
  const fmt = (s) => { s = Math.floor(s || 0); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
  function releaseAudio() { if (au) { au.pause(); au.removeAttribute("src"); au.load(); } if (auUrl) URL.revokeObjectURL(auUrl); au = null; auId = null; auUrl = null; }
  async function renderPlayer() {
    const f = $("#player"), e = sel();
    f.innerHTML = "";
    if (!e) { releaseAudio(); f.hidden = true; return; }
    f.hidden = false;
    if (!e.audioName) { releaseAudio(); f.append(h("button", { class: "pl", onclick: pickAudio }, "♪  MP3 yükle")); return; }
    if (auId !== e.id) {
      releaseAudio();
      const blob = await Lib.audio.get(e.id).catch(() => null);
      if (!blob) { e.audioName = null; Lib.save(); return renderPlayer(); }
      auUrl = URL.createObjectURL(blob); au = new Audio(auUrl); auId = e.id;
    }
    const play = h("button", {}, au.paused ? "▶" : "⏸"), seek = h("input", { type: "range", min: 0, max: 1000, value: 0 }), time = h("span", { class: "pt" }, "0:00 / 0:00");
    let seeking = false;
    const upd = () => { if (!au) return; if (!seeking) seek.value = au.duration ? (au.currentTime / au.duration) * 1000 : 0; time.textContent = `${fmt(au.currentTime)} / ${fmt(au.duration)}`; play.textContent = au.paused ? "▶" : "⏸"; };
    au.ontimeupdate = upd; au.onloadedmetadata = upd; au.onended = upd; au.onpause = upd; au.onplay = upd;
    play.onclick = () => (au.paused ? au.play() : au.pause());
    seek.oninput = () => { seeking = true; time.textContent = `${fmt((seek.value / 1000) * au.duration)} / ${fmt(au.duration)}`; };
    seek.onchange = () => { au.currentTime = (seek.value / 1000) * au.duration; seeking = false; };
    f.append(h("div", { class: "pn" }, "♪ " + e.audioName), h("div", { class: "pr" },
      h("button", { onclick: () => (au.currentTime = Math.max(0, au.currentTime - 5)) }, "⏪5"), play,
      h("button", { onclick: () => (au.currentTime = Math.min(au.duration || 0, au.currentTime + 5)) }, "5⏩"), seek, time,
      h("button", { style: "background:none;font-size:22px", onclick: audioMenu }, "⋯")));
    upd();
  }
  const pickAudio = () => { if (!sel()) { toast("Önce bir şarkı seçin"); return; } $("#audioIn").click(); };
  $("#audioIn").onchange = async (ev) => {
    const f = ev.target.files[0]; ev.target.value = ""; const e = sel(); if (!f || !e) return;
    try { releaseAudio(); await Lib.audio.put(e.id, f); e.audioName = f.name; Lib.save(); toast(`“${f.name}” bu şarkıya yüklendi`); } catch (x) { toast("MP3 yüklenemedi"); }
    renderPlayer();
  };
  async function audioMenu() {
    const e = sel(); if (!e) return;
    const i = await choose(e.audioName || "MP3", ["Başka MP3 yükle", "MP3'ü kaldır"]);
    if (i === 0) pickAudio(); else if (i === 1) { releaseAudio(); await Lib.audio.del(e.id); e.audioName = null; Lib.save(); renderPlayer(); }
  }
  addEventListener("pagehide", () => { if (au) au.pause(); });

  // ---------------- Başlangıç ----------------
  refresh();
  if (!Lib.store.items.length) openDrawer();
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) navigator.serviceWorker.register("sw.js").catch(() => {});
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
})();
