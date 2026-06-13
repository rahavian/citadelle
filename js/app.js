/* Citadel Guide Namur — logique applicative (vanilla JS).
 *
 * Reproduit fidèlement la maquette de Claude Design (6 écrans, nav 5 onglets,
 * fiche à onglets, timeline, carte à pins, parcours à progression), mais
 * pilotée par NOTRE contenu vérifié : window.CITADELLE_CONTENT (9 lieux + 11
 * périodes), embarqué via data/content.js pour fonctionner hors-ligne et en file://.
 *
 * Pas de framework, pas de backend. État de visite et favoris en localStorage ;
 * photos déposées gérées par le composant <image-slot>.
 */
(() => {
  'use strict';

  const C = window.CITADELLE_CONTENT;
  if (!C || !Array.isArray(C.lieux)) {
    document.getElementById('view').innerHTML =
      '<div style="padding:40px;color:#0F3328;font-family:sans-serif">Contenu indisponible (data/content.js manquant).</div>';
    return;
  }

  /* ---------- Utilitaires ---------- */
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const truncate = (s, n) => {
    s = String(s || '');
    if (s.length <= n) return s;
    const cut = s.slice(0, n);
    const i = cut.lastIndexOf(' ');
    return (i > n * 0.6 ? cut.slice(0, i) : cut).replace(/[ ,;.]+$/, '') + '…';
  };
  const infoVal = (lieu, re, fallback) => {
    const m = (lieu.infos_cles || []).find((i) => re.test(i.label));
    return m ? m.valeur : (fallback || '—');
  };
  const lieuById = (id) => C.lieux.find((x) => x.id === id);
  // Image « durable » d'un slot : fichier déclaré dans content.json (lieu.images),
  // servi à TOUS les appareils. Le glisser-déposer (localStorage) la surcharge
  // localement. slotId : slot-<id> | slot-<id>-a | slot-<id>-b | slot-<id>-plan.
  function slotSrcAttr(slotId) {
    const m = /^slot-(.+?)(?:-(a|b|plan))?$/.exec(slotId);
    if (!m) return '';
    const l = lieuById(m[1]);
    if (!l || !l.images) return '';
    const key = m[2] === 'a' ? 'avant' : m[2] === 'b' ? 'apres' : m[2] === 'plan' ? 'plan' : 'principale';
    const v = l.images[key];
    return v ? ` src="${esc(v)}"` : '';
  }

  /* ---------- Métadonnées de présentation (couche UI, pas du contenu) ----------
     era = libellé court d'époque pour les badges ; mapLabel = nom court sur la carte ;
     MAP_POS = placement PROVISOIRE des pins sur la carte stylisée (les vraies
     coordonnées x/y restent null dans content.json tant que l'asset carte n'existe pas). */
  const ERA = {
    'esplanade': 'Début XXᵉ', 'confluent': 'Antiquité', 'chateau-medieval': 'Moyen Âge',
    'la-mediane': 'XVIᵉ s.', 'terra-nova': 'XVIIᵉ s.', 'ravin-foliette': 'XVIIᵉ s.',
    'souterrains': 'XVIᵉ–XXᵉ s.', 'fortifications-hollandaises': '1815–1830', 'citadelle-aujourdhui': 'Aujourd’hui'
  };
  const MAP_LABEL = {
    'esplanade': 'L’Esplanade', 'confluent': 'Le Confluent', 'chateau-medieval': 'Château médiéval',
    'la-mediane': 'La Médiane', 'terra-nova': 'Terra Nova', 'ravin-foliette': 'Ravin de la Foliette',
    'souterrains': 'Les Souterrains', 'fortifications-hollandaises': 'Front hollandais', 'citadelle-aujourdhui': 'Citadelle auj.'
  };
  const MAP_POS = {
    'esplanade': { x: 76, y: 70, type: 'camera' },
    'confluent': { x: 52, y: 82, type: 'star' },
    'chateau-medieval': { x: 36, y: 62, type: 'star' },
    'la-mediane': { x: 47, y: 50, type: 'plain' },
    'terra-nova': { x: 40, y: 34, type: 'main' },
    'ravin-foliette': { x: 63, y: 30, type: 'plain' },
    'souterrains': { x: 71, y: 45, type: 'camera' },
    'fortifications-hollandaises': { x: 24, y: 42, type: 'plain' },
    'citadelle-aujourdhui': { x: 60, y: 62, type: 'star' }
  };
  const BAT_RE = /(architecte|acteur|concepteur|b[aâ]tisseur)/i;
  const BAT_FALLBACK = { 'confluent': 'La géographie' };

  /* ---------- Modèle de vue ---------- */
  const stops = C.lieux.slice().sort((a, b) => a.ordre_parcours - b.ordre_parcours).map((l) => ({
    id: l.id,
    num: String(l.ordre_parcours).padStart(2, '0'),
    title: l.nom,
    subtitle: l.sous_titre,
    era: ERA[l.id] || infoVal(l, /période/i, ''),
    period: infoVal(l, /période/i),
    batisseurs: infoVal(l, BAT_RE, BAT_FALLBACK[l.id] || '—'),
    fonction: infoVal(l, /fonction/i),
    etat: infoVal(l, /état/i),
    overview: l.intro,
    sections: l.sections || [],
    anecdotes: l.anecdotes || [],
    pistes: l.pistes_photos || [],
    sources: l.sources || [],
    mapLabel: MAP_LABEL[l.id] || l.nom
  }));
  const stopById = (id) => stops.find((s) => s.id === id) || stops[0];

  const timeline = C.periodes.map((p) => {
    const parts = String(p.label).split('—');
    return {
      id: p.id,
      date: p.dates,
      title: parts[0].trim(),
      subtitle: parts.length > 1 ? parts.slice(1).join('—').trim() : '',
      desc: truncate(p.resume, 135),
      stopId: (p.lieux_lies && p.lieux_lies[0]) || null,
      active: p.id === 'p-citadelle-actuelle',
      highlight: p.id === 'p-terra-nova'
    };
  });

  const pins = stops.filter((s) => MAP_POS[s.id]).map((s) => ({
    id: s.id, x: MAP_POS[s.id].x, y: MAP_POS[s.id].y, type: MAP_POS[s.id].type,
    label: s.mapLabel, era: s.era, subtitle: s.subtitle
  }));

  /* ---------- État ---------- */
  const LS = { visited: 'citadel.visited', favs: 'citadel.favs' };
  const loadArr = (k) => { try { const v = JSON.parse(localStorage.getItem(k) || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; } };
  const saveArr = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  // Notes personnelles par lieu (persistées sur l'appareil — fonctionnent hors-ligne).
  const getNote = (id) => { try { return localStorage.getItem('citadel.note.' + id) || ''; } catch (e) { return ''; } };
  const setNote = (id, v) => { try { if (v && v.trim()) localStorage.setItem('citadel.note.' + id, v); else localStorage.removeItem('citadel.note.' + id); } catch (e) {} };

  const state = {
    screen: 'home', prevScreen: 'home', stopId: stops[0].id, tab: 'apercu',
    selectedPin: null, more: false, editingNote: false, lightbox: null, visited: loadArr(LS.visited), favs: loadArr(LS.favs)
  };

  /* ---------- Icônes (réutilisées de la maquette) ---------- */
  const I = {
    castle: '<svg width="22" height="22" viewBox="0 0 24 24" fill="#fff"><path d="M3 21h18v-7l-2 1v-3l-2 1V8l-2 1V5l-3 2.5L9 5v4L7 8v3l-2-1v3l-2-1v9Z"/></svg>',
    chevronDown: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>',
    arrow: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h13M13 6l6 6-6 6"/></svg>',
    clock: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    map: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#0F3328" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4 3 6.5v13L9 17l6 2.5 6-2.5v-13L15 7 9 4Z"/><path d="M9 4v13M15 7v12.5"/></svg>',
    pin: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#0F3328" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z"/><circle cx="12" cy="10" r="2.4"/></svg>',
    chat: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#0F3328" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M5 5h14v11H9l-4 3.5V5Z"/><path d="M12 8.5v3.2"/><circle cx="12" cy="14.4" r=".7" fill="#0F3328" stroke="none"/></svg>',
    camera: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#0F3328" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8h3l1.6-2h8.8L18 8h3v11H3V8Z"/><circle cx="12" cy="13" r="3.1"/></svg>',
    burger: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
    search: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.4-3.4"/></svg>',
    backW: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
    share: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V4M8 7l4-3 4 3"/><path d="M5 12v7h14v-7"/></svg>',
    cal: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#C6A14A" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4.5" width="18" height="16.5" rx="2.5"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/></svg>',
    user: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#C6A14A" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="3.4"/><path d="M5 20a7 7 0 0 1 14 0"/></svg>',
    shield: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#C6A14A" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 5 6v5c0 4 3 7 7 9 4-2 7-5 7-9V6l-7-3Z"/></svg>',
    check: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#C6A14A" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/></svg>',
    mapW: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#0F3328" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s6-5 6-10a6 6 0 1 0-12 0c0 5 6 10 6 10Z"/><circle cx="12" cy="11" r="2"/></svg>',
    cube: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z"/><path d="m12 3 8 4.5L12 12 4 7.5M12 12v9"/></svg>',
    bulb: '<svg width="15" height="15" viewBox="0 0 24 24" fill="#2a210a"><path d="M12 2a7 7 0 0 0-4 12.7V18h8v-3.3A7 7 0 0 0 12 2Z"/></svg>',
    bulbGold: '<svg width="16" height="16" viewBox="0 0 24 24" fill="#C6A14A"><path d="M12 2a7 7 0 0 0-4 12.7V18h8v-3.3A7 7 0 0 0 12 2Z"/></svg>',
    chevR: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9aa093" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg>',
    chevRdk: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0F3328" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg>'
  };

  const navIcon = {
    home: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/></svg>',
    timeline: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    map: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4 3 6.5v13L9 17l6 2.5 6-2.5v-13L15 7 9 4Z"/><path d="M9 4v13M15 7v12.5"/></svg>',
    parcours: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z"/><circle cx="12" cy="10" r="2.4"/></svg>',
    more: '<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="19" cy="12" r="1.7"/></svg>'
  };

  /* ---------- Styles dérivés ---------- */
  const tabStyle = (active) =>
    'white-space:nowrap;flex:0 0 auto;border-radius:999px;padding:9px 16px;font-family:Mulish;font-weight:800;font-size:12.5px;letter-spacing:.4px;cursor:pointer;' +
    (active ? 'border:none;background:#FBF9F1;color:#0F3328;' : 'border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.06);color:rgba(255,255,255,.78);');

  /* ---------- Écrans ---------- */
  function homeHTML() {
    const card = (attrs, icon, title, sub) =>
      `<button ${attrs} style="text-align:left;background:#FBF9F1;border:none;border-radius:16px;padding:17px 16px;cursor:pointer;box-shadow:0 10px 24px rgba(0,0,0,.22);">
        ${icon}
        <div style="font-weight:800;font-size:14.5px;color:#20291F;margin-top:11px;letter-spacing:.2px;">${title}</div>
        <div style="font-size:11.5px;color:#6F7468;margin-top:4px;line-height:1.35;font-weight:500;">${sub}</div>
      </button>`;
    return `<div class="screen" style="animation:fadeIn .4s ease;">
      <div style="position:relative;background:#0F3328;">
        <div style="position:relative;">
          <img src="assets/hero-caricature.png" alt="Caricature de la Citadelle de Namur" style="display:block;width:100%;height:auto;" />
          <div style="position:absolute;left:0;right:0;bottom:0;height:44%;background:linear-gradient(180deg, rgba(15,51,40,0) 0%, rgba(13,44,33,.5) 52%, rgba(15,51,40,.92) 84%, #0F3328 100%);"></div>
          <div style="position:absolute;top:0;left:0;right:0;display:flex;align-items:center;justify-content:space-between;padding:20px 18px 0;">
            <div style="display:flex;align-items:center;gap:11px;">
              <div style="width:38px;height:38px;border-radius:10px;background:rgba(255,255,255,.16);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;border:1px solid rgba(255,255,255,.25);">${I.castle}</div>
              <div style="display:flex;flex-direction:column;gap:5px;color:#fff;text-shadow:0 1px 8px rgba(0,0,0,.45);">
                <div style="font-weight:900;font-size:14px;letter-spacing:1.5px;line-height:1;white-space:nowrap;">CITADEL GUIDE</div>
                <div style="font-weight:600;font-size:10px;letter-spacing:3px;opacity:.85;line-height:1;">NAMUR</div>
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:5px;background:rgba(255,255,255,.16);backdrop-filter:blur(6px);border:1px solid rgba(255,255,255,.28);border-radius:999px;padding:7px 12px;color:#fff;font-weight:800;font-size:12px;letter-spacing:.5px;">FR ${I.chevronDown}</div>
          </div>
        </div>
        <div style="padding:0 22px 28px;margin-top:-42px;position:relative;z-index:2;">
          <div style="color:rgba(255,255,255,.92);font-size:17px;font-weight:500;letter-spacing:.3px;text-shadow:0 1px 10px rgba(0,0,0,.5);">Bienvenue à la</div>
          <div style="font-family:var(--serif);font-weight:800;font-size:46px;line-height:.98;color:#fff;margin:4px 0 8px;text-shadow:0 2px 18px rgba(0,0,0,.45);text-wrap:balance;">Citadelle de Namur</div>
          <div style="color:rgba(255,255,255,.88);font-size:15.5px;font-weight:500;text-shadow:0 1px 8px rgba(0,0,0,.5);">2000 ans d'histoire à explorer</div>
          <div style="display:flex;flex-direction:column;gap:11px;margin-top:20px;">
            <button data-act="go" data-screen="parcours" style="display:flex;align-items:center;justify-content:space-between;gap:10px;background:#0F3328;color:#fff;border:1px solid rgba(255,255,255,.12);border-radius:14px;padding:16px 20px;font-family:Mulish;font-weight:800;font-size:14px;letter-spacing:1px;cursor:pointer;box-shadow:0 12px 30px rgba(8,24,16,.5);">
              <span style="white-space:nowrap;">COMMENCER LA VISITE</span>${I.arrow}
            </button>
            <button data-act="go" data-screen="timeline" style="display:flex;align-items:center;justify-content:center;gap:11px;background:rgba(255,255,255,.13);backdrop-filter:blur(8px);color:#fff;border:1px solid rgba(255,255,255,.3);border-radius:14px;padding:15px 20px;font-family:Mulish;font-weight:800;font-size:13.5px;letter-spacing:1px;cursor:pointer;">${I.clock}EXPLORER LA TIMELINE</button>
          </div>
        </div>
      </div>
      <div style="background:#0F3328;padding:4px 16px 26px;">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          ${card('data-act="go" data-screen="map"', I.map, 'Carte interactive', 'Explorez les lieux emblématiques')}
          ${card('data-act="go" data-screen="parcours"', I.pin, 'Parcours guidé', 'Les 9 étapes, prêtes à découvrir')}
          ${card('data-act="go" data-screen="anecdotes"', I.chat, 'Anecdotes', 'Histoires et secrets de la Citadelle')}
          ${card('data-act="openPhotos"', I.camera, 'Photos & 3D', 'Images historiques et reconstitutions')}
        </div>
      </div>
    </div>`;
  }

  function timelineHTML() {
    return `<div class="screen" style="animation:fadeIn .35s ease;min-height:100%;background:#ECE7D6;">
      <div style="position:sticky;top:0;z-index:5;background:#0F3328;display:flex;align-items:center;justify-content:space-between;padding:18px 18px;box-shadow:0 6px 20px rgba(0,0,0,.18);">
        <button data-act="more" style="background:none;border:none;cursor:pointer;padding:4px;">${I.burger}</button>
        <div style="display:flex;flex-direction:column;align-items:center;gap:3px;">
          <div style="color:#fff;font-weight:900;font-size:15px;letter-spacing:3px;line-height:1;">TIMELINE</div>
          <div style="color:rgba(255,255,255,.7);font-size:11.5px;font-weight:500;line-height:1;letter-spacing:.4px;white-space:nowrap;">2000 ans d'histoire</div>
        </div>
        <button style="background:none;border:none;cursor:pointer;padding:4px;">${I.search}</button>
      </div>
      <div style="padding:22px 18px 30px;position:relative;">
        <div style="position:absolute;left:46px;top:30px;bottom:30px;width:2px;background:linear-gradient(#0F3328,#C6A14A);opacity:.45;"></div>
        ${timeline.map((ev) => `
          <div style="display:flex;gap:16px;position:relative;margin-bottom:18px;">
            <div style="flex:0 0 16px;display:flex;justify-content:center;padding-top:30px;">
              ${ev.active
                ? '<div style="width:16px;height:16px;border-radius:50%;background:#B23B2D;border:3px solid #ECE7D6;box-shadow:0 0 0 2px #B23B2D;animation:pulse 2.4s infinite;"></div>'
                : '<div style="width:11px;height:11px;border-radius:50%;background:#0F3328;border:2px solid #ECE7D6;outline:1px solid rgba(15,51,40,.3);"></div>'}
            </div>
            <button ${ev.stopId ? `data-act="openStop" data-id="${esc(ev.stopId)}"` : 'disabled'} style="flex:1;text-align:left;display:flex;gap:13px;background:${ev.highlight ? '#FBF9F1' : '#FBF8EF'};border:${ev.highlight ? '2px solid #0F3328' : '1px solid rgba(0,0,0,.04)'};border-radius:15px;padding:11px;cursor:${ev.stopId ? 'pointer' : 'default'};box-shadow:0 6px 16px rgba(40,40,20,.10);">
              <div style="position:relative;flex:0 0 86px;height:86px;border-radius:11px;overflow:hidden;background:linear-gradient(135deg,#2c4a38,#15402f);">
                ${ev.stopId ? `<image-slot id="slot-${esc(ev.stopId)}"${slotSrcAttr('slot-' + ev.stopId)} placeholder="Photo" shape="rounded" radius="11"></image-slot>` : ''}
                <div style="position:absolute;left:6px;bottom:6px;background:rgba(15,51,40,.9);color:#fff;font-size:9.5px;font-weight:800;letter-spacing:.4px;padding:3px 7px;border-radius:6px;pointer-events:none;">${esc(ev.date)}</div>
              </div>
              <div style="flex:1;min-width:0;padding-top:2px;">
                <div style="font-family:var(--serif);font-weight:700;font-size:16.5px;color:#20291F;line-height:1.1;">${esc(ev.title)}</div>
                ${ev.subtitle ? `<div style="font-weight:800;font-size:12.5px;color:#0F3328;margin-top:3px;">${esc(ev.subtitle)}</div>` : ''}
                <div style="font-size:11.5px;color:#6F7468;margin-top:5px;line-height:1.4;font-weight:500;">${esc(ev.desc)}</div>
              </div>
            </button>
          </div>`).join('')}
      </div>
    </div>`;
  }

  function infoCard(icon, label, value) {
    return `<div style="background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.1);border-radius:14px;padding:14px;">
      <div style="display:flex;align-items:center;gap:7px;color:#C6A14A;">${icon}<span style="font-size:10px;font-weight:800;letter-spacing:1px;">${esc(label)}</span></div>
      <div style="color:#fff;font-size:13.5px;font-weight:700;margin-top:8px;">${esc(value)}</div>
    </div>`;
  }

  function detailHTML() {
    const stop = stopById(state.stopId);
    const isFav = state.favs.includes(stop.id);
    const tabDefs = [['apercu', 'Aperçu'], ['histoire', 'Histoire'], ['photos', 'Photos'], ['3dplan', '3D & Plan'], ['anec', 'Anecdotes']];
    const slot = 'slot-' + stop.id;

    const note = getNote(stop.id);
    const btnPrimary = 'flex:1;background:#FBF9F1;color:#0F3328;border:none;border-radius:10px;padding:11px;font-weight:800;font-size:12.5px;cursor:pointer;';
    const btnGhost = 'flex:1;background:rgba(255,255,255,.1);color:#fff;border:1px solid rgba(255,255,255,.2);border-radius:10px;padding:11px;font-weight:800;font-size:12.5px;cursor:pointer;';
    const notesBlock = `<div style="margin:0 2px 20px;background:rgba(198,161,74,.08);border:1px solid rgba(198,161,74,.35);border-radius:14px;padding:14px;">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
        <div style="display:flex;align-items:center;gap:7px;color:#C6A14A;font-size:10.5px;font-weight:800;letter-spacing:1px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#C6A14A" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>MES NOTES</div>
        ${(!state.editingNote && note) ? '<button data-act="noteEdit" style="background:none;border:none;color:#C6A14A;font-weight:700;font-size:12px;cursor:pointer;text-decoration:underline;">Modifier</button>' : ''}
      </div>
      ${state.editingNote
        ? `<textarea id="note-input" placeholder="Ajoute tes notes pour la visite…" style="width:100%;margin-top:10px;min-height:90px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.18);border-radius:10px;color:#fff;font-family:Mulish;font-size:14px;line-height:1.5;padding:10px;resize:vertical;box-sizing:border-box;">${esc(note)}</textarea>
           <div style="display:flex;gap:8px;margin-top:10px;"><button data-act="noteSave" style="${btnPrimary}">Enregistrer</button><button data-act="noteCancel" style="${btnGhost}">Annuler</button></div>`
        : note
          ? `<p style="color:rgba(255,255,255,.9);font-size:14px;line-height:1.55;font-weight:500;margin:10px 0 0;white-space:pre-wrap;">${esc(note)}</p>`
          : '<button data-act="noteEdit" style="margin-top:10px;width:100%;background:rgba(255,255,255,.06);border:1px dashed rgba(198,161,74,.5);color:#C6A14A;border-radius:10px;padding:11px;font-weight:700;font-size:13px;cursor:pointer;">＋ Ajouter une note</button>'}
    </div>`;

    let body = '';
    if (state.tab === 'apercu') {
      body = `<div style="animation:fadeUp .3s ease;">
        <div style="position:relative;height:208px;border-radius:18px;overflow:hidden;background:linear-gradient(135deg,#2c4a38,#15402f);box-shadow:0 14px 34px rgba(0,0,0,.4);">
          <image-slot id="${slot}"${slotSrcAttr(slot)} lightbox placeholder="Glisser une reconstitution" shape="rounded" radius="18"></image-slot>
          <div style="position:absolute;left:12px;top:12px;background:rgba(15,51,40,.92);backdrop-filter:blur(4px);color:#C6A14A;font-size:10.5px;font-weight:800;letter-spacing:1px;padding:6px 11px;border-radius:8px;pointer-events:none;white-space:nowrap;">${esc(stop.era)}</div>
        </div>
        <div style="margin-top:11px;">
          <div style="display:flex;align-items:center;gap:6px;color:rgba(255,255,255,.5);font-size:10px;font-weight:800;letter-spacing:1px;margin-bottom:8px;">GALERIE<span style="font-weight:600;letter-spacing:0;opacity:.85;text-transform:none;">· touchez ＋ pour ajouter, une image pour l'agrandir</span></div>
          <div data-scroll style="display:flex;gap:8px;overflow-x:auto;padding-bottom:2px;">
            ${[1, 2, 3, 4, 5].map((n) => `<div style="position:relative;flex:0 0 74px;height:74px;border-radius:11px;overflow:hidden;background:linear-gradient(135deg,#2c4a38,#15402f);"><image-slot id="${slot}-g${n}"${slotSrcAttr(slot + '-g' + n)} lightbox placeholder="＋" shape="rounded" radius="11"></image-slot></div>`).join('')}
          </div>
        </div>
        <p style="color:rgba(255,255,255,.9);font-size:15px;line-height:1.6;font-weight:500;margin:16px 2px 14px;text-wrap:pretty;">${esc(stop.overview)}</p>
        ${notesBlock}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:11px;">
          ${infoCard(I.cal, 'PÉRIODE', stop.period)}
          ${infoCard(I.user, 'BÂTISSEURS', stop.batisseurs)}
          ${infoCard(I.shield, 'FONCTION', stop.fonction)}
          ${infoCard(I.check, 'ÉTAT', stop.etat)}
        </div>
        <div style="display:flex;gap:10px;margin-top:16px;">
          <button data-act="openOnMap" style="flex:1;display:flex;align-items:center;justify-content:center;gap:8px;background:#FBF9F1;color:#0F3328;border:none;border-radius:13px;padding:14px;font-weight:800;font-size:12.5px;letter-spacing:.5px;cursor:pointer;">${I.mapW}VOIR SUR LA CARTE</button>
          <button data-act="tab" data-tab="3dplan" style="flex:1;display:flex;align-items:center;justify-content:center;gap:8px;background:rgba(255,255,255,.1);color:#fff;border:1px solid rgba(255,255,255,.2);border-radius:13px;padding:14px;font-weight:800;font-size:12.5px;letter-spacing:.5px;cursor:pointer;">${I.cube}MODE 3D</button>
        </div>
        ${stop.anecdotes.length ? `<button data-act="tab" data-tab="anec" style="width:100%;text-align:left;margin-top:14px;background:linear-gradient(120deg,#C6A14A,#a8842f);border:none;border-radius:15px;padding:16px 17px;cursor:pointer;box-shadow:0 10px 26px rgba(166,132,47,.35);">
          <div style="display:flex;align-items:center;gap:8px;color:#2a210a;font-weight:900;font-size:11px;letter-spacing:1.4px;">${I.bulb}LE SAVIEZ-VOUS ?</div>
          <div style="color:#241c08;font-size:13.5px;line-height:1.45;font-weight:600;margin-top:8px;">${esc(stop.anecdotes[0])}</div>
        </button>` : ''}
      </div>`;
    } else if (state.tab === 'histoire') {
      const blocks = stop.sections.length
        ? stop.sections.map((s) => `<p style="color:rgba(255,255,255,.92);font-size:15.5px;line-height:1.68;font-weight:500;text-wrap:pretty;margin:0 0 16px;">${s.titre ? `<span style="font-family:var(--serif);font-style:italic;color:#C6A14A;">${esc(s.titre)}.</span> ` : ''}${esc(s.texte)}</p>`).join('')
        : `<p style="color:rgba(255,255,255,.92);font-size:15.5px;line-height:1.68;font-weight:500;text-wrap:pretty;">${esc(stop.overview)}</p>`;
      const sources = stop.sources.length ? `
        <div style="height:1px;background:rgba(255,255,255,.12);margin:22px 0 16px;"></div>
        <div style="color:rgba(255,255,255,.6);font-size:11px;font-weight:800;letter-spacing:1.4px;margin-bottom:10px;">SOURCES</div>
        <div style="display:flex;flex-direction:column;gap:7px;">
          ${stop.sources.map((src) => `<a href="${esc(src.url || '#')}" target="_blank" rel="noopener" style="color:rgba(255,255,255,.75);font-size:12px;font-weight:600;text-decoration:none;display:flex;gap:8px;align-items:flex-start;">
            <span style="color:#C6A14A;flex:0 0 auto;">›</span><span style="text-decoration:underline;text-underline-offset:2px;text-decoration-color:rgba(198,161,74,.5);">${esc(src.titre)}</span></a>`).join('')}
        </div>` : '';
      body = `<div style="animation:fadeUp .3s ease;padding-top:4px;">
        <div style="font-family:var(--serif);font-style:italic;font-size:19px;color:#C6A14A;margin-bottom:12px;">${esc(stop.period)}</div>
        ${blocks}
        <div style="height:1px;background:rgba(255,255,255,.12);margin:22px 0;"></div>
        <div style="color:rgba(255,255,255,.6);font-size:11px;font-weight:800;letter-spacing:1.4px;margin-bottom:12px;">DANS LE PARCOURS</div>
        <div style="display:flex;align-items:center;gap:10px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:14px;padding:14px;">
          <div style="font-family:var(--serif);font-weight:800;font-size:30px;color:#C6A14A;line-height:1;">${esc(stop.num)}</div>
          <div><div style="color:#fff;font-weight:700;font-size:14px;">${esc(stop.title)}</div><div style="color:rgba(255,255,255,.6);font-size:12px;margin-top:2px;font-weight:500;">Étape ${esc(stop.num)} sur ${stops.length} · ${esc(stop.era)}</div></div>
        </div>
        ${sources}
      </div>`;
    } else if (state.tab === 'photos') {
      const pistes = stop.pistes.length ? `
        <div style="color:rgba(255,255,255,.55);font-size:11px;font-weight:800;letter-spacing:1.2px;margin:18px 0 10px;">PISTES DE PHOTOS (À SOURCER)</div>
        <div style="display:flex;flex-direction:column;gap:8px;">
          ${stop.pistes.map((p) => `<div style="color:rgba(255,255,255,.82);font-size:12.5px;line-height:1.4;font-weight:500;">• ${esc(p.sujet)}${p.source_suggeree ? ` <span style="color:#C6A14A;font-weight:700;">— ${esc(p.source_suggeree)}</span>` : ''}</div>`).join('')}
        </div>` : '';
      body = `<div style="animation:fadeUp .3s ease;padding-top:4px;">
        <div style="color:rgba(255,255,255,.6);font-size:11px;font-weight:800;letter-spacing:1.4px;margin-bottom:12px;">COMPARAISON PASSÉ / PRÉSENT</div>
        <div style="position:relative;height:200px;border-radius:16px;overflow:hidden;background:linear-gradient(135deg,#2c4a38,#15402f);margin-bottom:11px;">
          <image-slot id="${slot}-a"${slotSrcAttr(slot + '-a')} lightbox placeholder="Glisser une photo (passé)" shape="rounded" radius="16"></image-slot>
          <div style="position:absolute;left:10px;top:10px;background:rgba(15,51,40,.9);color:#fff;font-size:10px;font-weight:800;letter-spacing:.6px;padding:5px 10px;border-radius:7px;pointer-events:none;">AUTREFOIS</div>
        </div>
        <div style="position:relative;height:200px;border-radius:16px;overflow:hidden;background:linear-gradient(135deg,#2c4a38,#15402f);">
          <image-slot id="${slot}-b"${slotSrcAttr(slot + '-b')} lightbox placeholder="Glisser une photo (présent)" shape="rounded" radius="16"></image-slot>
          <div style="position:absolute;left:10px;top:10px;background:rgba(198,161,74,.95);color:#241c08;font-size:10px;font-weight:800;letter-spacing:.6px;padding:5px 10px;border-radius:7px;pointer-events:none;">AUJOURD'HUI</div>
        </div>
        ${pistes}
      </div>`;
    } else if (state.tab === '3dplan') {
      body = `<div style="animation:fadeUp .3s ease;padding-top:4px;">
        <div style="position:relative;height:230px;border-radius:18px;overflow:hidden;border:1px solid rgba(255,255,255,.12);background:radial-gradient(120% 90% at 50% 20%, #1c4636 0%, #0c281d 100%);display:flex;align-items:center;justify-content:center;">
          <svg width="150" height="150" viewBox="0 0 120 120" fill="none" stroke="rgba(198,161,74,.7)" stroke-width="1.4" stroke-linejoin="round"><path d="M60 18 96 38v44L60 102 24 82V38L60 18Z"/><path d="M60 18v84M24 38l36 20 36-20M24 82l36-20 36 20" opacity=".5"/><path d="M60 36 78 46v20L60 76 42 66V46l18-10Z" fill="rgba(198,161,74,.12)"/></svg>
          <div style="position:absolute;left:14px;bottom:14px;color:rgba(255,255,255,.85);"><div style="font-weight:800;font-size:13px;">Modèle 3D interactif</div><div style="font-size:11.5px;color:rgba(255,255,255,.6);font-weight:500;margin-top:2px;">Pincez pour pivoter · à venir</div></div>
          <div style="position:absolute;right:14px;top:14px;background:rgba(198,161,74,.95);color:#241c08;font-size:9.5px;font-weight:800;letter-spacing:.8px;padding:5px 9px;border-radius:7px;">3D</div>
        </div>
        <div style="color:rgba(255,255,255,.6);font-size:11px;font-weight:800;letter-spacing:1.4px;margin:20px 0 11px;">PLAN HISTORIQUE</div>
        <div style="position:relative;height:200px;border-radius:16px;overflow:hidden;background:#13402f;">
          <image-slot id="${slot}-plan"${slotSrcAttr(slot + '-plan')} lightbox placeholder="Glisser un plan / une gravure" shape="rounded" radius="16"></image-slot>
        </div>
      </div>`;
    } else { // anec
      const rest = stop.anecdotes.slice(1);
      body = `<div style="animation:fadeUp .3s ease;padding-top:4px;">
        <div style="background:linear-gradient(120deg,#C6A14A,#a8842f);border-radius:18px;padding:22px 20px;box-shadow:0 14px 30px rgba(166,132,47,.3);">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="rgba(36,28,8,.5)"><path d="M7 7h5v6c0 3-2 4.5-5 5v-2c1.6-.4 2.5-1.2 2.6-2.5H7V7Zm8 0h5v6c0 3-2 4.5-5 5v-2c1.6-.4 2.5-1.2 2.6-2.5H15V7Z"/></svg>
          <div style="font-family:var(--serif);font-size:21px;line-height:1.4;color:#241c08;font-weight:600;margin-top:8px;text-wrap:pretty;">${esc(stop.anecdotes[0] || '')}</div>
        </div>
        ${rest.length ? `<div style="margin-top:18px;display:flex;flex-direction:column;gap:13px;">
          ${rest.map((a) => `<div style="display:flex;gap:11px;align-items:flex-start;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:14px;padding:14px;">
            <span style="flex:0 0 auto;margin-top:2px;">${I.bulbGold}</span>
            <div style="color:rgba(255,255,255,.88);font-size:14px;line-height:1.55;font-weight:500;text-wrap:pretty;">${esc(a)}</div>
          </div>`).join('')}
        </div>` : ''}
      </div>`;
    }

    return `<div class="screen" style="animation:fadeIn .35s ease;min-height:100%;background:#0F3328;">
      <div style="position:sticky;top:0;z-index:6;background:#0F3328;padding:16px 16px 0;">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;">
          <button data-act="back" style="background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.16);border-radius:11px;width:40px;height:40px;display:flex;align-items:center;justify-content:center;cursor:pointer;flex:0 0 auto;">${I.backW}</button>
          <div style="flex:1;text-align:center;padding-top:1px;">
            <div style="font-family:var(--serif);font-weight:700;font-size:22px;color:#fff;line-height:1.05;">${esc(stop.title)}</div>
            <div style="color:rgba(255,255,255,.72);font-size:13px;font-weight:600;margin-top:3px;">${esc(stop.subtitle)}</div>
          </div>
          <div style="display:flex;gap:8px;flex:0 0 auto;">
            <button data-act="toggleFav" aria-label="Favori" style="background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.16);border-radius:11px;width:40px;height:40px;display:flex;align-items:center;justify-content:center;cursor:pointer;"><svg width="20" height="20" viewBox="0 0 24 24" fill="${isFav ? '#B23B2D' : 'none'}" stroke="${isFav ? '#B23B2D' : '#fff'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20s-7-4.6-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.4-7 10-7 10Z"/></svg></button>
            <button aria-label="Partager" style="background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.16);border-radius:11px;width:40px;height:40px;display:flex;align-items:center;justify-content:center;cursor:pointer;">${I.share}</button>
          </div>
        </div>
        <div data-scroll style="display:flex;gap:8px;overflow-x:auto;padding:16px 0 14px;">
          ${tabDefs.map(([k, label]) => `<button data-act="tab" data-tab="${k}" style="${tabStyle(state.tab === k)}">${label}</button>`).join('')}
        </div>
      </div>
      <div style="background:#0F3328;padding:0 16px 28px;">${body}</div>
    </div>`;
  }

  function pinStyle(p, sel) {
    const main = p.type === 'main';
    return `position:absolute;left:${p.x}%;top:${p.y}%;transform:translate(-50%,-50%) scale(${sel ? 1.08 : 1});display:flex;align-items:center;gap:5px;background:${main ? '#B23B2D' : '#FBF9F1'};color:${main ? '#fff' : '#1F2922'};border:${main ? 'none' : (sel ? '2px solid #B23B2D' : '1px solid rgba(0,0,0,.06)')};border-radius:999px;padding:${main ? '7px 12px' : '6px 11px'};font-family:Mulish;font-weight:800;font-size:${main ? '12.5px' : '11.5px'};white-space:nowrap;cursor:pointer;box-shadow:${sel ? '0 8px 22px rgba(0,0,0,.4)' : '0 4px 12px rgba(0,0,0,.28)'};z-index:${sel ? 6 : (main ? 4 : 3)};transition:transform .18s ease, box-shadow .18s ease;`;
  }
  function pinIcon(p) {
    if (p.type === 'main') return '<svg width="14" height="14" viewBox="0 0 24 24" fill="#fff"><path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7Z"/><circle cx="12" cy="9" r="2.6" fill="#B23B2D"/></svg>';
    if (p.type === 'star') return '<svg width="13" height="13" viewBox="0 0 24 24" fill="#C6A14A"><path d="m12 4 2.3 4.7 5.2.8-3.8 3.7.9 5.1L12 16.6 7.4 18l.9-5.1L4.5 9.5l5.2-.8L12 4Z"/></svg>';
    if (p.type === 'camera') return '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#0F3328" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8h3l1.6-2h8.8L18 8h3v11H3V8Z"/><circle cx="12" cy="13" r="3.1"/></svg>';
    return '';
  }
  function mapHTML() {
    const sel = state.selectedPin ? stopById(state.selectedPin) : null;
    return `<div class="screen" style="animation:fadeIn .35s ease;height:100%;display:flex;flex-direction:column;background:#0F3328;">
      <div style="background:#0F3328;display:flex;align-items:center;justify-content:space-between;padding:16px 16px;box-shadow:0 6px 20px rgba(0,0,0,.18);z-index:5;">
        <div style="display:flex;align-items:center;gap:12px;">
          <button data-act="go" data-screen="home" style="background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.16);border-radius:11px;width:38px;height:38px;display:flex;align-items:center;justify-content:center;cursor:pointer;">${I.backW}</button>
          <div style="display:flex;flex-direction:column;gap:3px;"><div style="color:#fff;font-weight:900;font-size:14px;letter-spacing:1px;line-height:1;white-space:nowrap;">CARTE INTERACTIVE</div><div style="color:rgba(255,255,255,.7);font-size:11px;font-weight:500;line-height:1;white-space:nowrap;">Explorez la Citadelle</div></div>
        </div>
      </div>
      <div style="position:relative;flex:1;overflow:hidden;background:#3d6b4f;">
        <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" style="position:absolute;inset:0;width:100%;height:100%;">
          <rect width="100" height="100" fill="#43734f"/>
          <path d="M0 0H100V100H0Z" fill="#3f6c4b"/>
          <path d="M-5 62 C 20 58, 30 70, 48 64 C 60 60, 70 70, 105 66 L 105 105 -5 105 Z" fill="#7fa9c9" opacity=".55"/>
          <path d="M40 -5 C 44 25, 38 40, 48 62 L 60 62 C 54 38, 60 22, 58 -5 Z" fill="#7fa9c9" opacity=".5"/>
          <path d="M18 30 C 30 24, 46 26, 52 36 C 58 46, 50 56, 36 56 C 22 56, 10 44, 18 30 Z" fill="#5c8c66"/>
          <path d="M22 34 L 30 30 L 38 34 L 42 42 L 36 50 L 26 50 L 20 42 Z" fill="#6e9c77" stroke="#cdb87a" stroke-width=".6" opacity=".9"/>
          <path d="M62 16 l4 4 4-4 4 4-4 4 4 4-4 4-4-4-4 4-4-4 4-4-4-4z" fill="#6e9c77" stroke="#cdb87a" stroke-width=".5"/>
          <path d="M70 46 l5 3 5-3 0 6-5 3-5-3z" fill="#6e9c77" stroke="#cdb87a" stroke-width=".5"/>
          <path d="M5 20 C 30 35, 55 30, 80 50" stroke="#cdb87a" stroke-width=".7" fill="none" opacity=".5" stroke-dasharray="2 2"/>
          <path d="M25 75 C 45 60, 60 65, 85 78" stroke="#e8e0c8" stroke-width="1" fill="none" opacity=".4"/>
          <g fill="#4d8059" opacity=".55"><circle cx="12" cy="48" r="2"/><circle cx="86" cy="30" r="2.4"/><circle cx="90" cy="70" r="2"/><circle cx="8" cy="72" r="2.2"/><circle cx="55" cy="80" r="1.8"/></g>
        </svg>
        <div style="position:absolute;inset:0;background:linear-gradient(180deg, rgba(15,51,40,.25), rgba(15,51,40,0) 30%, rgba(15,51,40,0) 70%, rgba(15,51,40,.35));"></div>
        ${pins.map((p) => `<button data-act="selectPin" data-id="${esc(p.id)}" style="${pinStyle(p, state.selectedPin === p.id)}">${pinIcon(p)}<span>${esc(p.label)}</span></button>`).join('')}
        <div style="position:absolute;left:14px;bottom:18px;display:flex;flex-direction:column;background:#fff;border-radius:11px;overflow:hidden;box-shadow:0 6px 18px rgba(0,0,0,.25);">
          <span style="width:42px;height:42px;display:flex;align-items:center;justify-content:center;border-bottom:1px solid #e7e2d4;"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0F3328" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg></span>
          <span style="width:42px;height:42px;display:flex;align-items:center;justify-content:center;"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0F3328" stroke-width="2.2" stroke-linecap="round"><path d="M5 12h14"/></svg></span>
        </div>
        <div style="position:absolute;right:14px;bottom:18px;width:48px;height:48px;border-radius:50%;background:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 6px 18px rgba(0,0,0,.25);"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#B23B2D" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3.5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg></div>
        ${sel ? `<button data-act="openStop" data-id="${esc(sel.id)}" style="position:absolute;left:14px;right:14px;bottom:80px;display:flex;align-items:center;gap:13px;text-align:left;background:#FBF9F1;border:none;border-radius:16px;padding:13px;cursor:pointer;box-shadow:0 14px 34px rgba(0,0,0,.35);animation:fadeUp .25s ease;">
          <div style="position:relative;flex:0 0 64px;height:64px;border-radius:12px;overflow:hidden;background:linear-gradient(135deg,#2c4a38,#15402f);"><image-slot id="slot-${esc(sel.id)}"${slotSrcAttr('slot-' + sel.id)} placeholder="" shape="rounded" radius="12"></image-slot></div>
          <div style="flex:1;min-width:0;">
            <div style="font-size:10px;font-weight:800;letter-spacing:1px;color:#B23B2D;">${esc(sel.era)}</div>
            <div style="font-family:var(--serif);font-weight:700;font-size:17px;color:#20291F;line-height:1.05;margin-top:2px;">${esc(sel.mapLabel)}</div>
            <div style="font-size:11.5px;color:#6F7468;margin-top:3px;font-weight:600;">${esc(sel.subtitle)}</div>
          </div>${I.chevRdk}
        </button>` : ''}
      </div>
    </div>`;
  }

  function parcoursHTML() {
    const total = stops.length;
    const visitedCount = state.visited.length;
    const pct = Math.round((visitedCount / total) * 100);
    const firstTodo = stops.find((s) => !state.visited.includes(s.id));
    return `<div class="screen" style="animation:fadeIn .35s ease;min-height:100%;background:#ECE7D6;">
      <div style="position:sticky;top:0;z-index:5;background:#0F3328;display:flex;align-items:center;justify-content:space-between;padding:18px 18px;box-shadow:0 6px 20px rgba(0,0,0,.18);">
        <button data-act="go" data-screen="home" style="background:none;border:none;cursor:pointer;padding:4px;">${I.backW}</button>
        <div style="display:flex;flex-direction:column;align-items:center;gap:3px;"><div style="color:#fff;font-weight:900;font-size:14px;letter-spacing:2px;line-height:1;white-space:nowrap;">PARCOURS GUIDÉ</div><div style="color:rgba(255,255,255,.7);font-size:11px;font-weight:500;line-height:1;white-space:nowrap;">Le grand tour · ${total} étapes</div></div>
        <div style="width:30px;"></div>
      </div>
      <div style="padding:18px 16px 6px;">
        <div style="background:#0F3328;border-radius:20px;padding:20px;color:#fff;box-shadow:0 14px 32px rgba(15,51,40,.3);position:relative;overflow:hidden;">
          <div style="position:absolute;right:-30px;top:-30px;opacity:.12;"><svg width="160" height="160" viewBox="0 0 24 24" fill="#fff"><path d="M3 21h18v-7l-2 1v-3l-2 1V8l-2 1V5l-3 2.5L9 5v4L7 8v3l-2-1v3l-2-1v9Z"/></svg></div>
          <div style="font-family:var(--serif);font-weight:700;font-size:24px;line-height:1.1;position:relative;">2000 ans en ${total} étapes</div>
          <div style="display:flex;gap:16px;margin-top:12px;color:rgba(255,255,255,.82);font-size:12.5px;font-weight:600;position:relative;">
            <span style="display:flex;align-items:center;gap:6px;"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#C6A14A" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>≈ 2 h</span>
            <span style="display:flex;align-items:center;gap:6px;"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#C6A14A" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s6-5 6-10a6 6 0 1 0-12 0c0 5 6 10 6 10Z"/><circle cx="12" cy="11" r="2"/></svg>3,5 km</span>
            <span style="display:flex;align-items:center;gap:6px;"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#C6A14A" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 4 4 9-10"/></svg>${visitedCount}/${total} vus</span>
          </div>
          <div style="margin-top:16px;height:8px;background:rgba(255,255,255,.15);border-radius:99px;overflow:hidden;">
            <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,#C6A14A,#e3c878);border-radius:99px;transition:width .4s ease;"></div>
          </div>
        </div>
      </div>
      <div style="padding:14px 16px 30px;position:relative;">
        <div style="position:absolute;left:42px;top:30px;bottom:40px;width:2px;border-left:2px dashed rgba(15,51,40,.28);"></div>
        ${stops.map((st) => {
          const done = state.visited.includes(st.id);
          const current = !done && firstTodo && firstTodo.id === st.id;
          const numStyle = `width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:var(--serif);font-weight:800;font-size:15px;background:${done ? '#0F3328' : current ? '#B23B2D' : '#FBF9F1'};color:${done || current ? '#fff' : '#0F3328'};border:${done || current ? 'none' : '2px solid rgba(15,51,40,.25)'};box-shadow:0 3px 8px rgba(0,0,0,.12);`;
          return `<div style="display:flex;gap:14px;margin-bottom:13px;position:relative;">
            <div style="flex:0 0 38px;display:flex;justify-content:center;padding-top:18px;z-index:1;">
              <div style="${numStyle}">${done ? '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 4 4 9-10"/></svg>' : `<span>${esc(st.num)}</span>`}</div>
            </div>
            <button data-act="openStop" data-id="${esc(st.id)}" style="flex:1;text-align:left;display:flex;gap:12px;align-items:center;background:${current ? '#FBF9F1' : '#FBF8EF'};border:${current ? '2px solid #B23B2D' : '1px solid rgba(0,0,0,.04)'};border-radius:15px;padding:10px;cursor:pointer;box-shadow:0 5px 14px rgba(40,40,20,.08);">
              <div style="position:relative;flex:0 0 62px;height:62px;border-radius:11px;overflow:hidden;background:linear-gradient(135deg,#2c4a38,#15402f);"><image-slot id="slot-${esc(st.id)}"${slotSrcAttr('slot-' + st.id)} placeholder="" shape="rounded" radius="11"></image-slot></div>
              <div style="flex:1;min-width:0;">
                <div style="display:flex;align-items:center;gap:7px;">
                  <span style="font-size:9.5px;font-weight:800;letter-spacing:.6px;color:#0F3328;background:rgba(15,51,40,.09);padding:2px 7px;border-radius:6px;">${esc(st.era)}</span>
                  ${current ? '<span style="font-size:9px;font-weight:800;letter-spacing:.6px;color:#B23B2D;background:rgba(178,59,45,.12);padding:2px 7px;border-radius:6px;">À SUIVRE</span>' : ''}
                </div>
                <div style="font-family:var(--serif);font-weight:700;font-size:15.5px;color:#20291F;line-height:1.1;margin-top:5px;">${esc(st.title)}</div>
                <div style="font-size:11.5px;color:#6F7468;margin-top:2px;font-weight:500;line-height:1.3;">${esc(st.subtitle)}</div>
              </div>${I.chevR}
            </button>
          </div>`;
        }).join('')}
      </div>
    </div>`;
  }

  function anecdotesHTML() {
    return `<div class="screen" style="animation:fadeIn .35s ease;min-height:100%;background:#ECE7D6;">
      <div style="position:sticky;top:0;z-index:5;background:#0F3328;display:flex;align-items:center;justify-content:space-between;padding:18px 18px;box-shadow:0 6px 20px rgba(0,0,0,.18);">
        <button data-act="go" data-screen="home" style="background:none;border:none;cursor:pointer;padding:4px;">${I.backW}</button>
        <div style="display:flex;flex-direction:column;align-items:center;gap:3px;"><div style="color:#fff;font-weight:900;font-size:14px;letter-spacing:2px;line-height:1;white-space:nowrap;">ANECDOTES</div><div style="color:rgba(255,255,255,.7);font-size:11px;font-weight:500;line-height:1;white-space:nowrap;">Histoires & secrets</div></div>
        <div style="width:30px;"></div>
      </div>
      <div style="padding:18px 16px 30px;display:flex;flex-direction:column;gap:13px;">
        ${stops.filter((s) => s.anecdotes.length).map((s) => `<button data-act="openStop" data-id="${esc(s.id)}" data-tab="anec" style="text-align:left;background:#FBF9F1;border:none;border-radius:16px;padding:16px;cursor:pointer;box-shadow:0 6px 16px rgba(40,40,20,.08);border-left:4px solid #C6A14A;">
          <div style="display:flex;align-items:center;gap:8px;color:#0F3328;">${I.bulbGold}<span style="font-weight:800;font-size:13.5px;">${esc(s.title)}</span></div>
          <div style="font-size:13.5px;color:#3a4138;line-height:1.5;font-weight:500;margin-top:8px;text-wrap:pretty;">${esc(s.anecdotes[0])}</div>
        </button>`).join('')}
      </div>
    </div>`;
  }

  function moreSheetHTML() {
    const row = (act, extra, icon, label) =>
      `<button data-act="${act}"${extra} style="width:100%;display:flex;align-items:center;gap:13px;text-align:left;background:none;border:none;border-bottom:1px solid #ece6d6;padding:15px 4px;cursor:pointer;">${icon}<span style="font-weight:700;font-size:14.5px;color:#20291F;">${label}</span></button>`;
    const ic = (path) => `<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#0F3328" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
    return `<div data-act="closeMore" style="position:absolute;inset:0;z-index:20;background:rgba(8,18,13,.5);backdrop-filter:blur(2px);animation:fadeIn .2s ease;display:flex;align-items:flex-end;">
      <div data-stop style="width:100%;background:#FBF9F1;border-radius:24px 24px 0 0;padding:10px 18px calc(24px + env(safe-area-inset-bottom));animation:sheetUp .3s cubic-bezier(.2,.9,.3,1);">
        <div style="width:42px;height:5px;border-radius:99px;background:#d8d2c0;margin:6px auto 16px;"></div>
        <div style="font-family:var(--serif);font-weight:700;font-size:20px;color:#20291F;margin-bottom:14px;">Plus d'options</div>
        ${row('go', ' data-screen="anecdotes"', ic('<path d="M5 5h14v11H9l-4 3.5V5Z"/>'), 'Anecdotes & secrets')}
        ${row('openPhotos', '', ic('<path d="M3 8h3l1.6-2h8.8L18 8h3v11H3V8Z"/><circle cx="12" cy="13" r="3.1"/>'), 'Galerie photos & 3D')}
        ${row('go', ' data-screen="parcours"', ic('<path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z"/><circle cx="12" cy="10" r="2.4"/>'), 'Parcours guidé complet')}
        <div style="display:flex;align-items:center;justify-content:space-between;padding:15px 4px 6px;"><div style="display:flex;align-items:center;gap:13px;">${ic('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.7 2.5 15.3 0 18M12 3c-2.5 2.7-2.5 15.3 0 18"/>')}<span style="font-weight:700;font-size:14.5px;color:#20291F;">Langue</span></div><div style="background:#0F3328;color:#fff;font-weight:800;font-size:12px;padding:6px 13px;border-radius:99px;letter-spacing:.5px;">FR</div></div>
      </div>
    </div>`;
  }

  /* ---------- Rendu ---------- */
  const view = document.getElementById('view');
  const overlay = document.getElementById('overlay');

  function activeNav() {
    if (state.more) return 'more';
    const s = state.screen;
    if (s === 'home' || s === 'timeline' || s === 'map') return s;
    return 'parcours'; // parcours / detail / anecdotes
  }

  function scrollTop() {
    requestAnimationFrame(() => { try { document.querySelectorAll('[data-scroll]').forEach((el) => { el.scrollTop = 0; }); } catch (e) {} });
  }

  function lightboxHTML() {
    const lb = state.lightbox;
    if (!lb || !lb.list.length) return '';
    const url = lb.list[lb.index];
    const many = lb.list.length > 1;
    const navBtn = 'position:absolute;top:50%;transform:translateY(-50%);width:46px;height:46px;border-radius:50%;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.25);color:#fff;cursor:pointer;font-size:24px;display:flex;align-items:center;justify-content:center;';
    return `<div data-act="lightboxClose" style="position:absolute;inset:0;z-index:40;background:rgba(6,12,9,.95);display:flex;align-items:center;justify-content:center;animation:fadeIn .2s ease;">
      <img src="${esc(url)}" alt="" style="max-width:94%;max-height:82%;object-fit:contain;border-radius:8px;box-shadow:0 20px 60px rgba(0,0,0,.6);" />
      <button data-act="lightboxClose" aria-label="Fermer" style="position:absolute;top:calc(14px + env(safe-area-inset-top));right:16px;width:44px;height:44px;border-radius:50%;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.25);color:#fff;font-size:20px;cursor:pointer;display:flex;align-items:center;justify-content:center;">✕</button>
      ${many ? `<button data-act="lightboxPrev" style="${navBtn}left:10px;">‹</button><button data-act="lightboxNext" style="${navBtn}right:10px;">›</button>
        <div style="position:absolute;bottom:calc(20px + env(safe-area-inset-bottom));left:0;right:0;text-align:center;color:rgba(255,255,255,.7);font-size:12px;font-weight:700;">${lb.index + 1} / ${lb.list.length}</div>` : ''}
    </div>`;
  }
  function renderOverlay() {
    overlay.innerHTML = state.lightbox ? lightboxHTML() : state.more ? moreSheetHTML() : '';
  }
  function render() {
    let html = '';
    switch (state.screen) {
      case 'home': html = homeHTML(); break;
      case 'timeline': html = timelineHTML(); break;
      case 'detail': html = detailHTML(); break;
      case 'map': html = mapHTML(); break;
      case 'parcours': html = parcoursHTML(); break;
      case 'anecdotes': html = anecdotesHTML(); break;
      default: html = homeHTML();
    }
    view.innerHTML = html;
    renderOverlay();
    const an = activeNav();
    document.querySelectorAll('.nav button').forEach((b) => b.classList.toggle('active', b.getAttribute('data-nav') === an));
  }

  /* ---------- Navigation / actions ---------- */
  function go(screen) {
    state.prevScreen = state.screen === 'detail' ? state.prevScreen : state.screen;
    state.screen = screen;
    state.more = false;
    state.selectedPin = null;
    state.editingNote = false;
    state.lightbox = null;
    render();
    scrollTop();
  }
  function openStop(id, tab) {
    if (!state.visited.includes(id)) { state.visited = state.visited.concat([id]); saveArr(LS.visited, state.visited); }
    state.prevScreen = state.screen === 'detail' ? state.prevScreen : state.screen;
    state.stopId = id;
    state.tab = tab || 'apercu';
    state.screen = 'detail';
    state.more = false;
    state.selectedPin = null;
    state.editingNote = false;
    state.lightbox = null;
    render();
    scrollTop();
  }
  function toggleFav() {
    const id = state.stopId;
    state.favs = state.favs.includes(id) ? state.favs.filter((x) => x !== id) : state.favs.concat([id]);
    saveArr(LS.favs, state.favs);
    render();
  }

  const ACTIONS = {
    go: (el) => go(el.getAttribute('data-screen')),
    openStop: (el) => openStop(el.getAttribute('data-id'), el.getAttribute('data-tab')),
    back: () => go(state.prevScreen || 'home'),
    more: () => { state.more = true; render(); },
    closeMore: () => { state.more = false; render(); },
    openPhotos: () => openStop((stops.find((s) => s.id === 'terra-nova') || stops[0]).id, 'photos'),
    tab: (el) => { state.tab = el.getAttribute('data-tab'); state.editingNote = false; render(); },
    toggleFav: () => toggleFav(),
    selectPin: (el) => { const id = el.getAttribute('data-id'); state.selectedPin = state.selectedPin === id ? null : id; render(); },
    openOnMap: () => { state.prevScreen = 'detail'; state.selectedPin = state.stopId; state.screen = 'map'; state.more = false; render(); scrollTop(); },
    noteEdit: () => { state.editingNote = true; render(); },
    noteCancel: () => { state.editingNote = false; render(); },
    noteSave: () => { const ta = document.getElementById('note-input'); if (ta) setNote(state.stopId, ta.value); state.editingNote = false; render(); },
    lightboxClose: () => { state.lightbox = null; renderOverlay(); },
    lightboxPrev: () => { const lb = state.lightbox; if (lb) { lb.index = (lb.index - 1 + lb.list.length) % lb.list.length; renderOverlay(); } },
    lightboxNext: () => { const lb = state.lightbox; if (lb) { lb.index = (lb.index + 1) % lb.list.length; renderOverlay(); } }
  };

  document.querySelector('.app-phone').addEventListener('click', (e) => {
    // Le clic sur le panneau interne de la feuille « Plus » ne doit pas la fermer.
    if (e.target.closest('[data-stop]') && !e.target.closest('[data-act]')) return;
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const act = el.getAttribute('data-act');
    if (act === 'closeMore' && e.target.closest('[data-stop]')) return;
    const fn = ACTIONS[act];
    if (fn) { e.preventDefault(); fn(el); }
  });

  // Ouverture plein écran d'une photo (événement émis par <image-slot lightbox>).
  document.querySelector('.app-phone').addEventListener('imageslot:open', (e) => {
    const slots = Array.from(view.querySelectorAll('image-slot[lightbox]')).filter((s) => s.hasAttribute('data-filled'));
    const list = slots.map((s) => s.url).filter(Boolean);
    if (!list.length) return;
    let index = list.indexOf(e.detail && e.detail.url);
    if (index < 0) index = 0;
    state.lightbox = { list, index };
    renderOverlay();
  });

  render();
})();
