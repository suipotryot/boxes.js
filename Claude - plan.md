# boxes.js — Plan d'implémentation

## Contexte

`boxes.js` est un nouveau projet, actuellement vide de code (juste `LICENSE` GPLv3+ et un `README.md` minimal). L'objectif : une application web 100% client-side, offline, distribuée comme un unique `dist/index.html` ouvrable par double-clic (Firefox + Chrome, zéro serveur), permettant de designer des boîtes en carton/bois pour découpe laser avec des cloisons intérieures détaillées façon "TrayLayout" de [boxes.py](https://github.com/florianfesti/boxes), puis d'exporter le tout en SVG prêt à découper.

Deux recherches de fond ont été menées :
- **boxes.py / TrayLayout** : son vrai modèle est une grille uniforme (sx×sy) avec murs/planchers activables par case — PAS un vrai découpage récursif. L'utilisateur veut un vrai modèle guillotine récursif (chaque zone se subdivise indépendamment de ses sœurs), donc on **généralise** l'algorithme de classification de jonctions de boxes.py (comptage de degré par coordonnées de grille) à des **coordonnées continues** (comptage par coïncidence de coordonnées avec epsilon). Les formules de finger joints, correction burn, et styles de coin intérieur sont réimplémentées **à partir de la connaissance générique de la géométrie des assemblages à doigts** (pas de copie/traduction du code de boxes.py). Le projet est malgré tout distribué sous licence **GPL**, par respect pour la volonté de l'auteur de boxes.py plutôt que par obligation légale (voir décision licence ci-dessous).
- **ConceptConstructif** (projet précédent validé par l'utilisateur) : stack et conventions à reprendre — Vue 3 + TS + Vite + Pinia, Konva.js pour le 2D, Three.js pour le 3D flottant, `vite-plugin-singlefile` pour le bundle offline, undo/redo par snapshots JSON, IndexedDB (`idb`) + export/import JSON, dialogues maison (overlay div), theming par CSS custom properties.

Décisions produit actées avec l'utilisateur (à ne pas rouvrir) :
- Modèle de split = **guillotine récursif libre**, pas une grille.
- Hauteur de cloison = **par couleur** (registre couleur→hauteur), pas une seule valeur globale. Jonction entre cloisons de hauteurs différentes → encoche mi-bois profonde de `min(hauteurA, hauteurB) / 2`, la plus haute continue sans échancrure au-delà.
- Sauvegarde : **auto-save (IndexedDB) + export/import JSON manuel**.
- Rendu 3D : **Three.js**.
- Nesting SVG : algorithme poussé — **MaxRects** (Jylänki), pas un simple shelf-packer.
- Hauteur extérieure de boîte = **pas de champ dédié** : les parois extérieures portent un `colorId` comme n'importe quelle cloison, résolu via le même `ColorHeightRegistry` (`config.outerColorId`) — l'utilisateur voit ainsi immédiatement, par la couleur, quelles cloisons partagent la hauteur des bords. À la création du projet, `NewProjectDialog` demande `baseWallHeightMm` (déjà prévu comme hauteur par défaut d'une nouvelle couleur) en plus des dimensions ; cette valeur crée automatiquement la première entrée de couleur ("Bords"), assignée à `outerColorId`, éditable ensuite comme toute autre couleur via `ColorLegend`.
- "Couvercle" = en réalité un **plateau/séparateur à hauteur Z intermédiaire configurable**, qui peut être :
  - **fixe** : lié aux parois par assemblage (finger joints) à la hauteur choisie ;
  - **amovible** : simplement posé sur des taquets/tasseaux fixés à l'intérieur des parois extérieures à cette hauteur, retenu uniquement par la gravité (aucun clip/friction).
  - **Visibilité togglable** : un plateau intermédiaire opaque masquerait les cloisons en dessous dans les vues, donc un contrôle d'affichage/masquage (`uiStore.shelfVisible`) est indispensable dès que `shelf` est actif (voir §4).
  - **Contrainte de hauteur** : une cloison interne ne peut jamais dépasser la hauteur `heightMm` d'un plateau intermédiaire actif (interdiction par validation, pas de découpe à gérer dans `ShelfBuilder`) — vérifiée aux deux points qui pourraient violer la règle : `updateColorHeight` (refuse une hauteur qui dépasserait `heightMm` si la couleur est utilisée par une cloison existante) et l'activation/édition de `ShelfConfig.heightMm` (doit rester ≥ hauteur de la cloison interne la plus haute).
- Encoche de préhension sur une arête : centrée, **largeur ET profondeur réglables**, forme **rectangulaire ou arrondie (demi-cercle)** au choix. **Cloisons internes uniquement en V1** (via `ZoneSplit.notches`) — pas sur les parois extérieures ni sur le plateau amovible, à rouvrir plus tard si besoin.
- Une cloison créée (split) est **fixe à la création** en V1 — pour changer sa position, on la supprime (fusion des 2 zones) et on la recrée. Pas de glisser-déposer de ligne de coupe en V1.
- Épaisseur des cloisons = uniforme (`innerThickness`), seule la hauteur varie par couleur.
- Un seul plateau de fond (si `hasBottom`) et un seul plateau intermédiaire (si activé), couvrant toute l'empreinte de la boîte — pas de gestion par zone déconnectée (simplification assumée vs. boxes.py).
- Licence : **GPL** (alignée sur boxes.py, GPLv3+), par respect pour l'auteur — malgré des algorithmes reformulés indépendamment et non portés littéralement depuis le code de boxes.py.
- Téléchargement multi-pages SVG : téléchargements séquentiels fichier-par-fichier (pas de dépendance zip), cohérent avec l'absence de dépendances superflues.
- Zone de dessin 2D : à l'ouverture d'un projet, l'utilisateur saisit d'abord les dimensions extérieures de la boîte (`NewProjectDialog`) ; le canvas cadre alors automatiquement la boîte vide à la plus grande taille possible dans le viewport (légère marge sur les 4 côtés), puis zoom/pan restent disponibles pour l'édition (molette + drag, comme dans ConceptConstructif).

---

## 1. Scaffold du projet

```
boxes.js/
  package.json  vite.config.ts  vitest.config.ts (ou bloc test dans vite.config.ts)
  tsconfig.json  tsconfig.node.json
  index.html
  .gitignore                dist/, node_modules/
  src/
    main.ts  App.vue  style.css
    domain/
      models/    types.ts  Project.ts  Zone.ts  WallSegment.ts
                  ColorHeightRegistry.ts  Notch.ts  Panel.ts  Shelf.ts
      services/  GeometryUtils.ts  ZoneTree.ts  WallExtractor.ts
                  JunctionClassifier.ts  FingerJoint.ts  PanelBuilder.ts
                  BasePlateBuilder.ts  ShelfBuilder.ts  ProjectGenerator.ts
      __tests__/ (Vitest, un fichier par service ci-dessus)
    canvas/
      CanvasManager.ts
      tools/       SplitTool.ts  EdgeSelectTool.ts  HoverHighlightTool.ts
      renderers/   ZoneRenderer.ts  WallRenderer.ts  DimensionRenderer.ts
    scene3d/
      Scene3D.ts  MeshBuilders.ts
    svgexport/
      SvgPathBuilder.ts  BurnCorrection.ts  InnerCornerPostProcess.ts
      ThicknessGrouper.ts  SvgPageRenderer.ts  ExportPipeline.ts
      nesting/  MaxRectsPacker.ts  types.ts
    storage/
      IndexedDbStore.ts  JsonExporter.ts  HistoryManager.ts
    stores/
      projectStore.ts  uiStore.ts
    components/
      AppHeader.vue  Sidebar.vue  CanvasView.vue  FloatingPanel.vue
      ColorLegend.vue  AdvancedOptionsPanel.vue  Scene3DPanel.vue
      dialogs/
        NewProjectDialog.vue  SplitZoneDialog.vue  EdgeEditDialog.vue
        RecentProjectsDialog.vue  ConfirmDialog.vue
```

**Dépendances** (`package.json`) : `vue`, `pinia`, `konva`, `three`, `idb` en dépendances ; `vite`, `@vitejs/plugin-vue`, `vite-plugin-singlefile`, `typescript`, `vue-tsc`, `vitest`, `@vue/test-utils` en devDependencies. Scripts : `dev`, `"build": "vue-tsc -b && vite build"`, `test`, `test:watch`.

⚠️ Vérifier au scaffold que `vue-tsc` fonctionne avec la dernière version majeure de TypeScript disponible ; si incompatibilité, retomber sur la dernière 5.x (ligne connue stable avec `vue-tsc`).

**`vite.config.ts`** : `plugins: [vue(), viteSingleFile()]`, `base: './'`, `build.assetsInlineLimit: 100_000_000`, `build.chunkSizeWarningLimit: 100_000_000`, `build.cssCodeSplit: false`, alias `@ -> src`. `dist/` gitignored — seul le code source est versionné.

---

## 2. Modèle de domaine

### 2.1 Arbre guillotine + liste de murs à plat

- **`ZoneNode`** (arbre récursif, source de vérité, persisté et snapshotté pour l'undo/redo) — c'est ce que l'UI 2D édite directement.
- **`WallSegment[]`** (liste plate, coordonnées absolues), dérivée par une fonction pure de l'arbre — nécessaire car deux sous-arbres frères splittés indépendamment peuvent produire des lignes de coupe **colinéaires qui se rencontrent au même point** (croisement en X), un fait invisible dans la structure d'arbre elle-même et détectable seulement en coordonnées absolues.

```ts
type Axis = 'x' | 'y'; // 'x' : enfants gauche/droite (ligne de coupe verticale)
                        // 'y' : enfants haut/bas (ligne de coupe horizontale)

interface ZoneLeaf  { kind: 'leaf'; id: string }
interface ZoneSplit {
  kind: 'split'; id: string; axis: Axis;
  firstSize: number;        // taille utile du 1er enfant (gauche/haut), mm
  dividerColorId: string;   // ce split crée une seule cloison -> une couleur -> une hauteur
  notches: Notch[];
  first: ZoneNode; second: ZoneNode;
  // taille utile du 2e enfant = taille du parent - innerThickness - firstSize
}
type ZoneNode = ZoneLeaf | ZoneSplit;
```

`ZoneTree.computeZoneRects(root, rootRect, innerThickness): Map<zoneId, Rect>` — pliage récursif O(n) : à chaque `ZoneSplit`, le 1er enfant prend `firstSize` depuis l'origine de l'axe, le 2e est décalé de `firstSize + innerThickness` ; les deux enfants héritent de la taille du parent sur l'autre axe. **Écrire et tester cette fonction en premier** (fixtures : 1 split, split imbriqué 2×2, tailles calculées à la main).

```ts
class ColorHeightRegistry {
  entries: { id: string; color: string; heightMm: number; label?: string }[];
  getHeight(colorId: string): number;
  findOrCreateByColor(hex: string, defaultHeight: number): ColorEntry;
  updateHeight(id: string, heightMm: number): void;
}
```

```ts
interface WallSegment {
  id: string; a: Point; b: Point;      // coords absolues mm, axis-aligned
  height: number;                       // toujours ColorHeightRegistry.getHeight(colorId) -- y compris murs extérieurs (colorId = config.outerColorId par défaut)
  thickness: number;                    // config.outerThickness ou innerThickness
  isOuter: boolean; colorId: string; notches: Notch[];
}

interface Notch {
  id: string; width: number; depth: number;
  shape: 'rect' | 'round'; edgeSide: 'top' | 'bottom';
  // toujours centrée sur la longueur du mur -> pas de champ offset
}

interface Panel {
  id: string; kind: 'outerWall' | 'dividerWall' | 'basePlate' | 'shelf';
  materialThickness: number;
  outline: Point[];        // géométrie IDÉALE (pas de correction burn ici)
  holes: Point[][];
  placement3d?: { origin: Point3; rotationZ: number };
  label?: string; sourceIds: string[];
}
```

Décision délibérée : `Panel.outline` reste en géométrie idéale. La correction burn et le post-traitement "inner corner style" sont appliqués uniquement à l'export SVG (`svgexport/`), jamais dans `Panel` — qui reste la source unique consommée à la fois par le canvas 2D, la vue 3D et l'export.

### 2.2 Config projet

```ts
interface ProjectConfig {
  outerThickness: number; innerThickness: number;   // mm, innerThickness peut = outerThickness
  outerColorId: string;           // couleur des parois extérieures, résolue via ColorHeightRegistry comme toute cloison -> pas de hauteur dédiée
  baseWallHeightMm: number;       // hauteur par défaut affectée à une nouvelle couleur de cloison
  dimX: { value: number; mode: 'inner' | 'outer' };
  dimY: { value: number; mode: 'inner' | 'outer' };
  hasBottom: boolean;
  shelf: ShelfConfig | null;      // le "couvercle", voir 2.3
  advanced: AdvancedOptions;      // voir 2.4
}
```

### 2.3 Plateau intermédiaire ("couvercle") — fixe ou amovible

```ts
interface ShelfConfig {
  heightMm: number;               // position Z depuis le fond
  mode: 'fixed' | 'removable';
}
```

- **`fixed`** : le plateau est lié aux parois extérieures à `heightMm` via assemblage à doigts — génère une rangée de trous d'assemblage horizontaux dans la FACE de chaque paroi extérieure à cette hauteur (mécanisme analogue à celui du plateau de fond, mais appliqué à mi-hauteur du panneau plutôt qu'au bord bas — `PanelBuilder` doit donc supporter une 2e "compound edge" horizontale optionnelle sur la face d'un mur, pas seulement sur son bord inférieur).
- **`removable`** : génère de petits taquets/tasseaux (pièces séparées, assemblées par doigts ou collées aux parois extérieures à `heightMm`) sur lesquels le plateau repose simplement ; le plateau lui-même n'a aucune découpe d'assemblage sur son pourtour (juste dimensionné pour reposer sur les taquets). Retenu uniquement par gravité, comme confirmé par l'utilisateur.
- Dans les deux cas, le plateau intermédiaire couvre **toute l'empreinte** de la boîte (une seule pièce, même simplification que le plateau de fond) — il repose/se fixe uniquement sur les parois extérieures, pas sur les cloisons internes (dont la hauteur peut être inférieure à `heightMm`).
- **Contrainte de hauteur (validée, pas gérée géométriquement)** : aucune cloison interne ne peut dépasser `heightMm`. `projectStore` doit rejeter/clamper : (a) `updateColorHeight(colorId, h)` si `h > heightMm` du plateau actif et que `colorId` est utilisé par au moins une cloison interne (les couleurs non utilisées par une cloison, dont potentiellement `outerColorId`, ne sont pas concernées) ; (b) l'activation ou l'édition de `ShelfConfig.heightMm` à une valeur `< max(hauteur des cloisons internes existantes)`. `ShelfBuilder`/`BasePlateBuilder` n'ont donc jamais à découper le plateau pour une cloison qui le traverse.
- `ShelfBuilder.ts` réutilise la logique de `BasePlateBuilder.ts` (même forme de plateau) en paramétrant la hauteur Z et le mode de fixation.

### 2.4 Options avancées

```ts
interface AdvancedOptions {
  laserBedX: number; laserBedY: number;      // mm
  burnMm: number;
  innerCornerStyle: 'loop' | 'corner' | 'backarc';
  partSpacingMm: number;
  fingerJoint: {
    style: 'rectangular';     // styles alternatifs (springs/barbs/snap) en extension future
    spaceMm: number; fingerMm: number; widthMm: number; edgeWidthMm: number;
    playMm: number; extraLengthMm: number; surroundingSpaces: number;
  };
}
```

### 2.5 Classification des jonctions (le cœur de l'algorithme)

Généralisation du comptage de degré par indices de grille de boxes.py vers des coordonnées continues :

```ts
interface JunctionInfo {
  point: Point;
  north: { segmentId: string } | null; south: { segmentId: string } | null;
  east:  { segmentId: string } | null; west:  { segmentId: string } | null;
}
```

Algorithme (`JunctionClassifier.ts`) :
1. Rassembler tous les points d'extrémité de tous les `WallSegment` (avec dédoublonnage par epsilon) — tout point de jonction utile est l'extrémité d'au moins un mur.
2. Pour chaque point candidat `P` et chaque mur `W` :
   - `W` vertical et `W.x ≈ P.x` : si `P.y` est **strictement à l'intérieur** de `[W.a.y, W.b.y]` → `W` traverse `P` (nord ET sud référencent `W`) ; sinon, si `P` coïncide avec une extrémité de `W`, `W` s'étend seulement au nord ou au sud depuis `P`.
   - Logique symétrique pour `W` horizontal (est/ouest).
3. Stocker dans une `Map<pointKey, JunctionInfo>` partagée par tous les constructeurs de panneaux, pour garantir que les deux murs d'une même jonction s'accordent sur sa classification.

Degré = nombre de côtés non-null sur l'axe perpendiculaire au mur en cours de construction :
- **0** → bord plein.
- **1** (jonction en T) → trous d'assemblage à doigts découpés dans la face du mur porteur, sur la hauteur du mur entrant.
- **2** (croisement en X) → encoche mi-bois sur LES DEUX murs, profondeur = `min(hauteurA, hauteurB) / 2`, largeur = épaisseur du mur perpendiculaire ; le mur le plus haut continue sans échancrure au-delà de cette profondeur (règle confirmée avec l'utilisateur).

Les points coïncidant avec les extrémités propres d'un mur (t=0 ou t=longueur) sont exclus de cette boucle interne et traités par la logique de bord de fin (`CompoundEdge`, §2.6) — ils représentent "ce mur bute contre un mur perpendiculaire/la paroi extérieure", pas une traversée.

Coût `O(murs × points)` — acceptable pour des dizaines à quelques centaines de murs ; indexation spatiale seulement si le profilage le justifie plus tard, pas construite préventivement.

### 2.6 Construction des panneaux

`FingerJoint.ts` — formules de comptage/espacement des doigts et positions des trous, dérivées indépendamment de la géométrie générique des assemblages à doigts (pas depuis le code de boxes.py) :
- `fingerEdgePath(length, settings, startWithFinger): PathSegment[]`
- `fingerHoleRow(startOffset, length, settings, holeHeight): Rect[]`

`PanelBuilder.buildWallPanel(wall, allWalls, junctions, config): Panel` :
1. Bord inférieur = séquence alternée assemblage-à-doigts (si `hasBottom`) / bord plein, avec encoche ou trous selon la classification de jonction à chaque point de croisement interne (§2.5).
2. Si `config.shelf?.mode === 'fixed'` et que ce mur est extérieur : ajouter une 2e rangée de trous d'assemblage horizontaux dans la face, à `heightMm`, sur toute la longueur du mur.
3. Bords de fin (gauche/droite) : "compound edge" généralisée — sur la plage de hauteur commune `[0, min(hauteurA, hauteurB)]`, assemblage à doigts ; au-delà (seulement sur le mur le plus haut), bord plein.
4. Application des `Notch[]` du split d'origine (`applyNotches` : encoche centrée, rectangulaire ou arrondie, largeur/profondeur réglables, sur le bord haut ou bas).
5. `placement3d` dérivé des coordonnées réelles du mur.

`BasePlateBuilder.buildBasePlate(...)` → `null` si `!hasBottom` ; sinon une pièce couvrant l'empreinte, avec trous d'assemblage pour chaque cloison qui la touche, encoches d'angle en L aux coins intérieurs.

`ShelfBuilder.buildShelf(...)` → `null` si `!config.shelf` ; sinon réutilise la forme de `BasePlateBuilder` positionnée à `heightMm`, plus (mode `removable`) génère les pièces taquets séparées.

`ProjectGenerator.generatePanels(project): Panel[]` orchestre : `computeZoneRects` → `WallExtractor.extract` → `JunctionClassifier.classify` → murs → `buildWallPanel` → `buildBasePlate` → `buildShelf` → concat. Calculé une fois par mutation du store (`computed` Pinia), jamais recalculé indépendamment par chaque consommateur (2D/3D/export).

---

## 3. Interaction 2D (Konva)

Couches (`CanvasManager.ts`, `Konva.Stage`) : `backgroundLayer` (contour extérieur) → `zoneLayer` (un `Konva.Rect` par zone-feuille, cible de clic pour split, `ZoneRenderer`) → `wallLayer` (un shape par panneau généré, coloré selon `ColorEntry.color`, cible de clic pour édition, `WallRenderer`) → `dimensionLayer` (togglable, labels de longueur par mur, `DimensionRenderer`) → `interactionLayer` (surbrillance hover + sélection).

Le fait que `wallLayer` soit au-dessus de `zoneLayer` permet au hit-testing natif de Konva de distinguer "clic sur un mur" vs "clic sur une zone vide" sans géométrie manuelle.

**Cadrage et navigation** : à l'ouverture d'un projet (nouveau ou chargé), `CanvasManager.fitToView()` calcule le facteur d'échelle mm→px qui maximise la boîte (dimensions extérieures) dans le viewport disponible avec une marge fixe (ex. 40px) sur les 4 côtés, et centre le `Konva.Stage` en conséquence. Ensuite, zoom (molette, centré sur le curseur, bornes min/max) et pan (drag) restent disponibles pour l'édition, sur le modèle de ConceptConstructif ; l'échelle et l'offset courants sont conservés dans `uiStore.viewport` pour survivre à un re-render de `CanvasView.vue`.

**Outils** : `SplitTool.ts` (hover + clic sur zone → `SplitZoneDialog.vue` pré-rempli avec W/H courants → `projectStore.splitZone(zoneId, axis, firstSize, colorId)`). `EdgeSelectTool.ts` (clic sur mur → `EdgeEditDialog.vue` : couleur éditable, hauteur/longueur/épaisseur en lecture seule (hauteur éditable via la légende, longueur et épaisseur uniforme fixées par le split/la config) ; section "ajout/suppression d'encoche" (largeur/profondeur/forme) visible **uniquement pour les cloisons internes** (`isOuter === false`) — les parois extérieures n'ont pas de stockage de notches en V1, décision confirmée avec l'utilisateur).

`uiStore.ts` : `selectedZoneId`, `selectedEdgeId`, `activeDialog` (union discriminée, un seul dialogue ouvert à la fois), `shelfVisible` (bool, défaut `true` — masque le plateau intermédiaire dans la vue 3D, voir §4), `viewport` (scale + offset courants du stage Konva, pour le zoom/pan).

`ColorLegend.vue` (dans `Sidebar.vue`) : swatch (`<input type=color>`) + hauteur éditable par entrée de couleur → `projectStore.updateColorHeight`. Important : la hauteur n'est **jamais** cachée sur `WallSegment`, toujours résolue depuis `colorId` à chaque génération — sinon l'édition de couleur en direct casse.

`CanvasView.vue` observe (`watch deep`) l'arbre de zones / couleurs / config et régénère les panneaux + renderers.

---

## 4. Vue 3D (Three.js)

`Scene3D.ts` (classe TS pure, pas un composant Vue) : `Scene`/`PerspectiveCamera`/`WebGLRenderer`/`OrbitControls`, `meshGroup` reconstruit par `rebuild(panels)`. `MeshBuilders.panelToMesh(panel)` : `THREE.Shape` depuis `outline` + `holes` comme trous, `ExtrudeGeometry(depth = materialThickness)`, positionné via `placement3d` (murs debout selon leur ligne réelle ; plateau de fond à z=0 ; plateau intermédiaire à z=heightMm). Matériau coloré depuis `ColorEntry.color`.

`Scene3DPanel.vue` enveloppe `FloatingPanel.vue` (porté depuis ConceptConstructif : drag/resize par listeners `mousedown/mousemove/mouseup` sur `window`, taille min clampée), charge `Scene3D.ts` en lazy (`import()` dynamique dans `onMounted`), observe le même `generatedPanels` computed que le canvas 2D (pas de recalcul du pipeline). Un bouton (icône œil, dans `Scene3DPanel.vue`) bascule `uiStore.shelfVisible` ; `Scene3D.rebuild` filtre alors les panneaux `kind !== 'shelf'` (et leurs taquets) avant de construire les meshes, pour laisser voir les cloisons en dessous du plateau intermédiaire.

---

## 5. Undo/redo & persistance

`HistoryManager.ts` : pile de snapshots (`JSON.stringify`/`parse`), `past`/`future`, taille max ~30, `push` au début de chaque action mutante du `projectStore` (snapshot-avant-mutation), `Ctrl+Z` / `Ctrl+Shift+Z` câblés au niveau racine de l'app.

`IndexedDbStore.ts` (via `idb`) : auto-save débattu (~1s) sur `watch(project, deep)`, dialogue "projets récents". `JsonExporter.ts` : export = `Blob` + `<a download>` ; import = `<input type=file accept=.json>` + validation de forme.

---

## 6. Export SVG

`SvgPathBuilder.buildPanelPath(panel, burnMm, cornerStyle)` :
1. **Correction burn** : le modèle étant entièrement rectiligne à 90°, simplification en décalage par sommet le long des deux arêtes adjacentes — coins convexes (sortants) `+burn`, concaves (rentrants) `-burn`, déterminé par le signe du produit vectoriel des vecteurs d'arêtes consécutifs. Même logique pour les trous (sens de convexité inversé).
2. **Post-traitement inner corner style** : `'corner'` = no-op (le modèle est déjà en sommets nets) ; `'backarc'` = petit arc de rayon `burn` au sommet concave ; `'loop'` = petite boucle de dégagement dépassant légèrement l'intersection sur les deux arêtes adjacentes (dégagement complet du kerf laser).
3. Sérialisation en un seul `<path>` par panneau, contour + trous en sous-chemins, `fill-rule="evenodd"`.

`ThicknessGrouper.groupByThickness(panels)` : regroupement par `materialThickness`.

**Nesting — MaxRects (Jylänki, "A Thousand Ways to Pack the Bin")**, heuristique Best Area Fit ou Best Short Side Fit, implémenté à la main (~150-250 lignes, `svgexport/nesting/MaxRectsPacker.ts`) plutôt qu'une dépendance externe — cohérent avec l'absence de dépendances superflues du projet et donne le contrôle sur la rotation à 90°.

```ts
class MaxRectsBin {
  freeRects: Rect[]; usedRects: Rect[];
  constructor(width: number, height: number);
  insert(w: number, h: number, allowRotation: boolean): { x; y; rotated } | null;
}
function packThicknessGroup(panels, bedW, bedH, spacing, allowRotation): PlacedPanel[][]
// tri décroissant par aire de bounding-box avant insertion ; nouvelle page (bin) si aucun bin existant n'accepte la pièce
```

`ExportPipeline.exportProject(project)` : `generatePanels` → `groupByThickness` → `packThicknessGroup` par groupe (bed size depuis `advanced.laserBedX/Y`) → une page par bin → `SvgPageRenderer` génère un `<svg width=bedX height=bedY>` avec un `<g transform>` par pièce placée + un label d'épaisseur en marge de page (hors des pièces). Téléchargement séquentiel un fichier par page (`${projectName}-${thicknessMm}mm-page${n}of${total}.svg`), délai ~150ms entre déclenchements pour éviter le blocage multi-téléchargement du navigateur.

---

## 7. Ordre de réalisation (jalons)

- **M1 — Noyau domaine, sans UI.** Scaffold + build offline vide fonctionnel. Couverture Vitest complète : `ZoneTree`/`computeZoneRects`, `JunctionClassifier` (fixtures T et X faites à la main), `FingerJoint`, `PanelBuilder`/`BasePlateBuilder`/`ShelfBuilder` (petits arbres de zones 2×1/2×2), `MaxRectsPacker` (pas de chevauchement, tout placé).
- **M2 — UI config + boîte vide.** Flux nouveau projet (`NewProjectDialog` demande les dimensions extérieures, les épaisseurs et `baseWallHeightMm` — cette dernière valeur crée automatiquement la couleur "Bords" assignée à `outerColorId`), squelette `projectStore`/`uiStore`, theming CSS (dark/light), stage Konva avec juste le contour extérieur, cadrage automatique de la boîte vide dans le viewport (marge sur les 4 côtés) + zoom/pan (molette + drag).
- **M3 — Interaction de split.** Split récursif complet (`SplitZoneDialog`, hover, `ZoneRenderer`), `wallLayer` avec les vrais contours `PanelBuilder` (doigts inclus) dès cette étape.
- **M4 — Édition complète.** Légende couleurs, dialogue d'édition d'arête, encoches (forme/largeur/profondeur), overlay dimensions, panneau options avancées.
- **M5 — Undo/redo + persistance.** `HistoryManager` câblé sur chaque action mutante, Ctrl+Z/Ctrl+Shift+Z, autosave IndexedDB, dialogue projets récents, export/import JSON.
- **M6 — Vue 3D.** `FloatingPanel.vue`, `Scene3D`/`MeshBuilders`, lazy-load, mise à jour live, toggle `uiStore.shelfVisible` pour masquer le plateau intermédiaire et voir les cloisons en dessous.
- **M7 — Export SVG + nesting.** Correction burn, styles de coin intérieur, groupement par épaisseur, packing MaxRects, pages multiples + labels, téléchargement séquentiel.
- **M8 — Polish.** Cas de jonctions difficiles (3+ splits colinéaires au même point, zones très fines), validation des entrées (split qui ne laisse pas de place pour l'épaisseur de cloison), QA offline double-clic Firefox+Chrome, README.

---

## Vérification

- **Tests unitaires** (`npm run test`) pour tout `domain/services/` — c'est la partie à plus haut risque (géométrie/assemblages), doit être fiable avant toute UI.
- **Build offline réel** : `npm run build`, puis ouvrir `dist/index.html` par double-clic (pas de `npm run preview`, pas de serveur) dans Firefox ET Chrome — vérifier absence d'erreurs console liées à des assets externes non inlinés.
- **Test manuel du flux complet** : créer un projet, configurer les dimensions, faire 2-3 splits récursifs (y compris un cas provoquant un croisement en X entre deux sous-arbres frères), assigner des couleurs/hauteurs différentes, ajouter une encoche, activer le plateau intermédiaire en mode fixe puis amovible, vérifier le rendu 3D, exporter en SVG avec une taille de plateau laser volontairement petite pour forcer plusieurs pages, vérifier visuellement l'absence de chevauchement de pièces et la présence des labels d'épaisseur.
- **Ctrl+Z/Ctrl+Shift+Z** testés après chaque type d'action mutante (split, couleur, encoche, config).
