# Citadel Guide Namur

Guide de poche (PWA mobile-first, hors-ligne) pour faire visiter la **Citadelle de Namur** : parcours guidé séquentiel, timeline, carte interactive et fiches des lieux. 2000 ans d'histoire, en français.

Application web autonome : **vanilla HTML/CSS/JS**, pas de backend, pas de build. Le contenu et l'interface sont embarqués → fonctionne sans réseau.

## Lancer

```bash
# Recommandé : serveur d'authoring (sert l'app ET accepte l'upload de photos)
python3 server.py               # http://localhost:8000  (ou http://<ip-lan>:8000)

# Alternatives en lecture seule (pas d'upload de fichiers)
python3 -m http.server 8000
# ou ouvrir directement index.html (le contenu est embarqué)
```

Depuis un téléphone sur le **même Wi-Fi** : `http://<ip-du-mac>:8000` — l'upload de photos écrit alors de vrais fichiers dans `assets/photos/` (voir ci-dessous).

Pour l'installer sur le téléphone (écran d'accueil, plein écran, hors-ligne) : servir le dossier en HTTPS et utiliser « Ajouter à l'écran d'accueil ». Le *service worker* met alors la coquille en cache.

## Structure

```
index.html            Coquille (cadre téléphone, navigation, montage des écrans)
css/app.css           Reset, polices (repli hors-ligne), animations, navigation
js/app.js             Logique : mappe le contenu sur les 6 écrans + état (visites, favoris)
js/image-slot.js      <image-slot> : emplacement photo glisser-déposer, persistant (localStorage)
data/content.json     SOURCE DE VÉRITÉ du contenu (9 lieux + 11 périodes) — voir SCHEMA.md
data/content.js        content.json embarqué pour fonctionner hors-ligne / en file://
data/SCHEMA.md        Modèle de données documenté
assets/               Image héros (caricature)
icons/                Icônes PWA
manifest.webmanifest  Manifeste PWA
sw.js                 Service worker (cache de la coquille)
```

## Écrans

Accueil · Timeline (11 périodes) · Carte à pins · Parcours guidé (9 étapes, progression mémorisée) · Fiche-lieu à onglets (Aperçu / Histoire / Photos / 3D & Plan / Anecdotes) · Anecdotes · feuille « Plus ».

## Modifier le contenu

1. Éditer `data/content.json` (structure : voir `data/SCHEMA.md`).
2. Régénérer le fichier embarqué :
   ```bash
   python3 -c "import json;d=json.load(open('data/content.json',encoding='utf-8'));open('data/content.js','w',encoding='utf-8').write('/* Généré depuis data/content.json — NE PAS éditer à la main. */\nwindow.CITADELLE_CONTENT = '+json.dumps(d,ensure_ascii=False,indent=2)+';\n')"
   ```

## Photos

L'app résout l'image d'un emplacement dans cet ordre : **upload** (`data/uploads.json`) → aperçu local (`localStorage`, mode statique) → **fichier déclaré** (`content.json` › `images`).

| Méthode | Stockage | Portée |
|---|---|---|
| **Glisser-déposer, serveur `server.py` lancé** | **vrai fichier** dans `assets/photos/` + `data/uploads.json` | **tous les appareils**, persistant, commitable |
| Glisser-déposer, mode statique (sans `server.py`) | `localStorage` du navigateur | un seul appareil + navigateur + URL (aperçu) |
| Déclaration manuelle dans `content.json` › `images` | fichier du projet | tous les appareils, hors-ligne |

### A. Upload via l'app (le plus simple)
Lance `python3 server.py`, ouvre l'app (sur le Mac ou un téléphone du même Wi-Fi via `http://<ip-lan>:8000`), puis **glisse une photo** dans un emplacement vert. Elle est écrite dans `assets/photos/` et notée dans `data/uploads.json` → visible **partout**. « Retirer » supprime le fichier. Pense ensuite à **committer** `assets/photos/` + `data/uploads.json`.

> L'endpoint d'upload est ouvert tant que `server.py` tourne (filtré : type image, ≤ 12 Mo, lieux connus). En LAN il n'est exposé qu'au réseau local ; via tunnel public, à arrêter quand tu n'édites pas.

### B. Déclaration manuelle dans `content.json`
Pour qu'une photo apparaisse **partout**, sans serveur, c'est un fichier du projet :

1. Mettre l'image dans `assets/photos/` (ex. `assets/photos/terra-nova.jpg`).
2. La déclarer dans `data/content.json`, sur le lieu concerné :
   ```json
   "images": {
     "principale": "assets/photos/terra-nova.jpg",
     "avant": "assets/photos/terra-nova-1700.jpg",
     "apres": "assets/photos/terra-nova-auj.jpg",
     "plan": "assets/photos/terra-nova-plan.jpg"
   }
   ```
   (`principale` → fiche + vignettes timeline/parcours/carte · `avant`/`apres` → onglet Photos · `plan` → onglet 3D & Plan)
3. Régénérer `data/content.js` (commande ci-dessus).

Un fichier déclaré est l'image de fond du slot ; un glisser-déposer local le **surcharge** seulement sur cet appareil (bouton « Retirer » pour revenir au fichier).

## Provenance & écarts assumés

- **Design** : maquette Claude Design (système vert citadelle / Playfair + Mulish, nav 5 onglets) reproduite ici en code réel.
- **Contenu** : `content.json` rédigé puis vérifié par recherche web (sources incluses), conforme au PRD v2 (Esplanade unifiée, 9 lieux).
- **Sans audioguide** (choix repris du design) ; **favoris** conservés (du design).
- Positions carte (`x/y`, `lat/lng`) volontairement `null` dans `content.json` ; l'app utilise un placement **provisoire** des pins en attendant l'asset carte réel.
- Quelques *faits historiques* restent à valider (voir blocs `incertitudes` de `content.json`).
