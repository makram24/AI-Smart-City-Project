export interface BikeStation {
    id: string;
    name: string;
    position: [number, number];
    availableBikes: number;
    availableDocks: number;
    totalDocks: number;
    status: 'active' | 'inactive' | 'maintenance';
    lastUpdated: string;
}
export interface BikeRoute {
    distance: number;
    duration: number;
    geometry: number[][];
    instructions: string[];
}
export interface BikeAvailability {
    stationId: string;
    stationName: string;
    availableBikes: number;
    availableDocks: number;
    distance: number;
}
export declare class SharedMobilityService {
    private molBubiApiUrl;
    private userAgent;
    getAllBikeStations(): Promise<BikeStation[]>;
    getNearbyBikeStations(lat: number, lng: number, radius?: number): Promise<BikeAvailability[]>;
    getBikeRoute(from: [number, number], to: [number, number]): Promise<BikeRoute | null>;
    getStationStatus(stationId: string): Promise<BikeStation | null>;
    getBikeAvailabilitySummary(): Promise<{
        totalStations: number;
        activeStations: number;
        totalBikes: number;
        availableBikes: number;
        totalDocks: number;
        availableDocks: number;
    }>;
    private calculateDistance;
    private deg2rad;
}
export declare const sharedMobilityService: SharedMobilityService;
//# sourceMappingURL=mobility.d.ts.map