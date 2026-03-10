export interface NominatimResult {
  place_id: number;
  licence: string;
  osm_type: string;
  osm_id: number;
  boundingbox: string[];
  lat: string;
  lon: string;
  display_name: string;
  class: string;
  type: string;
  importance: number;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    state?: string;
    country?: string;
    road?: string;
  };
}

export async function searchLocation(
  city: string,
  subarea?: string,
  street?: string
): Promise<NominatimResult[]> {
  const country = 'Poland';
  const queryParts = [];
  
  if (street) queryParts.push(street);
  queryParts.push(city);
  if (subarea) queryParts.push(subarea);
  queryParts.push(country);
  
  const q = queryParts.join(', ');
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&addressdetails=1&limit=5`;
  
  try {
    const response = await fetch(url, {
      headers: {
        'Accept-Language': 'pl,en'
      }
    });
    if (!response.ok) throw new Error('Nominatim request failed');
    return await response.json();
  } catch (err) {
    console.error('Geocoding error:', err);
    return [];
  }
}
