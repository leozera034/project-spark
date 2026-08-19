export type MapsProviderName = "openrouteservice" | "google_maps" | "local_haversine";
export type MapsTravelMode = "drive" | "two_wheeler" | "bicycle" | "walk";

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface MapsHealth {
  provider: MapsProviderName;
  available: boolean;
  routesAvailable: boolean;
  geocodingAvailable: boolean;
  errorCode: string | null;
}

export interface GeocodeRequest {
  storeId: string;
  address: string;
  countryCode?: string;
}

export interface GeocodeResult {
  provider: MapsProviderName;
  latitude: number;
  longitude: number;
  precision: string | null;
  formattedAddress: string | null;
  placeId: string | null;
}

export interface RouteRequest {
  storeId: string;
  origin: GeoPoint;
  destination: GeoPoint;
  travelMode: MapsTravelMode;
  trafficAware?: boolean;
}

export interface RouteEstimate {
  provider: MapsProviderName;
  travelMode: MapsTravelMode;
  distanceMeters: number;
  durationSeconds: number;
  trafficDurationSeconds: number | null;
  approximate: boolean;
  cacheHit: boolean;
}

export interface MapsProvider {
  readonly name: MapsProviderName;
  healthCheck(): Promise<MapsHealth>;
  geocode(request: GeocodeRequest): Promise<GeocodeResult>;
  computeRoute(request: RouteRequest): Promise<RouteEstimate>;
}
