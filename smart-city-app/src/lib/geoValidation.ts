export const BUDAPEST_BOUNDS = {
  latMin: 47.3,
  latMax: 47.7,
  lngMin: 18.9,
  lngMax: 19.4
} as const;

export type Coordinate = [number, number];

export const isWithinBudapest = (lat: number, lng: number): boolean => {
  return (
    lat >= BUDAPEST_BOUNDS.latMin &&
    lat <= BUDAPEST_BOUNDS.latMax &&
    lng >= BUDAPEST_BOUNDS.lngMin &&
    lng <= BUDAPEST_BOUNDS.lngMax
  );
};

export const normalizeCoordinate = (coord: Coordinate | null | undefined): Coordinate | null => {
  if (!coord || coord.length < 2) {
    return null;
  }

  let [lat, lng] = coord;

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  if (!isWithinBudapest(lat, lng) && isWithinBudapest(lng, lat)) {
    [lat, lng] = [lng, lat];
  }

  return isWithinBudapest(lat, lng) ? [lat, lng] : null;
};

