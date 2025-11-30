"use client";

import { memo } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PlaybookSummary } from "@/lib/api";

interface NeighborhoodPlaybooksProps {
  playbooks: PlaybookSummary[];
  selectedId?: string | null;
  loadingId?: string | null;
  disabled?: boolean;
  onSelect: (id: string) => void;
}

function NeighborhoodPlaybooksComponent({
  playbooks,
  selectedId,
  loadingId,
  disabled,
  onSelect,
  onClose
}: NeighborhoodPlaybooksProps) {
  return (
    <div className="absolute bottom-6 left-4 z-20 w-80">
      <div className="bg-white/95 backdrop-blur rounded-xl shadow-2xl border border-gray-100">
        <div className="p-4 border-b border-gray-100 flex items-start justify-between">
          <div className="flex-1">
            <p className="text-[11px] uppercase tracking-wide text-blue-500 font-semibold">
              Neighborhood Playbooks
            </p>
            <h3 className="text-sm font-semibold text-gray-900">
              Curated routines for Budapest
            </h3>
            <p className="text-xs text-gray-500">
              Tap to load markers, story, and route.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-yellow-500" />
            {onClose && (
              <button
                onClick={onClose}
                className="p-1 hover:bg-gray-100 rounded transition"
                title="Close Playbooks"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        <div className="max-h-80 overflow-y-auto divide-y divide-gray-100">
          {playbooks.length === 0 && (
            <div className="p-4 text-xs text-gray-500">
              {disabled
                ? "Playbooks need the backend connection."
                : "Fetching curated flows…"}
            </div>
          )}

          {playbooks.map((playbook) => {
            const isActive = playbook.id === selectedId;
            return (
              <div
                key={playbook.id}
                className={`p-4 transition-colors ${
                  isActive ? "bg-blue-50/80" : "bg-white"
                }`}
              >
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  {playbook.persona}
                </div>
                <h4 className="text-base font-semibold text-gray-900 leading-tight">
                  {playbook.title}
                </h4>
                <p className="text-sm text-gray-600 mt-1">{playbook.tagline}</p>
                <div className="flex items-center text-xs text-gray-500 mt-2 gap-3">
                  <span>{playbook.durationLabel}</span>
                  <span>•</span>
                  <span>{playbook.focusArea}</span>
                </div>
                <div className="flex flex-wrap gap-1 mt-3">
                  {playbook.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <Button
                  size="sm"
                  disabled={disabled}
                  className={`mt-4 w-full ${
                    isActive ? "bg-blue-600 hover:bg-blue-600" : ""
                  }`}
                  onClick={() => onSelect(playbook.id)}
                >
                  {isActive ? (
                    "Active"
                  ) : loadingId === playbook.id ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Loading
                    </span>
                  ) : (
                    "Load this playbook"
                  )}
                </Button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export const NeighborhoodPlaybooks = memo(NeighborhoodPlaybooksComponent);

