import { useState } from "react";
import { Linking, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  Battery,
  Car,
  ChevronLeft,
  ChevronRight,
  Clock,
  Cpu,
  CreditCard,
  Fence,
  Gauge,
  Hash,
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
import { freshColor, hexA, OFFLINE, ONLINE, Theme } from "../theme/tokens";
import { font } from "../theme/fonts";
import { useTranslation } from "react-i18next";
import { useTheme } from "../theme/ThemeProvider";
import { usePrefs } from "../state/prefs";
import { convKm, convSpeed, distUnit, speedUnit } from "../i18n/units";
import { useVehicles } from "../data/useVehicles";
import { sendCommand, type CommandType } from "../data/commands";
import { ApiError, patchVehicle, type VehiclePatch } from "../data/api";
import { iconForVehicle } from "../icons/vehicleIcons";
import { useIconOverrides } from "../state/iconOverrides";
import {
  Cmd,
  CommandToast,
  EditableRow,
  Glass,
  GlassButton,
  Metric,
  PasswordSheet,
  Row,
  StatusPill,
} from "../ui";
import type { Command } from "../types/models";
import type { RootStackParamList } from "../navigation/types";
import type { VehicleVM } from "../types/vehicle";

function relAgo(iso: string | null): string {
  if (!iso) return "—";
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h} h`;
  return `il y a ${Math.floor(h / 24)} j`;
}
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
  const { vehicles, refresh } = useVehicles();
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

  if (!v) {
    return (
      <View style={{ flex: 1, backgroundColor: t.bg, paddingTop: insets.top + 12, paddingHorizontal: 14 }}>
        <GlassButton t={t} icon={ChevronLeft} onPress={() => nav.goBack()} />
        <Text style={{ color: t.sub, marginTop: 20, fontFamily: font.body.regular }}>Véhicule introuvable.</Text>
      </View>
    );
  }

  const iconKey = overrides[v.id] ?? v.iconKey;
  const VIcon = iconForVehicle({ iconKey, type: v.type });
  const followUrl = `https://www.google.com/maps/dir/?api=1&destination=${v.lat},${v.lng}&travelmode=driving`;

  // Persistance base app (PATCH). Échec silencieux : l'édition locale reste affichée.
  const persist = async (patch: VehiclePatch) => {
    try {
      await patchVehicle(v.id, patch);
      refresh();
    } catch {
      /* réseau/API indispo — champs locaux conservés */
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

        {/* metrics */}
        <Glass t={t} dark={dark} style={{ padding: 12, flexDirection: "row", gap: 8 }}>
          <Metric t={t} label={tr("common.speed")} value={`${convSpeed(v.speed, units)}`} unit={speedUnit(units, tr)} />
          <Metric t={t} label={tr("common.battery")} value={v.battery != null ? `${v.battery}` : "—"} unit="%" />
          <Metric t={t} label={tr("common.tension")} value={v.voltage != null ? `${v.voltage}` : "—"} unit="V" />
        </Glass>

        {/* info rows */}
        <Glass t={t} dark={dark} style={{ padding: 4 }}>
          <Row t={t} icon={MapPin} label="Adresse" value={v.addr ?? "—"} />
          <Row t={t} icon={Signal} label="Positionnement" value={v.signal} />
          <Row t={t} icon={Power} label="Contact (ACC)" value={v.acc == null ? "—" : v.acc ? "Marche" : "Arrêt"} valueColor={v.acc ? ONLINE : OFFLINE} />
          <Row t={t} icon={Clock} label="Dernière position" value={fmtDT(v.lastSeen)} mono />
          <Row t={t} icon={v.status === "offline" ? WifiOff : Wifi} label="Mise à jour" value={relAgo(v.lastSeen)} valueColor={v.lastSeen ? freshColor(new Date(v.lastSeen)) : OFFLINE} last />
        </Glass>

        {/* commandes */}
        <Label t={t}>Commandes</Label>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          <View style={{ width: "48%" }}>
            <Cmd t={t} icon={Lock} label={engineCut ? "Moteur coupé" : "Couper moteur"} danger active={engineCut} onPress={() => setPwdAction("cut")} />
          </View>
          <View style={{ width: "48%" }}>
            <Cmd t={t} icon={Power} label="Redémarrer moteur" primary={engineCut} onPress={() => setPwdAction("restart")} />
          </View>
          <View style={{ width: "48%" }}>
            <Cmd t={t} icon={Navigation} label="Suivi en direct" primary onPress={() => Linking.openURL(followUrl)} />
          </View>
          <View style={{ width: "48%" }}>
            <Cmd t={t} icon={RotateCcw} label={gpsRebooting ? "Redémarrage…" : "Redémarrer GPS"} active={gpsRebooting} onPress={rebootGps} />
          </View>
          <View style={{ width: "48%" }}>
            <Cmd t={t} icon={Fence} label="Géofence" onPress={() => nav.navigate("Geo", { vehicleId: v.id })} />
          </View>
          <View style={{ width: "48%" }}>
            <Cmd t={t} icon={Gauge} label="Kilométrage" onPress={() => nav.navigate("Km", { vehicleId: v.id })} />
          </View>
        </View>

        {/* détails dispositif */}
        <Label t={t}>Détails du dispositif</Label>
        <Glass t={t} dark={dark} style={{ padding: 4 }}>
          <EditableRow t={t} icon={Car} label="Nom du dispositif" value={devName} onChangeText={setDevName} onEndEditing={() => persist({ name: devName })} />
          <Pressable
            onPress={() => nav.navigate("IconPicker", { vehicleId: v.id })}
            style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: t.line }}
          >
            <Gauge size={17} color={t.sub} />
            <Text style={{ fontSize: 13, color: t.sub, fontFamily: font.body.regular }}>Icône du véhicule</Text>
            <View style={{ marginLeft: "auto", flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View style={{ width: 30, height: 30, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: hexA(v.color, 0.16) }}>
                <VIcon size={16} color={v.color} />
              </View>
              <ChevronRight size={16} color={t.sub} />
            </View>
          </Pressable>
          <Row t={t} icon={Hash} label="IMEI" value={v.imei} mono />
          <Row t={t} icon={Cpu} label="Modèle" value={v.model ?? "—"} />
          <Row t={t} icon={Power} label="État ACC" value={v.acc == null ? "—" : v.acc ? "Marche" : "Arrêt"} valueColor={v.acc ? ONLINE : OFFLINE} />
          <Row t={t} icon={Hash} label="Immatriculation" value={v.plate ?? "—"} mono />
          <Row t={t} icon={Battery} label="Batterie interne" value={v.battery != null ? `${v.battery}%` : "—"} />
          <Row t={t} icon={Zap} label="Tension véhicule" value={v.voltage != null ? `${v.voltage} V` : "—"} />
          <Row t={t} icon={Radio} label="Signal GSM" value={v.gsm != null ? `${v.gsm}/5` : "—"} />
          <Row t={t} icon={Satellite} label="Satellites GPS" value={v.sats != null ? `${v.sats}` : "—"} />
          <Row t={t} icon={Gauge} label="Odomètre" value={v.odo != null ? `${convKm(v.odo, units).toLocaleString("fr-FR")} ${distUnit(units, tr)}` : "—"} mono />
          <EditableRow t={t} icon={CreditCard} label="Carte SIM" value={devSim} onChangeText={setDevSim} onEndEditing={() => persist({ sim: devSim })} />
          <EditableRow t={t} icon={Phone} label="Numéro de la SIM" value={devPhone} onChangeText={setDevPhone} onEndEditing={() => persist({ phone: devPhone })} mono />
          <Row t={t} icon={Hash} label="ICCID" value={v.iccid ?? "—"} mono />
          <Row t={t} icon={UserRound} label="Contact utilisateur" value={v.owner ?? "—"} last />
        </Glass>

        <Text style={{ fontSize: 11, color: t.sub, textAlign: "center", fontFamily: font.body.regular }}>
          Édition persistée (base app) — étape 5
        </Text>
      </ScrollView>

      <PasswordSheet
        t={t}
        visible={pwdAction !== null}
        title={pwdAction === "cut" ? "Couper le moteur" : "Redémarrer le moteur"}
        danger={pwdAction === "cut"}
        note={pwdAction === "cut" ? "Assurez-vous que le véhicule ralentit ou est à l'arrêt avant de couper le moteur." : null}
        confirmLabel={pwdAction === "cut" ? "Couper le moteur" : "Redémarrer le moteur"}
        onConfirm={confirmPwd}
        onClose={() => setPwdAction(null)}
      />

      {cmd ? <CommandToast t={t} cmd={cmd} onClose={() => setCmd(null)} /> : null}
    </View>
  );
}
