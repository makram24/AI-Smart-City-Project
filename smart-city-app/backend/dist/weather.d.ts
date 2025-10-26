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
export declare class WeatherService {
    private openWeatherApiKey;
    private baseUrl;
    private budapestCoords;
    constructor(apiKey?: string);
    getCurrentWeather(): Promise<WeatherData | null>;
    getWeatherForecast(): Promise<WeatherForecast[]>;
    getWeatherAlerts(): Promise<WeatherAlerts[]>;
    getWeatherContext(weather: WeatherData): {
        isGoodForCycling: boolean;
        isGoodForWalking: boolean;
        recommendations: string[];
    };
    private getMockWeatherData;
    private getMockForecast;
    private getMockAlerts;
    private mapSeverity;
}
export declare const weatherService: WeatherService;
//# sourceMappingURL=weather.d.ts.map