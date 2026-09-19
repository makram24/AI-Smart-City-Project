import { describe, expect, it } from 'vitest';
import { decodePolyline } from './decodePolyline';

describe('decodePolyline', () => {
  it('returns an empty array for an empty string', () => {
    expect(decodePolyline('')).toEqual([]);
  });

  it('is exported and returns an array of coordinates', () => {
    const result = decodePolyline('_p~iF~ps|U');
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0][0]).toBeCloseTo(38.5, 1);
    expect(result[0][1]).toBeCloseTo(-120.2, 1);
  });
});
