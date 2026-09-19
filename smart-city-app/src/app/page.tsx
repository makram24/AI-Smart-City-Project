"use client";

import dynamic from "next/dynamic";
import Chat from "@/components/Chat";
import TransportPanel from "@/components/TransportPanel";
import MapFilters from "@/components/MapFilters";
import { NeighborhoodPlaybooks } from "@/components/NeighborhoodPlaybooks";
import Moodboard from "@/components/Moodboard";
import StoryCardComponent from "@/components/StoryCard";
import RouteSafetyIndicator from "@/components/RouteSafetyIndicator";
import { useSmartCityApp } from "@/hooks/useSmartCityApp";

const Map = dynamic(() => import("@/components/Map"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center bg-gray-100">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
        <p className="text-gray-600">Loading map...</p>
      </div>
    </div>
  ),
});

export default function Home() {
  const app = useSmartCityApp();

  return (
    <div className="h-screen flex flex-col md:flex-row overflow-hidden">
      <div className="flex-1 min-h-[45vh] md:min-h-0 md:h-full relative">
        <Map
          center={app.userLocation ? [app.userLocation.lat, app.userLocation.lng] : [47.4979, 19.0402]}
          zoom={13}
          markers={app.mapMarkers}
          route={app.currentRoute || undefined}
          vehicles={app.vehicles}
          routeShapes={app.routeShapes}
          safetyAnalysis={app.routeSafetyAnalysis || undefined}
          constructionZones={app.constructionZones}
          filters={app.mapFilters}
          onMarkerClick={(position) => {
            if (app.userLocation) {
              app.handleRouteRequest("walking", `${position[0]},${position[1]}`);
            }
          }}
        />
        {app.currentRoute?.polyline &&
          app.currentRoute.polyline.length >= 2 &&
          app.currentRoute.mode !== "public_transport" && (
            <RouteSafetyIndicator
              routePolyline={app.currentRoute.polyline}
              onSafetyData={app.handleSafetyData}
            />
          )}
        {app.isMapFiltersVisible ? (
          <MapFilters
            onFiltersChange={app.setMapFilters}
            userLocation={app.userLocation}
            onClose={() => app.setIsMapFiltersVisible(false)}
          />
        ) : (
          <button
            onClick={() => app.setIsMapFiltersVisible(true)}
            className="absolute top-4 left-4 z-20 bg-white rounded-full px-3 py-2 text-sm shadow-lg"
            title="Show map filters"
          >
            Filters
          </button>
        )}
        {app.isPlaybooksVisible ? (
          <NeighborhoodPlaybooks
            playbooks={app.playbooks}
            selectedId={app.selectedPlaybook?.id || null}
            loadingId={app.loadingPlaybookId}
            disabled={!app.apiConnected}
            onSelect={app.handlePlaybookSelect}
            onClose={() => app.setIsPlaybooksVisible(false)}
          />
        ) : (
          <button
            onClick={() => app.setIsPlaybooksVisible(true)}
            className="absolute bottom-6 left-4 z-20 bg-white rounded-full px-3 py-2 text-sm shadow-lg"
            title="Show neighborhood playbooks"
          >
            Playbooks
          </button>
        )}
        {app.apiConnected && (
          <Moodboard
            userLocation={app.userLocation}
            onSuggestionAction={app.handleMoodboardSuggestion}
            onWeatherClick={app.handleWeatherClick}
            onTransportClick={app.handleTransportDisruptions}
          />
        )}
        {app.activeStory && (
          <StoryCardComponent
            story={app.activeStory}
            onClose={() => app.setActiveStory(null)}
            onNavigate={app.showStoryOnMap}
          />
        )}
      </div>

      {app.isTransportPanelVisible ? (
        <div className="w-full md:w-80 h-64 md:h-full shrink-0">
          <TransportPanel
            userLocation={app.userLocation}
            onRouteRequest={app.handleRouteRequest}
            onClose={() => app.setIsTransportPanelVisible(false)}
            onTransportStopsChange={app.handleTransportStopsChange}
            onBikeStationsChange={app.handleBikeStationsChange}
            onStopSelect={app.handleStopSelect}
            onRouteSelect={app.handleRouteSelect}
          />
        </div>
      ) : (
        <button
          onClick={() => app.setIsTransportPanelVisible(true)}
          className="md:absolute md:top-1/2 md:left-0 md:-translate-y-1/2 z-20 bg-white rounded-full px-3 py-2 text-sm shadow-lg md:ml-2"
          title="Show transport panel"
        >
          Transport
        </button>
      )}

      {app.isChatVisible ? (
        <div className="w-full md:w-96 h-80 md:h-full relative flex flex-col shrink-0">
          <div className="flex-1 min-h-0">
            <Chat
              onSendMessage={app.handleSendMessage}
              messages={app.messages}
              isLoading={app.isLoading}
              persona={app.activePersona}
              onPersonaPrompt={app.handlePersonaPrompt}
              isPlaybookActive={!!app.selectedPlaybook}
              onClose={() => app.setIsChatVisible(false)}
            />
          </div>
          {app.selectedPlaybook && (
            <div className="border-t border-border bg-white p-4 space-y-3">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-blue-500 font-semibold">
                  {app.selectedPlaybook.persona}
                </p>
                <h3 className="text-sm font-semibold text-gray-900">{app.selectedPlaybook.title}</h3>
                <p className="text-xs text-gray-500">{app.selectedPlaybook.mood}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {app.selectedPlaybook.recommendedPrompts.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => app.handlePlaybookPrompt(prompt)}
                    className="text-xs px-3 py-1 rounded-full border border-gray-200 text-gray-700 hover:bg-gray-50"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="absolute bottom-2 right-2">
            <div
              className={`w-3 h-3 rounded-full ${app.apiConnected ? "bg-green-500" : "bg-yellow-500"}`}
              title={app.apiConnected ? "Backend connected" : "Using mock data"}
            />
          </div>
        </div>
      ) : (
        <button
          onClick={() => app.setIsChatVisible(true)}
          className="md:absolute md:top-1/2 md:right-0 md:-translate-y-1/2 z-20 bg-white rounded-full px-3 py-2 text-sm shadow-lg md:mr-2"
          title="Show chat"
        >
          Chat
        </button>
      )}
    </div>
  );
}
