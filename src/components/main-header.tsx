'use client';

import React from 'react';
import { Lock, FilePlus } from 'lucide-react';
import { Button } from './ui/button';
import { useSettings } from '@/context/settings-context';
import { useSurvey } from '@/context/survey-context';
import { useEditor } from '@/context/editor-context';
import CargoLogo from './cargo-logo';

export default function MainHeader() {
  const { settings } = useSettings();
  const { startNewSurvey } = useSurvey();
  const { setEditorOpen } = useEditor();

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-card">
      <div className="container mx-auto flex h-16 items-center space-x-4 px-4 sm:justify-between sm:space-x-0">
        <div className="flex items-center gap-4">
          <CargoLogo className="h-8 w-8 text-primary" />
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            {settings.companyInfo.name} <span className="font-light text-muted-foreground hidden sm:inline">Companion</span>
          </h1>
        </div>
        <div className="flex flex-1 items-center justify-end space-x-2">
          <Button variant="ghost" size="sm" onClick={startNewSurvey}>
            <FilePlus className="h-4 w-4 mr-2" />
            New Survey
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setEditorOpen(true)}
            aria-label="Open Editor"
          >
            <Lock className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
