/* Clef kitaplığı: şarkılar, playlistler, içe/dışa aktarma, MP3 deposu. Veriler bu cihazda (localStorage + IndexedDB) saklanır. */
const Lib = (() => {
  const store = { items: [], playlists: [], selectedId: null };
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(16).slice(2));
  const byId = (id) => (id ? store.items.find((e) => e.id === id) || null : null);

  function load() {
    try {
      const o = JSON.parse(localStorage.getItem("clef.lib") || "{}");
      store.items = o.items || []; store.playlists = o.playlists || []; store.selectedId = o.selectedId || null;
    } catch (e) { store.items = []; store.playlists = []; }
    for (const p of store.playlists) p.ids = p.ids.filter((id) => byId(id));
    if (!byId(store.selectedId)) store.selectedId = store.items.length ? store.items[0].id : null;
  }
  function save() { try { localStorage.setItem("clef.lib", JSON.stringify(store)); } catch (e) { toast("Kaydedilemedi: depolama dolu olabilir"); } }
  const selected = () => byId(store.selectedId);

  // ---- .clef dosyası ----
  const looksClef = (t) => t.trimStart().startsWith("{") && t.includes('"clef"');
  function clefFile(songs) {
    return JSON.stringify({ clef: 1, songs: songs.map((s) => ({ title: s.title, composer: s.composer, style: s.style, key: s.key, bpm: s.bpm, sheet: JSON.parse(s.sheet) })) }, null, 2);
  }
  function parseClef(t) {
    return JSON.parse(t).songs.map((o) => ({ title: o.title, composer: o.composer || "", style: o.style || "", key: o.key || "", bpm: o.bpm || "", sheet: JSON.stringify(o.sheet) }));
  }

  /** Metinden şarkılar: .clef dosyası ya da iReal bağlantıları (Clef düzenine çevrilerek). */
  function songsFromText(text) {
    if (looksClef(text)) { try { return parseClef(text); } catch (e) { return []; } }
    let links = IReal.findLinks(text);
    if (!links.length && text.startsWith("irealb")) links = [text];
    const out = [];
    for (const l of links) {
      let songs = []; try { songs = IReal.decode(l); } catch (e) {}
      for (const s of songs) out.push({ title: s.title, composer: s.composer, style: s.style, key: IReal.clefKey(s.key), bpm: s.bpm, sheet: Sheet.toJson(IReal.toSheet(s.chart)) });
    }
    return out;
  }

  /** Şarkıları ekler (aynısı varsa tekrar eklemez); isteğe bağlı playlist'e de koyar. İlk şarkının kimliğini döndürür. */
  function add(songs, pl) {
    let first = null;
    for (const s of songs) {
      let e = store.items.find((x) => x.song.title === s.title && x.song.sheet === s.sheet);
      if (!e) { e = { id: uid(), song: s, transpose: 0, audioName: null }; store.items.push(e); }
      if (!first) first = e.id;
      if (pl && !pl.ids.includes(e.id)) pl.ids.push(e.id);
    }
    save();
    return first;
  }
  function create(song, pl) {
    const e = { id: uid(), song, transpose: 0, audioName: null };
    store.items.push(e);
    if (pl) pl.ids.push(e.id);
    store.selectedId = e.id; save();
    return e;
  }
  function removeMany(ids) {
    const set = new Set(ids);
    store.items = store.items.filter((e) => !set.has(e.id));
    store.playlists.forEach((p) => { p.ids = p.ids.filter((id) => !set.has(id)); });
    ids.forEach((id) => audio.del(id));
    if (set.has(store.selectedId)) store.selectedId = store.items.length ? store.items[0].id : null;
    save();
  }
  function createPlaylist(name) {
    const n = name.trim();
    if (!n || store.playlists.some((p) => p.name.toLowerCase() === n.toLowerCase())) return null;
    const p = { name: n, ids: [] }; store.playlists.push(p); save(); return p;
  }
  function renamePlaylist(p, name) {
    const n = name.trim();
    if (!n || store.playlists.some((x) => x !== p && x.name.toLowerCase() === n.toLowerCase())) return false;
    p.name = n; save(); return true;
  }
  function deletePlaylist(p) { store.playlists = store.playlists.filter((x) => x !== p); save(); }
  function setMembership(p, ids, member) {
    for (const id of ids) {
      if (member && !p.ids.includes(id) && byId(id)) p.ids.push(id);
      if (!member) p.ids = p.ids.filter((x) => x !== id);
    }
    save();
  }

  // ---- MP3 deposu (IndexedDB) ----
  const audio = (() => {
    let dbp = null;
    const db = () => dbp || (dbp = new Promise((res, rej) => {
      const r = indexedDB.open("clef-audio", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("a");
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    }));
    const tx = async (mode, fn) => { const d = await db(); return new Promise((res, rej) => { const t = d.transaction("a", mode); const rq = fn(t.objectStore("a")); t.oncomplete = () => res(rq && rq.result); t.onerror = () => rej(t.error); }); };
    return {
      put: (id, blob) => tx("readwrite", (s) => s.put(blob, id)),
      get: (id) => tx("readonly", (s) => s.get(id)),
      del: (id) => tx("readwrite", (s) => s.delete(id)).catch(() => {}),
    };
  })();

  return { store, load, save, byId, selected, uid, looksClef, clefFile, songsFromText, add, create, removeMany, createPlaylist, renamePlaylist, deletePlaylist, setMembership, audio };
})();
