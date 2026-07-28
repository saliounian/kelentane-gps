export interface DayKm {
  date: string; // YYYY-MM-DD
  km: number;
}

export interface KmReport {
  range: { from: string; to: string };
  days: DayKm[];
  total: number;
  avgPerDay: number;
  byVehicle: { id: number; name: string; total: number }[];
}

export interface StatsReport {
  days: DayKm[];
  total: number;
  avgPerDay: number;
  maxDay: number;
  activity: {
    drive: string; // "9 h 12"
    idle: string;
    trips: number;
    stops: number;
    avg: number; // vitesse moyenne km/h
    max: number; // vitesse max km/h
    over: number; // excès de vitesse (événements)
    days: number; // jours actifs
  };
}

export interface RoutePoint {
  lat: number;
  lng: number;
  speed: number; // km/h
  course: number;
  time: string; // ISO
  addr: string | null;
}

/** Arrêt (stationnement) — proxy du rapport ReportStops natif de Traccar. */
export interface StopPoint {
  latitude: number;
  longitude: number;
  address: string | null;
  startTime: string; // arrivée (début de l'arrêt), ISO
  endTime: string | null; // départ (fin de l'arrêt / reprise), ISO
  duration: number; // durée de l'arrêt en ms
}
