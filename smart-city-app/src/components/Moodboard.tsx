"use client";

import { useEffect, useState } from "react";
import { X, RefreshCw, AlertCircle, Info, MapPin, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MoodboardContext, MoodboardSuggestion, apiService } from "@/lib/api";

interface MoodboardProps {
  userLocation?: { lat: number; lng: number } | null;
  onSuggestionAction?: (suggestion: MoodboardSuggestion) => void;
}

const priorityColors = {
  high: "bg-red-50 border-red-200 text-red-900",
  medium: "bg-amber-50 border-amber-200 text-amber-900",
  low: "bg-blue-50 border-blue-200 text-blue-900"
};

const typeIcons: { [key: string]: any } = {
  weather: "🌤️",
  transport: "🚋",
  activity: "🎯",
  safety: "⚠️",
  event: "🎉"
};

export default function Moodboard({ userLocation, onSuggestionAction }: MoodboardProps) {
  const [moodboard, setMoodboard] = useState<MoodboardContext | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(true);
  const [isMinimized, setIsMinimized] = useState(false);

  const loadMoodboard = async () => {
    setIsLoading(true);
    try {
      const data = await apiService.getMoodboard(userLocation || undefined);
      setMoodboard(data);
    } catch (error) {
      console.error("Failed to load moodboard:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMoodboard();
    // Refresh every 5 minutes
    const interval = setInterval(loadMoodboard, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [userLocation]);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="absolute top-4 right-4 z-20 bg-white rounded-full p-3 shadow-lg hover:shadow-xl transition"
        title="Show City Moodboard"
      >
        <span className="text-2xl">🎨</span>
      </button>
    );
  }

  if (!moodboard) {
    return null;
  }

  const handleSuggestionClick = (suggestion: MoodboardSuggestion) => {
    if (onSuggestionAction) {
      onSuggestionAction(suggestion);
    }
  };

  return (
    <div className="absolute top-4 right-4 z-20 w-80 max-h-[600px] bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-4 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-lg">City Moodboard</h3>
            <p className="text-xs opacity-90">
              {moodboard.timeOfDay.charAt(0).toUpperCase() + moodboard.timeOfDay.slice(1)} • {moodboard.dayOfWeek}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={loadMoodboard}
              disabled={isLoading}
              className="p-1 hover:bg-white/20 rounded transition"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 hover:bg-white/20 rounded transition"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Weather Summary */}
        {moodboard.weather && (
          <div className="mt-3 flex items-center gap-3 bg-white/10 rounded-lg p-2 backdrop-blur">
            <span className="text-3xl">{moodboard.weather.description.includes('rain') ? '🌧️' : moodboard.weather.description.includes('cloud') ? '☁️' : '☀️'}</span>
            <div>
              <div className="font-semibold">{moodboard.weather.temperature}°C</div>
              <div className="text-xs opacity-90 capitalize">{moodboard.weather.description}</div>
            </div>
          </div>
        )}

        {/* Transport Status */}
        {moodboard.transportStatus.hasDisruptions && (
          <div className="mt-2 flex items-center gap-2 text-xs bg-red-500/20 rounded px-2 py-1">
            <AlertCircle className="w-3 h-3" />
            <span>{moodboard.transportStatus.disruptionCount} transport disruption{moodboard.transportStatus.disruptionCount > 1 ? 's' : ''}</span>
          </div>
        )}
      </div>

      {/* Suggestions */}
      {!isMinimized && (
        <div className="overflow-y-auto max-h-[450px] p-4 space-y-3">
          {moodboard.suggestions.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              <Info className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No suggestions at the moment</p>
            </div>
          ) : (
            moodboard.suggestions.map((suggestion) => (
              <div
                key={suggestion.id}
                className={`rounded-lg border-2 p-3 transition hover:shadow-md cursor-pointer ${priorityColors[suggestion.priority]}`}
                onClick={() => handleSuggestionClick(suggestion)}
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl flex-shrink-0">{suggestion.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold text-sm">{suggestion.title}</h4>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                        suggestion.priority === 'high' ? 'bg-red-200' :
                        suggestion.priority === 'medium' ? 'bg-amber-200' :
                        'bg-blue-200'
                      }`}>
                        {suggestion.priority}
                      </span>
                    </div>
                    <p className="text-xs opacity-90 leading-relaxed">{suggestion.description}</p>
                    {suggestion.action && (
                      <button className="mt-2 text-xs font-medium underline hover:no-underline flex items-center gap-1">
                        {suggestion.action.type === 'route' && <Navigation className="w-3 h-3" />}
                        {suggestion.action.type === 'search' && <MapPin className="w-3 h-3" />}
                        {suggestion.action.label}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

