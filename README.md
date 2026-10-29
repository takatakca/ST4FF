# ST4FF by TAKATAK

**App ID Clover (production) :** `E0BGTY752BZYE`
**Développeur :** TAKATAK (compte développeur Clover 9KJ25ATT15TTW)
**État au portail :** brouillon (draft) — rien de soumis.
**Dépôt :** takatakca/ST4FF

## Ce que fait l'app

Horaires d'employés, pointeuse sur le Clover, coûts de main-d'œuvre et messages d'équipe — le personnel au même endroit que les ventes. La vérité de présence vient des quarts (shifts) Clover.

## Paliers (doctrine de prix de Matt, 2026-10-28)

Chaque app a SES propres paliers. Base = le nécessaire essentiel · Premium = plus d'avantages · VIP = le full kit, tout ce que Clover offre pour la catégorie.

- **Base 50 $/mois** — employés et rôles synchronisés ; pointeuse alimentée par les quarts Clover ; heures travaillées par employé et par période.
- **Premium 100 $/mois** — + horaires planifiés comparés au réel ; coût de main-d'œuvre rapproché des ventes par quart ; messages d'équipe sur les appareils.
- **VIP 150 $/mois** — full kit : règles avancées (heures supplémentaires, pauses) ; export paie et flux de coûts vers 4CCOUNTING ; alertes (retard, quart non fermé, employé modifié — webhooks Employés) ; multi-succursales avec rôles par emplacement.

Prix facturés via les plans d'abonnement du Clover App Market (à créer au portail — voir DEPLOY.md).

## Permissions Clover visées

Employees R/W · Merchant R · Orders R · Payments R

## Structure

- `docs/listing/` — fiche marketplace (description FR/EN) et textes légaux, depuis le package de soumission local (`~/workspace/clover-apps/`)
- `app/api/clover/` — points d'entrée webhook + OAuth (scaffold, même patron que Food Hub)
- `lib/clover/config.ts` — configuration par variables d'environnement (aucun secret dans le code)
- `config/app.config.json` — identité de l'app et paliers
- `DEPLOY.md` — ce qui reste à faire, étape par étape, pour la vague portail

## Le système unique TAKATAK

Cette application fait partie de la suite TAKATAK sur Clover : toutes les apps partagent le même dos d'événements (webhooks Clover), le même **client unique reconnu par son numéro de téléphone** (+ courriel), et les mêmes commandes et paiements Clover. Aucune app ne vit en silo : les données qu'elle produit alimentent les autres apps de la suite (voir « Clover API — Main Stuff — Robot Notepad », section 3, déposé au Drive Opérations et dans `~/workspace/clover-apps/`).


## État du code (2026-10-28)

Application Next.js 16 qui fonctionne (tests verts, build OK). Mise en ligne : `DEPLOY.md` § 5.

**Ce qui marche :**
- **Commun (kit Suite TAKATAK, identique dans les 9 apps)** : connexion Clover OAuth v2 (jetons scellés, rafraîchis
  seuls, supprimés à la désinstallation) · webhook Clover (vérification, X-Clover-Auth, chaque événement une fois) ·
  base PostgreSQL (ou mémoire en dev) · session marchand · paliers Base / Premium / VIP lus depuis la facturation
  Clover (`OWN_MERCHANTS` = VIP) · marchand `RNVTBYMCKXEJ1` en lecture seule · lien Suite TAKATAK avec Food Hub ·
  page d'accueil FR/EN, tableau de bord `/app`, pages légales `/legal/*`, `/api/health`, `/api/cron`, clés d'appareils.
- **Tableau de bord premium (2026-10-29, kit commun)** : menu latéral avec sous-menus (les écrans de cette app,
  Suite TAKATAK, Mon compte, Aide) · Mon compte → Profil, Forfait et facturation, Actions autorisées, Appareils,
  Paiements et dépôts, Sécurité et données (export JSON), Journal d'activité · rôle Clover de la personne (propriétaire,
  administrateur, gérant, employé) vérifié par le serveur pour chaque action sensible, et noté au journal · sélecteur
  des 9 apps de la suite (annuaire Food Hub) · version mobile. Comment tout s'emboîte : `docs/SUITE_KIT.md`.
- Employés et rôles lus dans Clover ; taux horaire saisi ici
- Heures par employé pour la semaine depuis les quarts Clover (modification du gérant prioritaire, quart ouvert compté
  jusqu'à maintenant et signalé ; > 12 h signalé en rouge) ; coût de main-d'œuvre
- Premium : % de main-d'œuvre sur les ventes Clover, quarts planifiés comparés au réel

**Ce qui reste :**
- Messages d'équipe sur les appareils, règles d'heures supplémentaires / pauses, export paie vers 4CCOUNTING,
  alertes par webhooks Employés (VIP).

**Développer :** `npm install` · `npm run dev` · `npm run typecheck` · `npm test` · `npm run build`. Règles pour
les agents : `AGENTS.md` ; journal : `WORKLOG.md`.
