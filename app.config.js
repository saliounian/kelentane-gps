// Config dynamique : injecte la clé Google Maps Android depuis l'environnement
// (secret EAS `GOOGLE_MAPS_ANDROID_KEY`). La clé n'est JAMAIS codée en dur ici.
// Le reste de la config vit dans app.json.
const base = require("./app.json").expo;

module.exports = () => {
  const key = process.env.GOOGLE_MAPS_ANDROID_KEY;
  return {
    ...base,
    android: {
      ...base.android,
      ...(key
        ? { config: { ...(base.android && base.android.config), googleMaps: { apiKey: key } } }
        : {}),
    },
  };
};
