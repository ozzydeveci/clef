/* Clef: iReal bağlantısı çözme, Clef düzenine çevirme, transpoze. (Android sürümündeki IReal.kt'nin karşılığı) */
(function (root) {
  const PREFIX = "1r34LbKcu7";
  const ROW_CELLS = 16;
  const CHORD_END = " ,|[]{}Z<*Y";

  const findLinks = (t) => t.match(/irealb(?:ook)?:\/\/[^\s"'<>]+/g) || [];

  function obf50(s) {
    const a = s.split("");
    for (let i = 0; i < 5; i++) { a[49 - i] = s[i]; a[i] = s[49 - i]; }
    for (let i = 10; i < 24; i++) { a[49 - i] = s[i]; a[i] = s[49 - i]; }
    return a.join("");
  }
  function scramble(input) {
    let s = input, r = "";
    while (s.length > 50) {
      const p = s.slice(0, 50); s = s.slice(50);
      r += s.length < 2 ? p : obf50(p);
    }
    return r + s;
  }
  const expand = (t) => t.split("XyQ").join("   ").split("LZ").join(" |").split("Kcl").join("| x");
  const safeDecode = (s) => { try { return decodeURIComponent(s); } catch (e) { return unescape(s); } };

  /** Bir bağlantıdan bir veya birden çok şarkı çıkarır: {title, composer, style, key, bpm, chart} */
  function decode(link) {
    const isPro = link.startsWith("irealb://");
    const decoded = safeDecode(link.slice(link.indexOf("://") + 3));
    const songs = [];
    for (const chunk of decoded.split("===")) {
      const parts = chunk.split("=");
      if (isPro) {
        const mi = parts.findIndex((p) => p.startsWith(PREFIX));
        if (mi < 0) continue;
        const chart = expand(scramble(parts[mi].slice(PREFIX.length)));
        songs.push({ title: parts[0] || "", composer: parts[1] || "", style: parts[3] || "", key: parts[4] || "", bpm: parts[mi + 2] || "", chart });
      } else {
        if (parts.length < 6) continue;
        songs.push({ title: parts[0], composer: parts[1], style: parts[2], key: parts[3], bpm: "", chart: parts[5] });
      }
    }
    return songs;
  }

  // ---------------- Transpoze ----------------
  const SHARP = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const FLAT = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
  const BASE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

  /** "Bb" -> {p: 10, len: 2}. Nota değilse null. */
  function note(s, at) {
    if (at >= s.length) return null;
    const base = BASE[s[at]];
    if (base === undefined) return null;
    let p = base, len = 1;
    if (at + 1 < s.length) { if (s[at + 1] === "#") { p++; len = 2; } else if (s[at + 1] === "b") { p--; len = 2; } }
    return { p: ((p % 12) + 12) % 12, len };
  }
  const shiftNote = (p, shift, flats) => { const q = (((p + shift) % 12) + 12) % 12; return flats ? FLAT[q] : SHARP[q]; };

  function isMinorKey(key, n) { const rest = key.slice(n.len); return key.includes("-") || (rest.startsWith("m") && !rest.startsWith("maj")); }

  function useFlats(key, shift) {
    const n = note(key, 0);
    if (!n) return shift < 0;
    const target = (n.p + shift + 120) % 12;
    const flatMajor = [5, 10, 3, 8, 1, 6], flatMinor = [2, 7, 0, 5, 10, 3];
    return (isMinorKey(key, n) ? flatMinor : flatMajor).includes(target);
  }
  function transposeKey(key, shift) {
    if (shift === 0) return key;
    const n = note(key, 0);
    if (!n) return key;
    return shiftNote(n.p, shift, useFlats(key, shift)) + key.slice(n.len);
  }
  function transposeChord(raw, shift, flats) {
    if (shift === 0) return raw;
    const r = note(raw, 0);
    if (!r) return raw;
    let out = shiftNote(r.p, shift, flats) + raw.slice(r.len);
    const si = out.lastIndexOf("/");
    if (si > 0) {
      const bn = note(out, si + 1);
      if (bn) out = out.slice(0, si + 1) + shiftNote(bn.p, shift, flats) + out.slice(si + 1 + bn.len);
    }
    return out;
  }

  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  /** Akorun görüntü HTML'i: kök kalın, tür küçük, bas notası mavi. */
  function chordHtml(raw0, shift, flats) {
    if (["%", "%%", "/", "N.C."].includes(raw0)) return `<span class=sp>${esc(raw0)}</span>`;
    const raw = transposeChord(raw0, shift, flats);
    let bassAt = -1;
    const si = raw.lastIndexOf("/");
    if (si > 0) { const bn = note(raw, si + 1); if (bn && si + 1 + bn.len === raw.length) bassAt = si; }
    const main = bassAt > 0 ? raw.slice(0, bassAt) : raw;
    const bass = bassAt > 0 ? raw.slice(bassAt + 1) : "";
    let root = main.slice(0, 1), q = main.slice(1);
    if (q.startsWith("b") || q.startsWith("#")) { root += q[0]; q = q.slice(1); }
    q = q.split("^").join("maj").split("h").join("ø").split("o").join("dim");
    const bassHtml = bassAt > 0 ? `/<span class=bs>${esc(bass)}</span>` : "";
    return `<span class=r>${esc(root)}</span><span class=q>${esc(q)}${bassHtml}</span>`;
  }

  // ---------------- Clef düzenine çevirme ----------------
  /** C-7 -> Cm7, Bb^7 -> Bbmaj7, Gh7 -> Gm7b5, Eo7 -> Edim7 */
  function clefChord(raw) {
    const n = note(raw, 0);
    if (!n) return raw;
    const rootS = raw.slice(0, n.len);
    let rest = raw.slice(n.len), bass = "";
    const si = rest.lastIndexOf("/");
    if (si >= 0 && note(rest, si + 1)) { bass = rest.slice(si); rest = rest.slice(0, si); }
    rest = rest.split("-^").join("mMaj").replace(/\^(?!\d)/g, "maj7").split("^").join("maj")
      .split("-").join("m").split("h7").join("m7b5").split("h").join("m7b5")
      .split("o7").join("dim7").split("o").join("dim").split("+").join("aug");
    return rootS + rest + bass;
  }
  const clefKey = (k) => k.split("-").join("m");
  const secName = (c) => (c === "i" ? "Intro" : c === "v" ? "Verse" : c);

  /** iReal akor dizisi -> Sheet {lines:[{label,bars:[bar]}]} */
  function toSheet(s) {
    const lines = [];
    let bars = [], rowCells = 0, label = "", cells = [];
    let below = "", above = "", repStart = false, ending = 0, mark = "", ts = "";
    const closeLine = () => { if (bars.length) lines.push({ label, bars }); bars = []; rowCells = 0; label = ""; };
    const closeBar = (repEnd) => {
      if (!cells.length) {
        if (repEnd && bars.length) bars[bars.length - 1].repEnd = true;
        else if (repEnd && lines.length) { const lb = lines[lines.length - 1].bars; lb[lb.length - 1].repEnd = true; }
        return;
      }
      bars.push(Sheet.newBar({ chords: cells, above, below, repStart, repEnd, ending, mark, ts }));
      rowCells += cells.length;
      cells = []; below = ""; above = ""; repStart = false; ending = 0; mark = ""; ts = "";
    };
    let i = 0;
    while (i < s.length) {
      const c = s[i];
      if (rowCells + cells.length >= ROW_CELLS) {
        if (c === "|" || c === "}" || c === "]" || c === "Z") { closeBar(c === "}"); closeLine(); i++; continue; }
        if (cells.every((x) => x === "")) cells = []; else closeBar(false);
        closeLine();
      }
      const d1 = s[i + 1], d2 = s[i + 2];
      const isDigit = (x) => x !== undefined && x >= "0" && x <= "9";
      if (c === "*" && d1 !== undefined && /[A-Za-z]/.test(d1)) { label = secName(d1); i += 2; }
      else if (c === "T" && isDigit(d1) && isDigit(d2)) { ts = d1 === "1" && d2 === "2" ? "12/8" : `${d1}/${d2}`; i += 3; }
      else if (c === "N" && isDigit(d1)) { ending = +d1; i += 2; }
      else if (c === "<") {
        let e = s.indexOf(">", i); if (e < 0) e = s.length;
        const txt = s.slice(i + 1, e).replace(/^\*\d+/, "").trim();
        if (txt) above = above ? above + " " + txt : txt;
        i = e + 1;
      }
      else if (c === "{") { closeBar(false); repStart = true; i++; }
      else if (c === "}") { closeBar(true); i++; }
      else if (c === "|" || c === "[" || c === "]" || c === "Z") { closeBar(false); i++; }
      else if (c === "Q") { mark = "Coda"; i++; }
      else if (c === "S") { mark = "Segno"; i++; }
      else if (c === " ") { cells.push(""); i++; }
      else if (c === "x") { cells.push("%"); i++; }
      else if (c === "r") { cells.push("%%"); i++; }
      else if (c === "p") { cells.push("/"); i++; }
      else if (c === "n") { cells.push("N.C."); i++; }
      else if (c >= "A" && c <= "G") {
        let j = i + 1;
        while (j < s.length) {
          if (s[j] === "(") { const e = s.indexOf(")", j); j = e < 0 ? s.length : e + 1; continue; }
          if (CHORD_END.includes(s[j])) break;
          j++;
        }
        const raw = s.slice(i, j), p = raw.indexOf("(");
        const main = p > 0 ? raw.slice(0, p) : raw;
        if (p > 0) below = below ? below + " " + raw.slice(p) : raw.slice(p);
        cells.push(clefChord(main));
        i = j;
      }
      else i++;
    }
    if (cells.every((x) => x === "")) cells = [];   // satır sonu boşlukları ölçü olmasın
    closeBar(false); closeLine();
    if (!lines.length) lines.push({ label: "", bars: [Sheet.newBar()] });
    return { lines };
  }

  root.IReal = { findLinks, decode, scramble, expand, note, useFlats, transposeKey, transposeChord, chordHtml, clefChord, clefKey, toSheet, esc };
})(typeof window !== "undefined" ? window : globalThis);
