/* <image-slot> — emplacement photo que l'utilisateur remplit (glisser-déposer ou clic).
 *
 * Deux modes, détectés automatiquement au chargement :
 *  • SERVEUR (serveur d'authoring server.py présent → /api/health répond) :
 *    l'image est envoyée à /api/upload, écrite comme VRAI fichier dans
 *    assets/photos/, et la correspondance vit dans data/uploads.json.
 *    → visible sur TOUS les appareils, persistant, commitable.
 *  • STATIQUE (simple fichier / http.server / hors-ligne) : repli en
 *    localStorage = aperçu local sur cet appareil uniquement.
 *
 * Les fichiers déjà déclarés (content.json lieu.images, exposés via l'attribut
 * src) et les uploads (data/uploads.json) s'affichent partout sans dépôt.
 *
 * Attributs : id (clé du slot, requis) · placeholder · shape · radius · fit · src
 */
(() => {
  if (customElements.get('image-slot')) return;

  const PREFIX = 'imgslot:';
  const MAX_DIM = 1400;
  const ACCEPT = ['image/png', 'image/jpeg', 'image/webp', 'image/avif', 'image/gif'];

  // ── État partagé (mode serveur + mapping uploads) ───────────────────────
  let SERVER = false;       // serveur d'upload détecté ?
  let UPLOADS = {};         // { slotId: "assets/photos/....?v=..." }
  const subs = new Set();   // slots abonnés (re-render sur changement de mapping)
  const notifyAll = () => subs.forEach((fn) => { try { fn(); } catch (e) {} });

  async function initShared() {
    if (typeof fetch !== 'function') return; // hors navigateur (tests) : repli local
    // 1) serveur d'authoring ?
    try {
      const r = await fetch('api/uploads', { cache: 'no-store' });
      if (r.ok) { SERVER = true; UPLOADS = (await r.json()) || {}; notifyAll(); return; }
    } catch (e) {}
    // 2) sinon, mapping commité (uploads déjà figés dans le dépôt) — lecture seule
    try {
      const r = await fetch('data/uploads.json', { cache: 'no-store' });
      if (r.ok) { UPLOADS = (await r.json()) || {}; notifyAll(); }
    } catch (e) {}
  }
  initShared();

  function readLocal(id) { if (!id) return null; try { return localStorage.getItem(PREFIX + id) || null; } catch (e) { return null; } }
  function writeLocal(id, url) { if (!id) return; try { if (url) localStorage.setItem(PREFIX + id, url); else localStorage.removeItem(PREFIX + id); } catch (e) {} }

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
      if (out.indexOf('data:image/webp') !== 0) out = canvas.toDataURL('image/jpeg', 0.85);
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
    '.empty{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;' +
    '  justify-content:center;gap:6px;text-align:center;padding:10px;box-sizing:border-box;cursor:pointer;user-select:none}' +
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
    '.ctl{position:absolute;right:8px;bottom:8px;display:flex;gap:6px;opacity:0;pointer-events:none;transition:opacity .12s}' +
    ':host([data-filled]:hover) .ctl{opacity:1;pointer-events:auto}' +
    '.ctl button{appearance:none;border:0;border-radius:7px;padding:5px 9px;cursor:pointer;' +
    '  background:rgba(8,18,13,.72);color:#fff;font:11px/1 Mulish,system-ui,sans-serif;backdrop-filter:blur(6px)}' +
    '.ctl button:hover{background:rgba(8,18,13,.9)}' +
    '.err{position:absolute;left:8px;right:8px;bottom:8px;color:#fff;background:#B23B2D;' +
    '  font-size:11px;padding:5px 8px;border-radius:6px;pointer-events:none}';

  class ImageSlot extends HTMLElement {
    static get observedAttributes() { return ['placeholder', 'shape', 'radius', 'fit', 'src', 'id']; }

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
      this._subFn = () => this._render();

      this._empty.addEventListener('click', () => this._input.click());
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
          UPLOADS[this.id] = j.url;     // → vrai fichier, visible partout
          notifyAll();
        } else {
          writeLocal(this.id, url);     // repli aperçu local
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
          .catch(() => { this._setError('Suppression impossible.'); });
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

      // Priorité : upload (fichier réel, partout) > aperçu local (mode statique) > src (content.json).
      const uploaded = this.id ? UPLOADS[this.id] : null;
      const stored = SERVER ? null : readLocal(this.id);
      const url = uploaded || stored || this.getAttribute('src') || '';
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
