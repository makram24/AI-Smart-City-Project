"use client";

import { useState, useEffect } from "react";
import { X, Volume2, VolumeX, Clock, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StoryCard as StoryCardType } from "@/lib/api";

interface StoryCardProps {
  story: StoryCardType;
  onClose: () => void;
  onNavigate?: () => void;
}

export default function StoryCard({ story, onClose, onNavigate }: StoryCardProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(story.duration);

  useEffect(() => {
    if (isPlaying && timeRemaining > 0) {
      const timer = setTimeout(() => {
        setTimeRemaining(prev => Math.max(0, prev - 1));
      }, 1000);
      return () => clearTimeout(timer);
    } else if (timeRemaining === 0) {
      setIsPlaying(false);
    }
  }, [isPlaying, timeRemaining]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const categoryColors: { [key: string]: string } = {
    history: 'bg-amber-50 border-amber-200',
    architecture: 'bg-blue-50 border-blue-200',
    culture: 'bg-purple-50 border-purple-200',
    legend: 'bg-green-50 border-green-200',
    event: 'bg-red-50 border-red-200'
  };

  const categoryLabels: { [key: string]: string } = {
    history: 'History',
    architecture: 'Architecture',
    culture: 'Culture',
    legend: 'Legend',
    event: 'Event'
  };

  return (
    <div className={`absolute bottom-6 left-1/2 transform -translate-x-1/2 z-30 w-96 max-w-[calc(100vw-2rem)] ${categoryColors[story.category] || 'bg-white'} rounded-xl shadow-2xl border-2 overflow-hidden`}>
      {/* Header */}
      <div className="relative">
        {story.imageUrl && (
          <div className="h-32 bg-cover bg-center" style={{ backgroundImage: `url(${story.imageUrl})` }}>
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          </div>
        )}
        <div className={`p-4 ${story.imageUrl ? 'absolute bottom-0 left-0 right-0' : ''}`}>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] uppercase tracking-wide font-semibold px-2 py-0.5 rounded-full bg-white/20 backdrop-blur">
                  {categoryLabels[story.category] || story.category}
                </span>
                {story.duration > 0 && (
                  <span className="text-[10px] text-white/90 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatTime(story.duration)}
                  </span>
                )}
              </div>
              <h3 className={`font-bold text-lg ${story.imageUrl ? 'text-white' : 'text-gray-900'}`}>
                {story.title}
              </h3>
              <p className={`text-sm ${story.imageUrl ? 'text-white/90' : 'text-gray-600'}`}>
                {story.landmarkName}
              </p>
            </div>
            <button
              onClick={onClose}
              className={`p-1 rounded-full hover:bg-white/20 transition ${story.imageUrl ? 'text-white' : 'text-gray-600'}`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 bg-white">
        <p className="text-sm text-gray-700 leading-relaxed mb-4 whitespace-pre-line">
          {story.narrative}
        </p>

        {/* Tags */}
        {story.tags && story.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-4">
            {story.tags.map((tag) => (
              <span
                key={tag}
                className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2">
          {story.audioUrl && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsPlaying(!isPlaying)}
              className="flex items-center gap-2"
            >
              {isPlaying ? (
                <>
                  <VolumeX className="w-4 h-4" />
                  Pause
                </>
              ) : (
                <>
                  <Volume2 className="w-4 h-4" />
                  Play Audio
                </>
              )}
            </Button>
          )}
          {onNavigate && (
            <Button
              size="sm"
              onClick={onNavigate}
              className="flex items-center gap-2 flex-1"
            >
              <MapPin className="w-4 h-4" />
              Show on Map
            </Button>
          )}
        </div>

        {/* Progress bar for audio */}
        {isPlaying && story.duration > 0 && (
          <div className="mt-3">
            <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all duration-1000"
                style={{ width: `${((story.duration - timeRemaining) / story.duration) * 100}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1 text-center">
              {formatTime(timeRemaining)} remaining
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

