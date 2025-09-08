'use client';

import React, { useState } from 'react';
import { useSurvey } from '@/context/survey-context';
import { useSettings } from '@/context/settings-context';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Loader2, Printer, Share2 } from 'lucide-react';
import { generateQuoteSummary } from '@/ai/flows/generate-quote-summary';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';

const ReviewSection = ({ title, children }: { title: string, children: React.ReactNode }) => (
  <div>
    <h3 className="text-lg font-semibold mb-2">{title}</h3>
    <div className="text-sm text-muted-foreground space-y-1">{children}</div>
  </div>
);

export default function ReviewShareStep() {
  const { survey } = useSurvey();
  const { settings } = useSettings();
  const { toast } = useToast();
  const [isSharing, setIsSharing] = useState(false);
  const { customer, items, containerPlan, pricing, photos, signature } = survey;

  const handleGeneratePdf = () => {
    try {
      const data = btoa(JSON.stringify({ survey, settings }));
      const url = `/quote?data=${encodeURIComponent(data)}`;
      window.open(url, '_blank');
    } catch (error) {
      console.error('Error preparing data for PDF:', error);
      toast({
        variant: 'destructive',
        title: 'Error Generating PDF',
        description: 'Could not prepare data for PDF generation.',
      });
    }
  };

  const handleShare = async () => {
    if (!pricing) {
        toast({ variant: 'destructive', title: 'Cannot Share', description: 'Pricing must be calculated first.' });
        return;
    }
    setIsSharing(true);
    try {
      const pdfLink = new URL(`/quote?data=${encodeURIComponent(btoa(JSON.stringify({ survey, settings })))}`, window.location.origin).href;
      
      const result = await generateQuoteSummary({
        customerName: customer.name || 'Valued Customer',
        totalCbm: containerPlan.totalCbm,
        containerType: settings.containerSettings.find(c => c.id === containerPlan.recommendedContainerId)?.name || 'N/A',
        grandTotal: pricing.grandTotal,
        pdfLink: pdfLink,
      });

      const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(result.summary)}`;
      window.open(whatsappUrl, '_blank');

    } catch (error) {
      console.error('Error generating share summary:', error);
      toast({
        variant: 'destructive',
        title: 'Sharing Failed',
        description: 'Could not generate the shareable summary.',
      });
    } finally {
      setIsSharing(false);
    }
  };


  return (
    <div className="space-y-8">
      <CardHeader className="p-0">
        <CardTitle>Review & Share</CardTitle>
        <CardDescription>
          Final review of the survey details before generating documents.
        </CardDescription>
      </CardHeader>
      
      <Card>
        <CardContent className="p-6 space-y-6">
          <ReviewSection title="Customer Details">
            {Object.entries(customer).map(([key, value]) => (
              <p key={key}><strong>{settings.customerFields.find(f => f.id === key)?.label || key}:</strong> {value}</p>
            ))}
          </ReviewSection>

          <Separator />

          <ReviewSection title="Move Summary">
            <p><strong>Total Items:</strong> {items.length}</p>
            <p><strong>Total CBM:</strong> {containerPlan.totalCbm.toFixed(3)}</p>
            <p><strong>Recommended Container:</strong> {settings.containerSettings.find(c => c.id === containerPlan.recommendedContainerId)?.name || 'N/A'}</p>
          </ReviewSection>

          <Separator />
          
           {pricing && (
            <>
              <ReviewSection title="Pricing Summary">
                <p><strong>Grand Total:</strong> {pricing.grandTotal.toFixed(2)} {settings.rateSettings.currency}</p>
              </ReviewSection>
              <Separator />
            </>
          )}


          {photos.length > 0 && (
            <ReviewSection title="Photos">
                <div className="flex flex-wrap gap-2">
                {photos.map(p => <Image key={p.id} src={p.dataUrl} alt="item photo" width={64} height={64} className="rounded-md object-cover" />)}
                </div>
            </ReviewSection>
          )}

           {signature && (
            <ReviewSection title="Signature">
                <Image src={signature.dataUrl} alt="customer signature" width={160} height={80} className="rounded-md bg-muted p-1" />
            </ReviewSection>
          )}
        </CardContent>
      </Card>
      
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={handleGeneratePdf}><Printer className="mr-2 h-4 w-4" /> Generate Quote PDF</Button>
        <Button onClick={handleShare} disabled={isSharing}>
            {isSharing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Share2 className="mr-2 h-4 w-4" />}
            Share to WhatsApp
        </Button>
      </div>
    </div>
  );
}
