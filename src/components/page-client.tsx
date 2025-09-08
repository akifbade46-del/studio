'use client';

import { useState, useMemo, useEffect } from 'react';
import { useSurvey } from '@/context/survey-context';
import MainLayout from '@/components/main-layout';
import CustomerDetailsStep from '@/components/steps/1-customer-details';
import ItemListStep from '@/components/steps/2-item-list';
import ContainerPlanStep from '@/components/steps/3-container-plan';
import PricingStep from '@/components/steps/4-pricing';
import PhotosSignatureStep from '@/components/steps/5-photos-signature';
import ReviewShareStep from '@/components/steps/6-review-share';
import EditorPanel from './editor/editor-panel';
import PasscodeDialog from './editor/passcode-dialog';

const stepComponents = [
  { id: 1, name: 'Customer', component: CustomerDetailsStep },
  { id: 2, name: 'Items & CBM', component: ItemListStep },
  { id: 3, name: 'Container Plan', component: ContainerPlanStep },
  { id: 4, name: 'Pricing', component: PricingStep },
  { id: 5, name: 'Photos & Signature', component: PhotosSignatureStep },
  { id: 6, name: 'Review & Share', component: ReviewShareStep },
];

export default function PageClient() {
  const [currentStep, setCurrentStep] = useState(1);
  const { survey, setGoToStep } = useSurvey();
  const totalSteps = stepComponents.length;

  const goToNextStep = () => setCurrentStep(prev => Math.min(prev + 1, totalSteps));
  const goToPrevStep = () => setCurrentStep(prev => Math.max(prev - 1, 1));
  const goToStep = (step: number) => {
    if (step >= 1 && step <= totalSteps) {
      setCurrentStep(step);
    }
  };
  
  useEffect(() => {
    setGoToStep(() => goToStep);
  }, [setGoToStep]);


  useEffect(() => {
    // When the survey is loaded from storage, go to the first step.
    setCurrentStep(1);
  }, [survey.id]);

  const isNextDisabled = useMemo(() => {
    if (currentStep === 1) {
      return !survey.customer.name || !survey.customer.pickupAddress || !survey.customer.destinationAddress;
    }
    if (currentStep === 2) {
      return survey.items.length === 0;
    }
    if (currentStep === 3) {
      return !survey.containerPlan.recommendedContainerId;
    }
    if (currentStep === 4) {
      return !survey.pricing;
    }
    return false;
  }, [currentStep, survey]);

  const CurrentComponent = stepComponents.find(s => s.id === currentStep)?.component || null;

  return (
    <MainLayout
      steps={stepComponents}
      currentStep={currentStep}
      totalSteps={totalSteps}
      goToNextStep={goToNextStep}
      goToPrevStep={goToPrevStep}
      goToStep={goToStep}
      isNextDisabled={isNextDisabled}
    >
      <PasscodeDialog />
      <EditorPanel />
      {CurrentComponent && <CurrentComponent />}
    </MainLayout>
  );
}
