import coords from '../data/zip_coords.json' with { type: 'json' };

type Coord = { lat: number; lng: number };

const DATA = coords as Record<string, Coord>;

export function getCoordsFromZip(zip: string): Coord | null {
  if (!zip) return null;
  const padded = String(zip).trim().padStart(5, '0').slice(0, 5);
  return DATA[padded] ?? null;
}
