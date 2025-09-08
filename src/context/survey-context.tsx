'use client';

import React, { createContext, useContext, ReactNode, useCallback } from 'react';
import useLocalStorage from '@/hooks/use-local-storage';
import { INITIAL_SURVEY_DATA } from '@/lib/consts';
import type { SurveyData } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';

interface SurveyContextType {
  survey: SurveyData;
  setSurvey: (survey: SurveyData) => void;
  startNewSurvey: () => void;
}

const SurveyContext = createContext<SurveyContextType | undefined>(undefined);

export const SurveyProvider = ({ children }: { children: ReactNode }) => {
  const [survey, setSurvey] = useLocalStorage<SurveyData>('qgo-cargo-survey', {
    ...INITIAL_SURVEY_DATA,
    id: uuidv4(),
    createdAt: new Date().toISOString(),
  });

  const startNewSurvey = useCallback(() => {
    const newId = uuidv4();
    const newSurvey = {
      ...INITIAL_SURVEY_DATA,
      id: newId,
      createdAt: new Date().toISOString(),
    };
    setSurvey(newSurvey);
  }, [setSurvey]);
  
  return (
    <SurveyContext.Provider value={{ survey, setSurvey, startNewSurvey }}>
      {children}
    </SurveyContext.Provider>
  );
};

export const useSurvey = (): SurveyContextType => {
  const context = useContext(SurveyContext);
  if (context === undefined) {
    throw new Error('useSurvey must be used within a SurveyProvider');
  }
  return context;
};
