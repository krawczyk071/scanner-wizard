export interface Location {
  id: string;
  city: string;
  subarea?: string; // Voivodeship
  country: string;
  street?: string; // Optional for better precision
  lat: number;
  lon: number;
}

const STORAGE_KEY = 'scanner_wizard_locations';

export function getSavedLocations(): Location[] {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return [];
  try {
    return JSON.parse(stored);
  } catch (e) {
    console.error('Failed to parse locations from localStorage', e);
    return [];
  }
}

export function saveLocation(location: Location): void {
  const locations = getSavedLocations();
  const index = locations.findIndex(l => l.id === location.id);
  if (index >= 0) {
    locations[index] = location;
  } else {
    locations.push(location);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(locations));
  // Dispatch custom event to notify components
  window.dispatchEvent(new Event('locations_changed'));
}

export function deleteLocation(id: string): void {
  const locations = getSavedLocations().filter(l => l.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(locations));
  // Dispatch custom event to notify components
  window.dispatchEvent(new Event('locations_changed'));
}
