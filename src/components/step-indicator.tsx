'use client';

import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

interface StepIndicatorProps {
  steps: { id: number; name: string }[];
  currentStep: number;
  onStepClick: (step: number) => void;
}

export default function StepIndicator({ steps, currentStep, onStepClick }: StepIndicatorProps) {
  return (
    <nav aria-label="Progress">
      <ol role="list" className="flex items-center">
        {steps.map((step, stepIdx) => {
          const isCompleted = currentStep > step.id;
          const isCurrent = currentStep === step.id;
          const isAccessible = currentStep >= step.id;

          return (
            <li key={step.name} className={cn("relative", stepIdx !== steps.length - 1 ? "pr-8 sm:pr-20 flex-1" : "")}>
              {stepIdx !== steps.length - 1 ? (
                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                  <div className={cn("h-0.5 w-full", isCompleted ? "bg-primary" : "bg-border")} />
                </div>
              ) : null}

              <button
                type="button"
                onClick={() => onStepClick(step.id)}
                disabled={!isAccessible}
                className={cn(
                  "relative flex h-8 w-8 items-center justify-center rounded-full",
                  isAccessible ? "cursor-pointer" : "cursor-not-allowed"
                )}
                aria-current={isCurrent ? 'step' : undefined}
              >
                <div className={cn("absolute flex h-9 w-9 items-center justify-center rounded-full transition-colors", 
                  isCompleted ? "bg-primary hover:bg-primary/90" : 
                  isCurrent ? "border-2 border-primary bg-background" : 
                  "border-2 border-border bg-background",
                  isAccessible && !isCurrent && !isCompleted ? "hover:border-muted-foreground" : ""
                )}>
                  {isCompleted ? (
                    <Check className="h-5 w-5 text-primary-foreground" />
                  ) : (
                    <span className={cn("text-sm font-medium", isCurrent ? "text-primary" : "text-muted-foreground")}>{step.id}</span>
                  )}
                </div>
                <span className="sr-only">{step.name}</span>
              </button>
              <p className="absolute -bottom-7 w-max -translate-x-1/2 left-1/2 text-center text-xs sm:text-sm font-medium text-muted-foreground">{step.name}</p>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
