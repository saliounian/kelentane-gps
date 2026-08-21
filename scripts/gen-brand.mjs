import sharp from "sharp";
const PIN = "#0A5C42", LIME = "#B4E82A";
const K = (c) =>
  `<line x1="33" y1="22" x2="33" y2="78" stroke="${c}" stroke-width="13" stroke-linecap="round"/>` +
  `<line x1="35" y1="50" x2="73" y2="23" stroke="${c}" stroke-width="13" stroke-linecap="round"/>` +
  `<line x1="39" y1="52" x2="73" y2="78" stroke="${c}" stroke-width="13" stroke-linecap="round"/>`;
const ARROW = (c) =>
  `<path d="M47 69 L70 43 L69 66 Z" fill="${c}" stroke="${c}" stroke-width="5" stroke-linejoin="round"/>`;
function svg(mode) {
  let body = "";
  if (mode === "framed") body = `<rect x="2" y="2" width="96" height="96" rx="24" fill="${PIN}"/>` + K("#fff") + ARROW(LIME);
  else if (mode === "glyph") body = K("#fff") + ARROW(LIME);
  else if (mode === "mono") body = K("#fff") + ARROW("#fff");
  else if (mode === "solid") body = `<rect x="0" y="0" width="100" height="100" fill="${PIN}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">${body}</svg>`;
}
const out = [
  ["assets/brand/icon.png", "framed", 1024],
  ["assets/brand/splash-icon.png", "framed", 1024],
  ["assets/brand/adaptive-foreground.png", "glyph", 1024],
  ["assets/brand/adaptive-monochrome.png", "mono", 1024],
  ["assets/brand/notification-icon.png", "mono", 256],
  ["assets/brand/favicon.png", "framed", 96],
];
for (const [path, mode, size] of out) {
  await sharp(Buffer.from(svg(mode))).resize(size, size).png().toFile(path);
  console.log("wrote", path, size);
}
