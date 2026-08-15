# Task Genius BT

Fork maintenu de Task Genius. Amont : `taskgenius/taskgenius-plugin`, sans activité de
maintenance depuis juin 2026 — ne pas compter sur l'absorption des correctifs en amont.
Remotes : `origin` = `bthollet/taskgenius-plugin`, `upstream` = l'amont.

## Construire

- **pnpm obligatoire** (dépendances `workspace:*`), jamais npm. `corepack enable` échoue en
  EPERM sans droits administrateur → utiliser `npx --yes pnpm@10`.
- Ne **jamais** installer avec `--ignore-scripts` : les paquets du workspace ont besoin de
  leurs scripts de préparation. Sans eux, `tsc` sort 18 fausses erreurs TS2307/TS4112 dans
  `src/components/features/calendar/`. À défaut : `pnpm -r --filter=./packages/* run build`.
- `pnpm run build` bundle en **mode développement** et écrit à la racine. Seul
  `node esbuild.config.mjs production` écrit `dist/`, c'est-à-dire l'artefact installable.
- `packages/calendar` et `docs` sont des sous-modules ; `packages/calendar` est **aussi** un
  paquet du workspace pnpm. Cloner avec `--recurse-submodules`, sinon `pnpm install` échoue.

## Tester

- `pnpm test` est la suite bloquante : **129 suites, 1675 tests**, ~45 s. Elle doit rester à
  100 %. La CI l'exécute à chaque push et chaque pull request.
- `jest.config.js` force `TZ=UTC` avant tout chargement de module. **Ne jamais coder un
  timestamp en dur** dans un test : utiliser `Date.UTC(...)`, lisible et indépendant du fuseau.
- Les suites `*[Pp]erformance*` sont **exclues** de la suite bloquante : elles affirment des
  durées d'horloge murale sur un matériel non spécifié, grandeur non reproductible qui ne peut
  pas servir de critère d'échec. Les lancer à part avec `pnpm run test:perf`. Ne pas les
  réintégrer au critère de blocage ; relever leurs seuils un à un ne fait que déplacer le
  problème.
- Le hook `pre-commit` est **volontairement vide**. Ne pas y remettre de build : la CI s'en
  charge, et le hook coûtait ~2 min par commit.

## Identité du plugin

- `id` = `task-genius-bt`, dans `manifest.json` **et** `manifest-beta.json`. Les deux doivent
  toujours porter la **même version** : esbuild copie `manifest.json` dans `dist/`, donc un
  manifeste désynchronisé publie une version fausse dans la release et BRAT croit alors le
  plugin perpétuellement obsolète.
- **Ne jamais coder l'identifiant du plugin en dur.** Utiliser `plugin.manifest.id`. Deux
  régressions de ce type ont déjà été corrigées (`src/translations/helper.ts`,
  `src/components/features/fluent/components/WorkspaceSelector.ts`) ; elles échouaient en
  silence.
- Le préfixe du cache IndexedDB est `task-genius-bt/cache/`
  (`src/cache/local-storage-cache.ts`). L'espace de noms ne dépend sinon que de `app.appId`,
  qui identifie le **coffre** et non le plugin : deux variantes du plugin dans un même coffre
  partageraient alors la même base et s'invalideraient mutuellement leur index.
- Diffusion par BRAT uniquement, pas de soumission au catalogue communautaire.
  Versions `9.14.0-bt.N`.

## Licence — FSL-1.1-ALv2, pas MIT

- Ne pas modifier `LICENSE`, ne pas retirer les mentions de copyright, joindre la licence à
  toute redistribution.
- Le nom de produit « Task Genius » ne peut servir qu'à **citer l'origine**, jamais à désigner
  ce fork.
- Un fork gratuit n'est pas un « Competing Use » — celui-ci suppose un produit ou service
  commercial. Chaque version bascule sous Apache 2.0 deux ans après sa publication.

## Pièges connus

- `GOOGLE_CLIENT_SECRET_B64` est injecté au build (`esbuild.config.mjs`, ~l. 110). La valeur
  est vide dans tout build tiers → **les fonctions Google Calendar sont inertes**. Décision en
  suspens : identifiants OAuth propres, ou désactivation explicite.
- Chantier « v10 » : la Phase 0 est livrée et testée, mais les documents de planification
  (`PHASE0_DEFERRED.md`, `WORKTREE_PLAN.md`, 589 lignes) ont été **supprimés dans le dernier
  commit de code amont `f28ea8e`**. Les relire dans l'historique avant de toucher à
  `src/dataflow`.
- Modules qui concentrent le backlog : `src/dataflow/api/WriteAPI.ts`,
  `src/editor-extensions/task-operations/`,
  `src/components/features/task/view/projects.ts`. **Aucune couverture de test n'y est
  mesurée** — instrumenter et écrire des tests de caractérisation avant d'y toucher.
- `enhancedProjectData.fileMetadataMap` est un **cache dérivé persisté dans `data.json`** :
  ~600 Ko sur un coffre de 5567 notes, alors que la configuration réelle pèse ~10 Ko. Il est
  recalculé par `getEnhancedProjectData()` dans `src/services/task-parsing-service.ts`. Sur un
  coffre synchronisé entre postes, cet état dérivé voyage et peut arriver périmé. Suspect
  principal des lenteurs signalées.

## Conventions

- Messages de commit en conventional commits, rédigés en français, expliquant **pourquoi** et
  pas seulement quoi.
- Le backlog amont compte 205 issues (~130 j-h pour les seuls bugs, ~275 j-h au total) : environ
  18 doublons stricts et 25 grappes thématiques. **Traiter par grappe, pas par issue** — une
  grappe ferme plusieurs tickets pour un seul passage dans le même fichier.
