import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Pressable, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTranslation } from "react-i18next";
import { Phone, Smartphone } from "lucide-react-native";
import { ACCENT, hexA, LIME_ON } from "../theme/tokens";
import { font } from "../theme/fonts";
import { useTheme } from "../theme/ThemeProvider";
import { useAuth } from "../state/auth";
import { supabase } from "../data/supabase";
import { fetchVehicles, patchVehicle } from "../data/api";
import { BottomSheet, Field } from "../ui";

type SimTarget = { id: number; name: string };
type Step = "phone" | "sim" | null;

const DAY_MS = 86400000;
const seenKey = (uid: string) => `reminder:lastShown:${uid}`;
const hasVal = (s: string | null | undefined) => !!s && s.trim().length > 0;

/**
 * Rappels non-bloquants (§4 téléphone client, §5 numéro SIM du GPS).
 *
 * Vérifie à chaque ouverture / reprise de l'app (AppState → "active") :
 * - téléphone du compte manquant (`clients.phone`) ;
 * - véhicules sans numéro SIM renseigné (`devices.sim_phone` → `VehicleVM.phone`).
 * L'utilisateur peut renseigner tout de suite (persisté côté serveur) ou reporter
 * (« Plus tard ») ; une fois la donnée enregistrée, le rappel ne réapparaît plus.
 */
export function RemindersGate() {
  const { t } = useTheme();
  const { t: tr } = useTranslation();
  const { session } = useAuth();
  const uid = session?.user?.id ?? null;

  const [step, setStep] = useState<Step>(null);
  const [phoneMissing, setPhoneMissing] = useState(false);
  const [simQueue, setSimQueue] = useState<SimTarget[]>([]);
  const [input, setInput] = useState("");
  const [saving, setSaving] = useState(false);
  const dismissed = useRef(false); // « Plus tard » : pas de re-check tant qu'on ne repasse pas en background

  const runCheck = useCallback(async () => {
    if (!uid || dismissed.current) return;
    try {
      const [{ data: client }, vehicles] = await Promise.all([
        supabase.from("clients").select("phone").eq("id", uid).maybeSingle(),
        fetchVehicles().catch(() => []),
      ]);
      const noPhone = !hasVal((client as { phone: string | null } | null)?.phone);
      // §5 : uniquement les véhicules RÉELLEMENT possédés par l'utilisateur.
      const sims = vehicles.filter((v) => v.ownerId === uid && !hasVal(v.phone)).map((v) => ({ id: v.id, name: v.name }));
      if (!noPhone && sims.length === 0) {
        setStep(null);
        return;
      }
      // Cadence 1×/jour : ne ré-affiche pas si < 24 h depuis le dernier affichage.
      const raw = await AsyncStorage.getItem(seenKey(uid));
      if (raw && Date.now() - Number(raw) < DAY_MS) {
        setStep(null);
        return;
      }
      setPhoneMissing(noPhone);
      setSimQueue(sims);
      setInput("");
      setStep(noPhone ? "phone" : "sim");
      await AsyncStorage.setItem(seenKey(uid), String(Date.now()));
    } catch {
      /* silencieux : un rappel raté n'empêche rien */
    }
  }, [uid]);

  // Ouverture à froid.
  useEffect(() => {
    void runCheck();
  }, [runCheck]);

  // Reprise (background → active) = nouvelle « ouverture ».
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") {
        dismissed.current = false;
        void runCheck();
      }
    });
    return () => sub.remove();
  }, [runCheck]);

  const later = () => {
    dismissed.current = true;
    setStep(null);
  };

  // Passe à l'étape suivante (SIM) ou ferme.
  const advanceAfterPhone = (queue: SimTarget[]) => {
    setInput("");
    setStep(queue.length ? "sim" : null);
  };

  const savePhone = async () => {
    if (!uid || saving) return;
    const val = input.trim();
    if (val.length < 6) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("clients").update({ phone: val }).eq("id", uid);
      if (!error) {
        setPhoneMissing(false);
        advanceAfterPhone(simQueue);
      }
    } finally {
      setSaving(false);
    }
  };

  const saveSim = async () => {
    const target = simQueue[0];
    if (!target || saving) return;
    const val = input.trim();
    if (val.length < 4) return;
    setSaving(true);
    try {
      await patchVehicle(target.id, { phone: val });
      const rest = simQueue.slice(1);
      setSimQueue(rest);
      setInput("");
      setStep(rest.length ? "sim" : null);
    } catch {
      /* réseau : on garde le sheet ouvert */
    } finally {
      setSaving(false);
    }
  };

  if (!step) return null;
  const isPhone = step === "phone";
  const target = simQueue[0];

  return (
    <BottomSheet t={t} visible onClose={later}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 10 }}>
        <View style={{ width: 42, height: 42, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: hexA(ACCENT, 0.16) }}>
          {isPhone ? <Phone size={20} color={ACCENT} /> : <Smartphone size={20} color={ACCENT} />}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 17, color: t.text, fontFamily: font.body.bold }}>
            {isPhone ? tr("reminder.phoneTitle") : tr("reminder.simTitle")}
          </Text>
          <Text style={{ fontSize: 12, color: t.sub, fontFamily: font.body.regular }}>
            {isPhone ? tr("reminder.phoneDesc") : tr("reminder.simDesc", { name: target?.name ?? "" })}
          </Text>
        </View>
      </View>

      {!isPhone && simQueue.length > 1 ? (
        <Text style={{ fontSize: 11.5, color: t.sub, marginBottom: 8, fontFamily: font.body.regular }}>
          {tr("reminder.simRemaining", { n: simQueue.length })}
        </Text>
      ) : null}

      <Field
        t={t}
        label={isPhone ? tr("reminder.phoneField") : tr("reminder.simField")}
        icon={Phone}
        placeholder={isPhone ? "77 123 45 65" : "77 000 00 00"}
        keyboardType="phone-pad"
        mono={!isPhone}
        value={input}
        onChangeText={setInput}
      />

      <Pressable
        onPress={isPhone ? savePhone : saveSim}
        disabled={saving || input.trim().length < (isPhone ? 6 : 4)}
        style={{ padding: 14, borderRadius: 14, alignItems: "center", backgroundColor: input.trim().length >= (isPhone ? 6 : 4) ? ACCENT : hexA(t.text, 0.12) }}
      >
        <Text style={{ fontSize: 15, color: input.trim().length >= (isPhone ? 6 : 4) ? LIME_ON : t.sub, fontFamily: font.body.bold }}>
          {saving ? tr("reminder.saving") : tr("reminder.save")}
        </Text>
      </Pressable>
      <Pressable onPress={later} style={{ padding: 12, alignItems: "center", marginTop: 6 }}>
        <Text style={{ fontSize: 14, color: t.sub, fontFamily: font.body.semibold }}>{tr("reminder.later")}</Text>
      </Pressable>
    </BottomSheet>
  );
}
