/* Err_Library – przeglądarka alarmów i adresów urządzeń (PWA, działa offline) */
(function () {
  'use strict';

  /* ---------- Rejestr danych (pliki w data/ wywołują te funkcje) ---------- */
  const REG = window.ErrLibREG;
  function loadSet(id) {
    if (REG.sets[id]) return Promise.resolve(REG.sets[id]);
    const meta = REG.catalog.sets.find(s => s.id === id);
    if (!meta) return Promise.reject(new Error('Brak zestawu ' + id));
    return new Promise((res, rej) => {
      (REG.waits[id] = REG.waits[id] || []).push(() => res(REG.sets[id]));
      if (document.querySelector('script[data-set="' + id + '"]')) return;
      const s = document.createElement('script');
      s.src = meta.file; s.dataset.set = id; s.onerror = () => rej(new Error('Nie udało się wczytać ' + meta.file));
      document.head.appendChild(s);
    });
  }
  const loadAll = () => Promise.all(REG.catalog.sets.map(s => loadSet(s.id)));

  /* ---------- Ustawienia i ulubione (localStorage, zawsze w try/catch) ---------- */
  const LS_KEY = 'errlib.v1';
  const DEF = { lang: 'pl', groupBy: 'brand', theme: 'auto', favs: [], qd: { mod: 'MS16', axis: 1, sheet: 'par', inputs: {}, head: '0000' } };
  let ST = load();
  function load() {
    try { const s = JSON.parse(localStorage.getItem(LS_KEY) || 'null'); if (s) return Object.assign({}, DEF, s, { qd: Object.assign({}, DEF.qd, s.qd || {}) }); } catch (e) {}
    return JSON.parse(JSON.stringify(DEF));
  }
  function save() { try { localStorage.setItem(LS_KEY, JSON.stringify(ST)); } catch (e) {} }
  const favKey = (set, id) => set + '::' + id;
  const isFav = (set, id) => ST.favs.some(f => f.k === favKey(set, id));
  function toggleFav(set, id) {
    const k = favKey(set, id);
    const i = ST.favs.findIndex(f => f.k === k);
    if (i >= 0) { ST.favs.splice(i, 1); toast('Usunięto z ulubionych'); }
    else { ST.favs.unshift({ k, set, id, t: Date.now() }); toast('Dodano do ulubionych'); }
    save();
    return i < 0;
  }

  /* ---------- Pomocnicze ---------- */
  const $ = (s, r = document) => r.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const L = (pl, en) => ST.lang === 'en' ? en : pl;
  const T = o => o == null ? '' : (typeof o === 'string' ? o : (o[ST.lang] || o.en || o.pl || ''));
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l');
  const plural = (n, a, b, c) => n === 1 ? a : (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? b : c);
  function textBlock(t) {
    if (!t) return '';
    const lines = t.split('\n').filter(Boolean);
    const bul = lines.filter(l => l.startsWith('•'));
    if (bul.length && bul.length === lines.length) return '<ul>' + lines.map(l => '<li>' + esc(l.replace(/^•\s*/, '')) + '</li>').join('') + '</ul>';
    return lines.map(l => l.startsWith('•') ? '<ul><li>' + esc(l.replace(/^•\s*/, '')) + '</li></ul>' : '<p style="margin:0 0 6px">' + esc(l) + '</p>').join('');
  }

  let toastT;
  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 1800);
  }

  /* ---------- Arkusz (bottom sheet) i dialog ---------- */
  function openSheet(title, body, foot) {
    const r = $('#sheet-root');
    r.innerHTML = `<div class="backdrop" data-act="close-sheet"></div><div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="grab"></div><div class="sheet-head"><h2>${esc(title)}</h2><button class="icon-btn" data-act="close-sheet" aria-label="Zamknij">${ic('close')}</button></div>
      <div class="sheet-body">${body}</div><div class="sheet-foot">${foot || ''}</div></div>`;
    document.body.classList.add('noscroll');
    requestAnimationFrame(() => r.classList.add('open'));
  }
  function closeSheet() {
    const r = $('#sheet-root'); if (!r.classList.contains('open')) return;
    r.classList.remove('open'); document.body.classList.remove('noscroll');
    setTimeout(() => { if (!r.classList.contains('open')) r.innerHTML = ''; }, 250);
    if (/\/e\//.test(location.hash)) history.back();
  }
  function confirmDlg(msg, okLabel) {
    return new Promise(res => {
      const d = document.createElement('div'); d.className = 'dlg-back';
      d.innerHTML = `<div class="dlg" role="alertdialog"><p>${esc(msg)}</p><div class="dlg-btns"><button class="btn ghost" data-r="0">Anuluj</button><button class="btn danger" data-r="1">${esc(okLabel)}</button></div></div>`;
      d.addEventListener('click', e => { const b = e.target.closest('[data-r]'); if (b || e.target === d) { d.remove(); res(b && b.dataset.r === '1'); } });
      document.body.appendChild(d);
    });
  }

  /* ---------- Szkielet ekranu ---------- */
  function topbar(title, back, right) {
    return `<header class="topbar${back ? ' has-back' : ''}"><div class="topbar-in">
      ${back ? `<button class="icon-btn" data-act="back" aria-label="Wstecz">${ic('back')}</button>` : ''}
      <h1>${esc(title)}</h1>${right || ''}</div></header>`;
  }
  const langBtn = () => `<button class="icon-btn lang-btn" data-act="lang" aria-label="Zmień język opisów">${ST.lang === 'pl' ? 'PL' : 'EN'}</button>`;
  function tabbar(active) {
    const tabs = [['katalog', 'folder', 'Katalog'], ['ulubione', 'star', 'Ulubione'], ['ustawienia', 'gear', 'Ustawienia']];
    $('#tabbar').innerHTML = `<div class="tabbar-in">${tabs.map(([k, i, l]) =>
      `<a class="tab${active === k ? ' on' : ''}" href="#/${k === 'katalog' ? '' : k}"${active === k ? ' aria-current="page"' : ''}><span class="tab-ic">${ic(i)}</span>${l}</a>`).join('')}</div>`;
  }
  function screen(html, tab) {
    $('#app').innerHTML = html; tabbar(tab);
  }

  /* ---------- Router ---------- */
  function route() {
    const h = location.hash.replace(/^#\/?/, '');
    const p = h.split('/').map(decodeURIComponent);
    if (!p[0]) return viewHome();
    if (p[0] === 'ulubione') return viewFavs();
    if (p[0] === 'ustawienia') return viewSettings();
    if (p[0] === 'set') {
      const meta = REG.catalog.sets.find(s => s.id === p[1]);
      if (!meta) return viewHome();
      const openId = p[2] === 'e' ? p[3] : null;
      return (meta.kind === 'devicelist' ? viewDevicelist(meta) : viewSet(meta, openId));
    }
    viewHome();
  }
  let lastHash = '';
  window.addEventListener('hashchange', () => {
    const prev = lastHash; lastHash = location.hash;
    // otwarcie/zamknięcie szczegółów nie przerysowuje listy
    const base = s => s.replace(/\/e\/.*$/, '');
    if (base(prev) === base(location.hash) && prev !== location.hash) {
      const m = location.hash.match(/#\/set\/([^/]+)\/e\/(.+)$/);
      if (m) showDetail(decodeURIComponent(m[1]), decodeURIComponent(m[2]), true); else closeSheet();
      return;
    }
    closeSheet(); route(); window.scrollTo(0, 0);
  });

  /* ---------- Ekran: katalog ---------- */
  const HOME = { q: '' };
  function setIcon(meta) { const t = REG.catalog.types.find(x => x.id === meta.type); return t ? t.icon : 'box'; }
  function viewHome() {
    const C = REG.catalog;
    const groups = ST.groupBy === 'brand'
      ? C.brands.map(b => ({ title: b.name, sets: C.sets.filter(s => s.brand === b.id), sub: s => (C.types.find(t => t.id === s.type) || {}).name }))
      : C.types.map(t => ({ title: t.name, sets: C.sets.filter(s => s.type === t.id), sub: s => (C.brands.find(b => b.id === s.brand) || {}).name }));
    const html = topbar('Err_Library', false, langBtn()) + `<main class="wrap">
      <div class="search">${ic('search')}<input id="home-q" type="search" placeholder="Szukaj kodu lub nazwy" value="${esc(HOME.q)}" autocomplete="off" enterkeyhint="search" aria-label="Szukaj"></div>
      <div id="home-body"></div></main>`;
    screen(html, 'katalog');
    const body = $('#home-body');
    const renderCatalog = () => {
      body.innerHTML = `<div class="segp" role="tablist" style="margin:2px 0 4px">
          <button class="${ST.groupBy === 'brand' ? 'on' : ''}" data-act="group" data-v="brand" role="tab">Według marki</button>
          <button class="${ST.groupBy === 'type' ? 'on' : ''}" data-act="group" data-v="type" role="tab">Według rodzaju</button></div>
        ${groups.filter(g => g.sets.length).map(g => `<div class="sec-title">${esc(g.title)}</div><div class="choose">${g.sets.map(s => `
          <a href="#/set/${s.id}"><span class="ci">${ic(setIcon(s))}</span><span class="grow"><b>${esc(s.name)}</b><small>${esc(s.sub)}</small>
          <span class="cnt">${esc(g.sub(s))} · ${s.count} ${s.kind === 'devicelist' ? 'poz.' : s.countWord ? plural(s.count, ...s.countWord) : plural(s.count, 'kod', 'kody', 'kodów')}</span></span>${ic('chev')}</a>`).join('')}</div>`).join('')}
        ${ST.favs.length ? `<div class="sec-title">Ulubione</div><div class="card"><a class="irow" href="#/ulubione">${ic('star')}<span class="grow">${ST.favs.length} ${plural(ST.favs.length, 'pozycja', 'pozycje', 'pozycji')} w ulubionych</span>${ic('chev', 'style="color:var(--muted)"')}</a></div>` : ''}`;
    };
    const runSearch = () => {
      const q = HOME.q.trim();
      if (!q) return renderCatalog();
      body.innerHTML = '<div class="empty"><p>Wczytuję dane…</p></div>';
      loadAll().then(() => { if (HOME.q.trim() === q) body.innerHTML = globalResults(q); });
    };
    $('#home-q').addEventListener('input', e => { HOME.q = e.target.value; runSearch(); });
    runSearch();
  }

  /* wyszukiwanie w zestawie błędów: kod ma pierwszeństwo, potem nazwa, potem treść */
  function scoreItem(it, q) {
    const nq = norm(q), code = norm(it.code), alt = norm(it.alt || '');
    if (code === nq || alt === nq || code.replace('.', '') === nq.replace('.', '')) return 100;
    const bare = s => s.replace(/^(e|pr)\./, '');
    if (bare(code) === bare(nq)) return 90;
    if (code.startsWith(nq) || alt.startsWith(nq) || bare(code).startsWith(bare(nq))) return 80;
    const name = norm(T(it.name)) + ' ' + norm(it.name.en) + ' ' + norm(it.name.pl);
    if (name.includes(nq)) return 60;
    const words = nq.split(/\s+/).filter(Boolean);
    const hay = name + ' ' + norm(T(it.cls)) + ' ' + it.secs.map(s => norm(T(s.t)) + ' ' + norm((s.t || {}).en)).join(' ');
    if (words.every(w => hay.includes(w))) return 30;
    return 0;
  }
  function searchSet(set, q, cat) {
    let list = set.items;
    if (cat && cat !== 'all') list = cat === 'fav' ? list.filter(i => isFav(set.id, i.id)) : list.filter(i => i.cat === cat);
    if (!q.trim()) return list;
    return list.map(i => [scoreItem(i, q), i]).filter(x => x[0] > 0).sort((a, b) => b[0] - a[0]).map(x => x[1]);
  }
  function errRow(set, it) {
    const tone = (set.cats[it.cat] || {}).tone || 'muted';
    const sub = [it.alt, T(it.cls)].filter(Boolean).join(' · ') || T(set.cats[it.cat]);
    const fav = isFav(set.id, it.id);
    return `<div class="erow" data-act="open" data-set="${set.id}" data-id="${esc(it.id)}" role="button" tabindex="0">
      <span class="code t-${tone}">${esc(it.code)}</span>
      <span class="row-main"><span class="row-title">${esc(T(it.name))}</span><span class="row-sub">${esc(sub)}</span></span>
      <button class="icon-btn fav-btn${fav ? ' on' : ''}" data-act="fav" data-set="${set.id}" data-id="${esc(it.id)}" aria-label="${fav ? 'Usuń z ulubionych' : 'Dodaj do ulubionych'}" aria-pressed="${fav}">${ic(fav ? 'starf' : 'star')}</button></div>`;
  }
  function globalResults(q) {
    const groups = [];
    let total = 0;
    REG.catalog.sets.forEach((meta, order) => {
      const set = REG.sets[meta.id]; if (!set) return;
      let r, best, rows;
      if (meta.kind === 'errors') {
        r = searchSet(set, q); best = r.length ? scoreItem(r[0], q) : 0;
        rows = r.slice(0, 30).map(it => errRow(set, it)).join('');
      } else {
        r = QD.search(set, q); best = r.length ? r[0].sc : 0;
        rows = QD.resultsHtml(set, r.slice(0, 30));
      }
      total += r.length;
      if (r.length) groups.push({ best, order, html: `<div class="sec-title">${esc(meta.name)} · ${r.length}</div><div class="card">${rows}${r.length > 30 ? `<a class="list-more" style="display:block" href="#/set/${meta.id}" data-q="${esc(q)}" data-act="goset">Pokaż wszystkie (${r.length})</a>` : ''}</div>` });
    });
    if (!total) return `<div class="empty">${ic('search')}<p>Nic nie znaleziono dla „${esc(q)}”.<br>Sprawdź kod (np. 2052, E.OC1, Pr.79) albo wpisz fragment nazwy.</p></div>`;
    // najpierw zestaw z najlepszym trafieniem (np. dokładny kod)
    return groups.sort((a, b) => b.best - a.best || a.order - b.order).map(g => g.html).join('');
  }

  /* ---------- Ekran: zestaw błędów ---------- */
  const SETV = {};  // stan filtrów per zestaw
  function viewSet(meta, openId) {
    screen(topbar(meta.name, true, langBtn()) + '<main class="wrap"><div class="empty"><p>Wczytuję…</p></div></main>', 'katalog');
    loadSet(meta.id).then(set => {
      const v = SETV[meta.id] = SETV[meta.id] || { q: '', cat: 'all' };
      const counts = { all: set.items.length };
      set.items.forEach(i => counts[i.cat] = (counts[i.cat] || 0) + 1);
      const chips = [['all', 'Wszystkie', counts.all]].concat(Object.keys(set.cats).filter(k => counts[k]).map(k => [k, T(set.cats[k]), counts[k]]));
      const favCount = set.items.filter(i => isFav(set.id, i.id)).length;
      if (favCount) chips.push(['fav', 'Ulubione', favCount]);
      $('#app').querySelector('main').innerHTML = `
        <div class="search">${ic('search')}<input id="set-q" type="search" placeholder="Kod, nazwa lub opis" value="${esc(v.q)}" autocomplete="off" enterkeyhint="search" aria-label="Szukaj w ${esc(meta.name)}"></div>
        <div class="chips" role="tablist">${chips.map(([k, l, n]) => `<button class="chip${v.cat === k ? ' on' : ''}" data-act="cat" data-v="${k}" role="tab">${esc(l)} <span class="cnt">${n}</span></button>`).join('')}</div>
        <div id="set-list"></div>
        ${set.note ? `<div class="card"><div class="note">${esc(T(set.note))}<br>Źródło: <code class="inline">${esc(set.source)}</code></div></div>` : ''}`;
      const draw = () => {
        const r = searchSet(set, v.q, v.cat);
        $('#set-list').innerHTML = r.length ? `<div class="card">${r.map(it => errRow(set, it)).join('')}</div>`
          : `<div class="empty">${ic(v.cat === 'fav' ? 'star' : 'search')}<p>${v.cat === 'fav' && !v.q ? 'Brak ulubionych w tym urządzeniu.' : 'Brak wyników. Spróbuj innego kodu lub słowa.'}</p></div>`;
      };
      $('#set-q').addEventListener('input', e => { v.q = e.target.value; draw(); });
      $('#app').querySelector('.chips').addEventListener('click', e => {
        const b = e.target.closest('[data-act="cat"]'); if (!b) return;
        v.cat = b.dataset.v; [...e.currentTarget.children].forEach(c => c.classList.toggle('on', c === b)); draw();
      });
      draw();
      if (openId) showDetail(meta.id, openId, true);
    }).catch(err => { $('#app').querySelector('main').innerHTML = `<div class="banner">${ic('warn')}<span>${esc(err.message)}</span></div>`; });
  }

  function showDetail(setId, itemId, fromHash) {
    loadSet(setId).then(set => {
      const it = set.items.find(i => i.id === itemId); if (!it) return;
      if (!fromHash) { location.hash = '#/set/' + setId + '/e/' + encodeURIComponent(itemId); return; }
      const cat = set.cats[it.cat] || {};
      const other = ST.lang === 'pl' ? 'en' : 'pl';
      const body = `<div class="det-head"><span class="code lg t-${cat.tone || 'muted'}">${esc(it.code)}</span>${it.alt ? `<span class="tag">${esc(it.alt)}</span>` : ''}<span class="tone-dot tone-${cat.tone || 'muted'}">${esc(T(cat))}</span></div>
        <p class="det-name">${esc(T(it.name))}</p>
        ${it.name[other] && it.name[other] !== T(it.name) ? `<div class="muted small">${esc(it.name[other])}</div>` : ''}
        ${it.cls ? `<div class="muted small" style="margin-top:4px">${esc(T(it.cls))}</div>` : ''}
        ${it.secs.map(s => { const txt = T(s.t); if (!txt) return ''; return `<div class="det-sec"><div class="lbl">${esc(T(set.labels[s.k]))}${!s.t[ST.lang] ? ' <span class="tag" style="height:20px;font-size:11px">EN</span>' : ''}</div><div class="txt">${textBlock(txt)}</div></div>`; }).join('')}
        ${it.info.length ? `<div class="det-kv">${it.info.map(([k, val]) => `<div class="kv"><span>${esc(T(set.labels[k]) || k)}</span><span>${esc(val)}</span></div>`).join('')}</div>` : ''}
        <div class="hint" style="margin-top:14px">${esc(REG.catalog.sets.find(s => s.id === setId).name)} · ${esc(set.source)}</div>`;
      const fav = isFav(setId, it.id);
      const foot = `<button class="btn ghost" data-act="lang">${ST.lang === 'pl' ? 'EN' : 'PL'}</button>
        <button class="btn primary" data-act="fav-detail" data-set="${setId}" data-id="${esc(it.id)}">${ic(fav ? 'starf' : 'star')}${fav ? 'Usuń z ulubionych' : 'Dodaj do ulubionych'}</button>`;
      openSheet(REG.catalog.sets.find(s => s.id === setId).name, body, foot);
    });
  }

  /* ---------- Devicelist QD77 ---------- */
  const QD = {
    engines: {},
    eng(set, sh) {
      const k = set.id + ':' + sh.key;
      if (!this.engines[k]) this.engines[k] = new QDSheet(sh.cells);
      const E = this.engines[k];
      (sh.sections || []).forEach(sec => sec.inputs.forEach(inp => {
        let v = inp.kind === 'axis' ? ST.qd.axis : ST.qd.inputs[sh.key + ':' + inp.cell];
        if (v == null) v = inp.default;
        if (E.over[inp.cell] !== v) E.set(inp.cell, v);
      }));
      return E;
    },
    mod(set) { return set.mods.find(m => m.id === ST.qd.mod) || set.mods[2]; },
    fmtVal(v) {
      if (v === '-' || v === '' || v == null || v === '#ERR') return null;
      if (typeof v === 'number' && !Number.isInteger(v)) return String(Math.round(v));
      return String(v);
    },
    addr(set, sh, row) {
      const E = this.eng(set, sh), m = ST.qd.mod;
      const parts = [];
      row.a.forEach(a => {
        const ref = a[m]; if (!ref) return;
        if (ref.includes(':')) {
          const [r1, r2] = ref.split(':'); const v1 = this.fmtVal(E.get(r1)), v2 = this.fmtVal(E.get(r2));
          if (v1 == null) return; parts.push(v2 != null && v2 !== v1 ? v1 + '–' + v2 : v1);
        } else { const v = this.fmtVal(E.get(ref)); if (v != null) parts.push(v); }
      });
      return parts;
    },
    addrHtml(set, sh, row) {
      const p = this.addr(set, sh, row);
      if (!p.length) { const any = row.a.some(a => a[ST.qd.mod]); return `<span class="ad na">${any ? '—' : L('brak', 'none')}<small>${any ? L('nie dotyczy', 'not used') : this.mod(set).name}</small></span>`; }
      const isNum = p.every(x => /^\d+(–\d+)?$/.test(x));
      if (!isNum) return `<span class="ad" style="white-space:normal;max-width:45%;font-size:14px">${esc(p.join(' / '))}</span>`;
      if (p.length === 1) return `<span class="ad">${esc(p[0])}${row.sh && row.sh.includes(ST.qd.mod) ? '<small>' + L('to samo słowo', 'same word') + '</small>' : ''}</span>`;
      return `<span class="ad">${esc(p[0])}<small>+ ${esc(p.slice(1).join(', '))}</small></span>`;
    },
    rowNum(sec, row) { return row.n ? (sec.prefix ? sec.prefix + '.' : '') + row.n : ''; },
    /* przycisk opisu dla pozycji z opisem (np. PA08, PB09 w Parametrach serwa) */
    infoBtn(set, id, row) {
      if (!row.d) return '';
      return `<button class="icon-btn info-btn" data-act="qd-info" data-set="${set.id}" data-id="${id}" aria-label="Opis parametru ${esc(row.t)}">${ic('info')}</button>`;
    },
    showInfo(set, id) {
      const r = this.find(set, id); if (!r || !r.row.d) return;
      const d = r.row.d, LB = set.descLabels || {}, other = ST.lang === 'pl' ? 'en' : 'pl';
      const p = this.addr(set, r.sh, r.row);
      const body = `<div class="det-head"><span class="code lg t-muted">${esc(r.row.t)}</span><span class="tag">${esc(d.abbr)}</span></div>
        <p class="det-name">${esc(T(d.name))}</p>
        ${d.name[other] && d.name[other] !== T(d.name) ? `<div class="muted small">${esc(d.name[other])}</div>` : ''}
        <div class="total-box" style="margin-top:12px"><span><span style="font-weight:600">${L('Adres Un\\G', 'Un\\G address')}</span><small>${esc(this.mod(set).name)}, ${L('oś', 'axis')} ${ST.qd.axis}</small></span><b>${esc(p.length ? p.join(' / ') : '—')}</b></div>
        ${d.secs.map(s => { const txt = T(s.t); if (!txt) return ''; return `<div class="det-sec"><div class="lbl">${esc(T(LB[s.k]) || s.k)}</div><div class="txt">${textBlock(txt)}</div></div>`; }).join('')}
        <div class="det-kv">${d.info.map(([k, v]) => `<div class="kv"><span>${esc(T(LB[k]) || k)}</span><span>${esc(v)}</span></div>`).join('')}</div>
        ${set.descNote ? `<div class="hint" style="margin-top:14px">${esc(T(set.descNote))}</div>` : ''}`;
      const fav = isFav(set.id, id);
      const foot = `<button class="btn ghost" data-act="lang-info" data-set="${set.id}" data-id="${id}">${ST.lang === 'pl' ? 'EN' : 'PL'}</button>
        <button class="btn primary" data-act="fav-detail" data-set="${set.id}" data-id="${id}">${ic(fav ? 'starf' : 'star')}${fav ? L('Usuń z ulubionych', 'Remove from favourites') : L('Dodaj do ulubionych', 'Add to favourites')}</button>`;
      openSheet(T(r.sh.title), body, foot);
    },
    rowHtml(set, sh, si, ri, row, showSheet) {
      const sec = sh.sections[si];
      const id = sh.key + '.' + si + '.' + ri;
      const fav = isFav(set.id, id);
      const nb = this.rowNum(sec, row);
      return `<div class="arow">${nb ? `<span class="nb">${esc(nb)}</span>` : ''}
        <span class="nm">${esc(row.t)}${row.d ? `<small class="pdesc">${esc(T(row.d.name))} (${esc(row.d.abbr)})</small>` : ''}${showSheet ? `<small>${esc(T(sh.title))} · ${esc(T(sec.title))}</small>` : ''}</span>${this.infoBtn(set, id, row)}${this.addrHtml(set, sh, row)}
        <button class="icon-btn fav-btn${fav ? ' on' : ''}" data-act="fav" data-set="${set.id}" data-id="${id}" aria-label="${fav ? 'Usuń z ulubionych' : 'Dodaj do ulubionych'}" aria-pressed="${fav}">${ic(fav ? 'starf' : 'star')}</button></div>`;
    },
    find(set, id) {
      const [k, si, ri] = id.split('.');
      const sh = set.sheets.find(s => s.key === k); if (!sh || !sh.sections) return null;
      const sec = sh.sections[+si]; const row = sec && sec.rows[+ri];
      return row && row.a ? { sh, si: +si, ri: +ri, row } : null;
    },
    search(set, q) {
      const nq = norm(q).trim(); if (!nq) return [];
      const words = nq.split(/\s+/);
      const out = [];
      set.sheets.forEach(sh => (sh.sections || []).forEach((sec, si) => sec.rows.forEach((row, ri) => {
        if (!row.a) return;
        const num = norm(this.rowNum(sec, row));
        const hay = num + ' ' + norm(row.t) + ' ' + (row.d ? norm(row.d.name.pl) + ' ' + norm(row.d.name.en) + ' ' + norm(row.d.abbr) + ' ' : '') + norm(sec.title.pl) + ' ' + norm(sec.title.en) + ' ' + norm(sh.title.pl) + ' ' + norm(sh.title.en);
        let sc = 0;
        if (num && (num === nq || num.split(', ').includes(nq) || num.replace(/^\w+\./, '') === nq)) sc = 100;
        else if (norm(row.t).includes(nq) || (row.d && (norm(row.d.abbr) === nq || norm(T(row.d.name)).includes(nq)))) sc = 60;
        else if (words.every(w => hay.includes(w))) sc = 30;
        if (sc) out.push({ sc, sh, si, ri, row });
      })));
      return out.sort((a, b) => b.sc - a.sc);
    },
    resultsHtml(set, res) { return res.map(r => this.rowHtml(set, r.sh, r.si, r.ri, r.row, true)).join(''); }
  };

  const QDV = { q: '' };
  function stepper(act, val, min, max, label, extra) {
    return `<div class="mini-step" role="group" aria-label="${esc(label)}">
      <button data-act="${act}" data-d="-1" ${extra || ''} ${val <= min ? 'disabled' : ''} aria-label="Mniej">${ic('minus')}</button>
      <output>${val}</output>
      <button data-act="${act}" data-d="1" ${extra || ''} ${val >= max ? 'disabled' : ''} aria-label="Więcej">${ic('plus')}</button></div>`;
  }
  function viewDevicelist(meta) {
    screen(topbar(meta.name, true, langBtn()) + '<main class="wrap"><div class="empty"><p>Wczytuję…</p></div></main>', 'katalog');
    loadSet(meta.id).then(set => {
      const main = $('#app').querySelector('main');
      const draw = () => {
        const mod = QD.mod(set);
        if (ST.qd.axis > mod.axes) ST.qd.axis = mod.axes;
        let sh = set.sheets.find(s => s.key === ST.qd.sheet) || set.sheets[2];
        main.innerHTML = `
          <div class="card qd-set"><div class="flabel">${L('Moduł', 'Module')}</div>
            <div class="segp">${set.mods.map(m => `<button class="${m.id === ST.qd.mod ? 'on' : ''}" data-act="qd-mod" data-v="${m.id}">${esc(m.id === 'GF' ? 'GF4/8/16' : m.id)}<small>${m.axes} ${ST.lang === 'en' ? 'axes' : plural(m.axes, 'oś', 'osie', 'osi')}</small></button>`).join('')}</div>
            <div class="qd-axis"><span class="flabel">${L('Oś (Axis No.)', 'Axis No.')}</span>${stepper('qd-axis', ST.qd.axis, 1, mod.axes, L('Numer osi', 'Axis No.'))}</div></div>
          <div class="search">${ic('search')}<input id="qd-q" type="search" placeholder="${L('Szukaj: Md.23, feed current, PA01…', 'Search: Md.23, feed current, PA01…')}" value="${esc(QDV.q)}" autocomplete="off" enterkeyhint="search" aria-label="Szukaj adresu"></div>
          <div id="qd-body"></div>`;
        $('#qd-q').addEventListener('input', e => { QDV.q = e.target.value; body(); });
        body();
      };
      const body = () => {
        const b = $('#qd-body');
        if (QDV.q.trim()) {
          const r = QD.search(set, QDV.q);
          b.innerHTML = r.length ? `<div class="hint" style="margin:0 4px 8px">${r.length} ${ST.lang === 'en' ? (r.length === 1 ? 'result' : 'results') : plural(r.length, 'wynik', 'wyniki', 'wyników')} · ${esc(QD.mod(set).name)}, ${L('oś', 'axis')} ${ST.qd.axis}</div><div class="card">${QD.resultsHtml(set, r.slice(0, 150))}</div>`
            : `<div class="empty">${ic('search')}<p>${L('Brak pozycji dla', 'No items for')} „${esc(QDV.q)}”.</p></div>`;
          return;
        }
        const sh = set.sheets.find(s => s.key === ST.qd.sheet) || set.sheets[2];
        b.innerHTML = `<div class="chips" role="tablist">${set.sheets.map(s => `<button class="chip${s.key === sh.key ? ' on' : ''}" data-act="qd-sheet" data-v="${s.key}" role="tab">${esc(T(s.title))}</button>`).join('')}</div>
          <div class="hint" style="margin:-4px 4px 10px">${esc(T(sh.sub))}${sh.io ? '' : L(' · adresy Un\\G (dziesiętnie)', ' · Un\\G addresses (decimal)')}</div>` + (sh.io ? ioHtml(set, sh) : sheetHtml(set, sh));
        const act = b.querySelector('.chip.on'); if (act && act.scrollIntoView) act.scrollIntoView({ block: 'nearest', inline: 'center' });
        const hx = $('#qd-head');
        if (hx) hx.addEventListener('input', e => { const v = e.target.value.toUpperCase().replace(/[^0-9A-F]/g, '').slice(0, 4); ST.qd.head = v; save(); $('#qd-io').innerHTML = ioRows(set, sh); });
      };
      main.onclick = e => {
        const t = e.target.closest('[data-act]'); if (!t) return;
        const a = t.dataset.act;
        if (a === 'qd-mod') { ST.qd.mod = t.dataset.v; save(); draw(); }
        else if (a === 'qd-axis') { ST.qd.axis = Math.max(1, Math.min(QD.mod(set).axes, ST.qd.axis + (+t.dataset.d))); save(); draw(); }
        else if (a === 'qd-sheet') { ST.qd.sheet = t.dataset.v; save(); body(); }
        else if (a === 'qd-in') {
          const k = t.dataset.k, min = +t.dataset.min, max = +t.dataset.max, def = +t.dataset.def;
          const cur = ST.qd.inputs[k] == null ? def : ST.qd.inputs[k];
          ST.qd.inputs[k] = Math.max(min, Math.min(max, cur + (+t.dataset.d))); save(); body();
        }
      };
      draw();
    });
  }
  function sheetHtml(set, sh) {
    return sh.sections.map((sec, si) => {
      const ins = sec.inputs.filter(i => i.kind !== 'axis');
      const hasAxis = sec.inputs.some(i => i.kind === 'axis');
      return `<div class="card"><div class="sec-head"><h3>${esc(T(sec.title) || T(sh.title))}</h3>${hasAxis ? `<span class="tag">${L('oś', 'axis')} ${ST.qd.axis}</span>` : ''}</div>
        ${ins.length ? `<div class="sec-inputs">${ins.map(i => { const k = sh.key + ':' + i.cell; const v = ST.qd.inputs[k] == null ? i.default : ST.qd.inputs[k];
          return `<div class="in-row"><span class="flabel">${esc(T(i.label))} <span class="muted" style="font-weight:400">(${i.min}–${i.max})</span></span>${stepper('qd-in', v, i.min, i.max, T(i.label), `data-k="${k}" data-min="${i.min}" data-max="${i.max}" data-def="${i.default}"`)}</div>`; }).join('')}</div>` : ''}
        ${sec.rows.map((row, ri) => row.g ? `<div class="grp">${esc(T(row.g))}</div>` : row.g2 ? `<div class="grp2">${esc(T(row.g2))}</div>` : row.note ? `<div class="qnote">${esc(T(row.note))}</div>` : QD.rowHtml(set, sh, si, ri, row)).join('')}</div>`;
    }).join('');
  }
  function ioDev(prefix, head, i) {
    const h = parseInt(head || '0', 16) || 0;
    return prefix + (h + i).toString(16).toUpperCase();
  }
  function ioName(sh, v) {
    if (v && typeof v === 'object') { const n = sh.io.notes[v.note] || ''; const m = n.match(/refer to\s*"([^"]+)"/i); return '→ ' + (m ? m[1] : L('patrz uwaga', 'see note')); }
    return v || '';
  }
  function ioRows(set, sh) {
    const head = ST.qd.head || '0000', h = parseInt(head || '0', 16) || 0, m = ST.qd.mod;
    if (h > 4064) return `<div class="banner">${ic('warn')}<span><b>${L('Nieprawidłowy adres X-Y.', 'Invalid X-Y address.')}</b> ${L('Maksymalnie', 'Max.')} 0FE0.</span></div>`;
    const side = (key, prefix, title) => `<div class="card"><div class="sec-head"><h3>${title}</h3></div>${sh.io.rows.map(r =>
      `<div class="arow"><span class="nb" style="min-width:52px;font-size:15px">${ioDev(prefix, head, r.i)}</span><span class="nm">${esc(ioName(sh, r[key][m]))}</span></div>`).join('')}</div>`;
    return side('x', 'X', L('Wejścia X (QD77 → CPU)', 'Inputs X (QD77 → CPU)')) + side('y', 'Y', L('Wyjścia Y (CPU → QD77)', 'Outputs Y (CPU → QD77)'));
  }
  function ioHtml(set, sh) {
    return `<div class="card qd-set"><label class="flabel" for="qd-head">${L('Adres początkowy X-Y modułu (hex)', 'Module head X-Y address (hex)')}</label>
      <input id="qd-head" class="inp hex-in" value="${esc(ST.qd.head || '0000')}" inputmode="text" maxlength="4" autocomplete="off" spellcheck="false">
      <div class="hint">${L('Np. 0000, 0020, 0080. Numery urządzeń przeliczą się automatycznie.', 'E.g. 0000, 0020, 0080. Device numbers update automatically.')}</div></div><div id="qd-io">${ioRows(set, sh)}</div>`;
  }

  /* ---------- Ekran: ulubione ---------- */
  function viewFavs() {
    screen(topbar('Ulubione', false, langBtn()) + '<main class="wrap"><div id="fav-body"></div></main>', 'ulubione');
    const b = $('#fav-body');
    if (!ST.favs.length) { b.innerHTML = `<div class="empty">${ic('star')}<p>Brak ulubionych.<br>Dotknij gwiazdki przy kodzie błędu lub adresie, aby mieć go pod ręką.</p></div>`; return; }
    b.innerHTML = '<div class="empty"><p>Wczytuję…</p></div>';
    const need = [...new Set(ST.favs.map(f => f.set))].filter(id => REG.catalog.sets.some(s => s.id === id));
    Promise.all(need.map(loadSet)).then(() => {
      let out = '';
      REG.catalog.sets.forEach(meta => {
        const fs = ST.favs.filter(f => f.set === meta.id); if (!fs.length) return;
        const set = REG.sets[meta.id];
        let rows = '';
        if (meta.kind === 'errors') rows = fs.map(f => set.items.find(i => i.id === f.id)).filter(Boolean).map(it => errRow(set, it)).join('');
        else rows = fs.map(f => { const r = QD.find(set, f.id); return r ? QD.rowHtml(set, r.sh, r.si, r.ri, r.row, true) : ''; }).join('');
        if (rows) out += `<div class="sec-title">${esc(meta.name)}${meta.kind === 'devicelist' ? ` · ${esc(QD.mod(set).name)}, ${L('oś', 'axis')} ${ST.qd.axis}` : ''}</div><div class="card">${rows}</div>`;
      });
      b.innerHTML = out || `<div class="empty">${ic('star')}<p>Brak ulubionych.</p></div>`;
    });
  }

  /* ---------- Ekran: ustawienia ---------- */
  function viewSettings() {
    const C = REG.catalog;
    screen(topbar('Ustawienia') + `<main class="wrap">
      <div class="card">
        <div class="set-row"><div class="flabel">Język opisów błędów</div><div class="segp">
          <button class="${ST.lang === 'pl' ? 'on' : ''}" data-act="set-lang" data-v="pl">Polski</button><button class="${ST.lang === 'en' ? 'on' : ''}" data-act="set-lang" data-v="en">English</button></div>
          <div class="hint">Gdy brak tłumaczenia, wyświetla się tekst angielski z oznaczeniem EN.</div></div>
        <div class="set-row"><div class="flabel">Motyw</div><div class="segp">
          ${[['auto', 'Systemowy'], ['light', 'Jasny'], ['dark', 'Ciemny']].map(([k, l]) => `<button class="${ST.theme === k ? 'on' : ''}" data-act="set-theme" data-v="${k}">${l}</button>`).join('')}</div></div>
      </div>
      <div class="sec-title">Ulubione</div>
      <div class="card"><div class="kv"><span>Zapisane pozycje</span><b>${ST.favs.length}</b></div>
        <div class="btns" style="padding-top:12px"><button class="btn danger-ghost block" data-act="clear-favs" ${ST.favs.length ? '' : 'disabled'}>${ic('trash')}Wyczyść ulubione</button></div></div>
      <div class="sec-title">Dane</div>
      <div class="card">${C.sets.map(s => `<div class="kv"><span>${esc(s.name)}</span><span class="muted">${s.count} poz.</span></div>`).join('')}
        <div class="note">Każde urządzenie to osobny plik w folderze <code class="inline">data/&lt;marka&gt;/</code>, a lista kategorii jest w <code class="inline">data/catalog.js</code>. Ulubione i ustawienia są zapisane tylko na tym urządzeniu.</div></div>
      <div class="sec-title">Aplikacja</div>
      <div class="card"><div class="note about"><b>Err_Library</b> · wersja ${APP_VERSION}<br>Działa offline po pierwszym otwarciu z serwera (HTTPS lub localhost). Aby zainstalować na telefonie, otwórz stronę w przeglądarce i wybierz „Dodaj do ekranu głównego”.</div></div>
    </main>`, 'ustawienia');
  }

  /* ---------- Akcje globalne ---------- */
  function applyTheme() {
    if (ST.theme === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', ST.theme);
    const dark = ST.theme === 'dark' || (ST.theme === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
    const m = document.querySelector('meta[name="theme-color"]'); if (m) m.content = dark ? '#0e1116' : '#f2f4f8';
  }
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-act]'); if (!t) return;
    const a = t.dataset.act;
    if (a === 'back') { if (lastNav > 0) history.back(); else location.hash = '#/'; }
    else if (a === 'close-sheet') closeSheet();
    else if (a === 'lang') { ST.lang = ST.lang === 'pl' ? 'en' : 'pl'; save(); toast(ST.lang === 'pl' ? 'Opisy po polsku' : 'Descriptions in English'); rerender(); }
    else if (a === 'group') { ST.groupBy = t.dataset.v; save(); viewHome(); }
    else if (a === 'qd-info') { loadSet(t.dataset.set).then(set => QD.showInfo(set, t.dataset.id)); }
    else if (a === 'lang-info') { ST.lang = ST.lang === 'pl' ? 'en' : 'pl'; save(); const id = t.dataset.id, sid = t.dataset.set; closeSheet(); rerender(); setTimeout(() => QD.showInfo(REG.sets[sid], id), 260); }
    else if (a === 'open') { if (e.target.closest('[data-act="fav"]')) return; showDetail(t.dataset.set, t.dataset.id); }
    else if (a === 'fav') {
      e.stopPropagation();
      const on = toggleFav(t.dataset.set, t.dataset.id);
      t.classList.toggle('on', on); t.innerHTML = ic(on ? 'starf' : 'star'); t.setAttribute('aria-pressed', on);
      t.setAttribute('aria-label', on ? 'Usuń z ulubionych' : 'Dodaj do ulubionych');
      if (/ulubione/.test(location.hash) && !on) viewFavs();
    }
    else if (a === 'fav-detail') {
      const on = toggleFav(t.dataset.set, t.dataset.id);
      t.innerHTML = ic(on ? 'starf' : 'star') + (on ? L('Usuń z ulubionych', 'Remove from favourites') : L('Dodaj do ulubionych', 'Add to favourites'));
      document.querySelectorAll(`.fav-btn[data-set="${t.dataset.set}"][data-id="${CSS.escape(t.dataset.id)}"]`).forEach(b => { b.classList.toggle('on', on); b.innerHTML = ic(on ? 'starf' : 'star'); });
    }
    else if (a === 'goset') { e.preventDefault(); const id = t.getAttribute('href').split('/').pop(); const meta = REG.catalog.sets.find(s => s.id === id); if (meta.kind === 'devicelist') QDV.q = t.dataset.q; else (SETV[id] = SETV[id] || { cat: 'all' }).q = t.dataset.q; location.hash = '#/set/' + id; }
    else if (a === 'set-lang') { ST.lang = t.dataset.v; save(); viewSettings(); }
    else if (a === 'set-theme') { ST.theme = t.dataset.v; save(); applyTheme(); viewSettings(); }
    else if (a === 'clear-favs') confirmDlg('Usunąć wszystkie ulubione (' + ST.favs.length + ')?', 'Usuń').then(ok => { if (ok) { ST.favs = []; save(); toast('Ulubione wyczyszczone'); viewSettings(); } });
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeSheet();
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.erow')) { e.preventDefault(); e.target.click(); }
  });
  let lastNav = 0;
  window.addEventListener('hashchange', () => lastNav++);
  function rerender() {
    const y = window.scrollY;
    setTimeout(() => window.scrollTo(0, y), 60);  // zachowaj miejsce na liście po zmianie języka
    const open = $('#sheet-root').classList.contains('open');
    const m = location.hash.match(/#\/set\/([^/]+)\/e\/(.+)$/);
    if (/#\/set\//.test(location.hash)) {
      const meta = REG.catalog.sets.find(s => s.id === location.hash.split('/')[2]);
      if (meta && meta.kind === 'errors') { viewSet(meta, null); if (open && m) showDetail(m[1], decodeURIComponent(m[2]), true); return; }
    }
    route();
  }

  const APP_VERSION = '1.2.3';
  function start() {
    applyTheme();
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
    if (!REG.catalog) { $('#app').innerHTML = '<div class="wrap"><div class="banner">Brak pliku data/catalog.js</div></div>'; return; }
    lastHash = location.hash;
    route();
    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
