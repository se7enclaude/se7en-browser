/* Imports gérés par Vite : « ?url » donne l'adresse du fichier, les CSS sont injectées dans la page. */
declare module '*?url' {
  const url: string
  export default url
}
declare module '*.css'
