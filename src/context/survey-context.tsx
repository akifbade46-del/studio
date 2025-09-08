'use client';

import React, { createContext, useContext, ReactNode, useCallback, useState } from 'react';
import useLocalStorage from '@/hooks/use-local-storage';
import { INITIAL_SURVEY_DATA } from '@/lib/consts';
import type { SurveyData } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';

type GoToStepFunction = (step: number) => void;

interface SurveyContextType {
  survey: SurveyData;
  setSurvey: (survey: SurveyData) => void;
  loadSurvey: (survey: SurveyData) => void;
  startNewSurvey: (goToFirstStep?: boolean) => void;
  goToStep: GoToStepFunction;
  setGoToStep: React.Dispatch<React.SetStateAction<GoToStepFunction>>;
}

const SurveyContext = createContext<SurveyContextType | undefined>(undefined);

const getActiveSurveyId = (): string => {
    if (typeof window === 'undefined') return 'new';
    return localStorage.getItem('qgo-cargo-active-survey-id') || 'new';
}

const setActiveSurveyId = (id: string) => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('qgo-cargo-active-survey-id', id);
}

export const SurveyProvider = ({ children }: { children: ReactNode }) => {
    const [activeId, setActiveId] = useState(getActiveSurveyId());
    const [goToStep, setGoToStep] = useState<GoToStepFunction>(() => () => {});
    
    const [survey, setSurvey] = useLocalStorage<SurveyData>(
        `qgo-cargo-survey-${activeId}`, 
        { ...INITIAL_SURVEY_DATA, id: activeId, createdAt: new Date().toISOString() }
    );

    const startNewSurvey = useCallback((goToFirstStep = false) => {
        const newId = uuidv4();
        const newSurvey = {
            ...INITIAL_SURVEY_DATA,
            id: newId,
            createdAt: new Date().toISOString(),
        };
        setActiveSurveyId(newId);
        // This will trigger the useLocalStorage hook to update because its key has changed.
        setSurvey(newSurvey);
        setActiveId(newId);

        if (goToFirstStep) {
            goToStep(1);
        }
    }, [goToStep, setSurvey]);

    const loadSurvey = useCallback((surveyData: SurveyData) => {
        setActiveSurveyId(surveyData.id);
        setActiveId(surveyData.id);
    }, []);
  
  return (
    <SurveyContext.Provider value={{ survey, setSurvey, loadSurvey, startNewSurvey, goToStep, setGoToStep }}>
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
