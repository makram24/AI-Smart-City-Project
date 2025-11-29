"use client";

import { useEffect, useState, useRef } from "react";
import { X, RefreshCw, AlertCircle, Info, MapPin, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MoodboardContext, MoodboardSuggestion, apiService } from "@/lib/api";

interface MoodboardProps {
  userLocation?: { lat: number; lng: number } | null;
  onSuggestionAction?: (suggestion: MoodboardSuggestion) => void;
  onWeatherClick?: () => void;
  onTransportClick?: () => void;
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

export default function Moodboard({ userLocation, onSuggestionAction, onWeatherClick, onTransportClick }: MoodboardProps) {
  const [moodboard, setMoodboard] = useState<MoodboardContext | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(true);
  const [isMinimized, setIsMinimized] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const moodboardRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging && moodboardRef.current) {
        const newX = e.clientX - dragOffset.x;
        const newY = e.clientY - dragOffset.y;
        
        // Keep within viewport bounds
        const maxX = window.innerWidth - moodboardRef.current.offsetWidth;
        const maxY = window.innerHeight - moodboardRef.current.offsetHeight;
        
        setPosition({
          x: Math.max(0, Math.min(newX, maxX)),
          y: Math.max(0, Math.min(newY, maxY))
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, dragOffset]);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        style={{
          position: 'absolute',
          top: position.y || 16,
          right: position.x ? 'auto' : 16,
          left: position.x || 'auto',
          zIndex: 20
        }}
        className="bg-white rounded-full p-3 shadow-lg hover:shadow-xl transition"
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

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (moodboardRef.current) {
      const rect = moodboardRef.current.getBoundingClientRect();
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
      setIsDragging(true);
    }
  };

  return (
    <div
      ref={moodboardRef}
      style={{
        position: 'absolute',
        top: position.y || 16,
        right: position.x ? 'auto' : 16,
        left: position.x || 'auto',
        zIndex: 20,
        cursor: isDragging ? 'grabbing' : 'default'
      }}
      className="w-80 max-h-[600px] bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden"
    >
      {/* Header */}
      <div
        onMouseDown={handleMouseDown}
        className={`bg-gradient-to-r from-blue-500 to-purple-600 p-4 text-white ${isDragging ? 'cursor-grabbing' : 'cursor-grab'} select-none`}
      >
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
              onMouseDown={(e) => e.stopPropagation()}
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 hover:bg-white/20 rounded transition"
              title="Close"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Weather Summary */}
        {moodboard.weather && (
          <div 
            onClick={onWeatherClick}
            className="mt-3 flex items-center gap-3 bg-white/10 rounded-lg p-2 backdrop-blur cursor-pointer hover:bg-white/20 transition"
          >
            <span className="text-3xl">{moodboard.weather.description.includes('rain') ? '🌧️' : moodboard.weather.description.includes('cloud') ? '☁️' : '☀️'}</span>
            <div className="flex-1">
              <div className="font-semibold">{moodboard.weather.temperature}°C</div>
              <div className="text-xs opacity-90 capitalize">{moodboard.weather.description}</div>
            </div>
            <Info className="w-4 h-4 opacity-70" />
          </div>
        )}

        {/* Transport Status */}
        {moodboard.transportStatus.hasDisruptions ? (
          <div 
            onClick={onTransportClick}
            className="mt-2 flex items-center gap-2 text-xs bg-red-500/20 rounded px-2 py-1 cursor-pointer hover:bg-red-500/30 transition"
          >
            <AlertCircle className="w-3 h-3" />
            <span className="flex-1">{moodboard.transportStatus.disruptionCount} transport disruption{moodboard.transportStatus.disruptionCount > 1 ? 's' : ''}</span>
            <Info className="w-3 h-3 opacity-70" />
          </div>
        ) : (
          <div 
            onClick={onTransportClick}
            className="mt-2 flex items-center gap-2 text-xs bg-green-500/20 rounded px-2 py-1 cursor-pointer hover:bg-green-500/30 transition"
          >
            <span className="flex-1">✅ No transport disruptions</span>
            <Info className="w-3 h-3 opacity-70" />
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
                      <div className="mt-2 text-xs font-medium text-blue-700 flex items-center gap-1">
                        {suggestion.action.type === 'route' && <Navigation className="w-3 h-3" />}
                        {suggestion.action.type === 'search' && <MapPin className="w-3 h-3" />}
                        {suggestion.action.type === 'info' && <Info className="w-3 h-3" />}
                        <span>{suggestion.action.label}</span>
                      </div>
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

