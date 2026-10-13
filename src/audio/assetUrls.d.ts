// Imports de arquivo com "?url" (Vite copia o arquivo para dist/assets e devolve a URL final)
declare module "*?url" {
  const src: string;
  export default src;
}
declare module "*?url&no-inline" {
  const src: string;
  export default src;
}
