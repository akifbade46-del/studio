'use client';

import React from 'react';
import MainHeader from './main-header';
import StepIndicator from './step-indicator';
import { Button } from './ui/button';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Card, CardContent } from './ui/card';

interface MainLayoutProps {
  children: React.ReactNode;
  steps: { id: number; name: string }[];
  currentStep: number;
  totalSteps: number;
  goToNextStep: () => void;
  goToPrevStep: () => void;
  goToStep: (step: number) => void;
  isNextDisabled?: boolean;
}

export default function MainLayout({
  children,
  steps,
  currentStep,
  totalSteps,
  goToNextStep,
  goToPrevStep,
  goToStep,
  isNextDisabled = false,
}: MainLayoutProps) {
  return (
    <div className="flex min-h-screen w-full flex-col">
      <MainHeader />
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <StepIndicator
            steps={steps}
            currentStep={currentStep}
            onStepClick={goToStep}
          />
          <Card className="mt-6">
            <CardContent className="p-4 sm:p-6 md:p-8">
              {children}
            </CardContent>
          </Card>
          <div className="mt-8 flex justify-between">
            <Button
              variant="outline"
              onClick={goToPrevStep}
              disabled={currentStep === 1}
              size="lg"
            >
              <ArrowLeft />
              Previous
            </Button>
            {currentStep < totalSteps ? (
              <Button onClick={goToNextStep} disabled={isNextDisabled} size="lg">
                Next
                <ArrowRight />
              </Button>
            ) : (
               <Button onClick={() => goToStep(6)} size="lg">
                Review & Share
                <ArrowRight />
              </Button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
