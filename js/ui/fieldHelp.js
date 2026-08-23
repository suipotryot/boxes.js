// Tooltip text for fields that appear identically in more than one screen
// — finger-joint dimensions (SettingsPanel.js's own project settings AND
// PreferencesView.js's user-level defaults for them) and laser-bed/burn
// (SettingsPanel.js AND MachineSettingsView.js) — defined once so the
// wording can't drift between two screens describing the exact same
// underlying value. Screen-specific fields (project name, grid, lid,
// autosave delay…) keep their tooltip text inline at their own call site
// instead, since nothing else needs to match it.
export const FINGER_MM_HELP = 'Largeur de chaque dent des assemblages en doigts de menuisier.';
export const SPACE_MM_HELP = 'Largeur de chaque espace entre deux dents.';
export const MARGIN_MM_HELP = 'Marge plane minimale laissée à chaque extrémité d’une rangée de dents, avant que les dents commencent.';
// See FingerJoint.js's own fingerEdgePath(): play shrinks each dent and
// grows each espace by this same amount — this text mirrors that exactly,
// not a guess at the intent from the field's name alone.
export const PLAY_MM_HELP = 'Jeu de serrage : chaque dent est rétrécie et chaque espace élargi de cette valeur, pour que les pièces s’emboîtent sans forcer une fois découpées (compense la découpe laser et les tolérances du matériau).';
export const BURN_MM_HELP = 'Largeur de matière retirée par le laser à la découpe (jeu de coupe / kerf). L’app agrandit légèrement les contours et rétrécit les trous de ce montant pour que les pièces mesurent la bonne taille une fois coupées.';
export const LASER_WIDTH_HELP = 'Largeur de la zone de découpe de la machine — détermine comment les pièces sont réparties sur plusieurs pages à l’export.';
export const LASER_HEIGHT_HELP = 'Hauteur de la zone de découpe de la machine — détermine comment les pièces sont réparties sur plusieurs pages à l’export.';
export const LASER_SPACING_HELP = 'Espace minimal laissé entre deux pièces voisines sur une même page d’export.';
export const DRAWER_PLAY_HELP = 'Jeu de glissement entre la boîte actuelle et la boîte englobante — appliqué du côté fermé de l’axe d’ouverture, et des deux côtés sur l’autre axe. Le côté ouvert reste toujours à fleur, sans jeu ni marge supplémentaire.';
export const DRAWER_THICKNESS_HELP = 'Épaisseur du matériau utilisé pour la boîte englobante — indépendante de l’épaisseur extérieure de la boîte principale.';
