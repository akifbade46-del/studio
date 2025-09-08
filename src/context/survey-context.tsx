'use client';

import React, { createContext, useContext, ReactNode, useCallback, useEffect, useState } from 'react';
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

const getActiveSurveyId = (): string | null => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('qgo-cargo-active-survey-id');
}

const setActiveSurveyId = (id: string) => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('qgo-cargo-active-survey-id', id);
}

export const SurveyProvider = ({ children }: { children: ReactNode }) => {
    const [activeId, setActiveId] = useState(getActiveSurveyId());
    
    const [survey, setSurvey] = useLocalStorage<SurveyData>(
        `qgo-cargo-survey-${activeId || 'new'}`, 
        { ...INITIAL_SURVEY_DATA, id: activeId || uuidv4(), createdAt: new Date().toISOString() }
    );

    useEffect(() => {
        if (activeId !== survey.id) {
            setActiveSurveyId(survey.id);
            setActiveId(survey.id);
        }
    }, [survey.id, activeId]);

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
