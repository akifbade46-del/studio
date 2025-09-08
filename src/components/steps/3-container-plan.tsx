'use client';

import React, { useMemo, useEffect } from 'react';
import { useSettings } from '@/context/settings-context';
import { useSurvey } from '@/context/survey-context';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { CheckCircle2, Truck } from 'lucide-react';
import { calculateCbm } from '@/lib/utils';
import type { ContainerSettings } from '@/lib/types';

export default function ContainerPlanStep() {
  const { settings } = useSettings();
  const { survey, setSurvey } = useSurvey();

  const totalCbm = useMemo(() => {
    return survey.items.reduce((acc, item) => {
        const itemCbm = calculateCbm(item.length, item.width, item.height, item.unit);
        return acc + itemCbm * item.quantity;
      }, 0);
  }, [survey.items]);
  
  const recommendedContainer = useMemo(() => {
    let bestOption: ContainerSettings | null = null;
    for (const container of settings.containerSettings) {
      const effectiveCapacity = container.capacity * (container.efficiency / 100);
      if (totalCbm <= effectiveCapacity) {
        if (!bestOption || container.capacity < bestOption.capacity) {
          bestOption = container;
        }
      }
    }
    return bestOption;
  }, [totalCbm, settings.containerSettings]);

  useEffect(() => {
    setSurvey({
      ...survey,
      containerPlan: {
        totalCbm,
        recommendedContainerId: recommendedContainer?.id || survey.containerPlan.recommendedContainerId,
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalCbm, recommendedContainer]);
  
  const handleSelectContainer = (containerId: ContainerSettings['id']) => {
    setSurvey({
      ...survey,
      containerPlan: {
        ...survey.containerPlan,
        recommendedContainerId: containerId,
      }
    });
  }

  return (
    <div className="space-y-8">
      <CardHeader className="p-0">
        <CardTitle>Container Plan</CardTitle>
        <CardDescription>
          Based on a total of <span className="font-bold text-primary">{totalCbm.toFixed(3)} CBM</span>, here are the container options.
        </CardDescription>
      </CardHeader>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {settings.containerSettings.map(container => {
          const utilization = Math.min((totalCbm / container.capacity) * 100, 100);
          const isRecommended = recommendedContainer?.id === container.id;
          const isSelected = survey.containerPlan.recommendedContainerId === container.id;

          return (
            <Card 
              key={container.id} 
              className={cn(
                "cursor-pointer transition-all", 
                isSelected ? "border-primary ring-2 ring-primary" : "hover:shadow-md hover:border-muted-foreground/50",
                utilization > 100 ? "opacity-50" : ""
              )}
              onClick={() => handleSelectContainer(container.id)}
            >
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="flex items-center gap-2"><Truck size={20} />{container.name}</CardTitle>
                    <CardDescription>Capacity: {container.capacity.toFixed(2)} CBM</CardDescription>
                  </div>
                  {isSelected && <CheckCircle2 className="text-primary" />}
                </div>
                 {isRecommended && !isSelected && (
                  <p className="text-xs font-semibold text-accent-foreground bg-accent/30 rounded-full px-2 py-0.5 w-fit">Recommended</p>
                )}
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Progress value={utilization} className={utilization > 90 && utilization <= 100 ? '[&>div]:bg-orange-500' : utilization > 100 ? '[&>div]:bg-destructive' : ''} />
                  <div className="text-sm font-medium">
                    Utilization: <span className="font-bold">{utilization.toFixed(1)}%</span>
                  </div>
                   <div className="text-xs text-muted-foreground">
                    Packing Efficiency: {container.efficiency}%
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      {totalCbm > settings.containerSettings[settings.containerSettings.length - 1].capacity && (
        <p className="text-destructive text-center font-medium">
          Total CBM exceeds the largest container capacity. Multiple containers will be required.
        </p>
      )}
    </div>
  );
}
