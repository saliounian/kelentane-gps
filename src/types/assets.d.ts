// Assets importés directement (Metro les résout en module d'asset).
declare module "*.ttf" {
  const asset: number;
  export default asset;
}
declare module "*.png" {
  const asset: number;
  export default asset;
}
declare module "*.svg" {
  const asset: number;
  export default asset;
}
