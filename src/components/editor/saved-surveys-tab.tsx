'use client';

import React, { useState, useEffect } from 'react';
import { useSurvey } from '@/context/survey-context';
import type { SurveyData } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PlusCircle, Trash2, FileEdit } from 'lucide-react';
import { useEditor } from '@/context/editor-context';

export default function SavedSurveysTab() {
  const [savedSurveys, setSavedSurveys] = useState<SurveyData[]>([]);
  const { survey, setSurvey, startNewSurvey } = useSurvey();
  const { setUnlocked } = useEditor();

  useEffect(() => {
    const allSurveys: SurveyData[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('qgo-cargo-survey-')) {
        try {
          const item = localStorage.getItem(key);
          if (item) {
            allSurveys.push(JSON.parse(item));
          }
        } catch (e) {
            console.error(`Could not parse survey from localStorage key ${key}`, e);
        }
      }
    }
    setSavedSurveys(allSurveys.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
  }, [survey.id]); // Rerender when active survey changes

  const loadSurvey = (surveyData: SurveyData) => {
    setSurvey(surveyData);
    setUnlocked(false);
  };

  const deleteSurvey = (surveyId: string) => {
    if (confirm('Are you sure you want to delete this survey? This cannot be undone.')) {
        localStorage.removeItem(`qgo-cargo-survey-${surveyId}`);
        setSavedSurveys(savedSurveys.filter(s => s.id !== surveyId));
        if (survey.id === surveyId) {
            startNewSurvey();
        }
    }
  };
  
  const handleNewSurvey = () => {
    startNewSurvey();
    setUnlocked(false);
  }

  return (
    <div className="space-y-4 h-full flex flex-col">
        <div className="flex justify-between items-center">
             <p className="text-sm text-muted-foreground">Manage all your saved surveys.</p>
             <Button onClick={handleNewSurvey}><PlusCircle /> New Survey</Button>
        </div>
      <div className="flex-1 min-h-0">
        <ScrollArea className="h-full pr-4">
          <div className="space-y-2">
            {savedSurveys.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">No saved surveys found.</div>
            ) : (
                savedSurveys.map(s => (
                <div key={s.id} className="flex items-center justify-between p-2 border rounded-md hover:bg-muted/50">
                    <div className="flex-1 truncate">
                        <p className="font-medium truncate">{s.customer?.name || `Survey ${s.id.slice(0,6)}`}</p>
                        <p className="text-xs text-muted-foreground">{new Date(s.createdAt).toLocaleString()}</p>
                    </div>
                    <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => loadSurvey(s)} disabled={s.id === survey.id} aria-label="Load Survey">
                            <FileEdit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteSurvey(s.id)} aria-label="Delete Survey">
                            <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                    </div>
                </div>
                ))
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
