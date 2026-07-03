import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { I18nManager } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import i18n, { type Lang, LANGS, RTL_LANGS } from "../i18n";
import type { Units } from "../i18n/units";

type MapSource = "google" | "baidu";

type PrefsCtx = {
  language: Lang;
  units: Units;
  mapSource: MapSource;
  setLanguage: (l: Lang) => void;
  setUnits: (u: Units) => void;
  setMapSource: (m: MapSource) => void;
};

const KEY = { lang: "pref.lang", units: "pref.units", map: "pref.map" };
const Ctx = createContext<PrefsCtx | null>(null);

function applyRTL(l: Lang) {
  const rtl = RTL_LANGS.includes(l);
  if (I18nManager.isRTL !== rtl) {
    I18nManager.allowRTL(rtl);
    I18nManager.forceRTL(rtl); // NB: un redémarrage de l'app est requis pour appliquer le RTL
  }
}

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [language, setLang] = useState<Lang>("fr");
  const [units, setU] = useState<Units>("km");
  const [mapSource, setM] = useState<MapSource>("google");

  useEffect(() => {
    (async () => {
      const [l, u, m] = await Promise.all([
        AsyncStorage.getItem(KEY.lang),
        AsyncStorage.getItem(KEY.units),
        AsyncStorage.getItem(KEY.map),
      ]);
      if (l && (LANGS as readonly string[]).includes(l)) {
        setLang(l as Lang);
        void i18n.changeLanguage(l);
        applyRTL(l as Lang);
      }
      if (u === "km" || u === "mi") setU(u);
      if (m === "google" || m === "baidu") setM(m);
    })();
  }, []);

  const setLanguage = useCallback((l: Lang) => {
    setLang(l);
    void i18n.changeLanguage(l);
    applyRTL(l);
    void AsyncStorage.setItem(KEY.lang, l);
  }, []);
  const setUnits = useCallback((u: Units) => {
    setU(u);
    void AsyncStorage.setItem(KEY.units, u);
  }, []);
  const setMapSource = useCallback((m: MapSource) => {
    setM(m);
    void AsyncStorage.setItem(KEY.map, m);
  }, []);

  const value = useMemo<PrefsCtx>(
    () => ({ language, units, mapSource, setLanguage, setUnits, setMapSource }),
    [language, units, mapSource, setLanguage, setUnits, setMapSource],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePrefs(): PrefsCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("usePrefs doit être utilisé dans <PrefsProvider>");
  return v;
}
