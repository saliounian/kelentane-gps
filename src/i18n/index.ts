import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import fr from "./locales/fr.json";
import en from "./locales/en.json";
import wo from "./locales/wo.json";
import ar from "./locales/ar.json";

export const LANGS = ["fr", "wo", "en", "ar"] as const;
export type Lang = (typeof LANGS)[number];
export const LANG_LABELS: Record<Lang, string> = { fr: "Français", wo: "Wolof", en: "English", ar: "العربية" };
export const RTL_LANGS: Lang[] = ["ar"];

void i18n.use(initReactI18next).init({
  resources: {
    fr: { translation: fr },
    en: { translation: en },
    wo: { translation: wo },
    ar: { translation: ar },
  },
  lng: "fr",
  fallbackLng: "fr", // clés manquantes (wo/ar partiels) → français
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
});

export default i18n;
