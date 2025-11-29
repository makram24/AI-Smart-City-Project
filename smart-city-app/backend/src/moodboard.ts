import { weatherService, WeatherData } from './weather';
import { publicTransportService } from './transport';

export interface MoodboardSuggestion {
  id: string;
  type: 'weather' | 'transport' | 'activity' | 'safety' | 'event';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  icon: string;
  action?: {
    label: string;
    type: 'route' | 'search' | 'info';
    data?: any;
  };
  timestamp: string;
}

export interface MoodboardContext {
  weather: WeatherData | null;
  weatherContext: {
    isGoodForCycling: boolean;
    isGoodForWalking: boolean;
    recommendations: string[];
  } | null;
  transportStatus: {
    hasDisruptions: boolean;
    disruptionCount: number;
    nearbyStops: number;
  };
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
  dayOfWeek: string;
  suggestions: MoodboardSuggestion[];
}

export class MoodboardService {
  async generateMoodboard(
    userLocation?: { lat: number; lng: number }
  ): Promise<MoodboardContext> {
    const now = new Date();
    const hour = now.getHours();
    const dayOfWeek = now.toLocaleDateString('en-US', { weekday: 'long' });

    // Determine time of day
    let timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
    if (hour >= 5 && hour < 12) timeOfDay = 'morning';
    else if (hour >= 12 && hour < 17) timeOfDay = 'afternoon';
    else if (hour >= 17 && hour < 22) timeOfDay = 'evening';
    else timeOfDay = 'night';

    // Fetch weather data
    const weather = await weatherService.getCurrentWeather();
    const weatherContext = weather ? weatherService.getWeatherContext(weather) : null;

    // Fetch transport status
    const disruptions = await publicTransportService.getDisruptions();
    const hasDisruptions = disruptions.length > 0;
    const disruptionCount = disruptions.length;

    // Get nearby stops count if location available
    let nearbyStops = 0;
    if (userLocation) {
      try {
        const stops = await publicTransportService.getNearbyStops(
          userLocation.lat,
          userLocation.lng,
          500
        );
        nearbyStops = stops.length;
      } catch (error) {
        console.warn('Failed to fetch nearby stops for moodboard:', error);
      }
    }

    // Generate suggestions based on context
    const suggestions = this.generateSuggestions(
      weather,
      weatherContext,
      hasDisruptions,
      disruptionCount,
      timeOfDay,
      dayOfWeek,
      userLocation
    );

    return {
      weather,
      weatherContext,
      transportStatus: {
        hasDisruptions,
        disruptionCount,
        nearbyStops
      },
      timeOfDay,
      dayOfWeek,
      suggestions
    };
  }

  private generateSuggestions(
    weather: WeatherData | null,
    weatherContext: { isGoodForCycling: boolean; isGoodForWalking: boolean; recommendations: string[] } | null,
    hasDisruptions: boolean,
    disruptionCount: number,
    timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night',
    dayOfWeek: string,
    userLocation?: { lat: number; lng: number }
  ): MoodboardSuggestion[] {
    const suggestions: MoodboardSuggestion[] = [];
    const now = new Date().toISOString();

    // Weather-based suggestions
    if (weather) {
      const isRaining = weather.description.includes('rain') || 
                       weather.description.includes('drizzle') ||
                       weather.description.includes('storm');
      const isCold = weather.temperature < 10;
      const isHot = weather.temperature > 28;
      const isWindy = weather.windSpeed > 15;

      if (isRaining) {
        suggestions.push({
          id: 'weather_rain',
          type: 'weather',
          priority: 'high',
          title: 'Rainy Weather Alert',
          description: `It's ${weather.description} in Budapest. Consider indoor activities or use public transport.`,
          icon: '🌧️',
          action: {
            label: 'Find indoor places',
            type: 'search',
            data: { query: 'museum, gallery, cafe' }
          },
          timestamp: now
        });

        if (userLocation) {
          suggestions.push({
            id: 'weather_rain_tram',
            type: 'transport',
            priority: 'medium',
            title: 'Tram Line 2 - Scenic Route',
            description: 'Take the covered tram along the Danube for a dry, scenic journey.',
            icon: '🚋',
            action: {
              label: 'Show tram stops',
              type: 'search',
              data: { query: 'tram stops near me' }
            },
            timestamp: now
          });
        }
      }

      if (isCold) {
        suggestions.push({
          id: 'weather_cold',
          type: 'weather',
          priority: 'medium',
          title: 'Cold Weather',
          description: `Temperature is ${weather.temperature}°C. Perfect for thermal baths or cozy cafés.`,
          icon: '🧊',
          action: {
            label: 'Find thermal baths',
            type: 'search',
            data: { query: 'thermal bath, spa' }
          },
          timestamp: now
        });
      }

      if (isHot) {
        suggestions.push({
          id: 'weather_hot',
          type: 'weather',
          priority: 'medium',
          title: 'Hot Weather',
          description: `It's ${weather.temperature}°C. Stay cool with shaded walks or air-conditioned spaces.`,
          icon: '☀️',
          action: {
            label: 'Find shaded routes',
            type: 'route',
            data: { mode: 'walking', preference: 'shaded' }
          },
          timestamp: now
        });
      }

      if (weatherContext?.isGoodForCycling && weatherContext.isGoodForWalking) {
        suggestions.push({
          id: 'weather_perfect',
          type: 'activity',
          priority: 'low',
          title: 'Perfect Weather for Exploring',
          description: `Great conditions for walking or cycling! ${weather.temperature}°C and ${weather.description}.`,
          icon: '☀️',
          action: {
            label: 'Plan a route',
            type: 'route',
            data: { mode: 'walking' }
          },
          timestamp: now
        });
      }
    }

    // Transport disruption suggestions
    if (hasDisruptions) {
      suggestions.push({
        id: 'transport_disruption',
        type: 'transport',
        priority: 'high',
        title: 'Transport Disruptions',
        description: `There ${disruptionCount === 1 ? 'is' : 'are'} ${disruptionCount} transport disruption${disruptionCount > 1 ? 's' : ''} in Budapest. Check alternative routes.`,
        icon: '⚠️',
        action: {
          label: 'View disruptions',
          type: 'info',
          data: { type: 'disruptions' }
        },
        timestamp: now
      });
    }

    // Time-based suggestions
    if (timeOfDay === 'morning') {
      suggestions.push({
        id: 'time_morning',
        type: 'activity',
        priority: 'low',
        title: 'Good Morning!',
        description: 'Start your day with a walk along the Danube or visit a morning market.',
        icon: '🌅',
        action: {
          label: 'Find morning spots',
          type: 'search',
          data: { query: 'market, cafe, park' }
        },
        timestamp: now
      });
    }

    if (timeOfDay === 'afternoon') {
      suggestions.push({
        id: 'time_afternoon',
        type: 'activity',
        priority: 'low',
        title: 'Afternoon Activities',
        description: 'Perfect time for museum visits, shopping, or exploring historical sites.',
        icon: '🏛️',
        action: {
          label: 'Find museums',
          type: 'search',
          data: { query: 'museum, gallery, historical' }
        },
        timestamp: now
      });
    }

    if (timeOfDay === 'evening') {
      suggestions.push({
        id: 'time_evening',
        type: 'activity',
        priority: 'medium',
        title: 'Evening in Budapest',
        description: 'Golden hour! Perfect for riverside walks, sunset views, or dinner reservations.',
        icon: '🌆',
        action: {
          label: 'Find restaurants',
          type: 'search',
          data: { query: 'restaurant, bar, sunset view' }
        },
        timestamp: now
      });
    }

    // Weekend suggestions
    if (dayOfWeek === 'Saturday' || dayOfWeek === 'Sunday') {
      suggestions.push({
        id: 'weekend',
        type: 'activity',
        priority: 'low',
        title: 'Weekend Explorer',
        description: 'Weekend vibes! Explore markets, parks, or take a leisurely bike ride.',
        icon: '🎉',
        action: {
          label: 'Find weekend activities',
          type: 'search',
          data: { query: 'market, park, bike rental' }
        },
        timestamp: now
      });
    }

    // Sort by priority (high -> medium -> low)
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    suggestions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    return suggestions.slice(0, 5); // Return top 5 suggestions
  }
}

export const moodboardService = new MoodboardService();

