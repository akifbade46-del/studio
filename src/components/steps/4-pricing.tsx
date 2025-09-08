'use client';

import React, { useEffect, useMemo } from 'react';
import { useSettings } from '@/context/settings-context';
import { useSurvey } from '@/context/survey-context';
import { calculateTotals } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import type { MoveType, Totals } from '@/lib/types';
import { Badge } from '../ui/badge';

const PriceLineItem = ({ label, value, currency, className }: { label: React.ReactNode; value: number; currency: string; className?: string }) => (
  <div className={cn("flex justify-between items-center text-sm", className)}>
    <dt className="text-muted-foreground">{label}</dt>
    <dd className="font-medium">{value.toFixed(2)} {currency}</dd>
  </div>
);

export default function PricingStep() {
  const { settings } = useSettings();
  const { survey, setSurvey } = useSurvey();
  const { rateSettings } = settings;

  const totals = useMemo(() => {
    if (survey.items.length === 0) return null;
    return calculateTotals(survey.items, { ...rateSettings, moveType: survey.moveType });
  }, [survey.items, rateSettings, survey.moveType]);
  
  useEffect(() => {
    setSurvey({ ...survey, pricing: totals });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totals]);

  const handleMoveTypeChange = (moveType: MoveType) => {
    setSurvey({ ...survey, moveType });
  };

  if (!totals) {
    return (
      <div className="text-center text-muted-foreground py-12">
        <p>Please add items in Step 2 to calculate pricing.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <CardHeader className="p-0">
        <CardTitle>Pricing & Quote</CardTitle>
        <CardDescription>
          A detailed cost breakdown based on your selection.
        </CardDescription>
      </CardHeader>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 space-y-2">
          <Label htmlFor="moveType">Move Type</Label>
          <Select value={survey.moveType} onValueChange={handleMoveTypeChange}>
            <SelectTrigger id="moveType">
              <SelectValue placeholder="Select move type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="local">Local</SelectItem>
              <SelectItem value="gcc">GCC</SelectItem>
              <SelectItem value="international">International</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quote Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="space-y-4">
            <PriceLineItem
              label={
                <>
                  Transportation Cost ({totals.totalCbm.toFixed(3)} CBM @ {rateSettings.cbmRates[survey.moveType]}/{'CBM)'}
                  {totals.cbmCost === rateSettings.minCharge && <Badge variant="secondary" className="ml-2">Min. charge applied</Badge>}
                </>
              }
              value={totals.cbmCost}
              currency={rateSettings.currency}
            />
            <PriceLineItem label="Packing Materials" value={totals.materialsCost} currency={rateSettings.currency} />
            <PriceLineItem label="Labor" value={totals.laborCost} currency={rateSettings.currency} />
            <PriceLineItem label="Surcharges" value={totals.surchargesCost} currency={rateSettings.currency} />
            
            <Separator />
            
            <PriceLineItem label="Subtotal" value={totals.subtotal} currency={rateSettings.currency} className="text-base" />

            <Separator />
            
            <PriceLineItem label={`Insurance (${rateSettings.insurance}%)`} value={totals.insuranceAmount} currency={rateSettings.currency} />
            <PriceLineItem label={`Markup (${rateSettings.markup}%)`} value={totals.markupAmount} currency={rateSettings.currency} />
            <PriceLineItem label={`VAT (${rateSettings.vat}%)`} value={totals.vatAmount} currency={rateSettings.currency} />

            <Separator />

            <div className="flex justify-between items-center text-xl font-bold pt-4">
              <dt>Grand Total</dt>
              <dd className="text-primary">{totals.grandTotal.toFixed(2)} {rateSettings.currency}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
