/* Petites icônes SVG au trait, toutes dessinées sur une grille de 16. */
const base = { viewBox: '0 0 16 16', 'aria-hidden': true, className: 'icone' } as const

export const IconePrecedent = () => (
  <svg {...base}><path d="M9.5 3.5 5 8l4.5 4.5" /></svg>
)
export const IconeSuivant = () => (
  <svg {...base}><path d="M6.5 3.5 11 8l-4.5 4.5" /></svg>
)
export const IconeActualiser = () => (
  <svg {...base}><path d="M12.5 8a4.5 4.5 0 1 1-1.3-3.2" /><path d="M12.5 3v2.5H10" /></svg>
)
export const IconeCroix = () => (
  <svg {...base}><path d="M4.5 4.5l7 7M11.5 4.5l-7 7" /></svg>
)
export const IconePlus = () => (
  <svg {...base}><path d="M8 3.5v9M3.5 8h9" /></svg>
)
export const IconeCadenas = () => (
  <svg {...base}><rect x="4" y="7" width="8" height="6" rx="1.5" /><path d="M5.75 7V5.5a2.25 2.25 0 0 1 4.5 0V7" /></svg>
)
export const IconeRecherche = () => (
  <svg {...base}><circle cx="7" cy="7" r="4" /><path d="m10 10 3 3" /></svg>
)
export const IconeGlobe = () => (
  <svg {...base}><circle cx="8" cy="8" r="5.5" /><path d="M2.5 8h11M8 2.5c1.8 1.6 1.8 9.4 0 11M8 2.5c-1.8 1.6-1.8 9.4 0 11" /></svg>
)
export const IconeBarreLaterale = () => (
  <svg {...base}><rect x="2.5" y="3" width="11" height="10" rx="2" /><path d="M6.5 3v10" /></svg>
)
export const IconeReglages = () => (
  <svg {...base}><circle cx="8" cy="8" r="2" /><path d="M8 1.8v1.7M8 12.5v1.7M14.2 8h-1.7M3.5 8H1.8M12.4 3.6l-1.2 1.2M4.8 11.2l-1.2 1.2M12.4 12.4l-1.2-1.2M4.8 4.8 3.6 3.6" /></svg>
)
export const IconeEtoile = ({ pleine = false }: { pleine?: boolean }) => (
  <svg {...base} className={`icone${pleine ? ' pleine' : ''}`}><path d="m8 2.2 1.8 3.7 4 .6-2.9 2.8.7 4L8 11.4l-3.6 1.9.7-4-2.9-2.8 4-.6Z" /></svg>
)
export const IconeTelecharger = () => (
  <svg {...base}><path d="M8 2.5v7.5M4.8 7 8 10.2 11.2 7M3 13h10" /></svg>
)
export const IconeHistorique = () => (
  <svg {...base}><path d="M2.8 8a5.2 5.2 0 1 0 1.5-3.7" /><path d="M2.5 2.8v2.4h2.4M8 5v3l2 1.3" /></svg>
)
export const IconeSplit = () => (
  <svg {...base}><rect x="2" y="3" width="12" height="10" rx="2" /><path d="M8 3v10" /></svg>
)
export const IconeDossier = () => (
  <svg {...base}><path d="M2.5 4.5a1 1 0 0 1 1-1h3l1.5 1.5h4.5a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1Z" /></svg>
)
export const IconeCorbeille = () => (
  <svg {...base}><path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.5h5.8l.6-8.5" /></svg>
)
export const IconePause = () => (
  <svg {...base}><path d="M6 4v8M10 4v8" /></svg>
)
export const IconeLecture = () => (
  <svg {...base}><path d="M5.5 3.5v9l7-4.5Z" /></svg>
)
export const IconeIA = () => (
  <svg {...base}><path d="M8 2.5 9.3 6.7 13.5 8 9.3 9.3 8 13.5 6.7 9.3 2.5 8 6.7 6.7Z" /></svg>
)
export const IconePdf = () => (
  <svg {...base}><path d="M4 2.5h5.5L12.5 5.5v8H4Z" /><path d="M9.5 2.5v3h3M6 9h4M6 11h3" /></svg>
)
export const IconeBouclier = () => (
  <svg {...base}><path d="M8 2.2 13 4v3.6c0 3-2.1 5.2-5 6.2-2.9-1-5-3.2-5-6.2V4Z" /></svg>
)
export const IconeRanger = () => (
  <svg {...base}><rect x="2.5" y="3" width="4.5" height="4" rx="1" /><rect x="9" y="3" width="4.5" height="4" rx="1" /><rect x="2.5" y="9" width="11" height="4" rx="1" /></svg>
)
export const IconeAmis = () => (
  <svg {...base}><circle cx="6" cy="5.75" r="2.25" /><path d="M2 13c.4-2.3 2-3.6 4-3.6s3.6 1.3 4 3.6" /><path d="M10.5 3.6a2.2 2.2 0 0 1 0 4.3M12 9.6c1.1.5 1.8 1.6 2 3.4" /></svg>
)
export const IconeZone = () => (
  <svg {...base}><path d="M2.5 5.5v-2a1 1 0 0 1 1-1h2M10.5 2.5h2a1 1 0 0 1 1 1v2M13.5 10.5v2a1 1 0 0 1-1 1h-2M5.5 13.5h-2a1 1 0 0 1-1-1v-2" /><circle cx="8" cy="8" r="1.6" /></svg>
)
export const IconeTraduire = () => (
  <svg {...base}><path d="M2 3.6h6.2M5.1 2v1.6M3.4 3.6c.6 2.3 2.1 4 4.2 5M6.8 3.6C6.2 5.9 4.7 7.6 2.6 8.6M8.6 14l2.6-6.4 2.6 6.4M9.4 12.1h3.6" /></svg>
)
export const IconeImage = () => (
  <svg {...base}><rect x="2.2" y="3" width="11.6" height="10" rx="2" /><circle cx="5.8" cy="6.4" r="1.1" /><path d="m2.6 11.6 3.4-3.2 2.4 2.2 2-1.7 3.2 2.9" /></svg>
)
export const IconeEnsemble = () => (
  <svg {...base}><circle cx="5.4" cy="5.6" r="2" /><circle cx="10.8" cy="5.6" r="2" /><path d="M1.8 12.6c.5-2 1.9-3 3.6-3s3.1 1 3.6 3M7.6 9.9c.8-.8 1.9-1.3 3.2-1.3 1.7 0 3.1 1 3.6 3" /></svg>
)
export const IconePrive = () => (
  <svg {...base}><path d="M2 7.2c1.4-.9 3.6-1.4 6-1.4s4.6.5 6 1.4" /><path d="M4.2 5.9 5 2.8h6l.8 3.1" /><circle cx="5.2" cy="10.6" r="1.8" /><circle cx="10.8" cy="10.6" r="1.8" /><path d="M7 10.4c.6-.4 1.4-.4 2 0" /></svg>
)
export const IconeMicro = () => (
  <svg {...base}><rect x="5.8" y="1.8" width="4.4" height="8" rx="2.2" /><path d="M3.4 7.6a4.6 4.6 0 0 0 9.2 0M8 12.2v2" /></svg>
)
