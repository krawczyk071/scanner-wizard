
export const STORAGE_KEYS = {
  LOCATIONS: 'scanner_wizard_locations',
  SETTINGS: 'scanner_wizard_settings',
};

export interface AppSettings {
  defaultDownloadPath: string;
}

const DEFAULT_SETTINGS: AppSettings = {
  defaultDownloadPath: '',
};

export function getSettings(): AppSettings {
  const stored = localStorage.getItem(STORAGE_KEYS.SETTINGS);
  if (!stored) return DEFAULT_SETTINGS;
  try {
    return JSON.parse(stored);
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: AppSettings): void {
  localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
}
