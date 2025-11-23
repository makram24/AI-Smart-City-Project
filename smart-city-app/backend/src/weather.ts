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
  private openMeteoBaseUrl = 'https://api.open-meteo.com/v1/forecast';
  private openWeatherBaseUrl = 'https://api.openweathermap.org/data/2.5';
  private budapestCoords = { lat: 47.4979, lng: 19.0402 };
  private useOpenMeteo = true; // Use Open-Meteo by default (no API key needed)

  constructor(apiKey?: string) {
    this.openWeatherApiKey = apiKey || process.env.OPENWEATHER_API_KEY || '';
    // Prefer Open-Meteo (free, no key needed) unless OpenWeatherMap key is explicitly provided
    this.useOpenMeteo = !this.openWeatherApiKey;
  }

  // Get current weather for Budapest
  async getCurrentWeather(): Promise<WeatherData | null> {
    // Try Open-Meteo first (free, no API key needed)
    if (this.useOpenMeteo) {
      try {
        const weather = await this.fetchOpenMeteoCurrent();
        if (weather) {
          console.log('✅ Using Open-Meteo weather API (free, no key needed)');
          return weather;
        }
      } catch (error) {
        console.warn('Open-Meteo failed, trying OpenWeatherMap:', error);
      }
    }

    // Fallback to OpenWeatherMap if API key is provided
    if (this.openWeatherApiKey) {
      try {
        const response = await axios.get(`${this.openWeatherBaseUrl}/weather`, {
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
        console.error('Error fetching OpenWeatherMap:', error);
      }
    }

    // Final fallback to mock data
    return this.getMockWeatherData();
  }

  // Fetch current weather from Open-Meteo (free, no API key)
  private async fetchOpenMeteoCurrent(): Promise<WeatherData | null> {
    try {
      const response = await axios.get(this.openMeteoBaseUrl, {
        params: {
          latitude: this.budapestCoords.lat,
          longitude: this.budapestCoords.lng,
          current: 'temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,wind_direction_10m,pressure_msl',
          timezone: 'Europe/Budapest'
        },
        timeout: 5000,
        headers: {
          'User-Agent': 'AI-Smart-City-App/1.0'
        }
      });

      const data = response.data;
      if (data.current) {
        const current = data.current;
        return {
          temperature: Math.round(current.temperature_2m),
          feelsLike: Math.round(current.temperature_2m), // Open-Meteo doesn't have feels_like, use same temp
          humidity: current.relative_humidity_2m,
          pressure: Math.round(current.pressure_msl),
          visibility: 10, // Open-Meteo doesn't provide visibility in free tier
          windSpeed: current.wind_speed_10m,
          windDirection: current.wind_direction_10m,
          description: this.mapWeatherCode(current.weather_code),
          icon: this.mapWeatherCodeToIcon(current.weather_code),
          timestamp: new Date().toISOString()
        };
      }
      return null;
    } catch (error) {
      console.error('Error fetching Open-Meteo weather:', error);
      throw error;
    }
  }

  // Get 5-day weather forecast
  async getWeatherForecast(): Promise<WeatherForecast[]> {
    // Try Open-Meteo first (free, no API key needed)
    if (this.useOpenMeteo) {
      try {
        const forecast = await this.fetchOpenMeteoForecast();
        if (forecast && forecast.length > 0) {
          return forecast;
        }
      } catch (error) {
        console.warn('Open-Meteo forecast failed, trying OpenWeatherMap:', error);
      }
    }

    // Fallback to OpenWeatherMap if API key is provided
    if (this.openWeatherApiKey) {
      try {
        const response = await axios.get(`${this.openWeatherBaseUrl}/forecast`, {
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

  // Fetch forecast from Open-Meteo (free, no API key)
  private async fetchOpenMeteoForecast(): Promise<WeatherForecast[]> {
    try {
      const response = await axios.get(this.openMeteoBaseUrl, {
        params: {
          latitude: this.budapestCoords.lat,
          longitude: this.budapestCoords.lng,
          daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max',
          timezone: 'Europe/Budapest',
          forecast_days: 5
        },
        timeout: 5000,
        headers: {
          'User-Agent': 'AI-Smart-City-App/1.0'
        }
      });

      const data = response.data;
      if (data.daily) {
        const daily = data.daily;
        const forecasts: WeatherForecast[] = [];
        
        for (let i = 0; i < Math.min(5, daily.time.length); i++) {
          forecasts.push({
            date: daily.time[i],
            temperature: {
              min: Math.round(daily.temperature_2m_min[i]),
              max: Math.round(daily.temperature_2m_max[i])
            },
            description: this.mapWeatherCode(daily.weather_code[i]),
            icon: this.mapWeatherCodeToIcon(daily.weather_code[i]),
            precipitation: Math.round(daily.precipitation_sum[i] || 0),
            windSpeed: Math.round(daily.wind_speed_10m_max[i] || 0)
          });
        }
        
        return forecasts;
      }
      return [];
    } catch (error) {
      console.error('Error fetching Open-Meteo forecast:', error);
      throw error;
    }
  }

  // Map WMO weather code to description
  private mapWeatherCode(code: number): string {
    // WMO Weather interpretation codes (WW)
    const weatherMap: { [key: number]: string } = {
      0: 'clear sky',
      1: 'mainly clear',
      2: 'partly cloudy',
      3: 'overcast',
      45: 'foggy',
      48: 'depositing rime fog',
      51: 'light drizzle',
      53: 'moderate drizzle',
      55: 'dense drizzle',
      56: 'light freezing drizzle',
      57: 'dense freezing drizzle',
      61: 'slight rain',
      63: 'moderate rain',
      65: 'heavy rain',
      66: 'light freezing rain',
      67: 'heavy freezing rain',
      71: 'slight snow fall',
      73: 'moderate snow fall',
      75: 'heavy snow fall',
      77: 'snow grains',
      80: 'slight rain showers',
      81: 'moderate rain showers',
      82: 'violent rain showers',
      85: 'slight snow showers',
      86: 'heavy snow showers',
      95: 'thunderstorm',
      96: 'thunderstorm with slight hail',
      99: 'thunderstorm with heavy hail'
    };
    return weatherMap[code] || 'unknown';
  }

  // Map WMO weather code to icon (compatible with OpenWeatherMap icons)
  private mapWeatherCodeToIcon(code: number): string {
    // Map to OpenWeatherMap-style icons for consistency
    if (code === 0 || code === 1) return '01d'; // clear sky
    if (code === 2) return '02d'; // partly cloudy
    if (code === 3) return '04d'; // overcast
    if (code >= 45 && code <= 48) return '50d'; // fog
    if (code >= 51 && code <= 67) return '09d'; // rain
    if (code >= 71 && code <= 77) return '13d'; // snow
    if (code >= 80 && code <= 82) return '09d'; // rain showers
    if (code >= 85 && code <= 86) return '13d'; // snow showers
    if (code >= 95 && code <= 99) return '11d'; // thunderstorm
    return '02d'; // default
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
