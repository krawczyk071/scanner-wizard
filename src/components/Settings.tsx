import { useState, useEffect } from 'react';
import { X, Settings as SettingsIcon, Save, Folder } from 'lucide-react';
import { getSettings, saveSettings, type AppSettings } from '../utils/settingsStorage';

interface SettingsProps {
  onClose: () => void;
}

export function Settings({ onClose }: SettingsProps) {
  const [settings, setLocalSettings] = useState<AppSettings>({ defaultDownloadPath: '' });
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    const saved = getSettings();
    setLocalSettings(saved);
  }, []);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    saveSettings(settings);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-neutral-800">
          <div className="flex items-center gap-2">
            <SettingsIcon className="text-blue-500" size={20} />
            <h2 className="text-lg font-bold text-white uppercase tracking-tight">App Settings</h2>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-neutral-800 rounded-lg text-neutral-400 hover:text-white transition-colors border-none"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest flex items-center gap-2">
              <Folder size={12} />
              Default Download Path
            </label>
            <input 
              type="text"
              value={settings.defaultDownloadPath}
              onChange={(e) => setLocalSettings({ ...settings, defaultDownloadPath: e.target.value })}
              placeholder="/Users/name/Downloads/Photos"
              className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-neutral-200 focus:outline-none focus:border-blue-500 transition-colors"
            />
            <p className="text-[10px] text-neutral-600 leading-relaxed">
              Note: Browsers cannot directly save to a custom path for security. This path will be used as a prefix for the filename to help you organize exported photos.
            </p>
          </div>

          <div className="pt-4 flex items-center justify-end gap-3">
            <button 
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-bold text-neutral-500 hover:text-neutral-300 transition-colors border-none"
            >
              CANCEL
            </button>
            <button 
              type="submit"
              className={`flex items-center gap-2 px-6 py-2 rounded-lg transition-all font-bold text-sm border-none shadow-lg ${isSaved ? 'bg-green-600 text-white' : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/20'}`}
            >
              {isSaved ? <Save size={16} /> : <Save size={16} />}
              {isSaved ? 'SAVED!' : 'SAVE SETTINGS'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
