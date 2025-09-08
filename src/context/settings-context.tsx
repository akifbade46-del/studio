'use client';

import React, { createContext, useContext, ReactNode } from 'react';
import useLocalStorage from '@/hooks/use-local-storage';
import { DEFAULT_EDITOR_SETTINGS } from '@/lib/consts';
import type { EditorSettings } from '@/lib/types';

interface SettingsContextType {
  settings: EditorSettings;
  setSettings: (settings: EditorSettings) => void;
  resetSettings: () => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
  const [settings, setSettings] = useLocalStorage<EditorSettings>(
    'qgo-cargo-settings',
    DEFAULT_EDITOR_SETTINGS
  );

  const resetSettings = () => {
    setSettings(DEFAULT_EDITOR_SETTINGS);
  };

  return (
    <SettingsContext.Provider value={{ settings, setSettings, resetSettings }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = (): SettingsContextType => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};
