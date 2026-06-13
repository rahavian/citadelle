# Citadel Guide Namur

Guide de poche (PWA mobile-first, hors-ligne) pour faire visiter la **Citadelle de Namur** : parcours guidé séquentiel, timeline, carte interactive et fiches des lieux. 2000 ans d'histoire, en français.

Application web autonome : **vanilla HTML/CSS/JS**, pas de backend, pas de build. Le contenu et l'interface sont embarqués → fonctionne sans réseau.

## Lancer

```bash
# au choix
python3 -m http.server 8000     # puis http://localhost:8000
# ou ouvrir directement index.html dans le navigateur (le contenu est embarqué)
```

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

Les photos se déposent directement dans l'app (glisser-déposer dans les emplacements verts) et **persistent en local** sur l'appareil — elles ne sont pas dans le dépôt.

## Provenance & écarts assumés

- **Design** : maquette Claude Design (système vert citadelle / Playfair + Mulish, nav 5 onglets) reproduite ici en code réel.
- **Contenu** : `content.json` rédigé puis vérifié par recherche web (sources incluses), conforme au PRD v2 (Esplanade unifiée, 9 lieux).
- **Sans audioguide** (choix repris du design) ; **favoris** conservés (du design).
- Positions carte (`x/y`, `lat/lng`) volontairement `null` dans `content.json` ; l'app utilise un placement **provisoire** des pins en attendant l'asset carte réel.
- Quelques *faits historiques* restent à valider (voir blocs `incertitudes` de `content.json`).
