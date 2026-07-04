#!/usr/bin/env node
/**
 * Seed / reset du TENANT DÉMO (supervision). Idempotent.
 *
 * Crée un compte démo isolé + 3 véhicules fictifs (aucune donnée client réelle).
 * Ne touche à AUCUN autre tenant. Utilise le service_role (lu depuis api/.env),
 * jamais affiché.
 *
 * Usage :
 *   node infra/supabase/seed_demo.js          # crée / met à jour
 *   node infra/supabase/seed_demo.js --reset  # supprime puis recrée
 *
 * Identifiants démo (à communiquer au superviseur) :
 *   identifiant : demo   (email interne demo@kelentane.com)
 *   mot de passe: KelentaneDemo1
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
const ENV = path.join(ROOT, "api", ".env");
const env = {};
for (const line of fs.readFileSync(ENV, "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
const { createClient } = require(path.join(ROOT, "api", "node_modules", "@supabase/supabase-js"));
const supa = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const EMAIL = "demo@kelentane.com";
const PASSWORD = "KelentaneDemo1";
const USERNAME = "demo";
const DEVICES = [
  { imei: "868000000000101", name: "Démo · Peugeot Expert", plate: "DK-0001-DEMO", type: "van", icon_key: "van" },
  { imei: "868000000000102", name: "Démo · Master tine", plate: "DK-0002-DEMO", type: "truck", icon_key: "truck" },
  { imei: "868000000000103", name: "Démo · Taxi Ndiaye", plate: "DK-0003-DEMO", type: "taxi", icon_key: "taxi" },
];

async function findUser() {
  const { data } = await supa.auth.admin.listUsers({ page: 1, perPage: 200 });
  return data.users.find((u) => u.email === EMAIL) || null;
}

async function main() {
  const reset = process.argv.includes("--reset");
  let user = await findUser();

  if (reset && user) {
    await supa.from("devices").delete().eq("owner_id", user.id);
    await supa.from("clients").delete().eq("id", user.id);
    await supa.auth.admin.deleteUser(user.id);
    user = null;
    console.log("démo supprimée (--reset)");
  }

  if (!user) {
    const { data, error } = await supa.auth.admin.createUser({ email: EMAIL, password: PASSWORD, email_confirm: true });
    if (error) throw new Error("createUser: " + error.message);
    user = data.user;
    console.log("user démo créé:", user.id.slice(0, 8) + "…");
  } else {
    await supa.auth.admin.updateUserById(user.id, { password: PASSWORD });
    console.log("user démo existant, mot de passe réinitialisé");
  }

  await supa.from("clients").upsert({ id: user.id, name: "Démo Supervision", phone: "+221 70 000 00 00", username: USERNAME });

  for (const d of DEVICES) {
    await supa.from("devices").upsert({ owner_id: user.id, imei: d.imei, name: d.name, plate: d.plate, type: d.type, icon_key: d.icon_key }, { onConflict: "imei" });
  }

  const { data: check } = await supa.from("devices").select("imei,name").eq("owner_id", user.id);
  console.log("véhicules démo:", JSON.stringify(check));
  console.log("OK — identifiant: demo / mot de passe: KelentaneDemo1");
}

main().catch((e) => {
  console.error("ÉCHEC:", e.message);
  process.exit(1);
});
