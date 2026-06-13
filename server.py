#!/usr/bin/env python3
"""Serveur d'authoring — Citadel Guide Namur.

Sert l'app (comme `python -m http.server`) ET accepte l'upload de photos depuis
l'app : les images déposées (téléphone ou PC) sont écrites comme de VRAIS
fichiers dans assets/photos/, et la correspondance slot -> fichier est notée
dans data/uploads.json. Résultat : la photo apparaît sur tous les appareils et,
une fois commitée, dans la version hors-ligne.

Usage :  python3 server.py        (port 8000 par défaut, PORT=xxxx pour changer)

Endpoints :
  GET  /api/health         -> {ok, mode:"upload"}
  GET  /api/uploads        -> mapping {slotId: url}
  POST /api/upload         (header X-Slot-Id, corps = data:image/...;base64,...)
  POST /api/delete         (header X-Slot-Id)
Sécurité : type image + taille (<=12 Mo) + slotId restreint aux lieux connus.
Endpoint ouvert tant que le serveur tourne — à arrêter quand tu n'édites pas.
"""
import http.server, socketserver, json, os, re, base64, glob, time

ROOT = os.path.dirname(os.path.abspath(__file__))
PHOTOS_DIR = os.path.join(ROOT, 'assets', 'photos')
UPLOADS_JSON = os.path.join(ROOT, 'data', 'uploads.json')
os.makedirs(PHOTOS_DIR, exist_ok=True)

EXT = {'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/avif': 'avif'}
MAX_BYTES = 12 * 1024 * 1024
SLOT_RE = re.compile(r'^slot-([a-z0-9-]+?)(?:-(a|b|plan))?$')


def valid_ids():
    try:
        d = json.load(open(os.path.join(ROOT, 'data', 'content.json'), encoding='utf-8'))
        return set(l['id'] for l in d['lieux'])
    except Exception:
        return set()


def load_uploads():
    try:
        return json.load(open(UPLOADS_JSON, encoding='utf-8'))
    except Exception:
        return {}


def save_uploads(m):
    os.makedirs(os.path.dirname(UPLOADS_JSON), exist_ok=True)
    json.dump(m, open(UPLOADS_JSON, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=ROOT, **k)

    def log_message(self, *a):
        pass

    def _json(self, code, obj):
        b = json.dumps(obj, ensure_ascii=False).encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(b)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(b)

    def _slot_base(self, slot):
        m = SLOT_RE.match(slot or '')
        if not m or m.group(1) not in valid_ids():
            return None
        return re.sub(r'[^a-z0-9-]', '', slot)

    def _read_body(self):
        n = int(self.headers.get('Content-Length', '0') or 0)
        if n <= 0 or n > MAX_BYTES + 4_000_000:  # marge base64
            return None
        return self.rfile.read(n)

    def do_GET(self):
        p = self.path.split('?')[0]
        if p == '/api/health':
            return self._json(200, {'ok': True, 'mode': 'upload'})
        if p == '/api/uploads':
            return self._json(200, load_uploads())
        return super().do_GET()

    def do_POST(self):
        p = self.path.split('?')[0]
        if p == '/api/upload':
            return self._upload()
        if p == '/api/delete':
            return self._delete()
        return self._json(404, {'ok': False, 'error': 'not found'})

    def _upload(self):
        safe = self._slot_base(self.headers.get('X-Slot-Id', ''))
        if not safe:
            return self._json(400, {'ok': False, 'error': 'slot invalide'})
        body = self._read_body()
        if body is None:
            return self._json(413, {'ok': False, 'error': 'corps manquant ou trop volumineux'})
        m = re.match(r'^data:(image/[a-z+]+);base64,(.+)$', body.decode('utf-8', 'replace').strip(), re.S)
        if not m:
            return self._json(400, {'ok': False, 'error': 'format attendu data:image/...;base64,...'})
        mime = m.group(1)
        if mime not in EXT:
            return self._json(415, {'ok': False, 'error': 'type image non supporté'})
        try:
            raw = base64.b64decode(m.group(2))
        except Exception:
            return self._json(400, {'ok': False, 'error': 'base64 invalide'})
        if len(raw) > MAX_BYTES:
            return self._json(413, {'ok': False, 'error': 'image trop lourde (>12 Mo)'})
        for f in glob.glob(os.path.join(PHOTOS_DIR, safe + '.*')):
            try:
                os.remove(f)
            except Exception:
                pass
        fn = safe + '.' + EXT[mime]
        with open(os.path.join(PHOTOS_DIR, fn), 'wb') as out:
            out.write(raw)
        url = 'assets/photos/' + fn + '?v=' + str(int(time.time()))
        mp = load_uploads()
        mp[self.headers.get('X-Slot-Id')] = url
        save_uploads(mp)
        return self._json(200, {'ok': True, 'url': url})

    def _delete(self):
        slot = self.headers.get('X-Slot-Id', '')
        safe = self._slot_base(slot)
        if not safe:
            return self._json(400, {'ok': False, 'error': 'slot invalide'})
        for f in glob.glob(os.path.join(PHOTOS_DIR, safe + '.*')):
            try:
                os.remove(f)
            except Exception:
                pass
        mp = load_uploads()
        mp.pop(slot, None)
        save_uploads(mp)
        return self._json(200, {'ok': True})


class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


if __name__ == '__main__':
    port = int(os.environ.get('PORT', '8000'))
    with Server(('0.0.0.0', port), Handler) as httpd:
        print('Citadelle — serveur d\'authoring sur le port %d (uploads -> assets/photos/)' % port)
        httpd.serve_forever()
