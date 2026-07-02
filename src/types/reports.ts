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
    drive: string;
    idle: string;
    trips: number;
    stops: number;
    avg: number;
    max: number;
    over: number;
    days: number;
  };
}

export interface RoutePoint {
  lat: number;
  lng: number;
  speed: number;
  course: number;
  time: string;
  addr: string | null;
}
