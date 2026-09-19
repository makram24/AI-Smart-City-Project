import { describe, expect, it } from 'vitest';
import { isWithinBudapest, normalizeCoordinate } from './geoValidation';

describe('geoValidation', () => {
  it('isWithinBudapest is true for central Budapest', () => {
    expect(isWithinBudapest(47.4979, 19.0402)).toBe(true);
  });

  it('isWithinBudapest is false for London', () => {
    expect(isWithinBudapest(51.5074, -0.1278)).toBe(false);
  });

  it('normalizeCoordinate swaps lat/lng when needed', () => {
    expect(normalizeCoordinate([19.0402, 47.4979])).toEqual([47.4979, 19.0402]);
  });
});
