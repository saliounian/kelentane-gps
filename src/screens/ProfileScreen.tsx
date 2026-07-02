import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Bell, ChevronRight, Gauge, Globe, Hash, KeyRound, LogOut, Map, Phone, Share2, UserRound } from "lucide-react-native";
import { ACCENT, ALERT, hexA, LIME_ON, Theme } from "../theme/tokens";
import { font } from "../theme/fonts";
import { useTheme } from "../theme/ThemeProvider";
import { useAuth } from "../state/auth";
import { supabase } from "../data/supabase";
import { BottomSheet, Field, SectionLabel, Toggle } from "../ui";
import type { LucideIcon } from "../types/models";

const LANGS = ["Français", "Wolof", "English", "العربية"];

export function ProfileScreen() {
  const { t } = useTheme();
  const insets = useSafeAreaInsets();
  const { session, signOut } = useAuth();
  const [me, setMe] = useState<{ name: string | null; phone: string | null; username: string | null }>({ name: null, phone: null, username: null });
  const [lang, setLang] = useState(0);
  const [notif, setNotif] = useState(true);
  const [units, setUnits] = useState<"km" | "mi">("km");
  const [mapSrc, setMapSrc] = useState<"google" | "baidu">("google");
  const [pwdOpen, setPwdOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [byeOpen, setByeOpen] = useState(false);

  useEffect(() => {
    const uid = session?.user?.id;
    if (!uid) return;
    supabase
      .from("clients")
      .select("name,phone,username")
      .eq("id", uid)
      .maybeSingle()
      .then(({ data }) => data && setMe(data as typeof me));
  }, [session]);

  const initials = (me.name ?? me.username ?? "K").trim().slice(0, 2).toUpperCase();

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 110 }}>
        <Text style={{ fontSize: 26, color: t.text, fontFamily: font.display.extrabold, letterSpacing: -0.5, paddingHorizontal: 18, marginBottom: 14 }}>Profil</Text>

        {/* header compte */}
        <View style={{ marginHorizontal: 14, marginBottom: 18, borderRadius: 22, padding: 16, flexDirection: "row", alignItems: "center", gap: 13, backgroundColor: t.glass, borderWidth: 1, borderColor: t.border }}>
          <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: ACCENT, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ color: LIME_ON, fontSize: 20, fontFamily: font.body.bold }}>{initials}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 17, color: t.text, fontFamily: font.body.bold }}>{me.name ?? me.username ?? "Compte"}</Text>
            <Text style={{ fontSize: 12, color: t.sub, fontFamily: font.mono.regular }}>{me.phone ?? session?.user?.email ?? ""}</Text>
          </View>
        </View>

        <SectionLabel t={t}>Compte</SectionLabel>
        <Card t={t}>
          <Row t={t} icon={UserRound} label="Nom" value={me.name ?? "—"} />
          <Row t={t} icon={Phone} label="Téléphone" value={me.phone ?? "—"} />
          <Row t={t} icon={Hash} label="Identifiant" value={me.username ?? "—"} last />
        </Card>

        <SectionLabel t={t}>Paramètres</SectionLabel>
        <Card t={t}>
          <Row t={t} icon={Share2} label="Partager l'appareil" onPress={() => setShareOpen(true)} chevron />
          <Row t={t} icon={KeyRound} label="Changer le mot de passe" onPress={() => setPwdOpen(true)} chevron />
          <Row t={t} icon={Globe} label="Langue" value={LANGS[lang]} onPress={() => setLang((l) => (l + 1) % LANGS.length)} />
          <RowToggle t={t} icon={Bell} label="Notifications" on={notif} set={setNotif} />
          <Row t={t} icon={Gauge} label="Unités" value={units === "km" ? "km / km/h" : "mi / mph"} onPress={() => setUnits((u) => (u === "km" ? "mi" : "km"))} last />
        </Card>

        {/* source carte */}
        <View style={{ marginHorizontal: 14, marginTop: 14, borderRadius: 22, padding: 14, backgroundColor: t.glass, borderWidth: 1, borderColor: t.border }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <IconBox t={t} icon={Map} />
            <Text style={{ fontSize: 14, color: t.text, fontFamily: font.body.semibold }}>Source de la carte</Text>
          </View>
          <View style={{ flexDirection: "row", gap: 6, padding: 4, borderRadius: 13, backgroundColor: t.glass, borderWidth: 1, borderColor: t.line }}>
            {(["google", "baidu"] as const).map((id) => {
              const on = mapSrc === id;
              return (
                <Pressable key={id} onPress={() => setMapSrc(id)} style={{ flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: "center", backgroundColor: on ? ACCENT : "transparent" }}>
                  <Text style={{ fontSize: 13, color: on ? LIME_ON : t.text, fontFamily: font.body.semibold }}>{id === "google" ? "Google Maps" : "Baidu"}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={{ marginHorizontal: 14, marginTop: 14 }}>
          <Pressable onPress={() => setByeOpen(true)} style={{ padding: 13, borderRadius: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: hexA(ALERT, 0.1), borderWidth: 1, borderColor: hexA(ALERT, 0.4) }}>
            <LogOut size={17} color={ALERT} />
            <Text style={{ fontSize: 14, color: ALERT, fontFamily: font.body.bold }}>Déconnexion</Text>
          </Pressable>
        </View>

        <Text style={{ textAlign: "center", fontSize: 11, color: t.sub, marginTop: 14, fontFamily: font.body.regular }}>Kelentane GPS · v1.0</Text>
      </ScrollView>

      <PasswordChangeSheet t={t} visible={pwdOpen} onClose={() => setPwdOpen(false)} />

      <BottomSheet t={t} visible={shareOpen} onClose={() => setShareOpen(false)}>
        <Text style={{ fontSize: 18, color: t.text, fontFamily: font.body.bold, marginBottom: 4 }}>Partager l'appareil</Text>
        <Text style={{ fontSize: 13, color: t.sub, marginBottom: 16, fontFamily: font.body.regular }}>
          Partage par jeton sécurisé — arrive à l'étape 9b.
        </Text>
      </BottomSheet>

      <BottomSheet t={t} visible={byeOpen} onClose={() => setByeOpen(false)}>
        <Text style={{ fontSize: 18, color: t.text, fontFamily: font.body.bold, marginBottom: 4 }}>Se déconnecter ?</Text>
        <Text style={{ fontSize: 13, color: t.sub, marginBottom: 16, fontFamily: font.body.regular }}>Tu devras te reconnecter avec ton identifiant.</Text>
        <Pressable onPress={async () => { setByeOpen(false); await signOut(); }} style={{ padding: 14, borderRadius: 14, alignItems: "center", backgroundColor: ALERT }}>
          <Text style={{ fontSize: 15, color: "#fff", fontFamily: font.body.bold }}>Déconnexion</Text>
        </Pressable>
      </BottomSheet>
    </View>
  );
}

function PasswordChangeSheet({ t, visible, onClose }: { t: Theme; visible: boolean; onClose: () => void }) {
  const [pwd, setPwd] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const save = async () => {
    if (pwd.length < 4 || pwd !== pwd2) return setMsg("Mot de passe ≥ 4 caractères et identique.");
    const { error } = await supabase.auth.updateUser({ password: pwd });
    setMsg(error ? error.message : "Mot de passe mis à jour.");
    if (!error) {
      setPwd("");
      setPwd2("");
    }
  };
  return (
    <BottomSheet t={t} visible={visible} onClose={onClose}>
      <Text style={{ fontSize: 18, color: t.text, fontFamily: font.body.bold, marginBottom: 12 }}>Changer le mot de passe</Text>
      <Field t={t} label="Nouveau mot de passe" icon={KeyRound} placeholder="••••••" secure value={pwd} onChangeText={(v) => { setPwd(v); setMsg(null); }} />
      <Field t={t} label="Confirmer" icon={KeyRound} placeholder="••••••" secure value={pwd2} onChangeText={(v) => { setPwd2(v); setMsg(null); }} />
      {msg ? <Text style={{ fontSize: 12.5, color: t.sub, marginBottom: 8, fontFamily: font.body.regular }}>{msg}</Text> : null}
      <Pressable onPress={save} style={{ padding: 14, borderRadius: 14, alignItems: "center", backgroundColor: ACCENT }}>
        <Text style={{ fontSize: 15, color: LIME_ON, fontFamily: font.body.bold }}>Mettre à jour</Text>
      </Pressable>
    </BottomSheet>
  );
}

/* petits helpers de ligne */
function Card({ t, children }: { t: Theme; children: React.ReactNode }) {
  return <View style={{ marginHorizontal: 14, borderRadius: 22, overflow: "hidden", backgroundColor: t.glass, borderWidth: 1, borderColor: t.border }}>{children}</View>;
}
function IconBox({ t, icon: Icon }: { t: Theme; icon: LucideIcon }) {
  return (
    <View style={{ width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: hexA(ACCENT, 0.16) }}>
      <Icon size={18} color={ACCENT} />
    </View>
  );
}
function Row({ t, icon, label, value, onPress, chevron, last }: { t: Theme; icon: LucideIcon; label: string; value?: string; onPress?: () => void; chevron?: boolean; last?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 13, paddingHorizontal: 14, borderBottomWidth: last ? 0 : 1, borderBottomColor: t.line }}>
      <IconBox t={t} icon={icon} />
      <Text style={{ flex: 1, fontSize: 14, color: t.text, fontFamily: font.body.semibold }}>{label}</Text>
      {value ? <Text style={{ fontSize: 13, color: t.sub, fontFamily: font.body.regular }}>{value}</Text> : null}
      {chevron ? <ChevronRight size={17} color={t.sub} /> : null}
    </Pressable>
  );
}
function RowToggle({ t, icon, label, on, set, last }: { t: Theme; icon: LucideIcon; label: string; on: boolean; set: (v: boolean) => void; last?: boolean }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 13, paddingHorizontal: 14, borderBottomWidth: last ? 0 : 1, borderBottomColor: t.line }}>
      <IconBox t={t} icon={icon} />
      <Text style={{ flex: 1, fontSize: 14, color: t.text, fontFamily: font.body.semibold }}>{label}</Text>
      <Toggle t={t} on={on} set={set} />
    </View>
  );
}
