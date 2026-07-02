#!/usr/bin/env node
/**
 * Simulateur GT06 minimal — pousse des positions Dakar réalistes vers Traccar
 * (protocole GT06, comme un boîtier GT06N). Sans dépendance.
 *
 * Pré-requis : le device doit exister dans Traccar avec uniqueId = IMEI ci-dessous
 * (Traccar ignore les boîtiers inconnus). Créer le device dans l'UI (http://localhost:8082)
 * ou via l'API avant de lancer.
 *
 * Usage :
 *   node infra/gt06-sim/gt06-sim.js [imei] [host] [port]
 *   node infra/gt06-sim/gt06-sim.js 356789123456781 127.0.0.1 5023
 */
const net = require("net");

const IMEI = process.argv[2] || "356789123456781";
const HOST = process.argv[3] || "127.0.0.1";
const PORT = Number(process.argv[4] || 5023);

// CRC-ITU / X25 (init 0xFFFF, poly réfléchi 0x8408, xorout 0xFFFF)
function crc16(buf) {
  let fcs = 0xffff;
  for (const b of buf) {
    fcs ^= b;
    for (let i = 0; i < 8; i++) fcs = fcs & 1 ? (fcs >> 1) ^ 0x8408 : fcs >> 1;
  }
  return (~fcs) & 0xffff;
}

// Encadre un paquet GT06 : 7878 | len | proto+contenu+serial | crc | 0D0A
function frame(proto, content, serial) {
  const body = Buffer.concat([
    Buffer.from([proto]),
    content,
    Buffer.from([(serial >> 8) & 0xff, serial & 0xff]),
  ]);
  const len = body.length + 2; // + CRC
  const forCrc = Buffer.concat([Buffer.from([len]), body]);
  const crc = crc16(forCrc);
  return Buffer.concat([
    Buffer.from([0x78, 0x78, len]),
    body,
    Buffer.from([(crc >> 8) & 0xff, crc & 0xff]),
    Buffer.from([0x0d, 0x0a]),
  ]);
}

function imeiToBcd(imei) {
  const padded = imei.padStart(16, "0"); // 15 chiffres → 8 octets BCD
  const out = Buffer.alloc(8);
  for (let i = 0; i < 8; i++) out[i] = parseInt(padded.substr(i * 2, 2), 16);
  return out;
}

function loginPacket(serial) {
  return frame(0x01, imeiToBcd(IMEI), serial);
}

function locationPacket(serial, lat, lon, speed, course) {
  const now = new Date();
  const dt = Buffer.from([
    now.getUTCFullYear() % 100,
    now.getUTCMonth() + 1,
    now.getUTCDate(),
    now.getUTCHours(),
    now.getUTCMinutes(),
    now.getUTCSeconds(),
  ]);
  const sats = Buffer.from([0xc7]); // longueur info GPS + 7 satellites
  const latRaw = Math.round(Math.abs(lat) * 1800000);
  const lonRaw = Math.round(Math.abs(lon) * 1800000);
  const ll = Buffer.alloc(8);
  ll.writeUInt32BE(latRaw, 0);
  ll.writeUInt32BE(lonRaw, 4);
  // course/status : bit10=Nord, bit11=Ouest, bit12=positionné, bits0-9=cap
  const flags = 0x0400 | 0x0800 | 0x1000 | (course & 0x03ff);
  const cs = Buffer.from([(flags >> 8) & 0xff, flags & 0xff]);
  const content = Buffer.concat([dt, sats, ll, Buffer.from([speed & 0xff]), cs]);
  return frame(0x12, content, serial);
}

let serial = 1;
let lat = 14.6928;
let lon = -17.4467;

const sock = net.createConnection(PORT, HOST, () => {
  console.log(`Connecté à Traccar ${HOST}:${PORT} — IMEI ${IMEI}`);
  sock.write(loginPacket(serial++));
  setInterval(() => {
    // dérive légère + vitesse variable pour un flux "vivant"
    lat += (Math.random() - 0.5) * 0.001;
    lon += (Math.random() - 0.5) * 0.001;
    const speed = Math.floor(20 + Math.random() * 40);
    const course = Math.floor(Math.random() * 360);
    const pkt = locationPacket(serial++, lat, lon, speed, course);
    sock.write(pkt);
    console.log(`→ position ${lat.toFixed(5)}, ${lon.toFixed(5)} · ${speed} km/h`);
  }, 5000);
});

sock.on("data", (d) => console.log("← Traccar:", d.toString("hex")));
sock.on("error", (e) => console.error("Erreur socket:", e.message));
sock.on("close", () => console.log("Connexion fermée"));
