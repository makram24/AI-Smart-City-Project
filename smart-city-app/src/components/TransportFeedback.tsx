"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { X, Star, MessageSquare, ThumbsUp, ThumbsDown, Minus } from "lucide-react";
import { apiService, TransportFeedback as TransportFeedbackType, RouteConfidence } from "@/lib/api";

interface TransportFeedbackProps {
  routeId: string;
  routeType: 'bus' | 'tram' | 'metro' | 'trolley';
  routeName: string;
  onClose: () => void;
  onFeedbackSubmitted?: () => void;
}

export default function TransportFeedback({ 
  routeId, 
  routeType, 
  routeName, 
  onClose,
  onFeedbackSubmitted 
}: TransportFeedbackProps) {
  const [sentiment, setSentiment] = useState<'positive' | 'neutral' | 'negative' | null>(null);
  const [reliability, setReliability] = useState<number>(3);
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confidence, setConfidence] = useState<RouteConfidence | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  // Load confidence data on mount
  useEffect(() => {
    const loadConfidence = async () => {
      const conf = await apiService.getRouteConfidence(routeId, routeType);
      setConfidence(conf);
    };
    loadConfidence();
  }, [routeId, routeType]);

  const handleSubmit = async () => {
    if (!sentiment) {
      alert('Please select a sentiment (positive, neutral, or negative)');
      return;
    }

    setIsSubmitting(true);
    try {
      await apiService.submitTransportFeedback({
        routeId,
        routeType,
        sentiment,
        reliability,
        comment: comment.trim() || undefined
      });

      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        onFeedbackSubmitted?.();
        onClose();
      }, 2000);
    } catch (error) {
      console.error('Failed to submit feedback:', error);
      alert('Failed to submit feedback. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Transport Feedback</h3>
            <p className="text-sm text-gray-500">{routeName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Confidence */}
        {confidence && (
          <div className="p-4 bg-blue-50 border-b border-gray-200">
            <p className="text-xs text-gray-600 mb-2">Community Sentiment:</p>
            <div className="flex items-center gap-3">
              <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                confidence.sentiment === 'positive' ? 'bg-green-100 text-green-800' :
                confidence.sentiment === 'negative' ? 'bg-red-100 text-red-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {confidence.sentiment === 'positive' ? '👍 Positive' :
                 confidence.sentiment === 'negative' ? '👎 Negative' : '➖ Neutral'}
              </div>
              <div className="flex items-center gap-1">
                <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                <span className="text-sm font-semibold">{confidence.averageReliability.toFixed(1)}</span>
              </div>
              <span className="text-xs text-gray-500">
                ({confidence.feedbackCount} {confidence.feedbackCount === 1 ? 'review' : 'reviews'})
              </span>
            </div>
          </div>
        )}

        {/* Feedback Form */}
        <div className="p-4 space-y-4">
          {/* Sentiment Selection */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              How was your experience?
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => setSentiment('positive')}
                className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition ${
                  sentiment === 'positive'
                    ? 'border-green-500 bg-green-50 text-green-700'
                    : 'border-gray-200 hover:border-green-300'
                }`}
              >
                <ThumbsUp className="w-5 h-5" />
                <span className="text-sm font-medium">Positive</span>
              </button>
              <button
                onClick={() => setSentiment('neutral')}
                className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition ${
                  sentiment === 'neutral'
                    ? 'border-gray-500 bg-gray-50 text-gray-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <Minus className="w-5 h-5" />
                <span className="text-sm font-medium">Neutral</span>
              </button>
              <button
                onClick={() => setSentiment('negative')}
                className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition ${
                  sentiment === 'negative'
                    ? 'border-red-500 bg-red-50 text-red-700'
                    : 'border-gray-200 hover:border-red-300'
                }`}
              >
                <ThumbsDown className="w-5 h-5" />
                <span className="text-sm font-medium">Negative</span>
              </button>
            </div>
          </div>

          {/* Reliability Rating */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              Reliability Rating: {reliability}/5
            </label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((rating) => (
                <button
                  key={rating}
                  onClick={() => setReliability(rating)}
                  className={`flex-1 p-2 rounded transition ${
                    rating <= reliability
                      ? 'bg-yellow-100 text-yellow-600'
                      : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                  }`}
                >
                  <Star className={`w-5 h-5 mx-auto ${rating <= reliability ? 'fill-current' : ''}`} />
                </button>
              ))}
            </div>
          </div>

          {/* Comment */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              Optional Comment
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Share your experience (optional)..."
              className="w-full p-3 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              maxLength={500}
            />
            <p className="text-xs text-gray-500 mt-1">{comment.length}/500</p>
          </div>

          {/* Submit Button */}
          <Button
            onClick={handleSubmit}
            disabled={!sentiment || isSubmitting || showSuccess}
            className="w-full"
          >
            {showSuccess ? (
              <>
                <span className="mr-2">✓</span> Feedback Submitted!
              </>
            ) : isSubmitting ? (
              'Submitting...'
            ) : (
              <>
                <MessageSquare className="w-4 h-4 mr-2" />
                Submit Feedback
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

