// Flat key -> string dictionary, French (the app's original, still the
// default locale — see ProjectRepository.getLocale()'s own fallback).
// Grouped by the screen/component each key belongs to, matching the
// migration order in the i18n plan. Keys shared verbatim across more than
// one screen (e.g. "Ma machine", "Doigts (finger joint)") live under
// `shared.*` instead of being duplicated per screen, same anti-drift
// reasoning as fieldHelp.js's constants.
export const fr = {
  'app.defaultProjectName': 'Nouveau projet',

  // Shared across screens
  'shared.machineTitle': 'Ma machine',
  'shared.preferencesTitle': 'Préférences',
  'shared.fingerJointSection': 'Doigts (finger joint)',
  'shared.laserSection': 'Découpe laser',
  'shared.autoFix': 'Ajuster automatiquement',
  'shared.save': 'Enregistrer',

  // Shared field labels (Machine settings / Preferences / SettingsPanel)
  'field.laserWidth': 'Largeur de la zone de travail (mm)',
  'field.laserHeight': 'Hauteur de la zone de travail (mm)',
  'field.laserSpacing': 'Espacement entre pièces (mm)',
  'field.burnMm': 'Jeu de coupe / burn (mm)',
  'field.fingerMm': 'Largeur doigt (mm)',
  'field.spaceMm': 'Largeur espace (mm)',
  'field.marginMm': 'Marge min. (mm)',
  'field.playMm': 'Jeu (play, mm)',
  'field.drawerPlay': 'Jeu / marge (mm)',
  'field.drawerThickness': 'Épaisseur bois (mm)',

  // Shared tooltip help texts (fieldHelp.js)
  'help.fingerMm': 'Largeur de chaque dent des assemblages en doigts de menuisier.',
  'help.spaceMm': 'Largeur de chaque espace entre deux dents.',
  'help.marginMm': 'Marge plane minimale laissée à chaque extrémité d’une rangée de dents, avant que les dents commencent.',
  'help.playMm': 'Jeu de serrage : chaque dent est rétrécie et chaque espace élargi de cette valeur, pour que les pièces s’emboîtent sans forcer une fois découpées (compense la découpe laser et les tolérances du matériau).',
  'help.burnMm': 'Largeur de matière retirée par le laser à la découpe (jeu de coupe / kerf). L’app agrandit légèrement les contours et rétrécit les trous de ce montant pour que les pièces mesurent la bonne taille une fois coupées.',
  'help.laserWidth': 'Largeur de la zone de découpe de la machine — détermine comment les pièces sont réparties sur plusieurs pages à l’export.',
  'help.laserHeight': 'Hauteur de la zone de découpe de la machine — détermine comment les pièces sont réparties sur plusieurs pages à l’export.',
  'help.laserSpacing': 'Espace minimal laissé entre deux pièces voisines sur une même page d’export.',
  'help.drawerPlay': 'Jeu de glissement entre la boîte actuelle et la boîte englobante — appliqué du côté fermé de l’axe d’ouverture, et des deux côtés sur l’autre axe. Le côté ouvert reste toujours à fleur, sans jeu ni marge supplémentaire.',
  'help.drawerThickness': 'Épaisseur du matériau utilisé pour la boîte englobante — indépendante de l’épaisseur extérieure de la boîte principale.',

  // Machine settings screen
  'machine.hint': 'Réglages de ta découpeuse laser, pré-remplis sur chaque nouveau projet — modifier ces valeurs n’affecte pas les projets déjà créés.',

  // Preferences screen
  'preferences.hint': 'Valeurs par défaut pré-remplies sur chaque nouveau projet — modifier ces valeurs n’affecte pas les projets déjà créés.',
  'preferences.saveSection': 'Sauvegarde',
  'preferences.autosaveDelay': 'Délai de sauvegarde automatique (s)',
  'preferences.autosaveDelayHelp': 'Temps d’inactivité après une modification avant l’enregistrement automatique du projet en cours d’édition.',

  // Project list screen
  'projectList.title': 'Mes projets',
  'projectList.newProject': 'Nouveau projet',
  'projectList.importJson': 'Importer un fichier JSON…',
  'projectList.empty': 'Aucun projet pour l’instant — créez-en un ou importez un fichier JSON.',
  'projectList.neverSaved': 'jamais enregistré',
  'projectList.unnamed': '(sans nom)',
  'projectList.export': 'Exporter',
  'projectList.delete': 'Supprimer',
  'projectList.deleteConfirm': 'Supprimer « {name} » ? Cette action est irréversible.',
  'projectList.importInvalidJson': 'Fichier JSON invalide — impossible de le lire.',
  'projectList.importNotAProject': 'Ce fichier ne ressemble pas à un projet boxes.js.',
  'projectList.importCollision': 'Un projet avec cet id existe déjà : "{name}" (modifié le {date}).',
  'projectList.importReplace': 'Remplacer le projet existant',
  'projectList.importAsCopy': 'Importer comme copie',
  'projectList.importCancel': 'Annuler',

  // Editor toolbar
  'editor.backToList': 'Mes projets',
  'editor.dimensions': 'Taille extérieure : {width} × {depth} × {height} mm',

  // Export
  'export.exportJson': 'Exporter (JSON)',
  'export.exportSvg': 'Exporter (SVG)',
  'export.inProgress': 'Export en cours…',
  'export.jsonFileType': 'Projet JSON',
  'export.noPieces': 'aucune pièce à exporter',
  'export.page': 'page',
  'export.pages': 'pages',
  'export.pageSummary': '{thickness}mm : {count} {unit}',
  'export.hintMain': 'Export SVG multi-pages — empaquetage rectangulaire optimisé, pas d’imbrication réelle des pièces. {summary}.',
  'export.deepnestHintPrefix': 'Pour un nesting optimal (imbrication réelle des pièces), importer le SVG exporté dans',
  'export.deepnestLinkText': 'Deepnest',
  'export.deepnestHintSuffix': '(gratuit).',

  // Inspector (SegmentInspector.js)
  'inspector.state': 'État',
  'inspector.removeSegment': 'Supprimer ce segment',
  'inspector.addSegment': 'Ajouter ce segment',
  'inspector.outerCannotRemove': 'Le périmètre extérieur ne peut pas être retiré.',
  'inspector.thickness': 'Épaisseur',
  'inspector.thicknessValue': '{thickness}mm ({kind})',
  'inspector.outer': 'extérieur',
  'inspector.inner': 'intérieur',
  'inspector.height': 'Hauteur (mm)',
  'inspector.heightPlaceholder': 'hérite: {height}mm',
  'inspector.heightAppliesOuter': 'S’applique à tout le pourtour extérieur.',
  'inspector.wallHeading': 'Mur {kind} — c={c}, r={r}',
  'inspector.kindVertical': 'vertical',
  'inspector.kindHorizontal': 'horizontal',
  'inspector.empty': 'Cliquez sur un segment de la grille, ou sur une pièce dans l’aperçu, pour l’inspecter.',

  // Grip notch editor
  'notch.title': 'Encoches pour doigt',
  'notch.help': 'Découpe une ou plusieurs encoches dans le bord haut (libre) de ce pan, pour pouvoir y passer les doigts — par exemple pour ouvrir une boîte en tiroir.',
  'notch.fieldOrderHint': 'Largeur, profondeur, rayon, position (mm), séparés par des virgules — le point sépare les décimales, ex. « 20.5, 8, 0, 10 ».',
  'notch.add': '+ Ajouter une encoche',
  'notch.delete': 'Supprimer cette encoche',

  // Hole editor
  'hole.title': 'Trous',
  'hole.help': 'Découpe un ou plusieurs trous rectangulaires (avec coins arrondis en option) dans cette pièce, par exemple pour un passage de câble ou une fixation.',
  'hole.fieldOrderHint': 'Position X, position Y, largeur, hauteur, rayon (mm), séparés par des virgules — le point sépare les décimales, ex. « 20, 10, 30, 15, 3 ».',
  'hole.add': '+ Ajouter un trou',
  'hole.delete': 'Supprimer ce trou',

  // Settings panel
  'settingsPanel.resizeConfirm': 'Ce redimensionnement va faire perdre des personnalisations de segments existants (hauteur, épaisseur ou suppression). Continuer ?',
  'settingsPanel.projectSection': 'Projet',
  'settingsPanel.projectName': 'Nom du projet',
  'settingsPanel.projectNameHelp': 'Nom affiché dans « Mes projets » et utilisé pour le nom du fichier à l’export JSON.',
  'settingsPanel.gridSection': 'Grille',
  'settingsPanel.columns': 'Colonnes (sx, mm)',
  'settingsPanel.columnsHelp': 'Largeurs des colonnes de la grille, en mm, séparées par des virgules — définit le nombre de colonnes et leur taille.',
  'settingsPanel.rows': 'Rangées (sy, mm)',
  'settingsPanel.rowsHelp': 'Hauteurs des rangées de la grille, en mm, séparées par des virgules — définit le nombre de rangées et leur taille.',
  'settingsPanel.thicknessSection': 'Épaisseurs & hauteurs',
  'settingsPanel.outerThickness': 'Épaisseur extérieure (mm)',
  'settingsPanel.outerThicknessHelp': 'Épaisseur du matériau utilisé pour le fond et les parois extérieures.',
  'settingsPanel.innerThickness': 'Épaisseur intérieure (mm)',
  'settingsPanel.innerThicknessHelp': 'Épaisseur du matériau utilisé pour les cloisons internes.',
  'settingsPanel.outerHeight': 'Hauteur extérieure (mm)',
  'settingsPanel.outerHeightHelp': 'Hauteur des parois extérieures (le pourtour de la boîte).',
  'settingsPanel.innerHeight': 'Hauteur intérieure par défaut (mm)',
  'settingsPanel.innerHeightHelp': 'Hauteur par défaut des cloisons internes — modifiable individuellement par cloison dans l’inspecteur.',
  'settingsPanel.optionsSection': 'Options',
  'settingsPanel.labelPieces': 'Étiqueter les pièces',
  'settingsPanel.labelPiecesHelp': 'Grave le nom de chaque pièce (ex. « Paroi V2,0 ») sur son propre contour, dans l’aperçu et à l’export SVG.',
  'settingsPanel.lidSection': 'Couvercle',
  'settingsPanel.lidEnabled': 'Couvercle fixe',
  'settingsPanel.lidHelp': 'Ajoute un couvercle plat qui s’assemble aux parois extérieures, à une hauteur d’insertion donnée.',
  'settingsPanel.lidInsertHeight': 'Hauteur d’insertion (mm)',
  'settingsPanel.lidInsertHeightHelp': 'Hauteur à laquelle repose le dessous du couvercle, mesurée depuis le fond de la boîte.',
  'settingsPanel.lidValidRange': 'Plage valide : {min}–{max}mm.',
  'settingsPanel.lidInvalid': 'Hauteur invalide — doit être entre {min} et {max}mm.',
  'settingsPanel.drawerSection': 'Boîte en tiroir',
  'settingsPanel.drawerHelp': 'Ajoute une boîte englobante autour de la boîte actuelle, ouverte sur un côté, pour en faire un tiroir coulissant.',
  'settingsPanel.drawerOpenSide': 'Côté ouvert',
  'settingsPanel.drawerOpenSideHelp': 'Face de la boîte englobante laissée ouverte, pour insérer/retirer la boîte actuelle comme un tiroir.',
  'settingsPanel.sideTop': 'Haut',
  'settingsPanel.sideBottom': 'Bas',
  'settingsPanel.sideRight': 'Droite',
  'settingsPanel.sideLeft': 'Gauche',

  // Validation messages (GripNotchValidation.js / HoleValidation.js)
  'validation.widthPositive': 'La largeur doit être positive.',
  'validation.depthPositive': 'La profondeur doit être positive.',
  'validation.offsetNotNegative': 'La position ne peut pas être négative.',
  'validation.notch.radiusTooBig': 'Le rayon des coins ne peut pas dépasser {cap}mm (la moitié de la largeur, ou la profondeur si elle est plus petite).',
  'validation.notch.overflowsRun': 'L\'encoche dépasse l\'extrémité du pan (largeur + position ≤ {length}mm).',
  'validation.notch.crossesHeightChange': 'L\'encoche chevauche une variation de hauteur le long du pan — repositionnez-la dans une zone de hauteur uniforme.',
  'validation.notch.depthExceedsHeight': 'La profondeur doit être inférieure à la hauteur locale du pan à cet endroit ({height}mm).',
  'validation.notch.crossesJunction': 'L\'encoche chevauche une jonction (entaille en croix ou mortaise) sur ce pan — repositionnez-la.',
  'validation.notch.overlapsSibling': 'Cette encoche chevauche une autre encoche du même pan — repositionnez-la ou repositionnez l\'autre.',
  'validation.hole.xPositive': 'La dimension X doit être positive.',
  'validation.hole.yPositive': 'La dimension Y doit être positive.',
  'validation.hole.radiusTooBig': 'Le rayon des coins ne peut pas dépasser {cap}mm (la moitié de la plus petite dimension).',
  'validation.hole.tooCloseLeft': 'Le trou doit rester à au moins {margin}mm du bord gauche.',
  'validation.hole.tooCloseBottom': 'Le trou doit rester à au moins {margin}mm du bord bas.',
  'validation.hole.tooCloseRight': 'Le trou doit rester à au moins {margin}mm du bord droit.',
  'validation.hole.tooCloseTop': 'Le trou doit rester à au moins {margin}mm du bord haut.',
  'validation.hole.overlapsSibling': 'Ce trou chevauche un autre trou de la même pièce — repositionnez-le ou repositionnez l\'autre.',
  'validation.hole.crossesHeightChange': 'Le trou chevauche une variation de hauteur le long du pan — repositionnez-le dans une zone de hauteur uniforme.',
};
