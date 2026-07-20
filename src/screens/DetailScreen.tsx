import { useState } from "react";
import { Linking, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  Battery,
  BatteryCharging,
  Car,
  ChevronLeft,
  ChevronRight,
  Clock,
  Cpu,
  CreditCard,
  Eye,
  Fence,
  Gauge,
  Hash,
  KeyRound,
  Lock,
  MapPin,
  Navigation,
  Phone,
  Power,
  Radio,
  RotateCcw,
  Satellite,
  Signal,
  UserRound,
  Wifi,
  WifiOff,
  Zap,
} from "lucide-react-native";
import { ACCENT, freshColor, hexA, LIME_ON, OFFLINE, ONLINE, Theme } from "../theme/tokens";
import { font } from "../theme/fonts";
import { useTranslation } from "react-i18next";
import { useTheme } from "../theme/ThemeProvider";
import { usePrefs } from "../state/prefs";
import { convKm, convSpeed, distUnit, speedUnit } from "../i18n/units";
import { useVehicles } from "../data/useVehicles";
import { sendCommand, type CommandType } from "../data/commands";
import { ApiError, changeDevicePassword, patchVehicle, type VehiclePatch } from "../data/api";
import { logError, toUserMessage } from "../data/errorMessages";
import { iconForVehicle } from "../icons/vehicleIcons";
import { relAge } from "../utils/relTime";
import { useIconOverrides } from "../state/iconOverrides";
import {
  BottomSheet,
  Cmd,
  CommandToast,
  EditableRow,
  Field,
  Glass,
  GlassButton,
  Metric,
  MiniToast,
  PasswordSheet,
  Row,
  Skeleton,
  StatusPill,
} from "../ui";
import type { Command } from "../types/models";
import type { RootStackParamList } from "../navigation/types";

function fmtDT(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function Label({ t, children }: { t: Theme; children: string }) {
  return (
    <Text style={{ fontSize: 13, color: t.sub, paddingLeft: 4, marginTop: 4, marginBottom: 8, fontFamily: font.body.bold }}>
      {children}
    </Text>
  );
}

export function DetailScreen() {
  const { t, dark } = useTheme();
  const { t: tr } = useTranslation();
  const { units } = usePrefs();
  const insets = useSafeAreaInsets();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { params } = useRoute<RouteProp<RootStackParamList, "Detail">>();
  const { vehicles, loading, refresh } = useVehicles();
  const { overrides } = useIconOverrides();
  const v = vehicles.find((x) => x.id === params.vehicleId);

  // édition locale (persistance base app = étape 5)
  const [devName, setDevName] = useState(v?.name ?? "");
  const [devSim, setDevSim] = useState(v?.sim ?? "");
  const [devPhone, setDevPhone] = useState(v?.phone ?? "");
  const [engineCut, setEngineCut] = useState(false);
  const [gpsRebooting, setGpsRebooting] = useState(false);
  const [pwdAction, setPwdAction] = useState<"cut" | "restart" | null>(null);
  const [cmd, setCmd] = useState<Command | null>(null);
  const [devPwdOpen, setDevPwdOpen] = useState(false);
  const [newDevPwd, setNewDevPwd] = useState("");
  const [devPwdMsg, setDevPwdMsg] = useState<string | null>(null);
  const [savingDevPwd, setSavingDevPwd] = useState(false);
  const [toast, setToast] = useState<string | null>(null); // §5 : échec d'une action optimiste

  if (!v) {
    // §5 : ouverture de l'écran = page entière qui charge → SKELETON. « Véhicule
    // introuvable » n'est affiché qu'une fois la flotte réellement chargée.
    const pending = loading && vehicles.length === 0;
    return (
      <View style={{ flex: 1, backgroundColor: t.bg, paddingTop: insets.top + 12, paddingHorizontal: 14, gap: 12 }}>
        <GlassButton t={t} icon={ChevronLeft} onPress={() => nav.goBack()} />
        {pending ? (
          <>
            <Skeleton t={t} height={54} radius={16} />
            <Skeleton t={t} height={120} radius={16} />
            <Skeleton t={t} height={220} radius={16} />
            <Skeleton t={t} height={96} radius={16} />
          </>
        ) : (
          <Text style={{ color: t.sub, marginTop: 20, fontFamily: font.body.regular }}>{tr("common.vehicleNotFound")}</Text>
        )}
      </View>
    );
  }

  const iconKey = overrides[v.id] ?? v.iconKey;
  const VIcon = iconForVehicle({ iconKey, type: v.type });
  const followUrl = `https://www.google.com/maps/dir/?api=1&destination=${v.lat},${v.lng}&travelmode=driving`;

  /**
   * §5 — Écriture OPTIMISTE : le champ édité est déjà affiché localement ; on
   * persiste en fond et, en cas d'échec, on RESTAURE la valeur serveur (`rollback`)
   * puis on affiche un petit toast traduit (jamais l'exception brute).
   */
  const persist = async (patch: VehiclePatch, rollback: () => void) => {
    try {
      await patchVehicle(v.id, patch);
      refresh();
    } catch (e) {
      logError("DetailScreen.persist", e);
      rollback();
      setToast(toUserMessage(e));
    }
  };

  const run = async (type: CommandType, label: string, password?: string) => {
    setCmd({ state: "pending", label });
    try {
      const r = await sendCommand(v.id, type, password);
      setCmd({ state: r.state, label });
      if (type === "engineStop" && r.state === "success") setEngineCut(true);
      if (type === "engineResume" && r.state === "success") setEngineCut(false);
    } catch (e) {
      const msg = e instanceof ApiError && e.status === 401 ? "Mot de passe incorrect" : label;
      setCmd({ state: "error", label: msg });
    }
  };

  const rebootGps = async () => {
    if (gpsRebooting) return;
    setGpsRebooting(true);
    await run("gpsReboot", "Redémarrage du GPS");
    setTimeout(() => setGpsRebooting(false), 2200);
  };

  const confirmPwd = (password: string) => {
    const action = pwdAction;
    setPwdAction(null);
    if (action === "cut") void run("engineStop", "Coupure du moteur", password);
    if (action === "restart") void run("engineResume", "Redémarrage du moteur", password);
  };

  // §4 : les actions (coupure moteur, GPS, zones, mot de passe device) exigent le
  // rôle 'action'. Un accès 'consultation' est en lecture seule.
  const canAct = v.accessRole === "action" && v.accessStatus !== "revalidate";
  const saveDevPwd = async () => {
    const pw = newDevPwd.trim();
    if (pw.length < 4) {
      setDevPwdMsg(tr("detail.devicePwdRule"));
      return;
    }
    setSavingDevPwd(true);
    setDevPwdMsg(null);
    try {
      await changeDevicePassword(v.id, pw);
      setDevPwdMsg(tr("detail.devicePwdOk"));
      setNewDevPwd("");
      setTimeout(() => setDevPwdOpen(false), 900);
    } catch (e) {
      setDevPwdMsg(toUserMessage(e));
    } finally {
      setSavingDevPwd(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 120, paddingHorizontal: 14, gap: 12 }}>
        {/* header */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <GlassButton t={t} icon={ChevronLeft} onPress={() => nav.goBack()} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 21, color: t.text, fontFamily: font.display.extrabold, letterSpacing: -0.4 }}>
              {devName || v.name}
            </Text>
            <Text style={{ fontSize: 12, color: t.sub, fontFamily: font.mono.regular }}>{v.plate ?? v.imei}</Text>
          </View>
          <StatusPill status={v.status} color={v.color} />
        </View>

        {/* §7 : Commandes en premier (métriques/infos déplacées en bas) */}
        {/* commandes */}
        <Label t={t}>{tr("detail.commands")}</Label>
        {!canAct ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 4, marginTop: -4 }}>
            <Eye size={13} color={t.sub} />
            <Text style={{ fontSize: 12, color: t.sub, fontFamily: font.body.regular }}>{tr("detail.readOnly")}</Text>
          </View>
        ) : null}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          {canAct ? (
            <>
              <View style={{ width: "48%" }}>
                <Cmd t={t} icon={Lock} label={engineCut ? tr("detail.cutDone") : tr("detail.cut")} danger active={engineCut} onPress={() => setPwdAction("cut")} />
              </View>
              <View style={{ width: "48%" }}>
                <Cmd t={t} icon={Power} label={tr("detail.restart")} primary={engineCut} onPress={() => setPwdAction("restart")} />
              </View>
            </>
          ) : null}
          <View style={{ width: "48%" }}>
            <Cmd t={t} icon={Navigation} label={tr("detail.followLive")} primary onPress={() => Linking.openURL(followUrl)} />
          </View>
          {canAct ? (
            <View style={{ width: "48%" }}>
              <Cmd t={t} icon={RotateCcw} label={gpsRebooting ? tr("detail.gpsRebooting") : tr("detail.gps")} active={gpsRebooting} onPress={rebootGps} />
            </View>
          ) : null}
          {canAct ? (
            <View style={{ width: "48%" }}>
              <Cmd t={t} icon={Fence} label={tr("detail.geofence")} onPress={() => nav.navigate("Geo", { vehicleId: v.id })} />
            </View>
          ) : null}
          <View style={{ width: "48%" }}>
            <Cmd t={t} icon={Gauge} label={tr("detail.km")} onPress={() => nav.navigate("Km", { vehicleId: v.id })} />
          </View>
          {canAct ? (
            <View style={{ width: "48%" }}>
              <Cmd t={t} icon={KeyRound} label={tr("detail.devicePwd")} onPress={() => { setNewDevPwd(""); setDevPwdMsg(null); setDevPwdOpen(true); }} />
            </View>
          ) : null}
        </View>

        {/* détails dispositif */}
        <Label t={t}>{tr("detail.deviceDetails")}</Label>
        <Glass t={t} dark={dark} style={{ padding: 4 }}>
          <EditableRow t={t} icon={Car} label={tr("detail.devName")} value={devName} onChangeText={setDevName} onEndEditing={() => persist({ name: devName }, () => setDevName(v.name ?? ""))} />
          <Pressable
            onPress={() => nav.navigate("IconPicker", { vehicleId: v.id })}
            style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: t.line }}
          >
            <Gauge size={17} color={t.sub} />
            <Text style={{ fontSize: 13, color: t.sub, fontFamily: font.body.regular }}>{tr("detail.vehIcon")}</Text>
            <View style={{ marginLeft: "auto", flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View style={{ width: 30, height: 30, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: hexA(v.color, 0.16) }}>
                <VIcon size={16} color={v.color} />
              </View>
              <ChevronRight size={16} color={t.sub} />
            </View>
          </Pressable>
          <Row t={t} icon={Hash} label={tr("detail.imei")} value={v.imei} mono />
          <Row t={t} icon={Cpu} label={tr("detail.model")} value={v.model ?? "—"} />
          <Row t={t} icon={Power} label={tr("detail.accState")} value={v.acc == null ? tr("common.na") : v.acc ? tr("common.ignOn") : tr("common.ignOff")} valueColor={v.acc ? ONLINE : OFFLINE} />
          <Row t={t} icon={Hash} label={tr("detail.plate")} value={v.plate ?? "—"} mono />
          <Row t={t} icon={v.charge === true ? BatteryCharging : Battery} label={tr("detail.intBattery")} value={v.battery != null ? `${v.battery}%` : tr("detail.batteryNA")} valueColor={v.charge === true ? ONLINE : undefined} />
          <Row t={t} icon={Zap} label={tr("detail.vehVoltage")} value={v.voltage != null ? `${v.voltage} V` : "—"} />
          <Row t={t} icon={Radio} label={tr("detail.gsm")} value={v.gsm != null ? `${v.gsm}/5` : "—"} />
          <Row t={t} icon={Satellite} label={tr("detail.sats")} value={v.sats != null ? `${v.sats}` : "—"} />
          <Row t={t} icon={Gauge} label={tr("detail.odo")} value={v.odo != null ? `${convKm(v.odo, units).toLocaleString("fr-FR")} ${distUnit(units, tr)}` : "—"} mono />
          <EditableRow t={t} icon={CreditCard} label={tr("detail.sim")} value={devSim} onChangeText={setDevSim} onEndEditing={() => persist({ sim: devSim }, () => setDevSim(v.sim ?? ""))} />
          <EditableRow t={t} icon={Phone} label={tr("detail.simNumber")} value={devPhone} onChangeText={setDevPhone} onEndEditing={() => persist({ phone: devPhone }, () => setDevPhone(v.phone ?? ""))} mono />
          <Row t={t} icon={Hash} label={tr("detail.iccid")} value={v.iccid ?? "—"} mono />
          <Row t={t} icon={UserRound} label={tr("detail.ownerContact")} value={v.owner ?? "—"} last />
        </Glass>

        {/* §7 : métriques + position/état déplacés en DERNIER (désormais visibles par
            défaut sur le popup de la carte d'accueil). Batterie toujours affichée. */}
        <Label t={t}>{tr("detail.liveState")}</Label>
        <Glass t={t} dark={dark} style={{ padding: 12, flexDirection: "row", gap: 8 }}>
          <Metric t={t} label={tr("common.speed")} value={`${convSpeed(v.speed, units)}`} unit={speedUnit(units, tr)} />
          <Metric t={t} label={tr("common.battery")} value={v.battery != null ? `${v.battery}` : tr("common.na")} unit={v.battery != null ? "%" : undefined} />
          <Metric t={t} label={tr("common.tension")} value={v.voltage != null ? `${v.voltage}` : "—"} unit="V" />
        </Glass>
        <Glass t={t} dark={dark} style={{ padding: 4 }}>
          <Row t={t} icon={MapPin} label={tr("detail.address")} value={v.addr ?? "—"} />
          <Row t={t} icon={Signal} label={tr("detail.positioning")} value={v.signal} />
          <Row t={t} icon={Power} label={tr("detail.acc")} value={v.acc == null ? tr("common.na") : v.acc ? tr("common.ignOn") : tr("common.ignOff")} valueColor={v.acc ? ONLINE : OFFLINE} />
          <Row t={t} icon={Clock} label={tr("detail.lastPos")} value={fmtDT(v.lastSeen)} mono />
          <Row t={t} icon={v.status === "offline" ? WifiOff : Wifi} label={tr("detail.update")} value={relAge(v.lastSeen)} valueColor={v.lastSeen ? freshColor(new Date(v.lastSeen)) : OFFLINE} />
          {/* §1 : la télémétrie (batterie/charge/contact/tension) arrive sur les paquets
              de STATUT, plus rares que les positions → on date la dernière vraie MAJ. */}
          <Row t={t} icon={Battery} label={tr("detail.telemetryAge")} value={relAge(v.telemetryAt)} last />
        </Glass>
      </ScrollView>

      <PasswordSheet
        t={t}
        visible={pwdAction !== null}
        title={pwdAction === "cut" ? tr("detail.cutTitle") : tr("detail.restartTitle")}
        danger={pwdAction === "cut"}
        note={pwdAction === "cut" ? tr("detail.cutNote") : null}
        confirmLabel={pwdAction === "cut" ? tr("detail.cutTitle") : tr("detail.restartTitle")}
        onConfirm={confirmPwd}
        onClose={() => setPwdAction(null)}
      />

      <BottomSheet t={t} visible={devPwdOpen} onClose={() => setDevPwdOpen(false)}>
        <Text style={{ fontSize: 18, color: t.text, fontFamily: font.body.bold, marginBottom: 2 }}>{tr("detail.devicePwdTitle")}</Text>
        <Text style={{ fontSize: 12, color: t.sub, marginBottom: 14, fontFamily: font.body.regular }}>{tr("detail.devicePwdDesc")}</Text>
        <Field t={t} label={tr("detail.newDevicePwd")} icon={KeyRound} placeholder="••••••" secure value={newDevPwd} onChangeText={(v2) => { setNewDevPwd(v2); setDevPwdMsg(null); }} />
        {devPwdMsg ? <Text style={{ fontSize: 12.5, color: t.sub, marginBottom: 8, fontFamily: font.body.regular }}>{devPwdMsg}</Text> : null}
        <Pressable onPress={saveDevPwd} disabled={savingDevPwd || newDevPwd.trim().length < 4} style={{ padding: 14, borderRadius: 14, alignItems: "center", backgroundColor: newDevPwd.trim().length >= 4 ? ACCENT : hexA(t.text, 0.12) }}>
          <Text style={{ fontSize: 15, color: newDevPwd.trim().length >= 4 ? LIME_ON : t.sub, fontFamily: font.body.bold }}>{savingDevPwd ? tr("detail.devicePwdSaving") : tr("detail.devicePwdSave")}</Text>
        </Pressable>
      </BottomSheet>

      {cmd ? <CommandToast t={t} cmd={cmd} onClose={() => setCmd(null)} /> : null}
      {toast ? <MiniToast t={t} message={toast} onClose={() => setToast(null)} /> : null}
    </View>
  );
}
