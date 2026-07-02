export type GeofenceArea =
  | { kind: "circle"; lat: number; lng: number; radius: number }
  | { kind: "polygon"; points: { lat: number; lng: number }[] };

export interface GeofenceVM {
  id: string;
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
