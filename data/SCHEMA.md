# Modèle de données — `content.json`

Source de vérité du contenu de **Citadel Guide Namur** (V1). Fichier statique, embarqué (hors-ligne), pas de backend. Conforme au §5 du PRD v2.

```
content.json
├─ version        : entier (1)
├─ projet         : "Citadel Guide Namur"
├─ lieu_global    : "Citadelle de Namur"
├─ langue         : "fr-FR"   (langue de la synthèse vocale)
├─ lieux[]        : les arrêts du parcours (= points sur la carte)
└─ periodes[]     : les tranches de la Timeline
```

## Entité `Lieu`

Un arrêt physique du parcours guidé, un point cliquable sur la carte.

| Champ | Type | Rôle |
|---|---|---|
| `id` | string | Identifiant technique (slug), ex. `terra-nova`. |
| `nom` | string | Titre affiché. |
| `sous_titre` | string | Accroche courte. |
| `intro` | string | Texte « rapide » ~30 s, **lu par le TTS**. Une seule longueur en V1. |
| `infos_cles[]` | `{label, valeur}` | 3–4 puces : Période · Acteur/architecte · Fonction · État actuel. |
| `anecdotes[]` | string | 3–5 anecdotes. |
| `sections[]` | `{titre, texte}` | Sous-sections internes (ex. Esplanade : Stade → Théâtre ; Terra Nova : Vauban 1692). Vide si non pertinent. |
| `photos[]` | `{url, credit, licence}` | **Vide en V1.** À remplir progressivement (§11) avec crédit + licence vérifiée. |
| `pistes_photos[]` | `{sujet, source_suggeree}` | Indications de visuels libres à sourcer plus tard. Aucune URL/licence inventée. |
| `periodes_liees[]` | string | `id` de périodes de la Timeline. |
| `position` | `{x, y, lat, lng}` | **`null` en V1** : `x/y` dépend de l'asset carte (design) ; `lat/lng` réservé au futur GPS. |
| `ordre_parcours` | entier | Position dans le parcours séquentiel (1 → 9). |
| `sources[]` | `{titre, url, fiabilite}` | Sources du texte. `fiabilite` ∈ `haute` / `moyenne` / `a-verifier`. |
| `incertitudes[]` | string | Faits à valider / écarts entre sources. **Non destiné à l'affichage public** — outil de relecture éditoriale. |

### Champs différés (présents pour l'architecture, non remplis en V1 — §4)
| Champ | Usage futur |
|---|---|
| `texte_2min`, `texte_5min` | Versions longues (`null` en V1). |
| `avant_apres` | Comparaison reconstitution / état actuel (`null` en V1). |

## Entité `Periode`

Une tranche de la Timeline = une *lentille* sur l'histoire. **Pas de fiche propre** : pointe vers ses lieux.

| Champ | Type | Rôle |
|---|---|---|
| `id` | string | Slug préfixé `p-`, ex. `p-vauban-1692`. |
| `label` | string | Intitulé affiché. |
| `dates` | string | Bornes lisibles. |
| `resume` | string | 2–3 phrases. |
| `lieux_lies[]` | string | `id` de lieux à visiter pour cette période (**calculé** à partir des `periodes_liees` des lieux → cohérence bidirectionnelle garantie). |
| `sources[]` | `{titre, url, fiabilite}` | Sources. |
| `incertitudes[]` | string | Faits à valider (relecture). |

## Invariants

- Chaque `lieux[].periodes_liees[]` référence un `periodes[].id` existant.
- `periodes[].lieux_lies[]` est dérivé des lieux ; ne pas l'éditer à la main (régénérer si on change les liens d'un lieu).
- `intro` doit rester lisible par synthèse vocale : pas de symboles parasites, nombres ambigus écrits en toutes lettres.

## Provenance

Contenu rédigé puis **vérifié factuellement** (recherche web) par une orchestration multi-agents, avec passe de cohérence. Les `incertitudes` flaggées et les *faits à vérifier* relèvent d'une **validation éditoriale humaine** avant figement du texte audio.
