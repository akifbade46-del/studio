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

    const startNewSurvey = useCallback((goToFirstStep = false) => {
        const newId = uuidv4();
        const newSurvey = {
            ...INITIAL_SURVEY_DATA,
            id: newId,
            createdAt: new Date().toISOString(),
        };
        // We set the survey data for the *new* key first.
        window.localStorage.setItem(`qgo-cargo-survey-${newId}`, JSON.stringify(newSurvey));
        
        // Then, we update the active ID, which will cause useLocalStorage to pick up the new data.
        setActiveSurveyId(newId);
        setActiveId(newId);

        if (goToFirstStep) {
            goToStep(1);
        }
    }, [goToStep]);

    const loadSurvey = useCallback((surveyData: SurveyData) => {
        // Set the active ID, which will trigger the useLocalStorage hook to read the correct survey.
        setActiveSurveyId(surveyData.id);
        setActiveId(surveyData.id);
        
        if (goToStep) {
            goToStep(1);
        }
    }, [goToStep]);
  
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
