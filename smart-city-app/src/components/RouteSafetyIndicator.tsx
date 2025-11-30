"use client";

import { useEffect, useState } from "react";
import { Shield, AlertTriangle, CheckCircle, Info, Construction, Lightbulb, Accessibility } from "lucide-react";
import { apiService, RouteSafetyAnalysis } from "@/lib/api";

interface RouteSafetyIndicatorProps {
  routePolyline: number[][];
  onSafetyData?: (analysis: RouteSafetyAnalysis) => void;
  onClose?: () => void;
}

export default function RouteSafetyIndicator({ routePolyline, onSafetyData, onClose }: RouteSafetyIndicatorProps) {
  const [analysis, setAnalysis] = useState<RouteSafetyAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (routePolyline && routePolyline.length >= 2) {
      loadSafetyAnalysis();
    }
  }, [routePolyline]);

  const loadSafetyAnalysis = async () => {
    setIsLoading(true);
    try {
      const safetyAnalysis = await apiService.analyzeRouteSafety(routePolyline);
      if (safetyAnalysis) {
        setAnalysis(safetyAnalysis);
        onSafetyData?.(safetyAnalysis);
      }
    } catch (error) {
      console.error('Failed to load safety analysis:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!analysis && !isLoading) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="absolute bottom-4 left-4 z-20 bg-white rounded-lg shadow-lg p-3 border border-gray-200">
        <div className="flex items-center gap-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
          <span className="text-xs text-gray-600">Analyzing route safety...</span>
        </div>
      </div>
    );
  }

  if (!analysis) return null;

  const getSafetyColor = (level: string) => {
    switch (level) {
      case 'safe': return 'text-green-600 bg-green-50 border-green-200';
      case 'moderate': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'caution': return 'text-amber-600 bg-amber-50 border-amber-200';
      case 'unsafe': return 'text-red-600 bg-red-50 border-red-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getSafetyIcon = (level: string) => {
    switch (level) {
      case 'safe': return <CheckCircle className="w-4 h-4" />;
      case 'moderate': return <Info className="w-4 h-4" />;
      case 'caution': return <AlertTriangle className="w-4 h-4" />;
      case 'unsafe': return <Shield className="w-4 h-4" />;
      default: return <Info className="w-4 h-4" />;
    }
  };

  return (
    <div className="absolute bottom-4 left-4 z-20 bg-white rounded-lg shadow-lg border border-gray-200 w-80 max-h-96 overflow-y-auto">
      {/* Header */}
      <div className={`p-3 border-b border-gray-200 ${getSafetyColor(analysis.overallSafety)}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getSafetyIcon(analysis.overallSafety)}
            <div>
              <p className="text-xs font-semibold uppercase">Route Safety</p>
              <p className="text-sm font-medium capitalize">{analysis.overallSafety}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-right">
              <p className="text-lg font-bold">{analysis.safetyScore}/100</p>
              <p className="text-xs opacity-75">Safety Score</p>
            </div>
            {onClose && (
              <button
                onClick={onClose}
                className="p-1 hover:bg-white/20 rounded transition ml-2"
                title="Close Safety Info"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Warnings */}
      {analysis.warnings.length > 0 && (
        <div className="p-3 border-b border-gray-200 bg-amber-50">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-xs font-semibold text-amber-900 mb-1">Warnings:</p>
              <ul className="text-xs text-amber-800 space-y-1">
                {analysis.warnings.map((warning, index) => (
                  <li key={index}>• {warning}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Safety Factors */}
      <div className="p-3 border-b border-gray-200">
        <p className="text-xs font-semibold text-gray-700 mb-2">Safety Factors:</p>
        <div className="space-y-2">
          {analysis.segments.slice(0, 3).map((segment, index) => (
            <div key={segment.id} className="text-xs">
              <div className="flex items-center gap-2 mb-1">
                <div className={`w-2 h-2 rounded-full ${
                  segment.safetyLevel === 'safe' ? 'bg-green-500' :
                  segment.safetyLevel === 'moderate' ? 'bg-blue-500' :
                  segment.safetyLevel === 'caution' ? 'bg-amber-500' :
                  'bg-red-500'
                }`} />
                <span className="font-medium capitalize">{segment.safetyLevel}</span>
              </div>
              <div className="pl-4 space-y-1 text-gray-600">
                {segment.factors.lighting === 'well-lit' && (
                  <div className="flex items-center gap-1">
                    <Lightbulb className="w-3 h-3" />
                    <span>Well-lit area</span>
                  </div>
                )}
                {segment.factors.construction && (
                  <div className="flex items-center gap-1">
                    <Construction className="w-3 h-3" />
                    <span>Construction zone</span>
                  </div>
                )}
                {segment.factors.accessibility === 'accessible' && (
                  <div className="flex items-center gap-1">
                    <Accessibility className="w-3 h-3" />
                    <span>Wheelchair accessible</span>
                  </div>
                )}
                {segment.factors.crimeRisk === 'low' && (
                  <div className="flex items-center gap-1">
                    <Shield className="w-3 h-3" />
                    <span>Low crime risk</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recommendations */}
      {analysis.recommendations.length > 0 && (
        <div className="p-3 bg-blue-50">
          <p className="text-xs font-semibold text-blue-900 mb-1">Recommendations:</p>
          <ul className="text-xs text-blue-800 space-y-1">
            {analysis.recommendations.map((rec, index) => (
              <li key={index}>• {rec}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

