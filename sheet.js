/* Clef: şarkı düzeni (Sheet) modeli ve HTML çizimi. Android sürümündeki Sheet.kt'nin karşılığı; JSON biçimi aynıdır (.clef uyumlu). */
(function (root) {
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  function newBar(o) {
    return Object.assign({
      chords: [""], weight: 1, above: "", below: "", text: "", aboveSz: 16, belowSz: 16, textSz: 20,
      repStart: false, repEnd: false, ending: 0, mark: "", ts: "",
    }, o || {});
  }
  const hasChords = (b) => b.chords.some((c) => c !== "");
  const head = (b) => [b.mark, b.above].filter(Boolean).join("  ");
  const barBlank = (b) => !hasChords(b) && !b.above && !b.below && !b.text && !b.mark && !b.ts && !b.ending && !b.repStart && !b.repEnd;
  const lineBlank = (l) => l.bars.every(barBlank);
  const blankSheet = () => ({ lines: [{ label: "", bars: [newBar()] }] });

  /** 1./2. bitiş çizgileri: 1. bitiş tekrar (:|) olan ölçüye kadar ve kapalı; 2./3. bitiş ucu açık. */
  function brackets(line) {
    const r = new Array(line.bars.length).fill(null);
    line.bars.forEach((b, i) => {
      const n = b.ending;
      if (n <= 0) return;
      let end = i;
      for (let j = i; j < line.bars.length; j++) {
        if (j > i && (line.bars[j].ending > 0 || (n !== 1 && line.bars[j].repStart))) break;
        end = j;
        if (line.bars[j].repEnd) break;
      }
      for (let k = i; k <= end; k++) r[k] = { num: n, start: k === i, end: k === end, closed: n === 1 };
    });
    return r;
  }

  function toJson(sheet) {
    return JSON.stringify({
      v: 2,
      lines: sheet.lines.map((l) => ({
        label: l.label,
        bars: l.bars.map((b) => ({
          c: b.chords, w: b.weight, a: b.above, b: b.below, t: b.text, as: b.aboveSz, bs: b.belowSz, ts: b.textSz,
          rs: b.repStart, re: b.repEnd, en: b.ending, mk: b.mark, us: b.ts,
        })),
      })),
    });
  }
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  function fromJson(s) {
    try {
      const o = typeof s === "string" ? JSON.parse(s) : s;
      const lines = o.lines.map((l) => ({
        label: l.label || "",
        bars: l.bars.map((b) => newBar({
          chords: b.c && b.c.length ? b.c.slice() : [""], weight: clamp(+b.w || 1, 1, 4),
          above: b.a || "", below: b.b || "", text: b.t || "",
          aboveSz: clamp(b.as || 16, 10, 36), belowSz: clamp(b.bs || 16, 10, 36), textSz: clamp(b.ts || 20, 10, 36),
          repStart: !!b.rs, repEnd: !!b.re, ending: b.en || 0, mark: b.mk || "", ts: b.us || "",
        })),
      }));
      return lines.length ? { lines } : blankSheet();
    } catch (e) { return blankSheet(); }
  }

  const CSS = `
:root{--cw:min(28px,calc((100vw - 40px)/16));--fg:#f1ead8;--bar:#b9b2a0}
.sheet{font-family:Hand,'Comic Sans MS',cursive;color:var(--fg)}
.sheet h1{font-size:34px;margin:4px 0;font-weight:700;letter-spacing:.5px}
.sheet .meta{color:#a7a08e;font-size:21px;margin-bottom:18px}
.lab{display:inline-block;border:2px solid var(--fg);color:var(--fg);font-weight:bold;font-size:20px;padding:0 6px;border-radius:50% 45% 55% 50%;margin-right:3px}
.r{font-weight:700}.q{font-size:.8em;font-weight:500}.sp{color:#a7a08e}
.red{color:#ff9e8f}.bs{color:#6b8fc4;font-weight:600}
.sl{margin-top:18px;height:30px}
.sr{display:flex;flex-wrap:wrap;margin:2px 0 12px 4px;row-gap:6px}
.sb{flex:none;box-sizing:border-box;position:relative}
.sr .sb:last-child .ch{border-right:2px solid var(--fg)}
.sb.rs .ch{border-left:none;padding-left:0}
.sb.re .ch{border-right:none!important;padding-right:0}
.ch{display:flex;align-items:center;min-height:34px;font-size:27px;line-height:1.1;white-space:nowrap;border-left:2px solid var(--fg);padding:0 4px 0 2px}
.blank .ch{border-color:transparent!important}
.bk{height:16px;box-sizing:border-box;font-size:12px;line-height:14px;color:var(--fg);padding-left:5px;white-space:nowrap}
.bk.on{border-top:2px solid var(--fg)}
.bk.st{border-left:2px solid var(--fg);padding-left:3px}
.bk.cl{border-right:2px solid var(--fg)}
.ch>span{box-sizing:border-box;padding:0 6px 0 3px}
.ch .nt{color:var(--fg)}
.an,.bn{line-height:1.15;min-height:20px;color:#ff6b6b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding-left:5px}
.bt{line-height:1.15;min-height:22px;color:var(--fg);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding-left:5px}
.us{flex:none;display:flex;flex-direction:column;align-items:center;justify-content:center;font-style:normal;font-size:15px;line-height:1;margin:0 5px 0 3px;color:#ff9e8f}
.us b{font-weight:600}
.rsd,.red2{flex:none;width:15px;align-self:stretch}
.rsd{background:linear-gradient(var(--fg),var(--fg)) 0 0/4px 100% no-repeat,linear-gradient(var(--fg),var(--fg)) 6px 0/1.5px 100% no-repeat,radial-gradient(circle at 11px 35%,var(--fg) 2px,transparent 2.8px),radial-gradient(circle at 11px 65%,var(--fg) 2px,transparent 2.8px)}
.red2{background:linear-gradient(var(--fg),var(--fg)) 11px 0/4px 100% no-repeat,linear-gradient(var(--fg),var(--fg)) 7px 0/1.5px 100% no-repeat,radial-gradient(circle at 3px 35%,var(--fg) 2px,transparent 2.8px),radial-gradient(circle at 3px 65%,var(--fg) 2px,transparent 2.8px)}
`;
  const LIGHT_CSS = `
.sheet-light{--fg:#111;--bar:#444;background:#fff;color:#111}
.sheet-light .meta{color:#555}.sheet-light .lab{border-color:#111;color:#111}
.sheet-light .red,.sheet-light .an,.sheet-light .bn,.sheet-light .us{color:#c62828}
.sheet-light .sp{color:#666}.sheet-light .bs{color:#1f4fa0}
.sheet-light .sr,.sheet-light .sl{break-inside:avoid}
`;

  /** Bir ölçünün HTML'i. opts: {editor, li, bi, sel} ile editör işaretleri eklenir. */
  function barHtml(line, bi, shift, flats, opts) {
    const b = line.bars[bi];
    const ed = opts && opts.editor;
    const lineAbove = line.bars.some((x) => head(x));
    const lineBelow = line.bars.some((x) => x.below);
    const lineBt = line.bars.some((x) => hasChords(x) && x.text);
    const brs = opts && opts.brs ? opts.brs : brackets(line);
    const lineEnding = line.bars.some((x) => x.ending > 0);
    const blank = lineBlank(line);
    const cells = b.chords.length;
    const cls = ["sb", b.repStart ? "rs" : "", b.repEnd ? "re" : "", blank ? "blank" : "", opts && opts.selected ? "bsel" : ""].filter(Boolean).join(" ");
    let h = `<div class="${cls}" data-l="${opts ? opts.li : ""}" data-b="${bi}" style="min-width:calc(var(--cw)*${cells * b.weight})">`;
    if (lineEnding) {
      const bk = brs[bi];
      h += `<div class="bk${bk ? " on" : ""}${bk && bk.start ? " st" : ""}${bk && bk.end && bk.closed ? " cl" : ""}">${bk && bk.start ? bk.num + "." : ""}</div>`;
    }
    if (lineAbove) h += `<div class=an style="font-size:${b.aboveSz}px">${esc(head(b))}</div>`;
    h += "<div class=ch>";
    if (b.repStart) h += "<i class=rsd></i>";
    if (b.ts.includes("/")) h += `<i class=us><b>${esc(b.ts.split("/")[0])}</b><b>${esc(b.ts.split("/")[1])}</b></i>`;
    let st = 0;
    while (st < cells) {
      let en = st + 1;
      while (en < cells && b.chords[en] === "") en++;
      const n = en - st, c = b.chords[st];
      const sel = ed && opts.sel && opts.sel.s >= st && opts.sel.s < en;
      h += `<span${ed ? ` class="g${sel ? " gsel" : ""}" data-s="${st}" data-n="${n}"` : ""} style="flex:${n} 0 calc(var(--cw)*${n})${ed ? ";position:relative" : ""}">`;
      if (c) h += `<span class=txt>${IReal.chordHtml(c, shift, flats)}</span>`;
      else if (!hasChords(b) && b.text) h += `<span class="nt txt" style="font-size:${b.textSz}px;padding:0">${esc(b.text)}</span>`;
      else if (ed) h += `<span class=txt></span>`;
      if (ed) for (let k = 0; k < n; k++) {
        if (k === 0 && (c || (!hasChords(b) && b.text))) continue;
        h += `<i class="dot${sel && opts.sel.s === st + k ? " on" : ""}" data-k="${k}" data-n="${n}" style="left:calc(${k} / ${n} * 100% + 7px)"></i>`;
      }
      h += "</span>";
      st = en;
    }
    if (b.repEnd) h += "<i class=red2></i>";
    h += "</div>";
    if (lineBt) h += `<div class=bt style="font-size:${b.textSz}px">${hasChords(b) ? esc(b.text) : ""}</div>`;
    if (lineBelow) h += `<div class=bn style="font-size:${b.belowSz}px">${esc(b.below)}</div>`;
    if (ed && opts.handle) h += `<div class=handle></div>`;
    return h + "</div>";
  }

  /** Şarkı başlığı + üst bilgi + tüm satırlar. */
  function songHtml(song, shift, opts) {
    const sheet = fromJson(song.sheet);
    const flats = IReal.useFlats(song.key || "", shift);
    const metaParts = [song.composer, song.style,
      song.key && song.key.trim() ? "Ton: " + IReal.transposeKey(song.key, shift) + (shift ? ` (orijinal ${song.key})` : "") : null,
      song.bpm && song.bpm !== "0" ? song.bpm + " BPM" : null]
      .filter((x) => x && x.trim() && x !== "-" && x !== ".");
    let h = `<h1>${esc(song.title)}</h1><div class=meta>${esc(metaParts.join(" · "))}</div>`;
    for (const l of sheet.lines) {
      if (l.label) h += `<div class=sl><span class=lab>${esc(l.label)}</span></div>`;
      if (lineBlank(l)) { if (!l.label) h += `<div style="height:46px"></div>`; continue; }
      h += "<div class=sr>";
      const brs = brackets(l);
      l.bars.forEach((_, bi) => { h += barHtml(l, bi, shift, flats, { brs }); });
      h += "</div>";
    }
    return h;
  }

  root.Sheet = { newBar, hasChords, head, barBlank, lineBlank, blankSheet, brackets, toJson, fromJson, barHtml, songHtml, CSS, LIGHT_CSS, esc };
})(typeof window !== "undefined" ? window : globalThis);
