import { useState } from "react";
import { ScrollView, StatusBar as RNStatusBar, Text, TouchableOpacity, View } from "react-native";
import {
  Car,
  CreditCard,
  Crosshair,
  Fence,
  Gauge,
  Hash,
  Info,
  KeyRound,
  Layers,
  Lock,
  MapPin,
  Navigation,
  Phone,
  Power,
  RotateCcw,
  Route,
  Search,
} from "lucide-react-native";
import { ACCENT, Theme } from "../theme/tokens";
import { font } from "../theme/fonts";
import {
  ActionBtn,
  Cmd,
  CommandToast,
  EditableRow,
  Field,
  Glass,
  GlassButton,
  KMonogram,
  Metric,
  Row,
  SectionLabel,
  StatusDot,
  StatusPill,
  TabBar,
  Toggle,
} from "../ui";
import type { Command, TabId } from "../types/models";

/**
 * Galerie /ui (Étape 1) — rend chaque primitive dans les 2 thèmes.
 * Écran de dev, retiré à l'étape 3 (vrai chrome + navigation).
 */
export function Gallery({ t, dark, toggleDark }: { t: Theme; dark: boolean; toggleDark: () => void }) {
  const [tab, setTab] = useState<TabId>("map");
  const [notif, setNotif] = useState(true);
  const [devName, setDevName] = useState("Peugeot Expert");
  const [pwd, setPwd] = useState("");
  const [cmd, setCmd] = useState<Command | null>(null);

  const H = ({ children }: { children: string }) => (
    <Text
      style={{ color: t.sub, fontSize: 12, fontFamily: font.body.bold, marginTop: 20, marginBottom: 8 }}
    >
      {children}
    </Text>
  );

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: (RNStatusBar.currentHeight ?? 44) + 12,
          paddingHorizontal: 16,
          paddingBottom: 110,
        }}
      >
        {/* header marque + toggle thème */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <KMonogram />
          <View style={{ flex: 1 }}>
            <Text style={{ color: t.text, fontSize: 22, fontFamily: font.display.extrabold }}>
              Galerie /ui
            </Text>
            <Text style={{ color: t.sub, fontSize: 12, fontFamily: font.body.regular }}>
              Étape 1 · primitives
            </Text>
          </View>
          <TouchableOpacity
            onPress={toggleDark}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: t.border,
              backgroundColor: t.glass,
            }}
          >
            <Text style={{ color: t.text, fontSize: 12, fontFamily: font.body.semibold }}>
              {dark ? "Sombre" : "Clair"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Statuts */}
        <H>StatusPill / StatusDot</H>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          <StatusPill status="moving" />
          <StatusPill status="online" />
          <StatusPill status="parked" />
          <StatusPill status="offline" />
          <StatusDot status="online" />
          <StatusDot status="parked" />
          <StatusDot status="offline" />
        </View>

        {/* Metric */}
        <H>Metric</H>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Metric t={t} label="Vitesse" value="47" unit="km/h" />
          <Metric t={t} label="Batterie" value="80" unit="%" />
          <Metric t={t} label="Connexion" value="En ligne" valueColor={ACCENT} small />
        </View>

        {/* Glass + Row */}
        <H>Glass + Row</H>
        <Glass t={t} dark={dark} style={{ padding: 4 }}>
          <Row t={t} icon={MapPin} label="Adresse" value="Av. Blaise Diagne, Dakar" />
          <Row t={t} icon={Hash} label="IMEI" value="356 789 123 456 781" mono />
          <Row t={t} icon={Power} label="Contact (ACC)" value="Marche" valueColor={ACCENT} last />
        </Glass>

        {/* EditableRow + Field */}
        <H>EditableRow + Field</H>
        <Glass t={t} dark={dark} style={{ padding: 4, marginBottom: 12 }}>
          <EditableRow t={t} icon={Car} label="Nom" value={devName} onChangeText={setDevName} />
          <EditableRow
            t={t}
            icon={CreditCard}
            label="Carte SIM"
            value="Orange SN"
            onChangeText={() => {}}
            last
          />
        </Glass>
        <Field t={t} label="Mot de passe" icon={KeyRound} placeholder="••••••" secure value={pwd} onChangeText={setPwd} />
        <Field t={t} label="Numéro SIM" icon={Phone} placeholder="+221 …" mono keyboardType="phone-pad" />

        {/* Cmd grid */}
        <H>Cmd (grille commandes)</H>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          <View style={{ width: "48%" }}>
            <Cmd t={t} icon={Lock} label="Couper moteur" danger onPress={() => {}} />
          </View>
          <View style={{ width: "48%" }}>
            <Cmd t={t} icon={Power} label="Redémarrer moteur" onPress={() => {}} />
          </View>
          <View style={{ width: "48%" }}>
            <Cmd t={t} icon={Navigation} label="Suivi en direct" primary onPress={() => {}} />
          </View>
          <View style={{ width: "48%" }}>
            <Cmd t={t} icon={RotateCcw} label="Redémarrer GPS" active onPress={() => {}} />
          </View>
        </View>

        {/* ActionBtn */}
        <H>ActionBtn</H>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <ActionBtn t={t} icon={Navigation} label="Suivi" primary />
          <ActionBtn t={t} icon={Route} label="Trajectoire" />
          <ActionBtn t={t} icon={Info} label="Plus" />
        </View>

        {/* Toggle */}
        <H>Toggle</H>
        <View style={{ flexDirection: "row", gap: 20, alignItems: "center" }}>
          <Toggle t={t} label="Notifications" on={notif} set={setNotif} />
          <Toggle t={t} on={notif} set={setNotif} large />
        </View>

        {/* GlassButton */}
        <H>GlassButton (icon / ctrl)</H>
        <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
          <GlassButton t={t} icon={Search} />
          <GlassButton t={t} icon={Layers} size={38} />
          <GlassButton t={t} icon={Crosshair} size={38} color={ACCENT} />
        </View>

        {/* SectionLabel */}
        <H>SectionLabel</H>
        <View style={{ marginLeft: -16 }}>
          <SectionLabel t={t}>Paramètres</SectionLabel>
        </View>

        {/* CommandToast trigger */}
        <H>CommandToast</H>
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          {(["pending", "success", "offline", "error"] as const).map((s) => (
            <TouchableOpacity
              key={s}
              onPress={() => setCmd({ state: s, label: "Coupure du moteur" })}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 12,
                backgroundColor: t.glass,
                borderWidth: 1,
                borderColor: t.border,
              }}
            >
              <Text style={{ color: t.text, fontSize: 12, fontFamily: font.body.semibold }}>{s}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {cmd ? <CommandToast t={t} cmd={cmd} onClose={() => setCmd(null)} /> : null}
      <TabBar t={t} dark={dark} active={tab} onSelect={setTab} />
    </View>
  );
}
