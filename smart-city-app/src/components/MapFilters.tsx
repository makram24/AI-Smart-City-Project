"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { 
  Filter, 
  MapPin, 
  Utensils, 
  Pill, 
  Building, 
  Car, 
  Bike,
  X
} from "lucide-react";

interface MapFiltersProps {
  onFiltersChange: (filters: {
    categories: string[];
    maxDistance: number;
  }) => void;
  userLocation: { lat: number; lng: number } | null;
}

const categoryIcons = {
  restaurant: Utensils,
  pharmacy: Pill,
  bank: Building,
  hospital: Pill,
  metro: Car,
  bus: Car,
  tram: Car,
  bike_station: Bike,
};

const categoryLabels = {
  restaurant: "Restaurants",
  pharmacy: "Pharmacies", 
  bank: "Banks",
  hospital: "Hospitals",
  metro: "Metro",
  bus: "Bus",
  tram: "Tram",
  bike_station: "Bike Stations",
};

export default function MapFilters({ onFiltersChange, userLocation }: MapFiltersProps) {
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [maxDistance, setMaxDistance] = useState<number>(2); // km
  const [isOpen, setIsOpen] = useState(false);

  const handleCategoryToggle = (category: string) => {
    const newCategories = selectedCategories.includes(category)
      ? selectedCategories.filter(c => c !== category)
      : [...selectedCategories, category];
    
    setSelectedCategories(newCategories);
    onFiltersChange({
      categories: newCategories,
      maxDistance
    });
  };

  const handleDistanceChange = (value: number[]) => {
    const newDistance = value[0];
    setMaxDistance(newDistance);
    onFiltersChange({
      categories: selectedCategories,
      maxDistance: newDistance
    });
  };

  const clearFilters = () => {
    setSelectedCategories([]);
    setMaxDistance(2);
    onFiltersChange({
      categories: [],
      maxDistance: 2
    });
  };

  const availableCategories = Object.keys(categoryLabels);

  return (
    <div className="absolute top-4 left-4 z-10">
      <Button
        onClick={() => setIsOpen(!isOpen)}
        className="bg-white text-gray-700 hover:bg-gray-50 shadow-lg"
        size="sm"
      >
        <Filter className="w-4 h-4 mr-2" />
        Filters
        {selectedCategories.length > 0 && (
          <span className="ml-2 bg-blue-500 text-white rounded-full px-2 py-1 text-xs">
            {selectedCategories.length}
          </span>
        )}
      </Button>

      {isOpen && (
        <div className="absolute top-12 left-0 bg-white rounded-lg shadow-lg p-4 w-80 border">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Map Filters</h3>
            <Button
              onClick={() => setIsOpen(false)}
              variant="ghost"
              size="sm"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Distance Filter */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Max Distance: {maxDistance} km
            </label>
            <Slider
              value={[maxDistance]}
              onValueChange={handleDistanceChange}
              max={10}
              min={0.5}
              step={0.5}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>0.5 km</span>
              <span>10 km</span>
            </div>
          </div>

          {/* Category Filters */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Categories
            </label>
            <div className="grid grid-cols-2 gap-2">
              {availableCategories.map((category) => {
                const Icon = categoryIcons[category as keyof typeof categoryIcons];
                const isSelected = selectedCategories.includes(category);
                
                return (
                  <Button
                    key={category}
                    onClick={() => handleCategoryToggle(category)}
                    variant={isSelected ? "default" : "outline"}
                    size="sm"
                    className="justify-start text-xs"
                  >
                    <Icon className="w-3 h-3 mr-2" />
                    {categoryLabels[category as keyof typeof categoryLabels]}
                  </Button>
                );
              })}
            </div>
          </div>

          {/* Clear Filters */}
          <Button
            onClick={clearFilters}
            variant="outline"
            size="sm"
            className="w-full"
          >
            Clear All Filters
          </Button>

          {/* Status */}
          {!userLocation && (
            <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
              <MapPin className="w-3 h-3 inline mr-1" />
              Location access needed for distance filtering
            </div>
          )}
        </div>
      )}
    </div>
  );
}
