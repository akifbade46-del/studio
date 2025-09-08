'use client';

import React from 'react';
import { useSettings } from '@/context/settings-context';
import { useSurvey } from '@/context/survey-context';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CardTitle, CardDescription, CardHeader } from '../ui/card';

export default function CustomerDetailsStep() {
  const { settings } = useSettings();
  const { survey, setSurvey } = useSurvey();

  const handleInputChange = (fieldId: string, value: string) => {
    setSurvey({
      ...survey,
      customer: {
        ...survey.customer,
        [fieldId]: value,
      },
    });
  };

  const enabledFields = settings.customerFields.filter(field => field.enabled);

  return (
    <div className="space-y-8">
       <CardHeader className="p-0">
        <CardTitle>Customer & Move Details</CardTitle>
        <CardDescription>
          Enter the customer's information and details about the move.
        </CardDescription>
      </CardHeader>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {enabledFields.map(field => (
          <div key={field.id} className="space-y-2">
            <Label htmlFor={field.id}>
              {field.label}
              {field.required && <span className="text-destructive ml-1">*</span>}
            </Label>
            <Input
              id={field.id}
              type={field.type}
              value={survey.customer[field.id] || ''}
              onChange={e => handleInputChange(field.id, e.target.value)}
              required={field.required}
              placeholder={`Enter ${field.label.toLowerCase()}`}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
