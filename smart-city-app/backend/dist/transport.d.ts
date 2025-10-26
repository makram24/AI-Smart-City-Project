export interface TransportStop {
    id: string;
    name: string;
    position: [number, number];
    type: 'bus' | 'tram' | 'metro' | 'trolley';
    routes: string[];
}
export interface TransportRoute {
    id: string;
    name: string;
    type: 'bus' | 'tram' | 'metro' | 'trolley';
    stops: TransportStop[];
    color?: string;
}
export interface ArrivalInfo {
    route: string;
    destination: string;
    arrivalTime: string;
    delay?: number;
    vehicleType: string;
}
export interface TransportRoutePlan {
    from: string;
    to: string;
    duration: number;
    transfers: number;
    steps: Array<{
        type: 'walk' | 'bus' | 'tram' | 'metro';
        route?: string;
        from: string;
        to: string;
        duration: number;
        distance?: number;
    }>;
}
export declare class PublicTransportService {
    private bkkApiUrl;
    private userAgent;
    getNearbyStops(lat: number, lng: number, radius?: number): Promise<TransportStop[]>;
    getStopArrivals(stopId: string): Promise<ArrivalInfo[]>;
    planJourney(from: [number, number], to: [number, number]): Promise<TransportRoutePlan | null>;
    getDisruptions(): Promise<Array<{
        id: string;
        title: string;
        description: string;
        severity: 'low' | 'medium' | 'high';
        affectedRoutes: string[];
        startTime: string;
        endTime?: string;
    }>>;
    getRoutesByType(type: 'bus' | 'tram' | 'metro' | 'trolley'): Promise<TransportRoute[]>;
    private calculateDistance;
    private deg2rad;
}
export declare const publicTransportService: PublicTransportService;
//# sourceMappingURL=transport.d.ts.map