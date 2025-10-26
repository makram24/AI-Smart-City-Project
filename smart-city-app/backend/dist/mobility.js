"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sharedMobilityService = exports.SharedMobilityService = void 0;
class SharedMobilityService {
    constructor() {
        this.molBubiApiUrl = 'https://api.molbubi.hu/api/stations';
        this.userAgent = 'AI-Smart-City-App/1.0';
    }
    // Get all bike stations
    async getAllBikeStations() {
        try {
            // Mock MOL Bubi data for Budapest
            const mockStations = [
                {
                    id: 'station_001',
                    name: 'Deák Ferenc tér',
                    position: [47.4979, 19.0402],
                    availableBikes: 8,
                    availableDocks: 12,
                    totalDocks: 20,
                    status: 'active',
                    lastUpdated: new Date().toISOString()
                },
                {
                    id: 'station_002',
                    name: 'Vörösmarty tér',
                    position: [47.4969, 19.0412],
                    availableBikes: 15,
                    availableDocks: 5,
                    totalDocks: 20,
                    status: 'active',
                    lastUpdated: new Date().toISOString()
                },
                {
                    id: 'station_003',
                    name: 'Astoria',
                    position: [47.4949, 19.0592],
                    availableBikes: 3,
                    availableDocks: 17,
                    totalDocks: 20,
                    status: 'active',
                    lastUpdated: new Date().toISOString()
                },
                {
                    id: 'station_004',
                    name: 'Kálvin tér',
                    position: [47.4879, 19.0602],
                    availableBikes: 0,
                    availableDocks: 20,
                    totalDocks: 20,
                    status: 'active',
                    lastUpdated: new Date().toISOString()
                },
                {
                    id: 'station_005',
                    name: 'Széll Kálmán tér',
                    position: [47.5079, 19.0202],
                    availableBikes: 12,
                    availableDocks: 8,
                    totalDocks: 20,
                    status: 'active',
                    lastUpdated: new Date().toISOString()
                },
                {
                    id: 'station_006',
                    name: 'Margit híd',
                    position: [47.5179, 19.0402],
                    availableBikes: 6,
                    availableDocks: 14,
                    totalDocks: 20,
                    status: 'maintenance',
                    lastUpdated: new Date().toISOString()
                },
                {
                    id: 'station_007',
                    name: 'Batthyány tér',
                    position: [47.5079, 19.0302],
                    availableBikes: 18,
                    availableDocks: 2,
                    totalDocks: 20,
                    status: 'active',
                    lastUpdated: new Date().toISOString()
                },
                {
                    id: 'station_008',
                    name: 'Moszkva tér',
                    position: [47.5179, 19.0102],
                    availableBikes: 4,
                    availableDocks: 16,
                    totalDocks: 20,
                    status: 'active',
                    lastUpdated: new Date().toISOString()
                }
            ];
            return mockStations;
        }
        catch (error) {
            console.error('Error fetching bike stations:', error);
            return [];
        }
    }
    // Get nearby bike stations
    async getNearbyBikeStations(lat, lng, radius = 1000) {
        try {
            const allStations = await this.getAllBikeStations();
            const nearbyStations = allStations
                .filter(station => station.status === 'active')
                .map(station => {
                const distance = this.calculateDistance(lat, lng, station.position[0], station.position[1]);
                return {
                    stationId: station.id,
                    stationName: station.name,
                    availableBikes: station.availableBikes,
                    availableDocks: station.availableDocks,
                    distance
                };
            })
                .filter(station => station.distance <= radius)
                .sort((a, b) => a.distance - b.distance);
            return nearbyStations;
        }
        catch (error) {
            console.error('Error fetching nearby bike stations:', error);
            return [];
        }
    }
    // Get bike route between two points
    async getBikeRoute(from, to) {
        try {
            const distance = this.calculateDistance(from[0], from[1], to[0], to[1]);
            const duration = Math.round(distance / 4); // Assume 4 m/s average bike speed
            // Mock route geometry (simplified straight line)
            const geometry = [
                [from[1], from[0]], // [lng, lat]
                [to[1], to[0]]
            ];
            const instructions = [
                'Start cycling from starting point',
                'Follow bike-friendly route',
                'Arrive at destination'
            ];
            return {
                distance,
                duration,
                geometry,
                instructions
            };
        }
        catch (error) {
            console.error('Error calculating bike route:', error);
            return null;
        }
    }
    // Get bike station status
    async getStationStatus(stationId) {
        try {
            const allStations = await this.getAllBikeStations();
            return allStations.find(station => station.id === stationId) || null;
        }
        catch (error) {
            console.error('Error fetching station status:', error);
            return null;
        }
    }
    // Get bike availability summary
    async getBikeAvailabilitySummary() {
        try {
            const allStations = await this.getAllBikeStations();
            const summary = allStations.reduce((acc, station) => {
                if (station.status === 'active') {
                    acc.activeStations++;
                    acc.totalBikes += station.availableBikes;
                    acc.availableBikes += station.availableBikes;
                    acc.totalDocks += station.totalDocks;
                    acc.availableDocks += station.availableDocks;
                }
                acc.totalStations++;
                return acc;
            }, {
                totalStations: 0,
                activeStations: 0,
                totalBikes: 0,
                availableBikes: 0,
                totalDocks: 0,
                availableDocks: 0
            });
            return summary;
        }
        catch (error) {
            console.error('Error fetching bike availability summary:', error);
            return {
                totalStations: 0,
                activeStations: 0,
                totalBikes: 0,
                availableBikes: 0,
                totalDocks: 0,
                availableDocks: 0
            };
        }
    }
    calculateDistance(lat1, lng1, lat2, lng2) {
        const R = 6371;
        const dLat = this.deg2rad(lat2 - lat1);
        const dLng = this.deg2rad(lng2 - lng1);
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) *
                Math.sin(dLng / 2) * Math.sin(dLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c * 1000; // Return in meters
    }
    deg2rad(deg) {
        return deg * (Math.PI / 180);
    }
}
exports.SharedMobilityService = SharedMobilityService;
exports.sharedMobilityService = new SharedMobilityService();
//# sourceMappingURL=mobility.js.map