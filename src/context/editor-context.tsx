'use client';

import React, { createContext, useState, useContext, ReactNode } from 'react';

type EditorTab = 'surveys' | 'company' | 'fields' | 'presets' | 'containers' | 'rates' | 'templates' | 'data';

interface EditorContextType {
  isEditorOpen: boolean;
  setEditorOpen: (isOpen: boolean) => void;
  isUnlocked: boolean;
  setUnlocked: (isUnlocked: boolean) => void;
  activeTab: EditorTab;
  setActiveTab: (tab: EditorTab) => void;
}

const EditorContext = createContext<EditorContextType | undefined>(undefined);

export const EditorProvider = ({ children }: { children: ReactNode }) => {
  const [isEditorOpen, setEditorOpen] = useState(false);
  const [isUnlocked, setUnlocked] = useState(false);
  const [activeTab, setActiveTab] = useState<EditorTab>('surveys');

  return (
    <EditorContext.Provider value={{ isEditorOpen, setEditorOpen, isUnlocked, setUnlocked, activeTab, setActiveTab }}>
      {children}
    </EditorContext.Provider>
  );
};

export const useEditor = (): EditorContextType => {
  const context = useContext(EditorContext);
  if (context === undefined) {
    throw new Error('useEditor must be used within an EditorProvider');
  }
  return context;
};
