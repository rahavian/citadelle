# Citadel Guide Namur — PRD v2

*Spécification produit nettoyée, prête à transmettre à Claude Code (build) et Claude Design (identité visuelle). Cette version résout les contradictions du brief initial et fige le périmètre de la V1.*

---

## 1. Vision

Un guide de poche que le créateur utilise pour **faire visiter la Citadelle de Namur à des amis**, sur place, en marchant. L'app raconte 2000 ans d'histoire en suivant un parcours physique, lieu par lieu, avec textes, anecdotes, photos et audio.

Trois casquettes : guide touristique interactif · mini-musée numérique · audioguide. La frise chronologique et la carte sont des **portes d'entrée secondaires** ; le cœur de l'usage, c'est le **parcours guidé**.

## 2. Public cible

- **Usage premier** : le créateur, comme guide, avec des amis / visiteurs.
- Ensuite : touristes (BE et étrangers), familles, et éventuellement groupes (écoles, visites).

## 3. Décisions tranchées (résolution des contradictions du brief initial)

Ces points étaient contradictoires ou flous dans le brief d'origine. Ils sont désormais figés :

| Sujet | Décision V2 |
|---|---|
| **Identité visuelle** | **Hors-périmètre de ce PRD — déléguée à Claude Design.** Ce document ne fixe ni palette ni style. Un visuel cartoon (hero) est disponible ; le choix « cartoon vs sobre/musée » se tranche directement avec Claude Design. |
| **Structure du parcours** | **1 arrêt = 1 lieu physique** où l'on se tient. Les *époques* et *thèmes* (artillerie, Vauban, période hollandaise…) ne sont plus des arrêts : ils deviennent du **contenu rattaché à un lieu** et/ou des **périodes de la Timeline**. |
| **Esplanade** | Stade des Jeux + Théâtre de Verdure + Corridas = **un seul lieu « L'Esplanade »** (c'est le même bâtiment / le même endroit), avec des sous-sections. Ordre interne : **Stade puis Théâtre**. |
| **Audio-guide** | **Synthèse vocale du navigateur** (TTS), gratuite et hors-ligne. Pas de fichiers audio enregistrés en V1. Voix humaine = évolution future. |
| **Reconstitutions IA / Avant-après** | **Repoussées.** Emplacements prévus mais vides en V1 (assets non disponibles / non alignables aujourd'hui). |
| **Guide IA** | **Supprimé.** Le guide, c'est l'humain. |
| **Favoris** | **Supprimé.** |
| **Hors-ligne** | **Cœur embarqué** (interface + tous les textes + structure) → fonctionne sans réseau. **Médias** (photos, futurs visuels) chargés via 4G, avec repli propre si indisponibles. |
| **Responsive** | **Exigence non négociable.** Mobile-first, portrait, cibles tactiles ≥ 44 px, gestion des encoches (safe-area). |
| **Ambition V1** | **Couverture large, contenu en surface** : tous les lieux présents, mais une seule longueur de texte (version courte) + quelques anecdotes + emplacements photos. |

## 4. Périmètre

### Dans la V1
- Parcours guidé séquentiel (étape par étape, avec progression).
- Fiche-lieu (version courte) pour chaque lieu.
- Timeline historique (consultation + accès aux lieux liés).
- Carte interactive avec points cliquables.
- Galerie photo par lieu (emplacements + photos disponibles).
- Audio-guide par synthèse vocale (lecture du texte).

### Plus tard (différé, à prévoir dans l'architecture mais pas à construire)
- Versions de texte 2 min et 5 min.
- Reconstitutions IA.
- Comparaison avant / après.
- Audio en voix réelle.
- Géolocalisation sur site (position en direct).
- Réalité augmentée.

### Supprimé
- Guide IA.
- Favoris.

## 5. Modèle de contenu (unifié)

Deux entités, plus de mélange :

**Lieu** (= un arrêt physique du parcours, un point sur la carte)
- `id`, `nom`, `sous-titre`
- `intro` (texte court, ~30 s de lecture)
- `infos_cles` : 3-4 paires (Période, Acteur/architecte, Fonction, État actuel)
- `anecdotes` : 3 à 5
- `photos` : liste (URL + crédit + licence)
- `periodes_liees` : ids de périodes Timeline
- `position` : {x, y} sur la carte (et lat/lng pour le futur GPS)
- `ordre_parcours` : entier

**Période** (= une tranche de la Timeline, une *lentille* sur l'histoire)
- `id`, `label`, `dates`, `resume`
- `lieux_lies` : ids de lieux à visiter pour cette période

→ Une période **n'a pas** de fiche à part : elle pointe vers le ou les lieux concernés.

## 6. Parcours guidé — liste des lieux (V1)

Ordre pensé pour un déplacement physique cohérent (du moderne/touristique vers le militaire, comme souhaité). Le mapping montre que **rien du brief initial n'est perdu** : les thèmes deviennent des sections internes.

1. **L'Esplanade** — Stade des Jeux · Théâtre de Verdure · Corridas & loisirs *(Georges Hobé, 1908-1910, « Ludus pro Patria », démilitarisation sous Léopold II)*
2. **Point de vue du Confluent** — Meuse + Sambre, importance stratégique
3. **Château médiéval (des Comtes)** — comtes de Namur, tours, vie quotidienne *(+ section : la révolution de l'artillerie qui rend ce château obsolète)*
4. **La Médiane** — nouveaux remparts, défense moderne
5. **Terra Nova** — extension espagnole, fortifications bastionnées en étoile *(+ section : Vauban et le siège de 1692)*
6. **Ravin de la Foliette** — le principal point faible de la Citadelle
7. **Les Souterrains** — « Termitière de l'Europe », galeries militaires
8. **Les fortifications hollandaises** — 1815-1830, ~90 % de ce qu'on voit aujourd'hui (point de vue sur les remparts)
9. **La Citadelle aujourd'hui** — téléphérique, tourisme, patrimoine vivant

> **À valider (voir §12)** : faut-il garder *Vauban* et *Première/Seconde Guerre mondiale* comme arrêts à part entière, ou rester sur ces 9 lieux ?

## 7. Fiche-lieu — structure (V1)

1. **Titre + sous-titre**
2. **Bandeau infos clés** (3-4 puces : Période · Acteur · Fonction · État)
3. **Texte court** (version « rapide », une seule longueur en V1)
4. **Anecdotes** (3-5)
5. **Galerie photo** (avec crédits + licence ; repli propre si média non chargé)
6. **Bouton Écouter** (TTS du texte court)
7. **Sources**
8. **Bouton « Étape suivante »** (en mode parcours) + **« Voir sur la carte »**

*(Onglets type « Aperçu / Histoire / Photos / Anecdotes » possibles ; l'organisation exacte relève du design → Claude Design.)*

## 8. Timeline

Frise verticale, consultable indépendamment du parcours. Chaque période renvoie vers le(s) lieu(x) lié(s).

Périodes : IIIᵉ siècle · Haut Moyen Âge / Château des Comtes · Révolution de l'artillerie · La Médiane · Terra Nova (extension espagnole) · Vauban (1692) · Reconstruction hollandaise (1815-1830) · Première Guerre mondiale · Seconde Guerre mondiale · Fin de la fonction militaire · Citadelle actuelle.

## 9. Carte interactive

- Carte de la Citadelle, points cliquables = les lieux du §6.
- Tap sur un point → ouvre la fiche-lieu.
- Surbrillance du point quand on arrive depuis une fiche (« Voir sur la carte »).
- Zoom / recentrage : V1 simple, GPS = plus tard.

## 10. Audio-guide

Synthèse vocale du navigateur (`SpeechSynthesis`, langue `fr-FR`), lecture du texte de la fiche. Bouton lecture/arrêt. Fonctionne hors-ligne. Pas d'asset audio à produire.

## 11. Bibliothèque photo

- Objectif indicatif ~50 photos, réparties par lieu, **remplies progressivement** (la V1 n'attend pas que tout soit prêt).
- **Priorité aux sources libres** : Wikimedia Commons (cartes postales anciennes + vues actuelles déjà repérées pour l'Esplanade), puis Archives de la Ville de Namur, ODWB, Archives de l'État.
- **Chaque photo doit porter crédit + licence vérifiée** avant tout usage public.
- Réalisme : certains sujets (souterrains, corridas anciennes) seront difficiles à trouver en libre — prévoir des emplacements qui restent élégants même vides.

## 12. Exigences techniques (pour Claude Code)

- **Responsive mobile-first** (obligatoire) : portrait, large gamme de largeurs de smartphone, encoches gérées, cibles tactiles confortables, focus clavier visible, `prefers-reduced-motion` respecté.
- **Hors-ligne** : interface + données textuelles **embarquées** (données statiques type JSON, pas de backend en V1). Médias chargés via réseau (4G dispo) avec **repli** propre.
- **PWA recommandée** : installable sur l'écran d'accueil, *service worker* pour mettre en cache la coquille et les textes.
- **Pas de backend / pas de compte** en V1.
- **Architecture extensible** : prévoir dès maintenant les champs « différés » (2 min / 5 min, avant-après, lat/lng GPS) sans les implémenter.
- Stack précise (vanilla HTML/CSS/JS vs framework léger) : **à proposer par Claude Code** selon ce qui sert le mieux le hors-ligne + le responsive.

## 13. Design (délégué à Claude Design)

Ce PRD fournit la **structure, le contenu et le comportement** ; Claude Design définit l'**identité visuelle**. À lui transmettre :
- les écrans (Accueil, Parcours/fiche, Timeline, Carte) ;
- la décision **cartoon vs sobre/musée** (toujours ouverte — le brief initial citait « Apple / National Geographic / musée », mais un hero cartoon est disponible) ;
- l'asset cartoon fourni ;
- la contrainte responsive mobile-first.

## 14. À valider avant le build

1. **Liste des arrêts** : on reste sur les 9 lieux du §6, ou on ajoute *Vauban* et/ou *WW1/WW2* comme arrêts distincts ?
2. **Direction visuelle** : à fixer avec Claude Design (cartoon, sobre, ou mixte).
3. **Stack technique** : laisser Claude Code proposer, ou tu as déjà une préférence ?
4. **Photos** : on lance le sourcing complet (tableau des ~50 avec liens + licences) maintenant, ou après le squelette ?

---

*Fin du PRD v2.*
