import axios from 'axios';

export interface WeatherData {
  temperature: number;
  feelsLike: number;
  humidity: number;
  pressure: number;
  visibility: number;
  windSpeed: number;
  windDirection: number;
  description: string;
  icon: string;
  timestamp: string;
}

export interface WeatherForecast {
  date: string;
  temperature: {
    min: number;
    max: number;
  };
  description: string;
  icon: string;
  precipitation: number;
  windSpeed: number;
}

export interface WeatherAlerts {
  id: string;
  title: string;
  description: string;
  severity: 'minor' | 'moderate' | 'severe' | 'extreme';
  startTime: string;
  endTime: string;
  areas: string[];
}

export class WeatherService {
  private openWeatherApiKey: string;
  private baseUrl = 'https://api.openweathermap.org/data/2.5';
  private budapestCoords = { lat: 47.4979, lng: 19.0402 };

  constructor(apiKey?: string) {
    this.openWeatherApiKey = apiKey || process.env.OPENWEATHER_API_KEY || '';
  }

  // Get current weather for Budapest
  async getCurrentWeather(): Promise<WeatherData | null> {
    try {
      if (!this.openWeatherApiKey) {
        // Return mock data if no API key
        return this.getMockWeatherData();
      }

      const response = await axios.get(`${this.baseUrl}/weather`, {
        params: {
          lat: this.budapestCoords.lat,
          lon: this.budapestCoords.lng,
          appid: this.openWeatherApiKey,
          units: 'metric'
        },
        timeout: 5000,
        headers: {
          'User-Agent': 'AI-Smart-City-App/1.0'
        }
      });

      const data = response.data;
      return {
        temperature: Math.round(data.main.temp),
        feelsLike: Math.round(data.main.feels_like),
        humidity: data.main.humidity,
        pressure: data.main.pressure,
        visibility: data.visibility / 1000, // Convert to km
        windSpeed: data.wind.speed,
        windDirection: data.wind.deg,
        description: data.weather[0].description,
        icon: data.weather[0].icon,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error fetching current weather:', error);
      return this.getMockWeatherData();
    }
  }

  // Get 5-day weather forecast
  async getWeatherForecast(): Promise<WeatherForecast[]> {
    try {
      if (!this.openWeatherApiKey) {
        return this.getMockForecast();
      }

      const response = await axios.get(`${this.baseUrl}/forecast`, {
        params: {
          lat: this.budapestCoords.lat,
          lon: this.budapestCoords.lng,
          appid: this.openWeatherApiKey,
          units: 'metric'
        },
        timeout: 5000,
        headers: {
          'User-Agent': 'AI-Smart-City-App/1.0'
        }
      });

      // Process forecast data to get daily summaries
      const dailyForecasts: { [key: string]: any } = {};
      
      response.data.list.forEach((item: any) => {
        const date = new Date(item.dt * 1000).toDateString();
        if (!dailyForecasts[date]) {
          dailyForecasts[date] = {
            temperatures: [],
            descriptions: [],
            icons: [],
            precipitation: [],
            windSpeeds: []
          };
        }
        
        dailyForecasts[date].temperatures.push(item.main.temp);
        dailyForecasts[date].descriptions.push(item.weather[0].description);
        dailyForecasts[date].icons.push(item.weather[0].icon);
        dailyForecasts[date].precipitation.push(item.rain?.['3h'] || 0);
        dailyForecasts[date].windSpeeds.push(item.wind.speed);
      });

      return Object.keys(dailyForecasts).slice(0, 5).map(date => {
        const dayData = dailyForecasts[date];
        return {
          date,
          temperature: {
            min: Math.round(Math.min(...dayData.temperatures)),
            max: Math.round(Math.max(...dayData.temperatures))
          },
          description: dayData.descriptions[0],
          icon: dayData.icons[0],
          precipitation: Math.round(dayData.precipitation.reduce((a: number, b: number) => a + b, 0)),
          windSpeed: Math.round(dayData.windSpeeds.reduce((a: number, b: number) => a + b, 0) / dayData.windSpeeds.length)
        };
      });
    } catch (error) {
      console.error('Error fetching weather forecast:', error);
      return this.getMockForecast();
    }
  }

  // Get weather alerts
  async getWeatherAlerts(): Promise<WeatherAlerts[]> {
    try {
      if (!this.openWeatherApiKey) {
        return this.getMockAlerts();
      }

      const response = await axios.get(`${this.baseUrl}/onecall`, {
        params: {
          lat: this.budapestCoords.lat,
          lon: this.budapestCoords.lng,
          appid: this.openWeatherApiKey,
          exclude: 'minutely,hourly,daily'
        }
      });

      return response.data.alerts?.map((alert: any) => ({
        id: alert.sender_name + '_' + alert.start,
        title: alert.event,
        description: alert.description,
        severity: this.mapSeverity(alert.severity),
        startTime: new Date(alert.start * 1000).toISOString(),
        endTime: new Date(alert.end * 1000).toISOString(),
        areas: alert.areas || ['Budapest']
      })) || [];
    } catch (error) {
      console.error('Error fetching weather alerts:', error);
      return this.getMockAlerts();
    }
  }

  // Get weather context for route planning
  getWeatherContext(weather: WeatherData): {
    isGoodForCycling: boolean;
    isGoodForWalking: boolean;
    recommendations: string[];
  } {
    const recommendations: string[] = [];
    let isGoodForCycling = true;
    let isGoodForWalking = true;

    if (weather.temperature < 5 || weather.temperature > 35) {
      isGoodForCycling = false;
      isGoodForWalking = false;
      recommendations.push('Extreme temperatures - consider public transport');
    }

    if (weather.windSpeed > 15) {
      isGoodForCycling = false;
      recommendations.push('Strong winds - cycling may be difficult');
    }

    if (weather.description.includes('rain') || weather.description.includes('storm')) {
      isGoodForCycling = false;
      recommendations.push('Rainy weather - bring an umbrella or use public transport');
    }

    if (weather.visibility < 1) {
      isGoodForCycling = false;
      isGoodForWalking = false;
      recommendations.push('Poor visibility - use public transport');
    }

    if (isGoodForCycling && isGoodForWalking) {
      recommendations.push('Great weather for walking or cycling!');
    }

    return {
      isGoodForCycling,
      isGoodForWalking,
      recommendations
    };
  }

  private getMockWeatherData(): WeatherData {
    return {
      temperature: 18,
      feelsLike: 16,
      humidity: 65,
      pressure: 1013,
      visibility: 10,
      windSpeed: 8,
      windDirection: 180,
      description: 'partly cloudy',
      icon: '02d',
      timestamp: new Date().toISOString()
    };
  }

  private getMockForecast(): WeatherForecast[] {
    return [
      {
        date: new Date().toDateString(),
        temperature: { min: 12, max: 20 },
        description: 'partly cloudy',
        icon: '02d',
        precipitation: 0,
        windSpeed: 8
      },
      {
        date: new Date(Date.now() + 86400000).toDateString(),
        temperature: { min: 10, max: 18 },
        description: 'light rain',
        icon: '10d',
        precipitation: 2,
        windSpeed: 12
      },
      {
        date: new Date(Date.now() + 172800000).toDateString(),
        temperature: { min: 8, max: 15 },
        description: 'cloudy',
        icon: '04d',
        precipitation: 1,
        windSpeed: 6
      }
    ];
  }

  private getMockAlerts(): WeatherAlerts[] {
    return [
      {
        id: 'alert_001',
        title: 'Wind Advisory',
        description: 'Strong winds expected in the afternoon',
        severity: 'moderate',
        startTime: new Date(Date.now() + 3600000).toISOString(),
        endTime: new Date(Date.now() + 7200000).toISOString(),
        areas: ['Budapest']
      }
    ];
  }

  private mapSeverity(severity: string): 'minor' | 'moderate' | 'severe' | 'extreme' {
    const severityMap: { [key: string]: 'minor' | 'moderate' | 'severe' | 'extreme' } = {
      'Minor': 'minor',
      'Moderate': 'moderate',
      'Severe': 'severe',
      'Extreme': 'extreme'
    };
    return severityMap[severity] || 'minor';
  }
}

export const weatherService = new WeatherService();
