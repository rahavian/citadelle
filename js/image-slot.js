/* <image-slot> — emplacement photo que l'utilisateur remplit (glisser-déposer ou clic).
 *
 * Persistance (par ordre de priorité d'affichage) :
 *  • SERVEUR d'authoring (server.py, /api) → /api/upload écrit un VRAI fichier
 *    dans assets/photos/ (+ data/uploads.json). Visible sur tous les appareils.
 *  • Sinon (app statique / hors-ligne) → IndexedDB sur l'appareil : robuste,
 *    gros quota, survit aux rechargements (bien mieux que localStorage sur iOS).
 *  • Fichier déclaré dans content.json (attribut src) en repli de base.
 *
 * Attribut `lightbox` : si présent, un clic sur l'image remplie demande
 * l'ouverture en plein écran (événement 'imageslot:open').
 *
 * Attributs : id (clé, requis) · placeholder · shape · radius · fit · src · lightbox
 */
(() => {
  if (customElements.get('image-slot')) return;

  const PREFIX = 'imgslot:';
  const MAX_DIM = 1600;
  const ACCEPT = ['image/png', 'image/jpeg', 'image/webp', 'image/avif', 'image/gif'];

  // ── État partagé ────────────────────────────────────────────────────────
  let SERVER = false;       // serveur d'authoring détecté ?
  let UPLOADS = {};         // { slotId: "assets/photos/...?v=..." } (serveur/commité)
  const subs = new Set();
  const notifyAll = () => subs.forEach((fn) => { try { fn(); } catch (e) {} });

  // ── IndexedDB (stockage local robuste des dépôts) ───────────────────────
  const DB_NAME = 'citadelle', STORE = 'slots';
  let IDB = null;
  const CACHE = {};         // { slotId: dataURL } — miroir synchrone de l'IDB
  function idbOpen() {
    return new Promise((res) => {
      if (typeof indexedDB === 'undefined') return res(null);
      let req;
      try { req = indexedDB.open(DB_NAME, 1); } catch (e) { return res(null); }
      req.onupgradeneeded = () => { try { req.result.createObjectStore(STORE); } catch (e) {} };
      req.onsuccess = () => res(req.result);
      req.onerror = () => res(null);
    });
  }
  async function idbLoadAll() {
    IDB = await idbOpen();
    if (!IDB) return;
    try {
      const st = IDB.transaction(STORE, 'readonly').objectStore(STORE);
      const req = st.openCursor();
      await new Promise((res) => {
        req.onsuccess = (e) => { const c = e.target.result; if (c) { CACHE[c.key] = c.value; c.continue(); } else res(); };
        req.onerror = () => res();
      });
    } catch (e) {}
    notifyAll();
  }
  function idbPut(id, val) { if (IDB) try { IDB.transaction(STORE, 'readwrite').objectStore(STORE).put(val, id); } catch (e) {} }
  function idbDel(id) { if (IDB) try { IDB.transaction(STORE, 'readwrite').objectStore(STORE).delete(id); } catch (e) {} }

  function readLocal(id) {
    if (!id) return null;
    if (id in CACHE) return CACHE[id];
    try { return localStorage.getItem(PREFIX + id) || null; } catch (e) { return null; } // legacy
  }
  function writeLocal(id, url) {
    if (!id) return;
    if (url) { CACHE[id] = url; idbPut(id, url); }
    else { delete CACHE[id]; idbDel(id); try { localStorage.removeItem(PREFIX + id); } catch (e) {} }
  }

  async function initShared() {
    if (typeof fetch === 'function') {
      try {
        const r = await fetch('api/uploads', { cache: 'no-store' });
        if (r.ok) { SERVER = true; UPLOADS = (await r.json()) || {}; }
      } catch (e) {}
      if (!SERVER) {
        try { const r = await fetch('data/uploads.json', { cache: 'no-store' }); if (r.ok) UPLOADS = (await r.json()) || {}; } catch (e) {}
      }
      notifyAll();
    }
    if (!SERVER) await idbLoadAll();   // dépôts locaux seulement hors serveur
  }
  initShared();

  async function toDataUrl(file, targetW) {
    const bitmap = await createImageBitmap(file);
    try {
      const cap = Math.min(MAX_DIM, Math.max(1, Math.round((targetW || MAX_DIM) * 2)));
      const scale = Math.min(1, cap / Math.max(bitmap.width, bitmap.height));
      const w = Math.max(1, Math.round(bitmap.width * scale));
      const h = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(bitmap, 0, 0, w, h);
      let out = canvas.toDataURL('image/webp', 0.85);
      if (out.indexOf('data:image/webp') !== 0) out = canvas.toDataURL('image/jpeg', 0.85); // Safari : pas de webp
      return out;
    } finally { bitmap.close && bitmap.close(); }
  }

  const ICON =
    '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
    'stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' +
    '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>' +
    '<path d="m21 15-5-5L5 21"/></svg>';

  const CSS =
    ':host{display:block;position:relative;width:100%;height:100%;' +
    '  font:12px/1.3 Mulish,system-ui,-apple-system,sans-serif;color:rgba(255,255,255,.78)}' +
    '.frame{position:absolute;inset:0;overflow:hidden;background:rgba(255,255,255,.05)}' +
    '.frame img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;-webkit-user-drag:none;user-select:none}' +
    ':host([lightbox][data-filled]) .frame img{cursor:zoom-in}' +
    '.empty{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;' +
    '  justify-content:center;gap:6px;text-align:center;padding:8px;box-sizing:border-box;cursor:pointer;user-select:none}' +
    '.empty svg{opacity:.55}' +
    '.cap{max-width:92%;font-weight:600;letter-spacing:.01em;opacity:.85}' +
    '.sub{font-size:10.5px;opacity:.7}' +
    '.sub u{text-underline-offset:2px}' +
    '.empty:hover .sub{opacity:1}' +
    '.busy{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(8,18,13,.55);color:#fff;font-weight:700;font-size:11px}' +
    '.ring{position:absolute;inset:0;pointer-events:none;border:1.5px dashed rgba(255,255,255,.32);transition:border-color .12s}' +
    ':host([data-over]) .ring{border-color:#C6A14A}' +
    ':host([data-over]) .frame{outline:2px solid #C6A14A;outline-offset:-2px;background:rgba(198,161,74,.12)}' +
    ':host([data-filled]) .ring{display:none}' +
    '.ctl{position:absolute;right:6px;bottom:6px;display:flex;gap:6px;opacity:0;pointer-events:none;transition:opacity .12s}' +
    ':host([data-filled]:hover) .ctl{opacity:1;pointer-events:auto}' +
    '.ctl button{appearance:none;border:0;border-radius:7px;padding:5px 9px;cursor:pointer;' +
    '  background:rgba(8,18,13,.72);color:#fff;font:11px/1 Mulish,system-ui,sans-serif;backdrop-filter:blur(6px)}' +
    '.ctl button:hover{background:rgba(8,18,13,.9)}' +
    '.err{position:absolute;left:6px;right:6px;bottom:6px;color:#fff;background:#B23B2D;' +
    '  font-size:11px;padding:5px 8px;border-radius:6px;pointer-events:none}';

  class ImageSlot extends HTMLElement {
    static get observedAttributes() { return ['placeholder', 'shape', 'radius', 'fit', 'src', 'id', 'lightbox']; }

    constructor() {
      super();
      const root = this.attachShadow({ mode: 'open' });
      root.innerHTML =
        '<style>' + CSS + '</style>' +
        '<div class="frame"><img alt="" draggable="false" style="display:none">' +
        '<div class="empty">' + ICON + '<div class="cap"></div><div class="sub">ou <u>parcourir</u></div></div>' +
        '<div class="ring"></div></div>' +
        '<div class="ctl"><button data-act="replace">Remplacer</button><button data-act="clear">Retirer</button></div>' +
        '<input type="file" accept="' + ACCEPT.join(',') + '" hidden>';
      this._frame = root.querySelector('.frame');
      this._ring = root.querySelector('.ring');
      this._img = root.querySelector('img');
      this._empty = root.querySelector('.empty');
      this._cap = root.querySelector('.cap');
      this._input = root.querySelector('input');
      this._err = null;
      this._depth = 0;
      this._gen = 0;
      this._url = '';
      this._subFn = () => this._render();

      this._empty.addEventListener('click', () => this._input.click());
      this._img.addEventListener('click', (e) => {
        if (this.hasAttribute('lightbox') && this.hasAttribute('data-filled')) {
          e.stopPropagation();
          this.dispatchEvent(new CustomEvent('imageslot:open', { detail: { url: this._url, id: this.id }, bubbles: true, composed: true }));
        }
      });
      root.addEventListener('click', (e) => {
        const act = e.target.getAttribute && e.target.getAttribute('data-act');
        if (act === 'replace') this._input.click();
        if (act === 'clear') this._clear();
      });
      this._input.addEventListener('change', () => {
        const f = this._input.files && this._input.files[0];
        if (f) this._ingest(f);
        this._input.value = '';
      });
    }

    connectedCallback() {
      ['dragenter', 'dragover', 'dragleave', 'drop'].forEach((t) => this.addEventListener(t, this));
      subs.add(this._subFn);
      this._render();
    }
    disconnectedCallback() {
      ['dragenter', 'dragover', 'dragleave', 'drop'].forEach((t) => this.removeEventListener(t, this));
      subs.delete(this._subFn);
    }
    attributeChangedCallback() { if (this.shadowRoot) this._render(); }

    get url() { return this._url || ''; }

    handleEvent(e) {
      if (e.type === 'dragenter' || e.type === 'dragover') {
        e.preventDefault(); e.stopPropagation();
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
        if (e.type === 'dragenter') this._depth++;
        this.setAttribute('data-over', '');
      } else if (e.type === 'dragleave') {
        if (--this._depth <= 0) { this._depth = 0; this.removeAttribute('data-over'); }
      } else if (e.type === 'drop') {
        e.preventDefault(); e.stopPropagation();
        this._depth = 0; this.removeAttribute('data-over');
        const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
        if (f) this._ingest(f);
      }
    }

    _busy(on) {
      let b = this.shadowRoot.querySelector('.busy');
      if (on && !b) { b = document.createElement('div'); b.className = 'busy'; b.textContent = 'Envoi…'; this._frame.appendChild(b); }
      if (!on && b) b.remove();
    }

    async _ingest(file) {
      this._setError(null);
      if (!file || ACCEPT.indexOf(file.type) < 0) { this._setError('Image PNG, JPEG, WebP ou GIF.'); return; }
      const gen = ++this._gen;
      try {
        const url = await toDataUrl(file, this.clientWidth || this.offsetWidth);
        if (gen !== this._gen) return;
        if (SERVER && this.id) {
          this._busy(true);
          const r = await fetch('api/upload', { method: 'POST', headers: { 'X-Slot-Id': this.id, 'Content-Type': 'text/plain' }, body: url });
          this._busy(false);
          if (gen !== this._gen) return;
          const j = await r.json().catch(() => ({}));
          if (!r.ok || !j.ok) throw new Error(j.error || ('HTTP ' + r.status));
          UPLOADS[this.id] = j.url;
          notifyAll();
        } else {
          writeLocal(this.id, url);   // IndexedDB : persistant sur l'appareil
          this._render();
        }
      } catch (err) {
        this._busy(false);
        if (gen !== this._gen) return;
        this._setError('Échec : ' + (err && err.message ? err.message : 'envoi impossible'));
      }
    }

    _clear() {
      this._gen++;
      if (SERVER && this.id && UPLOADS[this.id]) {
        fetch('api/delete', { method: 'POST', headers: { 'X-Slot-Id': this.id } })
          .then(() => { delete UPLOADS[this.id]; notifyAll(); })
          .catch(() => this._setError('Suppression impossible.'));
      } else {
        writeLocal(this.id, null);
        this._render();
      }
    }

    _setError(msg) {
      if (this._err) { this._err.remove(); this._err = null; }
      if (!msg) return;
      const d = document.createElement('div');
      d.className = 'err'; d.textContent = msg;
      this.shadowRoot.appendChild(d);
      this._err = d;
      setTimeout(() => { if (this._err === d) { d.remove(); this._err = null; } }, 3500);
    }

    _render() {
      const shape = (this.getAttribute('shape') || 'rounded').toLowerCase();
      let radius = '12px';
      if (shape === 'circle') radius = '50%';
      else if (shape === 'pill') radius = '9999px';
      else if (shape === 'rect') radius = '0';
      else { const n = parseFloat(this.getAttribute('radius')); radius = (Number.isFinite(n) ? n : 12) + 'px'; }
      this._frame.style.borderRadius = radius;
      this._ring.style.borderRadius = radius;
      this._img.style.objectFit = this.getAttribute('fit') || 'cover';

      const uploaded = this.id ? UPLOADS[this.id] : null;
      const stored = SERVER ? null : readLocal(this.id);
      const url = uploaded || stored || this.getAttribute('src') || '';
      this._url = url;
      this._cap.textContent = this.getAttribute('placeholder') || 'Glisser une photo';
      if (url) {
        if (this._img.getAttribute('src') !== url) this._img.src = url;
        this._img.style.display = 'block';
        this._empty.style.display = 'none';
        this.setAttribute('data-filled', '');
      } else {
        this._img.style.display = 'none';
        this._img.removeAttribute('src');
        this._empty.style.display = 'flex';
        this.removeAttribute('data-filled');
      }
    }
  }

  customElements.define('image-slot', ImageSlot);
})();
