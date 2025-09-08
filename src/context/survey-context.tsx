'use client';

import React, { createContext, useContext, ReactNode, useCallback, useEffect, useState } from 'react';
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
    const [goToStep, setGoToStep] = useState<GoToStepFunction>(() => () => {});
    
    const [survey, setSurvey] = useLocalStorage<SurveyData>(
        `qgo-cargo-survey-${activeId || 'new'}`, 
        { ...INITIAL_SURVEY_DATA, id: activeId || uuidv4(), createdAt: new Date().toISOString() }
    );

    useEffect(() => {
        // This effect ensures that if the activeId changes (e.g. by loading a survey),
        // the `useLocalStorage` hook is now targetting the correct key,
        // and we can now read the correct data from it.
        const storedSurvey = localStorage.getItem(`qgo-cargo-survey-${activeId}`);
        if (storedSurvey) {
            setSurvey(JSON.parse(storedSurvey));
        }
    }, [activeId, setSurvey]);


    const startNewSurvey = useCallback((goToFirstStep = false) => {
        const newId = uuidv4();
        setActiveSurveyId(newId);
        const newSurvey = {
        ...INITIAL_SURVEY_DATA,
        id: newId,
        createdAt: new Date().toISOString(),
        };
        setSurvey(newSurvey);
        setActiveId(newId);

        if (goToFirstStep) {
            goToStep(1);
        }
    }, [setSurvey, goToStep]);

    const loadSurvey = useCallback((surveyData: SurveyData) => {
        setActiveSurveyId(surveyData.id);
        setSurvey(surveyData);
        setActiveId(surveyData.id);
        goToStep(1);
    }, [setSurvey, goToStep]);
  
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
