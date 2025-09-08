'use client';

// Disabling eslint rule for now as it's a known issue with searchParams in App Router
/* eslint-disable @next/next/no-img-element */

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import CargoLogo from "@/components/cargo-logo";
import type { EditorSettings, SurveyData } from "@/lib/types";

// The main component is wrapped in Suspense to handle streaming of searchParams
export default function QuotePage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center">Loading quote...</div>}>
      <QuoteDisplay />
    </Suspense>
  );
}

function QuoteDisplay() {
  const searchParams = useSearchParams();
  const [survey, setSurvey] = useState<SurveyData | null>(null);
  const [settings, setSettings] = useState<EditorSettings | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const data = searchParams.get('data');
    if (data) {
      try {
        const decodedData = JSON.parse(atob(decodeURIComponent(data)));
        setSurvey(decodedData.survey);
        setSettings(decodedData.settings);
      } catch (e) {
        console.error("Failed to parse quote data:", e);
        setError("Failed to load quote data. The link may be corrupted.");
      }
    }
  }, [searchParams]);

  if (error) {
    return <div className="p-8 text-center text-red-500">{error}</div>;
  }

  if (!survey || !settings) {
    return <div className="flex h-screen items-center justify-center">Loading quote...</div>;
  }

  const { companyInfo, rateSettings } = settings;
  const { customer, items, containerPlan, pricing, photos, signature } = survey;

  const PriceLine = ({ label, value }: { label: string, value: number | string }) => (
    <div className="flex justify-between">
      <span>{label}</span>
      <span className="font-medium">{typeof value === 'number' ? `${value.toFixed(2)} ${rateSettings.currency}` : value}</span>
    </div>
  );

  return (
    <div className="bg-gray-100 min-h-screen p-4 sm:p-8 print:bg-white print:p-0">
      <style jsx global>{`
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none; }
        }
      `}</style>
      <Card className="max-w-4xl mx-auto a4-sheet print:shadow-none print:border-none print:rounded-none">
        <CardHeader className="flex flex-row justify-between items-start">
          <div>
            <div className="flex items-center gap-4 mb-4">
              <CargoLogo className="h-12 w-12" />
              <h1 className="text-3xl font-bold">{companyInfo.name}</h1>
            </div>
            <p className="text-muted-foreground">{companyInfo.address}</p>
            <p className="text-muted-foreground">Phone: {companyInfo.phone} | Email: {companyInfo.email}</p>
          </div>
          <div className="text-right">
            <h2 className="text-2xl font-bold text-primary">Quotation</h2>
            <p className="text-muted-foreground">Date: {new Date(survey.createdAt).toLocaleDateString()}</p>
            <p className="text-muted-foreground">Quote ID: {survey.id.slice(0, 8).toUpperCase()}</p>
          </div>
        </CardHeader>
        <CardContent>
          <Separator className="my-6" />
          <div className="grid grid-cols-2 gap-8">
            <div>
              <h3 className="font-semibold mb-2">Bill To:</h3>
              <p>{customer.name}</p>
              <p>{customer.phone}</p>
              {customer.email && <p>{customer.email}</p>}
            </div>
            <div className="text-right">
              <h3 className="font-semibold mb-2">Move Details:</h3>
              <p>From: {customer.pickupAddress}</p>
              <p>To: {customer.destinationAddress}</p>
            </div>
          </div>
          <Separator className="my-6" />
          <h3 className="font-semibold mb-2">Item List</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>CBM/Unit</TableHead>
                <TableHead className="text-right">Total CBM</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map(item => (
                <TableRow key={item.id}>
                  <TableCell>{item.name}</TableCell>
                  <TableCell>{item.quantity}</TableCell>
                  <TableCell>{item.cbm.toFixed(3)}</TableCell>
                  <TableCell className="text-right">{(item.cbm * item.quantity).toFixed(3)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow className="font-bold">
                <TableCell colSpan={3} className="text-right">Total Volumetric Weight</TableCell>
                <TableCell className="text-right">{containerPlan.totalCbm.toFixed(3)} CBM</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
          <Separator className="my-6" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
                {photos.length > 0 && (
                    <div>
                        <h3 className="font-semibold mb-2">Item Photos</h3>
                        <div className="flex flex-wrap gap-2">
                        {photos.map(p => (
                            <img key={p.id} src={p.dataUrl} alt="Item" className="w-20 h-20 object-cover rounded-md border" />
                        ))}
                        </div>
                    </div>
                )}
            </div>
            {pricing && (
              <div className="bg-gray-50 p-6 rounded-lg print:bg-gray-50">
                <h3 className="font-semibold text-lg mb-4">Price Breakdown</h3>
                <div className="space-y-2 text-sm">
                  <PriceLine label="Transportation Cost" value={pricing.cbmCost} />
                  <PriceLine label="Packing Materials" value={pricing.materialsCost} />
                  <PriceLine label="Labor" value={pricing.laborCost} />
                  <PriceLine label="Surcharges" value={pricing.surchargesCost} />
                  <Separator className="my-2" />
                  <PriceLine label="Subtotal" value={pricing.subtotal} />
                  <Separator className="my-2" />
                  <PriceLine label={`Insurance (${rateSettings.insurance}%)`} value={pricing.insuranceAmount} />
                  <PriceLine label={`Markup (${rateSettings.markup}%)`} value={pricing.markupAmount} />
                  <PriceLine label={`VAT (${rateSettings.vat}%)`} value={pricing.vatAmount} />
                  <Separator className="my-2" />
                  <div className="flex justify-between font-bold text-lg pt-2">
                    <span>Grand Total</span>
                    <span className="text-primary">{`${pricing.grandTotal.toFixed(2)} ${rateSettings.currency}`}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
          <Separator className="my-6" />
          <div className="grid grid-cols-2 gap-8">
            <div>
              <h3 className="font-semibold mb-2">Terms & Conditions</h3>
              <p className="text-xs text-muted-foreground whitespace-pre-wrap">{settings.templateSettings.pdfTerms}</p>
            </div>
            {signature && (
              <div>
                <h3 className="font-semibold mb-2">Customer Signature</h3>
                <div className="border rounded-lg p-2 bg-gray-50 max-w-xs">
                    <img src={signature.dataUrl} alt="Signature" className="mix-blend-darken" />
                </div>
                <p className="text-xs text-muted-foreground mt-1">Signed on: {new Date(signature.timestamp).toLocaleString()}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      <div className="text-center mt-4 no-print">
        <button onClick={() => window.print()} className="bg-primary text-primary-foreground px-6 py-2 rounded-md">Print or Save as PDF</button>
      </div>
    </div>
  );
}
