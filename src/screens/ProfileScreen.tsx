import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";
import { useTranslation } from "react-i18next";
import { Bell, Check, ChevronRight, Copy, Gauge, Globe, Hash, KeyRound, LogOut, Map, Phone, Share2, UserRound } from "lucide-react-native";
import { ACCENT, ALERT, hexA, LIME_ON, ONLINE, Theme } from "../theme/tokens";
import { font } from "../theme/fonts";
import { useTheme } from "../theme/ThemeProvider";
import { useAuth } from "../state/auth";
import { usePrefs } from "../state/prefs";
import { LANG_LABELS, LANGS, RTL_LANGS, type Lang } from "../i18n";
import { useVehicles } from "../data/useVehicles";
import { supabase } from "../data/supabase";
import { claimShare, createShare } from "../data/shares";
import { BottomSheet, Field, SectionLabel, Toggle } from "../ui";
import type { LucideIcon } from "../types/models";

export function ProfileScreen() {
  const { t } = useTheme();
  const { t: tr } = useTranslation();
  const insets = useSafeAreaInsets();
  const { session, signOut } = useAuth();
  const { language, units, mapSource, setLanguage, setUnits, setMapSource } = usePrefs();
  const [me, setMe] = useState<{ name: string | null; phone: string | null; username: string | null }>({ name: null, phone: null, username: null });
  const [notif, setNotif] = useState(true);
  const [langOpen, setLangOpen] = useState(false);
  const [pwdOpen, setPwdOpen] = useState(false);
  const [phoneOpen, setPhoneOpen] = useState(false);
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
        <Text style={{ fontSize: 26, color: t.text, fontFamily: font.display.extrabold, letterSpacing: -0.5, paddingHorizontal: 18, marginBottom: 14 }}>{tr("profile.title")}</Text>

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

        <SectionLabel t={t}>{tr("profile.account")}</SectionLabel>
        <Card t={t}>
          <Row t={t} icon={UserRound} label={tr("profile.name")} value={me.name ?? "—"} />
          <Row t={t} icon={Phone} label={tr("profile.phone")} value={me.phone ?? tr("profile.phoneMissing")} onPress={() => setPhoneOpen(true)} chevron />
          <Row t={t} icon={Hash} label={tr("profile.identifier")} value={me.username ?? "—"} last />
        </Card>

        <SectionLabel t={t}>{tr("profile.settings")}</SectionLabel>
        <Card t={t}>
          <Row t={t} icon={Share2} label={tr("profile.share")} onPress={() => setShareOpen(true)} chevron />
          <Row t={t} icon={KeyRound} label={tr("profile.changePwd")} onPress={() => setPwdOpen(true)} chevron />
          <Row t={t} icon={Globe} label={tr("profile.language")} value={LANG_LABELS[language]} onPress={() => setLangOpen(true)} chevron />
          <RowToggle t={t} icon={Bell} label={tr("profile.notifications")} on={notif} set={setNotif} />
          <Row t={t} icon={Gauge} label={tr("profile.units")} value={tr(units === "km" ? "units.kmLabel" : "units.miLabel")} onPress={() => setUnits(units === "km" ? "mi" : "km")} last />
        </Card>

        {/* source carte */}
        <View style={{ marginHorizontal: 14, marginTop: 14, borderRadius: 22, padding: 14, backgroundColor: t.glass, borderWidth: 1, borderColor: t.border }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <IconBox t={t} icon={Map} />
            <Text style={{ fontSize: 14, color: t.text, fontFamily: font.body.semibold }}>{tr("profile.mapSource")}</Text>
          </View>
          <View style={{ flexDirection: "row", gap: 6, padding: 4, borderRadius: 13, backgroundColor: t.glass, borderWidth: 1, borderColor: t.line }}>
            {(["google", "baidu"] as const).map((id) => {
              const on = mapSource === id;
              return (
                <Pressable key={id} onPress={() => setMapSource(id)} style={{ flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: "center", backgroundColor: on ? ACCENT : "transparent" }}>
                  <Text style={{ fontSize: 13, color: on ? LIME_ON : t.text, fontFamily: font.body.semibold }}>{id === "google" ? "Google Maps" : "Baidu"}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={{ marginHorizontal: 14, marginTop: 14 }}>
          <Pressable onPress={() => setByeOpen(true)} style={{ padding: 13, borderRadius: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: hexA(ALERT, 0.1), borderWidth: 1, borderColor: hexA(ALERT, 0.4) }}>
            <LogOut size={17} color={ALERT} />
            <Text style={{ fontSize: 14, color: ALERT, fontFamily: font.body.bold }}>{tr("profile.logout")}</Text>
          </Pressable>
        </View>

        <Text style={{ textAlign: "center", fontSize: 11, color: t.sub, marginTop: 14, fontFamily: font.body.regular }}>Kelentane GPS · v1.0</Text>
      </ScrollView>

      <LanguagePickerSheet t={t} visible={langOpen} current={language} onSelect={(l) => { setLanguage(l); setLangOpen(false); }} onClose={() => setLangOpen(false)} />

      <PasswordChangeSheet t={t} visible={pwdOpen} onClose={() => setPwdOpen(false)} />

      <PhoneEditSheet
        t={t}
        visible={phoneOpen}
        uid={session?.user?.id ?? null}
        current={me.phone}
        onSaved={(p) => setMe((m) => ({ ...m, phone: p }))}
        onClose={() => setPhoneOpen(false)}
      />

      <ShareSheet t={t} visible={shareOpen} onClose={() => setShareOpen(false)} />

      <BottomSheet t={t} visible={byeOpen} onClose={() => setByeOpen(false)}>
        <Text style={{ fontSize: 18, color: t.text, fontFamily: font.body.bold, marginBottom: 4 }}>{tr("profile.logoutQ")}</Text>
        <Text style={{ fontSize: 13, color: t.sub, marginBottom: 16, fontFamily: font.body.regular }}>{tr("profile.logoutDesc")}</Text>
        <Pressable onPress={async () => { setByeOpen(false); await signOut(); }} style={{ padding: 14, borderRadius: 14, alignItems: "center", backgroundColor: ALERT }}>
          <Text style={{ fontSize: 15, color: "#fff", fontFamily: font.body.bold }}>{tr("profile.logout")}</Text>
        </Pressable>
      </BottomSheet>
    </View>
  );
}

function PasswordChangeSheet({ t, visible, onClose }: { t: Theme; visible: boolean; onClose: () => void }) {
  const { t: tr } = useTranslation();
  const [pwd, setPwd] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const save = async () => {
    if (pwd.length < 4 || pwd !== pwd2) return setMsg(tr("profile.pwdRule"));
    const { error } = await supabase.auth.updateUser({ password: pwd });
    setMsg(error ? error.message : tr("profile.pwdUpdated"));
    if (!error) {
      setPwd("");
      setPwd2("");
    }
  };
  return (
    <BottomSheet t={t} visible={visible} onClose={onClose}>
      <Text style={{ fontSize: 18, color: t.text, fontFamily: font.body.bold, marginBottom: 12 }}>{tr("profile.changePwd")}</Text>
      <Field t={t} label={tr("profile.newPwd")} icon={KeyRound} placeholder="••••••" secure value={pwd} onChangeText={(v) => { setPwd(v); setMsg(null); }} />
      <Field t={t} label={tr("profile.confirm")} icon={KeyRound} placeholder="••••••" secure value={pwd2} onChangeText={(v) => { setPwd2(v); setMsg(null); }} />
      {msg ? <Text style={{ fontSize: 12.5, color: t.sub, marginBottom: 8, fontFamily: font.body.regular }}>{msg}</Text> : null}
      <Pressable onPress={save} style={{ padding: 14, borderRadius: 14, alignItems: "center", backgroundColor: ACCENT }}>
        <Text style={{ fontSize: 15, color: LIME_ON, fontFamily: font.body.bold }}>{tr("profile.update")}</Text>
      </Pressable>
    </BottomSheet>
  );
}

/** Édition du numéro de téléphone du compte (persisté sur `clients.phone`). */
function PhoneEditSheet({ t, visible, uid, current, onSaved, onClose }: { t: Theme; visible: boolean; uid: string | null; current: string | null; onSaved: (phone: string) => void; onClose: () => void }) {
  const { t: tr } = useTranslation();
  const [phone, setPhone] = useState(current ?? "");
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setPhone(current ?? "");
      setMsg(null);
    }
  }, [visible, current]);

  const save = async () => {
    const val = phone.trim();
    if (!uid || val.length < 6) return setMsg(tr("profile.phoneRule"));
    setSaving(true);
    const { error } = await supabase.from("clients").update({ phone: val }).eq("id", uid);
    setSaving(false);
    if (error) return setMsg(error.message);
    onSaved(val);
    onClose();
  };

  return (
    <BottomSheet t={t} visible={visible} onClose={onClose}>
      <Text style={{ fontSize: 18, color: t.text, fontFamily: font.body.bold, marginBottom: 2 }}>{tr("profile.phoneEdit")}</Text>
      <Text style={{ fontSize: 12, color: t.sub, marginBottom: 14, fontFamily: font.body.regular }}>{tr("profile.phoneEditDesc")}</Text>
      <Field t={t} label={tr("profile.phone")} icon={Phone} placeholder="77 123 45 65" keyboardType="phone-pad" value={phone} onChangeText={(v) => { setPhone(v); setMsg(null); }} />
      {msg ? <Text style={{ fontSize: 12.5, color: t.sub, marginBottom: 8, fontFamily: font.body.regular }}>{msg}</Text> : null}
      <Pressable onPress={save} disabled={saving || phone.trim().length < 6} style={{ padding: 14, borderRadius: 14, alignItems: "center", backgroundColor: phone.trim().length >= 6 ? ACCENT : hexA(t.text, 0.12) }}>
        <Text style={{ fontSize: 15, color: phone.trim().length >= 6 ? LIME_ON : t.sub, fontFamily: font.body.bold }}>{saving ? tr("profile.saving") : tr("profile.save")}</Text>
      </Pressable>
    </BottomSheet>
  );
}

/** Sélecteur de langue en LISTE (radio), pas un toggle. Langue active surlignée. */
function LanguagePickerSheet({ t, visible, current, onSelect, onClose }: { t: Theme; visible: boolean; current: Lang; onSelect: (l: Lang) => void; onClose: () => void }) {
  const { t: tr } = useTranslation();
  return (
    <BottomSheet t={t} visible={visible} onClose={onClose}>
      <Text style={{ fontSize: 18, color: t.text, fontFamily: font.body.bold, marginBottom: 12 }}>{tr("profile.language")}</Text>
      {LANGS.map((l) => {
        const on = l === current;
        const rtl = RTL_LANGS.includes(l);
        return (
          <Pressable
            key={l}
            onPress={() => onSelect(l)}
            style={{ flexDirection: rtl ? "row-reverse" : "row", alignItems: "center", gap: 12, paddingVertical: 13, paddingHorizontal: 14, borderRadius: 12, marginBottom: 8, backgroundColor: on ? hexA(ACCENT, 0.12) : t.glass, borderWidth: 1, borderColor: on ? ACCENT : t.border }}
          >
            <Text style={{ flex: 1, fontSize: 15, color: t.text, fontFamily: font.body.semibold, textAlign: rtl ? "right" : "left" }}>{LANG_LABELS[l]}</Text>
            {on ? <Check size={18} color={ACCENT} /> : null}
          </Pressable>
        );
      })}
    </BottomSheet>
  );
}

function ShareSheet({ t, visible, onClose }: { t: Theme; visible: boolean; onClose: () => void }) {
  const { t: tr } = useTranslation();
  const { vehicles } = useVehicles();
  const [token, setToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [claim, setClaim] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const gen = async (vehicleId: number) => {
    setMsg(null);
    setCopied(false);
    try {
      const r = await createShare(vehicleId);
      setToken(r.token);
    } catch (e) {
      setMsg((e as Error).message);
    }
  };
  const copy = async () => {
    if (!token) return;
    await Clipboard.setStringAsync(token);
    setCopied(true);
  };
  const doClaim = async () => {
    setMsg(null);
    try {
      await claimShare(claim);
      setMsg(tr("profile.deviceAdded"));
      setClaim("");
    } catch (e) {
      setMsg((e as Error).message);
    }
  };

  return (
    <BottomSheet t={t} visible={visible} onClose={onClose}>
      <Text style={{ fontSize: 18, color: t.text, fontFamily: font.body.bold, marginBottom: 4 }}>{tr("profile.share")}</Text>
      <Text style={{ fontSize: 12.5, color: t.sub, marginBottom: 12, fontFamily: font.body.regular }}>
        {tr("profile.shareDesc")}
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        {vehicles.map((v) => (
          <Pressable key={v.id} onPress={() => gen(v.id)} style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, backgroundColor: t.glass, borderWidth: 1, borderColor: t.border }}>
            <Text style={{ fontSize: 13, color: t.text, fontFamily: font.body.semibold }}>{v.name}</Text>
          </Pressable>
        ))}
      </View>

      {token ? (
        <Pressable onPress={copy} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderRadius: 14, padding: 14, marginBottom: 12, backgroundColor: t.glass, borderWidth: 1, borderColor: t.border }}>
          <Text style={{ fontSize: 16, letterSpacing: 2, color: t.text, fontFamily: font.mono.semibold }}>{token}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
            {copied ? <Check size={15} color={ONLINE} /> : <Copy size={15} color={ACCENT} />}
            <Text style={{ fontSize: 12, color: copied ? ONLINE : ACCENT, fontFamily: font.body.bold }}>{copied ? tr("profile.copied") : tr("profile.copy")}</Text>
          </View>
        </Pressable>
      ) : null}

      <Text style={{ fontSize: 13, color: t.sub, marginBottom: 8, fontFamily: font.body.bold }}>{tr("profile.addShared")}</Text>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Field t={t} label="" icon={Share2} placeholder="KLN-XXXXXXXX" mono value={claim} onChangeText={setClaim} />
        </View>
      </View>
      <Pressable onPress={doClaim} disabled={!claim.trim()} style={{ padding: 13, borderRadius: 14, alignItems: "center", backgroundColor: claim.trim() ? ACCENT : hexA(t.text, 0.12) }}>
        <Text style={{ fontSize: 14, color: claim.trim() ? LIME_ON : t.sub, fontFamily: font.body.bold }}>{tr("profile.add")}</Text>
      </Pressable>
      {msg ? <Text style={{ fontSize: 12.5, color: t.sub, marginTop: 10, fontFamily: font.body.regular }}>{msg}</Text> : null}
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
