import { useState, useMemo } from 'react';
import { 
  ArrowLeft, 
  Trash2, 
  Calendar, 
  MapPin, 
  Search, 
  CheckSquare, 
  Square,
  SortAsc,
  SortDesc,
  X,
  Loader2,
  FileText,
  Save,
  CheckCircle2,
  ImagePlus
} from 'lucide-react';
import * as piexif from 'piexifjs';
import { type Location, getSavedLocations } from '../utils/locationStorage';
import { v4 as uuidv4 } from 'uuid';

interface BulkImageItem {
  id: string;
  file: File;
  handle?: any; // FileSystemFileHandle
  previewUrl: string;
  exifDate?: string; // DDMMYY
  exifLocation?: string; // City/Location
  exifDescription?: string; // ImageDescription
  location?: Location;
  selected: boolean;
  filename: string;
}

interface ExifBulkEditorProps {
  onBack: () => void;
}

export function ExifBulkEditor({ onBack }: ExifBulkEditorProps) {
  const [items, setItems] = useState<BulkImageItem[]>([]);
  const [filter, setFilter] = useState('');
  const [sortBy, setSortBy] = useState<'filename' | 'date' | 'location' | 'description'>('filename');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Bulk edit form states
  const [bulkDate, setBulkDate] = useState('');
  const [bulkLocation, setBulkLocation] = useState<Location | null>(null);
  const [bulkCity, setBulkCity] = useState('');
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  const [locationSearch, setLocationSearch] = useState('');

  const savedLocations = getSavedLocations();

  const handleFileSelection = async () => {
    try {
      // @ts-expect-error File System Access API
      const handles = await window.showOpenFilePicker({
        multiple: true,
        types: [{
          description: 'Images',
          accept: { 'image/jpeg': ['.jpg', '.jpeg'] }
        }]
      });

      setIsProcessing(true);
      const newItems: BulkImageItem[] = await Promise.all(
        handles.map(async (handle: any) => {
          const file = await handle.getFile();
          const id = uuidv4();
          const previewUrl = URL.createObjectURL(file);
          
          let exifDate = '';
          let exifLocation = '';
          let exifDescription = '';
          
          try {
            const reader = new FileReader();
            const data = await new Promise<string>((resolve) => {
              reader.onload = (e) => resolve(e.target?.result as string);
              reader.readAsDataURL(file);
            });
            
            const exifObj = piexif.load(data);
            const dateTime = exifObj['0th'][piexif.ImageIFD.DateTime] || exifObj['Exif'][piexif.ExifIFD.DateTimeOriginal];
            if (dateTime) {
              const match = dateTime.match(/^(\d{4}):(\d{2}):(\d{2})/);
              if (match) {
                exifDate = `${match[3]}${match[2]}${match[1].substring(2)}`;
              }
            }
            
            exifDescription = exifObj['0th'][piexif.ImageIFD.ImageDescription] || '';
            if (exifDescription) {
               try {
                 exifDescription = decodeURIComponent(escape(exifDescription));
                 exifLocation = exifDescription;
               } catch { /* ignore */ }
            }
          } catch (err) {
            console.error('Error reading EXIF for', file.name, err);
          }

          return {
            id,
            file,
            handle,
            previewUrl,
            exifDate,
            exifLocation,
            exifDescription,
            selected: false,
            filename: file.name,
          };
        })
      );

      setItems((prev) => [...prev, ...newItems]);
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        console.error('File picker error:', err);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleSelect = (id: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, selected: !item.selected } : item
      )
    );
  };

  const toggleSelectAll = () => {
    const allSelected = filteredItems.every((item) => item.selected);
    setItems((prev) =>
      prev.map((item) =>
        filteredItems.find((f) => f.id === item.id)
          ? { ...item, selected: !allSelected }
          : item
      )
    );
  };

  const removeSelected = () => {
    setItems((prev) => {
      const remaining = prev.filter((item) => !item.selected);
      // Revoke URLs for removed items
      prev.forEach((item) => {
        if (item.selected) URL.revokeObjectURL(item.previewUrl);
      });
      return remaining;
    });
  };

  const filteredItems = useMemo(() => {
    const result = items.filter((item) =>
      item.filename.toLowerCase().includes(filter.toLowerCase()) ||
      (item.exifDate && item.exifDate.includes(filter)) ||
      (item.exifLocation && item.exifLocation.toLowerCase().includes(filter.toLowerCase()))
    );

    result.sort((a, b) => {
      let valA = '';
      let valB = '';

      if (sortBy === 'filename') {
        valA = a.filename;
        valB = b.filename;
      } else if (sortBy === 'date') {
        valA = a.exifDate || '';
        valB = b.exifDate || '';
      } else if (sortBy === 'location') {
        valA = a.exifLocation || '';
        valB = b.exifLocation || '';
      } else if (sortBy === 'description') {
        valA = a.exifDescription || '';
        valB = b.exifDescription || '';
      }

      const cmp = valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' });
      return sortOrder === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [items, filter, sortBy, sortOrder]);

  const selectedCount = items.filter((item) => item.selected).length;

  const generateNewFilename = (originalName: string, dateStr: string) => {
    if (!/^\d{6}$/.test(dateStr)) return originalName;
    
    const yearYY = parseInt(dateStr.substring(4, 6));
    const currentYY = new Date().getFullYear() % 100;
    const year = (yearYY > currentYY ? 1900 : 2000) + yearYY;
    const month = dateStr.substring(2, 4);
    const day = dateStr.substring(0, 2);
    const datePart = `${year}${month}${day}`;
    
    // Check if the filename already has the YYYYMMDD_ pattern
    const pattern = /^(\d{8})_(\d{4})\./;
    const match = originalName.match(pattern);
    const extension = originalName.split('.').pop() || 'jpg';
    
    if (match) {
      const randomPart = match[2];
      return `${datePart}_${randomPart}.${extension}`;
    } else {
      const randomPart = Math.floor(1000 + Math.random() * 9000).toString();
      return `${datePart}_${randomPart}.${extension}`;
    }
  };

  const handleBulkUpdate = async () => {
    if (selectedCount === 0) return;
    setIsProcessing(true);

    try {
      const updatedItems = await Promise.all(
        items.map(async (item) => {
          if (!item.selected) return item;

          const reader = new FileReader();
          const data = await new Promise<string>((resolve) => {
            reader.onload = (e) => resolve(e.target?.result as string);
            reader.readAsDataURL(item.file);
          });

          const exifObj = piexif.load(data);
          
          // Update Date
          if (bulkDate && /^\d{6}$/.test(bulkDate)) {
            const yearYY = parseInt(bulkDate.substring(4, 6));
            const currentYY = new Date().getFullYear() % 100;
            const year = (yearYY > currentYY ? 1900 : 2000) + yearYY;
            const month = bulkDate.substring(2, 4);
            const day = bulkDate.substring(0, 2);
            const isoDate = `${year}:${month}:${day} 00:00:00`;
            exifObj['0th'][piexif.ImageIFD.DateTime] = isoDate;
            exifObj['Exif'][piexif.ExifIFD.DateTimeOriginal] = isoDate;
          }

          // Update Location
          const finalCity = bulkLocation?.city || bulkCity;
          if (finalCity) {
            try {
              exifObj['0th'][piexif.ImageIFD.ImageDescription] = unescape(encodeURIComponent(finalCity));
            } catch {
              exifObj['0th'][piexif.ImageIFD.ImageDescription] = finalCity.replace(/[^\x20-\x7E]/g, '?');
            }
          }

          if (bulkLocation) {
            const degToExifRational = (deg: number): [[number, number], [number, number], [number, number]] => {
              const absolute = Math.abs(deg);
              const degrees = Math.floor(absolute);
              const minutesNotTruncated = (absolute - degrees) * 60;
              const minutes = Math.floor(minutesNotTruncated);
              const seconds = Math.floor((minutesNotTruncated - minutes) * 60 * 100);
              return [[degrees, 1], [minutes, 1], [seconds, 100]];
            };

            exifObj['GPS'][piexif.GPSIFD.GPSLatitudeRef] = bulkLocation.lat >= 0 ? 'N' : 'S';
            exifObj['GPS'][piexif.GPSIFD.GPSLatitude] = degToExifRational(bulkLocation.lat);
            exifObj['GPS'][piexif.GPSIFD.GPSLongitudeRef] = bulkLocation.lon >= 0 ? 'E' : 'W';
            exifObj['GPS'][piexif.GPSIFD.GPSLongitude] = degToExifRational(bulkLocation.lon);
          }

          const exifStr = piexif.dump(exifObj);
          const finalDataUrl = piexif.insert(exifStr, data);

          // Generate new filename if date is updated
          const newFilename = bulkDate ? generateNewFilename(item.filename, bulkDate) : item.filename;

          // Convert back to Blob
          const res = await fetch(finalDataUrl);
          const blob = await res.blob();

          if (item.handle) {
            try {
              console.log('Attempting to overwrite file via handle:', item.filename);
              
              // Try to rename if filename changed
              if (newFilename !== item.filename && item.handle.move) {
                console.log('Renaming file to:', newFilename);
                await item.handle.move(newFilename);
              }

              // Overwrite existing file using File System Access API
              const writable = await item.handle.createWritable({ keepExistingData: false });
              await writable.write(blob);
              await writable.close();
              
              console.log('File successfully overwritten:', newFilename);
              const newFile = await item.handle.getFile();
              return {
                ...item,
                file: newFile,
                handle: item.handle, // Keep the same handle for future edits
                filename: newFilename,
                exifDate: bulkDate || item.exifDate,
                exifLocation: finalCity || item.exifLocation,
                exifDescription: finalCity || item.exifDescription,
                selected: false,
              };
            } catch (err) {
              console.error('CRITICAL: Error updating file on disk:', item.filename, err);
              // Fallback to download if overwrite fails
            }
          }
          
          // Fallback: Trigger download if no handle or update failed
          const link = document.createElement('a');
          link.href = finalDataUrl;
          link.download = newFilename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);

          return {
            ...item,
            file: new File([blob], newFilename, { type: item.file.type }),
            filename: newFilename,
            exifDate: bulkDate || item.exifDate,
            exifLocation: finalCity || item.exifLocation,
            exifDescription: finalCity || item.exifDescription,
            selected: false,
          };
        })
      );

      setItems(updatedItems);
      // Reset bulk form
      setBulkDate('');
      setBulkCity('');
      setBulkLocation(null);
    } catch (err) {
      console.error('Error during bulk update:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredLocations = savedLocations.filter(loc => 
    loc.city.toLowerCase().includes(locationSearch.toLowerCase()) ||
    (loc.street && loc.street.toLowerCase().includes(locationSearch.toLowerCase()))
  );

  return (
    <div className="flex flex-col w-full h-screen bg-neutral-950 text-white overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-neutral-900/50 backdrop-blur-md z-10">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-2 hover:bg-neutral-800 rounded-full transition-colors text-neutral-400 hover:text-white"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-xl font-bold">Exif Bulk Editor</h1>
            <p className="text-xs text-neutral-500">{items.length} images loaded</p>
          </div>
        </div>

        {items.length > 0 && (
          <div className="flex items-center gap-4">
            <div className="relative group/search">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500 group-focus-within/search:text-blue-500 transition-colors pointer-events-none" size={16} />
              <input 
                type="text"
                placeholder="Filter files..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                style={{ paddingLeft: '3rem' }}
                className="w-full bg-neutral-900 border border-neutral-800 rounded-full text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all"
              />
            </div>
            
            <div className="flex items-center gap-2 border-l border-neutral-800 pl-4">
              <span className="text-xs text-neutral-500 uppercase tracking-wider font-bold">Sort:</span>
              <select 
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'filename' | 'date' | 'location' | 'description')}
                className="bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-xs focus:outline-none"
              >
                <option value="filename">Filename</option>
                <option value="date">Date</option>
                <option value="location">Location</option>
                <option value="description">Description</option>
              </select>
              <button 
                onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                className="p-1 hover:bg-neutral-800 rounded transition-colors text-neutral-400"
              >
                {sortOrder === 'asc' ? <SortAsc size={16} /> : <SortDesc size={16} />}
              </button>
            </div>
          </div>
        )}
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Main Content Area */}
        <main className="flex-1 flex flex-col overflow-y-auto p-6 min-w-0">
          {items.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <div 
                className="w-full max-w-2xl aspect-video border-2 border-dashed border-neutral-800 rounded-3xl flex flex-col items-center justify-center bg-neutral-900/20"
              >
                <div className="p-6 bg-neutral-900 rounded-full mb-6">
                  <ImagePlus size={48} className="text-neutral-500" />
                </div>
                <h2 className="text-2xl font-bold mb-2 text-center">Select images to edit Exif</h2>
                <p className="text-neutral-500 mb-8 text-center max-w-md">
                  Using the file picker allows the app to save changes directly to your original files.
                </p>
                <button 
                  onClick={handleFileSelection}
                  className="flex items-center gap-3 px-8 py-4 bg-blue-600 hover:bg-blue-500 rounded-2xl text-lg font-bold transition-all shadow-xl shadow-blue-900/30 transform active:scale-[0.98]"
                >
                  <Save size={24} />
                  <span>Select Files to Edit</span>
                </button>
                <p className="mt-6 text-xs text-neutral-600 uppercase tracking-widest">
                  Only JPG files are supported
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  <button 
                    onClick={toggleSelectAll}
                    className="flex items-center gap-2 px-3 py-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-lg text-sm transition-colors"
                  >
                    {filteredItems.every(i => i.selected) ? <CheckSquare size={16} className="text-blue-500" /> : <Square size={16} />}
                    <span>Select All</span>
                  </button>
                  {selectedCount > 0 && (
                    <button 
                      onClick={removeSelected}
                      className="flex items-center gap-2 px-3 py-2 bg-red-950/20 hover:bg-red-950/40 border border-red-900/30 text-red-400 rounded-lg text-sm transition-colors"
                    >
                      <Trash2 size={16} />
                      <span>Remove Selected ({selectedCount})</span>
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={handleFileSelection}
                    className="flex items-center gap-2 px-4 py-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-lg text-sm font-bold transition-colors"
                  >
                    <Save size={16} className="text-blue-500" />
                    <span>Add More Files</span>
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-start' }}>
                {filteredItems.map((item) => (
                  <div 
                    key={item.id}
                    onClick={() => toggleSelect(item.id)}
                    style={{ width: '75px', display: 'flex', flexDirection: 'column', gap: '6px', cursor: 'pointer' }}
                  >
                    <div 
                      style={{ 
                        width: '75px', 
                        height: '75px', 
                        position: 'relative', 
                        borderRadius: '6px', 
                        overflow: 'hidden', 
                        border: item.selected ? '2px solid #3b82f6' : '2px solid #262626',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <img 
                          src={item.previewUrl} 
                          alt={item.filename}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      
                      <div style={{ position: 'absolute', top: '4px', left: '4px', pointerEvents: 'none' }}>
                        <div style={{ 
                          padding: '2px', 
                          borderRadius: '2px', 
                          backgroundColor: item.selected ? '#3b82f6' : 'rgba(0,0,0,0.5)', 
                          color: 'white',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          {item.selected ? <CheckSquare size={10} /> : <Square size={10} />}
                        </div>
                      </div>
                    </div>

                    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'hidden' }}>
                      <p style={{ 
                        fontSize: '9px', 
                        fontWeight: '700', 
                        margin: 0, 
                        whiteSpace: 'nowrap', 
                        overflow: 'hidden', 
                        textOverflow: 'ellipsis',
                        color: '#d4d4d4'
                      }} title={item.filename}>
                        {item.filename}
                      </p>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#737373', fontSize: '7px' }}>
                          <Calendar size={7} style={{ flexShrink: 0 }} />
                          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.exifDate || 'No date'}</span>
                        </div>
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#737373', fontSize: '7px' }}>
                          <MapPin size={7} style={{ flexShrink: 0 }} />
                          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.exifLocation || 'No location'}</span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#737373', fontSize: '7px' }}>
                          <FileText size={7} style={{ flexShrink: 0 }} />
                          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.exifDescription || 'No description'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </main>

        {/* Sidebar for Bulk Edit */}
        {selectedCount > 0 && (
          <aside className="w-80 border-l border-neutral-800 bg-neutral-900/50 flex flex-col animate-in slide-in-from-right duration-300">
            <div className="p-6 border-b border-neutral-800">
              <h2 className="text-lg font-bold mb-1">Bulk Edit</h2>
              <p className="text-sm text-neutral-500">{selectedCount} images selected</p>
            </div>

            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
              {/* Date Input */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Set New Date (DDMMYY)</label>
                <div className="relative group/date">
                  <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-600 group-focus-within/date:text-blue-500 transition-colors pointer-events-none" size={16} />
                  <input 
                    type="text"
                    placeholder="e.g. 150885"
                    value={bulkDate}
                    onChange={(e) => setBulkDate(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    style={{ paddingLeft: '3rem' }}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg pr-4 py-3 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all"
                  />
                </div>
              </div>

              {/* Location Input */}
              <div className="flex flex-col gap-2 relative">
                <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Set New Location</label>
                <div className="relative group/loc">
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-600 group-focus-within/loc:text-blue-500 transition-colors pointer-events-none" size={16} />
                  <input 
                    type="text"
                    placeholder="Search saved or enter city..."
                    value={locationSearch || bulkCity}
                    onChange={(e) => {
                      setLocationSearch(e.target.value);
                      setBulkCity(e.target.value);
                      setShowLocationDropdown(true);
                    }}
                    onFocus={() => setShowLocationDropdown(true)}
                    style={{ paddingLeft: '3rem' }}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg pr-10 py-3 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all"
                  />
                  {(locationSearch || bulkCity) && (
                    <button 
                      onClick={() => {
                        setLocationSearch('');
                        setBulkCity('');
                        setBulkLocation(null);
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-600 hover:text-neutral-400"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                {showLocationDropdown && (
                  <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-neutral-900 border border-neutral-800 rounded-lg shadow-2xl max-h-60 overflow-y-auto">
                    {filteredLocations.map(loc => (
                      <button
                        key={loc.id}
                        onClick={() => {
                          setBulkLocation(loc);
                          setBulkCity(loc.city);
                          setLocationSearch(loc.city);
                          setShowLocationDropdown(false);
                        }}
                        className="w-full text-left px-4 py-3 hover:bg-neutral-800 transition-colors border-b border-neutral-800 last:border-0"
                      >
                        <div className="flex items-center gap-2">
                          <MapPin size={14} className="text-blue-500 shrink-0" />
                          <span className="text-sm text-neutral-200 font-medium truncate">{loc.street || loc.city}</span>
                        </div>
                        {(loc.street || loc.subarea) && (
                          <div className="pl-6 text-[10px] text-neutral-500 uppercase truncate">
                            {loc.street ? loc.city : loc.subarea}
                          </div>
                        )}
                      </button>
                    ))}
                    {locationSearch && filteredLocations.length === 0 && (
                      <div className="p-4 text-center text-xs text-neutral-600 italic">
                        No saved matches. Press Enter to use manual city.
                      </div>
                    )}
                  </div>
                )}
              </div>

              {bulkLocation && (
                <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-bold text-blue-500 uppercase tracking-wider">Selected Location</span>
                    <button onClick={() => setBulkLocation(null)} className="text-blue-500 hover:text-blue-400">
                      <X size={12} />
                    </button>
                  </div>
                  <div className="text-sm font-medium">{bulkLocation.city}</div>
                  <div className="text-[10px] text-neutral-500">{bulkLocation.lat.toFixed(4)}, {bulkLocation.lon.toFixed(4)}</div>
                </div>
              )}
            </div>

              <div className="p-6 border-t border-neutral-800 bg-neutral-900/80 backdrop-blur-md">
                <button 
                  onClick={handleBulkUpdate}
                  disabled={isProcessing || (!bulkDate && !bulkCity && !bulkLocation)}
                  className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-neutral-800 disabled:text-neutral-500 py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all transform active:scale-[0.98]"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 size={20} className="animate-spin" />
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      <Save size={20} />
                      <span>Save Changes to Files</span>
                    </>
                  )}
                </button>
                <div className="mt-3 flex items-start gap-2 px-1">
                  <CheckCircle2 size={12} className="text-blue-500 mt-0.5 shrink-0" />
                  <p className="text-[10px] text-neutral-500 uppercase tracking-widest leading-relaxed">
                    Changes will be saved directly to the original files
                  </p>
                </div>
              </div>
          </aside>
        )}
      </div>

      {isProcessing && items.length === 0 && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center">
          <Loader2 size={48} className="text-blue-500 animate-spin mb-4" />
          <h2 className="text-xl font-bold">Reading Exif data...</h2>
        </div>
      )}
    </div>
  );
}
