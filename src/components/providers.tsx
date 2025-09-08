'use client';

import React from 'react';
import { SettingsProvider } from '@/context/settings-context';
import { SurveyProvider } from '@/context/survey-context';
import { EditorProvider } from '@/context/editor-context';
import { Toaster } from '@/components/ui/toaster';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SettingsProvider>
      <SurveyProvider>
        <EditorProvider>
          {children}
          <Toaster />
        </EditorProvider>
      </SurveyProvider>
    </SettingsProvider>
  );
}
