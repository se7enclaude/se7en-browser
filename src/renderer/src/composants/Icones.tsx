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
