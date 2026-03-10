import { useState, useEffect } from 'react';
import { X, MapPin, Trash2, Plus, Loader2, Check, ExternalLink } from 'lucide-react';
import { type Location, getSavedLocations, saveLocation, deleteLocation } from '../utils/locationStorage';
import { searchLocation, type NominatimResult } from '../utils/geocoding';
import { v4 as uuidv4 } from 'uuid';

interface LocationSettingsProps {
  onClose: () => void;
}

export function LocationSettings({ onClose }: LocationSettingsProps) {
  const [locations, setLocations] = useState<Location[]>([]);
  const [searchCity, setSearchCity] = useState('');
  const [searchSubarea, setSearchSubarea] = useState('');
  const [searchStreet, setSearchStreet] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<NominatimResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLocations(getSavedLocations());
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchCity) {
      setError('City is required');
      return;
    }
    
    setError(null);
    setIsSearching(true);
    setSearchResults([]);
    
    try {
      const results = await searchLocation(searchCity, searchSubarea, searchStreet);
      setSearchResults(results);
      if (results.length === 0) {
        setError('No locations found. Try adjusting your search.');
      }
    } catch (err) {
      setError('Search failed. Please check your connection.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddLocation = (res: NominatimResult) => {
    // Attempt to extract street/road from address if not provided by user
    const finalStreet = searchStreet || res.address?.road || '';
    
    const newLoc: Location = {
      id: uuidv4(),
      city: res.address?.city || res.address?.town || res.address?.village || searchCity,
      subarea: res.address?.state || searchSubarea || '',
      country: res.address?.country || 'Poland',
      street: finalStreet,
      lat: parseFloat(res.lat),
      lon: parseFloat(res.lon)
    };
    
    saveLocation(newLoc);
    setLocations(getSavedLocations());
    setSearchResults([]);
    setSearchCity('');
    setSearchSubarea('');
    setSearchStreet('');
  };

  const handleDelete = (id: string) => {
    deleteLocation(id);
    setLocations(getSavedLocations());
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-neutral-800">
          <div className="flex items-center gap-2">
            <MapPin className="text-blue-500" size={20} />
            <h2 className="text-lg font-bold text-white uppercase tracking-tight">Location Management</h2>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-neutral-800 rounded-lg text-neutral-400 hover:text-white transition-colors border-none"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {/* Search Form */}
          <section className="space-y-4">
            <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Find New Location</h3>
            <form onSubmit={handleSearch} className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="md:col-span-1">
                 <input 
                  type="text"
                  placeholder="Street (Opt.)"
                  value={searchStreet}
                  onChange={(e) => setSearchStreet(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-neutral-200 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="md:col-span-1">
                <input 
                  type="text"
                  placeholder="City *"
                  value={searchCity}
                  required
                  onChange={(e) => setSearchCity(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-neutral-200 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="md:col-span-1">
                <input 
                  type="text"
                  placeholder="Voivodeship (Opt.)"
                  value={searchSubarea}
                  onChange={(e) => setSearchSubarea(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-neutral-200 focus:outline-none focus:border-blue-500"
                />
              </div>
              <button 
                type="submit"
                disabled={isSearching}
                className="bg-blue-600 hover:bg-blue-500 disabled:bg-neutral-800 text-white rounded-lg px-4 py-2 flex items-center justify-center gap-2 transition-all font-bold text-sm border-none"
              >
                {isSearching ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                {isSearching ? 'Searching...' : 'Add'}
              </button>
            </form>

            {error && <p className="text-xs text-red-500 px-1">{error}</p>}

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="bg-neutral-950 border border-neutral-800 rounded-lg divide-y divide-neutral-800">
                {searchResults.map((res) => (
                  <div key={res.place_id} className="p-3 flex items-center justify-between hover:bg-neutral-900 transition-colors">
                    <div className="flex-1 min-w-0 pr-4">
                      <p className="text-sm text-neutral-200 font-medium truncate">{res.display_name}</p>
                      <p className="text-[10px] text-neutral-500 font-mono">
                        {parseFloat(res.lat).toFixed(4)}, {parseFloat(res.lon).toFixed(4)}
                      </p>
                    </div>
                    <button 
                      onClick={() => handleAddLocation(res)}
                      className="shrink-0 p-2 bg-neutral-800 hover:bg-blue-600 text-neutral-400 hover:text-white rounded-lg transition-all border-none"
                      title="Add this location"
                    >
                      <Check size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Saved Locations */}
          <section className="space-y-4">
            <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Saved Locations</h3>
            {locations.length === 0 ? (
               <div className="text-center py-10 border-2 border-dashed border-neutral-800 rounded-xl">
                 <p className="text-sm text-neutral-600">No locations saved yet.</p>
               </div>
            ) : (
              <div className="grid grid-cols-1 gap-2">
                {locations.map((loc) => (
                  <div key={loc.id} className="group bg-neutral-950/50 border border-neutral-800 rounded-xl p-4 flex items-center justify-between hover:border-neutral-700 transition-all">
                    <a 
                      href={`https://www.google.com/maps/search/?api=1&query=${loc.lat},${loc.lon}&z=10`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 space-y-1 group/link cursor-pointer no-underline"
                      title="View on Google Maps"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-neutral-200 capitalize group-hover/link:text-blue-400 transition-colors">{loc.city}</span>
                        {loc.subarea && (
                          <span className="text-[10px] bg-neutral-800 text-neutral-400 px-2 py-0.5 rounded-full uppercase tracking-widest font-bold">
                            {loc.subarea}
                          </span>
                        )}
                        <ExternalLink size={12} className="opacity-0 group-hover/link:opacity-100 text-blue-500 transition-all" />
                      </div>
                      {loc.street && <p className="text-[11px] text-neutral-400">{loc.street}</p>}
                      <p className="text-[10px] text-neutral-600 font-mono">{loc.lat.toFixed(6)}, {loc.lon.toFixed(6)}</p>
                    </a>
                    <button 
                      onClick={() => handleDelete(loc.id)}
                      className="p-2 text-neutral-600 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all border-none ml-4"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="p-4 bg-neutral-950/50 border-t border-neutral-800 text-[10px] text-neutral-500 text-center font-medium uppercase tracking-widest">
          Nominatim API usage must comply with search policy (Limit 1 req/sec)
        </div>
      </div>
    </div>
  );
}
