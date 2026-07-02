export type GeofenceArea =
  | { kind: "circle"; lat: number; lng: number; radius: number }
  | { kind: "polygon"; points: { lat: number; lng: number }[] };

export interface GeofenceVM {
  id: string; // custom_geofences.id (uuid)
  name: string;
  kind: "circle" | "polygon";
  color: string | null;
  enabled: boolean;
  area: GeofenceArea | null;
}

export interface CreateGeofenceBody {
  name: string;
  kind: "circle" | "polygon";
  area: GeofenceArea;
  color?: string;
}

/** Construit le WKT Traccar depuis une aire (lat lon, ordre Traccar). */
export function areaToWkt(area: GeofenceArea): string {
  if (area.kind === "circle") {
    return `CIRCLE (${area.lat} ${area.lng}, ${area.radius})`;
  }
  const pts = area.points.map((p) => `${p.lat} ${p.lng}`);
  if (pts.length && pts[0] !== pts[pts.length - 1]) pts.push(pts[0]); // fermer l'anneau
  return `POLYGON ((${pts.join(", ")}))`;
}
