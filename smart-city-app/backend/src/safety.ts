import constructionZonesSeed from './data/construction-zones.json';

interface ConstructionZone {
  id: string;
  position: [number, number];
  radius: number;
  description: string;
  startDate: string;
  endDate?: string;
}

interface ConstructionZoneSeed {
  id: string;
  position: [number, number];
  radius: number;
  description: string;
  startOffsetDays: number;
  endOffsetDays?: number;
}

export interface SafetySegment {
  id: string;
  start: [number, number]; // [lat, lng]
  end: [number, number]; // [lat, lng]
  safetyLevel: 'safe' | 'moderate' | 'caution' | 'unsafe';
  factors: {
    lighting: 'well-lit' | 'moderate' | 'poor';
    construction?: boolean;
    accessibility?: 'accessible' | 'limited' | 'not-accessible';
    crimeRisk?: 'low' | 'medium' | 'high';
    pedestrianFriendly?: boolean;
  };
  description?: string;
  lastUpdated: string;
}

export interface RouteSafetyAnalysis {
  routeId: string;
  segments: SafetySegment[];
  overallSafety: 'safe' | 'moderate' | 'caution' | 'unsafe';
  safetyScore: number; // 0-100
  warnings: string[];
  recommendations: string[];
}

export class SafetyService {
  private safetyData: Map<string, SafetySegment[]> = new Map();
  private constructionZones: ConstructionZone[] = [];

  constructor() {
    this.initializeSafetyData();
    this.initializeConstructionZones();
  }

  // Analyze safety for a route
  analyzeRouteSafety(routePolyline: number[][]): RouteSafetyAnalysis {
    const segments: SafetySegment[] = [];
    const warnings: string[] = [];
    const recommendations: string[] = [];

    // Analyze each segment of the route
    for (let i = 0; i < routePolyline.length - 1; i++) {
      const start = routePolyline[i] as [number, number];
      const end = routePolyline[i + 1] as [number, number];
      
      const segment = this.analyzeSegment(start, end);
      if (segment) {
        segments.push(segment);
        
        // Collect warnings
        if (segment.safetyLevel === 'unsafe' || segment.safetyLevel === 'caution') {
          if (segment.factors.construction) {
            warnings.push('Construction zone ahead');
          }
          if (segment.factors.lighting === 'poor') {
            warnings.push('Poorly lit area');
          }
          if (segment.factors.accessibility === 'not-accessible') {
            warnings.push('Not wheelchair accessible');
          }
          if (segment.factors.crimeRisk === 'high') {
            warnings.push('Higher crime risk area');
          }
        }
      }
    }

    // Calculate overall safety
    const safetyScore = this.calculateSafetyScore(segments);
    const overallSafety = this.determineOverallSafety(safetyScore);

    // Generate recommendations
    if (safetyScore < 50) {
      recommendations.push('Consider using well-lit main streets');
      recommendations.push('Travel during daylight hours if possible');
    } else if (safetyScore < 70) {
      recommendations.push('Stay alert and aware of surroundings');
    }

    // Check for construction zones
    const hasConstruction = segments.some(s => s.factors.construction);
    if (hasConstruction) {
      recommendations.push('Allow extra time for construction delays');
    }

    return {
      routeId: `route_${Date.now()}`,
      segments,
      overallSafety,
      safetyScore,
      warnings: [...new Set(warnings)], // Remove duplicates
      recommendations: [...new Set(recommendations)]
    };
  }

  // Analyze a single segment
  private analyzeSegment(start: [number, number], end: [number, number]): SafetySegment | null {
    // Check if segment is in a known construction zone
    const midPoint: [number, number] = [
      (start[0] + end[0]) / 2,
      (start[1] + end[1]) / 2
    ];

    const inConstructionZone = this.constructionZones.some(zone => {
      const distance = this.calculateDistance(midPoint, zone.position);
      return distance <= zone.radius;
    });

    // Determine lighting based on time and location
    const hour = new Date().getHours();
    const isDaylight = hour >= 7 && hour < 19;
    let lighting: 'well-lit' | 'moderate' | 'poor' = 'moderate';
    
    // Check if in well-lit area (main streets, tourist areas)
    const isWellLitArea = this.isWellLitArea(midPoint);
    if (isWellLitArea) {
      lighting = 'well-lit';
    } else if (!isDaylight && !isWellLitArea) {
      lighting = 'poor';
    }

    // Determine accessibility (simplified - main streets are usually accessible)
    const isMainStreet = this.isMainStreet(midPoint);
    const accessibility: 'accessible' | 'limited' | 'not-accessible' = 
      isMainStreet ? 'accessible' : 'limited';

    // Determine crime risk (simplified - based on area type)
    const crimeRisk = this.assessCrimeRisk(midPoint);

    // Determine safety level
    let safetyLevel: 'safe' | 'moderate' | 'caution' | 'unsafe' = 'moderate';
    
    // Most unsafe: high crime risk with poor lighting
    if (crimeRisk === 'high' && lighting === 'poor') {
      safetyLevel = 'unsafe';
    }
    // Unsafe: high crime risk or poor lighting
    else if (crimeRisk === 'high' || lighting === 'poor') {
      safetyLevel = 'caution';
    }
    // Caution: construction zones or medium crime risk with poor conditions
    else if (inConstructionZone || (crimeRisk === 'medium' && lighting !== 'well-lit')) {
      safetyLevel = 'caution';
    }
    // Safe: well-lit, low crime, no construction
    else if (lighting === 'well-lit' && crimeRisk === 'low' && !inConstructionZone) {
      safetyLevel = 'safe';
    }
    // Default: moderate (already set)

    return {
      id: `segment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      start,
      end,
      safetyLevel,
      factors: {
        lighting,
        construction: inConstructionZone,
        accessibility,
        crimeRisk,
        pedestrianFriendly: isMainStreet
      },
      description: this.generateSafetyDescription(lighting, inConstructionZone, crimeRisk, accessibility),
      lastUpdated: new Date().toISOString()
    };
  }

  // Check if area is well-lit (main streets, tourist areas)
  private isWellLitArea(position: [number, number]): boolean {
    // Main streets and tourist areas in Budapest
    const wellLitAreas: Array<{ center: [number, number]; radius: number }> = [
      { center: [47.4979, 19.0402], radius: 0.01 }, // City center
      { center: [47.5024, 19.034], radius: 0.005 }, // Castle district
      { center: [47.5074, 19.0452], radius: 0.01 }, // Parliament area
      { center: [47.4906, 19.0612], radius: 0.008 }, // Andrássy Avenue
    ];

    return wellLitAreas.some(area => {
      const distance = this.calculateDistance(position, area.center);
      return distance <= area.radius;
    });
  }

  // Check if segment is on a main street
  private isMainStreet(position: [number, number]): boolean {
    // Main streets in Budapest
    const mainStreets: Array<{ center: [number, number]; radius: number }> = [
      { center: [47.4979, 19.0402], radius: 0.015 }, // Váci Street, Deák Ferenc tér
      { center: [47.4906, 19.0612], radius: 0.012 }, // Andrássy Avenue
      { center: [47.5074, 19.0452], radius: 0.01 }, // Kossuth Lajos tér
    ];

    return mainStreets.some(street => {
      const distance = this.calculateDistance(position, street.center);
      return distance <= street.radius;
    });
  }

  // Assess crime risk (simplified)
  private assessCrimeRisk(position: [number, number]): 'low' | 'medium' | 'high' {
    // Tourist areas and main streets have lower crime risk
    if (this.isWellLitArea(position) || this.isMainStreet(position)) {
      return 'low';
    }
    
    // Areas further from center might have higher risk (simplified)
    const centerDistance = this.calculateDistance(position, [47.4979, 19.0402]);
    if (centerDistance > 0.05) {
      return 'medium';
    }
    
    return 'low';
  }

  // Calculate distance between two points (Haversine)
  private calculateDistance(point1: [number, number], point2: [number, number]): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.deg2rad(point2[0] - point1[0]);
    const dLon = this.deg2rad(point2[1] - point1[1]);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(point1[0])) * Math.cos(this.deg2rad(point2[0])) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  // Calculate overall safety score
  private calculateSafetyScore(segments: SafetySegment[]): number {
    if (segments.length === 0) return 100;

    let totalScore = 0;
    segments.forEach(segment => {
      let segmentScore = 50; // Base score
      
      // Lighting factor
      if (segment.factors.lighting === 'well-lit') segmentScore += 20;
      else if (segment.factors.lighting === 'moderate') segmentScore += 10;
      else segmentScore -= 10;
      
      // Construction factor
      if (segment.factors.construction) segmentScore -= 15;
      
      // Accessibility factor
      if (segment.factors.accessibility === 'accessible') segmentScore += 10;
      else if (segment.factors.accessibility === 'not-accessible') segmentScore -= 10;
      
      // Crime risk factor
      if (segment.factors.crimeRisk === 'low') segmentScore += 15;
      else if (segment.factors.crimeRisk === 'high') segmentScore -= 20;
      
      // Pedestrian friendly
      if (segment.factors.pedestrianFriendly) segmentScore += 10;
      
      totalScore += Math.max(0, Math.min(100, segmentScore));
    });

    return Math.round(totalScore / segments.length);
  }

  // Determine overall safety level
  private determineOverallSafety(score: number): 'safe' | 'moderate' | 'caution' | 'unsafe' {
    if (score >= 80) return 'safe';
    if (score >= 60) return 'moderate';
    if (score >= 40) return 'caution';
    return 'unsafe';
  }

  // Generate safety description
  private generateSafetyDescription(
    lighting: 'well-lit' | 'moderate' | 'poor',
    construction: boolean,
    crimeRisk: 'low' | 'medium' | 'high',
    accessibility: 'accessible' | 'limited' | 'not-accessible'
  ): string {
    const parts: string[] = [];
    
    if (lighting === 'well-lit') parts.push('Well-lit area');
    else if (lighting === 'poor') parts.push('Poorly lit');
    
    if (construction) parts.push('Construction zone');
    
    if (accessibility === 'accessible') parts.push('Wheelchair accessible');
    else if (accessibility === 'not-accessible') parts.push('Not wheelchair accessible');
    
    if (crimeRisk === 'low') parts.push('Low crime risk');
    else if (crimeRisk === 'high') parts.push('Higher crime risk');
    
    return parts.join(' • ') || 'Standard safety conditions';
  }

  // Initialize safety data
  private initializeSafetyData(): void {
    // This could be populated from external data sources
    // For now, we'll use dynamic analysis
  }

  // Initialize construction zones from seed data
  private initializeConstructionZones(): void {
    const seed = constructionZonesSeed as ConstructionZoneSeed[];
    const dayMs = 24 * 60 * 60 * 1000;
    this.constructionZones = seed.map((zone) => ({
      id: zone.id,
      position: zone.position as [number, number],
      radius: zone.radius,
      description: zone.description,
      startDate: new Date(Date.now() + zone.startOffsetDays * dayMs).toISOString(),
      endDate: zone.endOffsetDays !== undefined
        ? new Date(Date.now() + zone.endOffsetDays * dayMs).toISOString()
        : undefined
    }));
  }

  // Get construction zones near a point
  getConstructionZonesNearPoint(lat: number, lng: number, radius: number = 500): ConstructionZone[] {
    return this.constructionZones.filter(zone => {
      const distance = this.calculateDistance([lat, lng], zone.position) * 1000; // Convert to meters
      return distance <= radius;
    });
  }
}

export const safetyService = new SafetyService();

