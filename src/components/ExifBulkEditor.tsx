import { useState, useMemo } from 'react';
import { 
  ArrowLeft, 
  Trash2, 
  Search, 
  CheckSquare, 
  Square,
  SortAsc,
  SortDesc,
  X,
  Loader2,
  Save,
  ImagePlus,
  FolderOpen
} from 'lucide-react';
import * as piexif from 'piexifjs';
import { type Location, getSavedLocations } from '../utils/locationStorage';
import { v4 as uuidv4 } from 'uuid';
import { type BulkImageItem, type ImageGroup } from './ExifBulkEditor/types';
import { ImageGrid } from './ExifBulkEditor/ImageGrid';
import { BulkEditSidebar } from './ExifBulkEditor/BulkEditSidebar';

interface ExifBulkEditorProps {
  onBack: () => void;
}

export function ExifBulkEditor({ onBack }: ExifBulkEditorProps) {
  const [items, setItems] = useState<BulkImageItem[]>([]);
  const [filter, setFilter] = useState('');
  const [sortBy, setSortBy] = useState<'filename' | 'date' | 'location' | 'description' | 'manual'>('filename');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [isProcessing, setIsProcessing] = useState(false);
  const [preserveOrder, setPreserveOrder] = useState(false);
  
  // Bulk edit form states
  const [bulkDate, setBulkDate] = useState('');
  const [bulkLocation, setBulkLocation] = useState<Location | null>(null);
  const [bulkCity, setBulkCity] = useState('');
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  const [locationSearch, setLocationSearch] = useState('');

  const savedLocations = getSavedLocations();

  const processFileHandles = async (handles: any[]) => {
    setIsProcessing(true);
    try {
      const newItems: BulkImageItem[] = await Promise.all(
        handles.map(async (handle: any) => {
          // Request readwrite permission if not already granted (e.g. from folder)
          try {
            const permission = await handle.queryPermission({ mode: 'readwrite' });
            if (permission !== 'granted') {
              await handle.requestPermission({ mode: 'readwrite' });
            }
          } catch (err) {
            console.warn('Could not get write permission for', handle.name, err);
          }

          const file = await handle.getFile();
          const id = uuidv4();
          const previewUrl = URL.createObjectURL(file);
          
          let exifDate = '';
          let exifTime = '';
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
              const dateMatch = dateTime.match(/^(\d{4}):(\d{2}):(\d{2})/);
              if (dateMatch) {
                exifDate = `${dateMatch[3]}${dateMatch[2]}${dateMatch[1].substring(2)}`;
              }
              const timeMatch = dateTime.match(/(\d{2}):(\d{2}):\d{2}$/);
              if (timeMatch) {
                exifTime = `${timeMatch[1]}:${timeMatch[2]}`;
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
            exifTime,
            exifLocation,
            exifDescription,
            selected: false,
            filename: file.name,
          };
        })
      );

      setItems((prev) => [...prev, ...newItems]);
    } catch (err) {
      console.error('Error processing files:', err);
    } finally {
      setIsProcessing(false);
    }
  };

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

      await processFileHandles(handles);
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        console.error('File picker error:', err);
      }
    }
  };

  const handleFolderSelection = async () => {
    try {
      // @ts-expect-error File System Access API
      const dirHandle = await window.showDirectoryPicker({
        mode: 'readwrite'
      });

      // Request readwrite permission once for the whole folder
      const permission = await dirHandle.queryPermission({ mode: 'readwrite' });
      if (permission !== 'granted') {
        const result = await dirHandle.requestPermission({ mode: 'readwrite' });
        if (result !== 'granted') return;
      }

      setIsProcessing(true);
      const handles: any[] = [];
      
      for await (const entry of dirHandle.values() as any) {
        if (entry.kind === 'file' && (entry.name.toLowerCase().endsWith('.jpg') || entry.name.toLowerCase().endsWith('.jpeg'))) {
          handles.push(entry);
        }
      }

      await processFileHandles(handles);
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        console.error('Directory picker error:', err);
      }
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

  const selectSameDate = (date: string) => {
    if (!date) return;
    setItems((prev) =>
      prev.map((item) =>
        item.exifDate === date ? { ...item, selected: true } : item
      )
    );
  };

  const moveItem = (id: string, direction: 'up' | 'down') => {
    setItems((prev) => {
      const selectedIndices = prev.map((item, index) => item.selected ? index : -1).filter(idx => idx !== -1);
      const currentIndex = prev.findIndex(item => item.id === id);
      const selectedIndexInSelected = selectedIndices.indexOf(currentIndex);
      
      if (selectedIndexInSelected === -1) return prev;
      
      const targetIndexInSelected = direction === 'up' ? selectedIndexInSelected - 1 : selectedIndexInSelected + 1;
      
      if (targetIndexInSelected < 0 || targetIndexInSelected >= selectedIndices.length) return prev;
      
      const targetIndex = selectedIndices[targetIndexInSelected];
      
      const newItems = [...prev];
      const temp = newItems[currentIndex];
      newItems[currentIndex] = newItems[targetIndex];
      newItems[targetIndex] = temp;
      
      setSortBy('manual');
      return newItems;
    });
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

  const clearSelection = () => {
    setItems((prev) => prev.map((item) => ({ ...item, selected: false })));
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

    if (sortBy === 'manual') return result;

    result.sort((a, b) => {
      let valA = '';
      let valB = '';

      if (sortBy === 'filename') {
        valA = a.filename;
        valB = b.filename;
      } else if (sortBy === 'date') {
        // Convert DDMMYY to YYYYMMDD for correct chronological sorting
        const toSortableDate = (dateStr?: string, timeStr?: string) => {
          if (!dateStr || !/^\d{6}$/.test(dateStr)) return '000000000000';
          const day = dateStr.substring(0, 2);
          const month = dateStr.substring(2, 4);
          const yearYY = parseInt(dateStr.substring(4, 6));
          const currentYY = new Date().getFullYear() % 100;
          const year = (yearYY > currentYY ? 1900 : 2000) + yearYY;
          const time = (timeStr || '00:00').replace(':', '');
          return `${year}${month}${day}${time}`;
        };
        valA = toSortableDate(a.exifDate, a.exifTime);
        valB = toSortableDate(b.exifDate, b.exifTime);
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

  const groupedItems = useMemo(() => {
    const groups: ImageGroup[] = [];
    
    // Use the same sortable logic for consistent grouping order
    const toSortKey = (dateStr?: string) => {
      if (!dateStr || !/^\d{6}$/.test(dateStr)) return '00000000';
      const day = dateStr.substring(0, 2);
      const month = dateStr.substring(2, 4);
      const yearYY = parseInt(dateStr.substring(4, 6));
      const currentYY = new Date().getFullYear() % 100;
      const year = (yearYY > currentYY ? 1900 : 2000) + yearYY;
      return `${year}${month}${day}`;
    };

    filteredItems.forEach(item => {
      const date = item.exifDate || 'No date';
      let group = groups.find(g => g.date === date);
      if (!group) {
        group = { date, items: [] };
        groups.push(group);
      }
      group.items.push(item);
    });

    // Ensure groups themselves are sorted chronologically
    groups.sort((a, b) => {
      const keyA = toSortKey(a.date === 'No date' ? undefined : a.date);
      const keyB = toSortKey(b.date === 'No date' ? undefined : b.date);
      return sortOrder === 'asc' ? keyA.localeCompare(keyB) : keyB.localeCompare(keyA);
    });

    return groups;
  }, [filteredItems, sortOrder]);

  const selectedCount = items.filter((item) => item.selected).length;
  const selectedItems = useMemo(() => items.filter(i => i.selected), [items]);

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
      // Get selected items in the order they are displayed
      const currentSelectedItems = filteredItems.filter(item => item.selected);
      const newItems = [...items];
      
      // Base date/time for sequential incrementing
      let baseDateTime: { y: number, m: number, d: number, h: number, min: number, s: number } | null = null;

      for (let i = 0; i < currentSelectedItems.length; i++) {
        const item = currentSelectedItems[i];
        const itemIdx = newItems.findIndex(ni => ni.id === item.id);
        if (itemIdx === -1) continue;

        const reader = new FileReader();
        const data = await new Promise<string>((resolve) => {
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.readAsDataURL(item.file);
        });

        const exifObj = piexif.load(data);
        
        // Determine this item's new date/time
        let finalY: number, finalM: number, finalD: number, finalH: number, finalMin: number, finalS: number;

        if (preserveOrder) {
          if (i === 0) {
            // Initialize base date/time from bulkDate or first item's EXIF
            if (bulkDate && /^\d{6}$/.test(bulkDate)) {
              const yearYY = parseInt(bulkDate.substring(4, 6));
              const currentYY = new Date().getFullYear() % 100;
              const year = (yearYY > currentYY ? 1900 : 2000) + yearYY;
              const month = parseInt(bulkDate.substring(2, 4));
              const day = parseInt(bulkDate.substring(0, 2));
              baseDateTime = { y: year, m: month, d: day, h: 0, min: 0, s: 0 };
            } else {
              const dateTime = (exifObj['0th'][piexif.ImageIFD.DateTime] || exifObj['Exif'][piexif.ExifIFD.DateTimeOriginal]) as string;
              if (dateTime) {
                const parts = dateTime.split(' ');
                const [y, m, d] = parts[0].split(':').map(Number);
                const [h, min, s] = (parts[1] || '00:00:00').split(':').map(Number);
                baseDateTime = { y, m, d, h, min, s };
              } else {
                baseDateTime = { y: 2000, m: 1, d: 1, h: 0, min: 0, s: 0 };
              }
            }
          }

          if (baseDateTime) {
            finalY = baseDateTime.y;
            finalM = baseDateTime.m;
            finalD = baseDateTime.d;
            finalH = baseDateTime.h;
            finalMin = baseDateTime.min + i;
            finalS = baseDateTime.s;

            while (finalMin >= 60) {
              finalH++;
              finalMin -= 60;
            }
            while (finalH >= 24) {
              finalD++;
              finalH -= 24;
            }
          } else {
            finalY = 2000; finalM = 1; finalD = 1; finalH = 0; finalMin = 0; finalS = 0;
          }
        } else if (bulkDate && /^\d{6}$/.test(bulkDate)) {
          const yearYY = parseInt(bulkDate.substring(4, 6));
          const currentYY = new Date().getFullYear() % 100;
          finalY = (yearYY > currentYY ? 1900 : 2000) + yearYY;
          finalM = parseInt(bulkDate.substring(2, 4));
          finalD = parseInt(bulkDate.substring(0, 2));
          finalH = 0; finalMin = 0; finalS = 0;
        } else {
          // No date update requested, use existing
          const dateTime = (exifObj['0th'][piexif.ImageIFD.DateTime] || exifObj['Exif'][piexif.ExifIFD.DateTimeOriginal]) as string;
          if (dateTime) {
            const parts = dateTime.split(' ');
            [finalY, finalM, finalD] = parts[0].split(':').map(Number);
            [finalH, finalMin, finalS] = (parts[1] || '00:00:00').split(':').map(Number);
          } else {
            finalY = 2000; finalM = 1; finalD = 1; finalH = 0; finalMin = 0; finalS = 0;
          }
        }

        const pad = (n: number) => n.toString().padStart(2, '0');
        const isoDate = `${finalY}:${pad(finalM)}:${pad(finalD)} ${pad(finalH)}:${pad(finalMin)}:${pad(finalS)}`;
        
        // Apply updates
        if (bulkDate || preserveOrder) {
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

        // Extract updated date and time for state
        let updatedDate = item.exifDate;
        let updatedTime = item.exifTime;
        const finalDateTime = exifObj['0th'][piexif.ImageIFD.DateTime] || exifObj['Exif'][piexif.ExifIFD.DateTimeOriginal];
        if (finalDateTime) {
          const dateMatch = (finalDateTime as string).match(/^(\d{4}):(\d{2}):(\d{2})/);
          if (dateMatch) {
            updatedDate = `${dateMatch[3]}${dateMatch[2]}${dateMatch[1].substring(2)}`;
          }
          const timeMatch = (finalDateTime as string).match(/(\d{2}):(\d{2}):\d{2}$/);
          if (timeMatch) {
            updatedTime = `${timeMatch[1]}:${timeMatch[2]}`;
          }
        }

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
            newItems[itemIdx] = {
              ...item,
              file: newFile,
              handle: item.handle, // Keep the same handle for future edits
              filename: newFilename,
              exifDate: updatedDate,
              exifTime: updatedTime,
              exifLocation: finalCity || item.exifLocation,
              exifDescription: finalCity || item.exifDescription,
              selected: false,
            };
            continue; // Move to next item
          } catch (err) {
            console.error('CRITICAL: Error updating file on disk:', item.filename, err);
            alert(`Error updating ${item.filename}: ${err instanceof Error ? err.message : String(err)}`);
            // Stop processing further items on critical error
            setIsProcessing(false);
            return;
          }
        }
        
        // No handle available
        alert(`Could not save ${item.filename} because the file handle is missing. Please re-import the file.`);
        setIsProcessing(false);
        return;
      }

      setItems(newItems);
      // Reset bulk form
      setBulkDate('');
      setBulkCity('');
      setBulkLocation(null);
      setPreserveOrder(false);
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
                onChange={(e) => setSortBy(e.target.value as 'filename' | 'date' | 'location' | 'description' | 'manual')}
                className="bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-xs focus:outline-none"
              >
                <option value="filename">Filename</option>
                <option value="date">Date</option>
                <option value="location">Location</option>
                <option value="description">Description</option>
                <option value="manual">Manual Order</option>
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
                  Using the file or folder picker allows the app to save changes directly to your original files.
                </p>
                <div className="flex items-center gap-4">
                  <button 
                    onClick={handleFileSelection}
                    className="flex items-center gap-3 px-8 py-4 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-2xl text-lg font-bold transition-all transform active:scale-[0.98]"
                  >
                    <Save size={24} className="text-blue-500" />
                    <span>Select Files</span>
                  </button>
                  <button 
                    onClick={handleFolderSelection}
                    className="flex items-center gap-3 px-8 py-4 bg-blue-600 hover:bg-blue-500 rounded-2xl text-lg font-bold transition-all shadow-xl shadow-blue-900/30 transform active:scale-[0.98]"
                  >
                    <FolderOpen size={24} />
                    <span>Select Folder</span>
                  </button>
                </div>
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
                    <>
                      <button 
                        onClick={clearSelection}
                        className="flex items-center gap-2 px-3 py-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-lg text-sm transition-colors"
                      >
                        <X size={16} />
                        <span>Clear Selection</span>
                      </button>
                      <button 
                        onClick={removeSelected}
                        className="flex items-center gap-2 px-3 py-2 bg-red-950/20 hover:bg-red-950/40 border border-red-900/30 text-red-400 rounded-lg text-sm transition-colors"
                      >
                        <Trash2 size={16} />
                        <span>Remove Selected ({selectedCount})</span>
                      </button>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={handleFileSelection}
                    className="flex items-center gap-2 px-4 py-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-lg text-sm font-bold transition-colors"
                  >
                    <Save size={16} className="text-blue-500" />
                    <span>Add Files</span>
                  </button>
                  <button 
                    onClick={handleFolderSelection}
                    className="flex items-center gap-2 px-4 py-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-lg text-sm font-bold transition-colors"
                  >
                    <FolderOpen size={16} className="text-blue-500" />
                    <span>Add Folder</span>
                  </button>
                </div>
              </div>

              <ImageGrid 
                groupedItems={groupedItems} 
                onToggle={toggleSelect} 
                onSelectSameDate={selectSameDate} 
              />
            </>
          )}
        </main>

        {/* Sidebar for Bulk Edit */}
        {selectedCount > 0 && (
          <BulkEditSidebar 
            selectedItems={selectedItems}
            isProcessing={isProcessing}
            bulkDate={bulkDate}
            setBulkDate={setBulkDate}
            bulkCity={bulkCity}
            setBulkCity={setBulkCity}
            bulkLocation={bulkLocation}
            setBulkLocation={setBulkLocation}
            locationSearch={locationSearch}
            setLocationSearch={setLocationSearch}
            showLocationDropdown={showLocationDropdown}
            setShowLocationDropdown={setShowLocationDropdown}
            filteredLocations={filteredLocations}
            preserveOrder={preserveOrder}
            setPreserveOrder={setPreserveOrder}
            onMoveItem={moveItem}
            onBulkUpdate={handleBulkUpdate}
          />
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
