import L from "leaflet";

delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: string })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

export const iconMap: Record<string, string> = {
  pharmacy: "P",
  restaurant: "R",
  hospital: "H",
  bank: "B",
  metro: "M",
  bus: "B",
  tram: "T",
  bike_station: "C",
  playbook: "N",
  highlight: "*",
  historical: "H",
  landmark: "L",
  viewpoint: "V",
  thermal_bath: "S",
  spa: "S",
  default: "+",
  destination: "D",
  user: "U",
  vehicle_bus: "B",
  vehicle_tram: "T",
  vehicle_metro: "M",
  vehicle_trolley: "Y",
};

export function createCustomIcon(type: string, color: string, size = 28) {
  const icon = iconMap[type] || iconMap.default;
  return L.divIcon({
    className: "custom-marker",
    html: `<div style="
      background-color: ${color};
      width: ${size}px;
      height: ${size}px;
      border-radius: 50%;
      border: 2px solid white;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: ${Math.max(10, size * 0.4)}px;
      font-weight: 700;
      line-height: 1;
    ">${icon}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

export const mapIcons = {
  pharmacy: createCustomIcon("pharmacy", "#10b981"),
  restaurant: createCustomIcon("restaurant", "#f59e0b"),
  hospital: createCustomIcon("hospital", "#ef4444"),
  bank: createCustomIcon("bank", "#3b82f6"),
  metro: createCustomIcon("metro", "#dc2626"),
  bus: createCustomIcon("bus", "#2563eb"),
  tram: createCustomIcon("tram", "#059669"),
  bike_station: createCustomIcon("bike_station", "#7c3aed"),
  playbook: createCustomIcon("playbook", "#0ea5e9"),
  highlight: createCustomIcon("highlight", "#ec4899"),
  historical: createCustomIcon("historical", "#9333ea"),
  landmark: createCustomIcon("landmark", "#f97316"),
  viewpoint: createCustomIcon("viewpoint", "#22d3ee"),
  thermal_bath: createCustomIcon("thermal_bath", "#f97316", 32),
  spa: createCustomIcon("spa", "#f97316", 32),
  default: createCustomIcon("default", "#6b7280"),
  destination: createCustomIcon("destination", "#8b5cf6"),
  user: createCustomIcon("user", "#06b6d4"),
  vehicle_bus: createCustomIcon("vehicle_bus", "#2563eb", 32),
  vehicle_tram: createCustomIcon("vehicle_tram", "#059669", 32),
  vehicle_metro: createCustomIcon("vehicle_metro", "#dc2626", 32),
  vehicle_trolley: createCustomIcon("vehicle_trolley", "#7c3aed", 32),
};

export function iconForType(type?: string) {
  if (!type) return mapIcons.default;
  return mapIcons[type as keyof typeof mapIcons] || mapIcons.default;
}
