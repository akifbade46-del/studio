import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { SurveyItem, RateSettings, Totals } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const calculateCbm = (length: number, width: number, height: number, unit: 'cm' | 'in'): number => {
  if (length <= 0 || width <= 0 || height <= 0) {
    return 0;
  }
  if (unit === 'cm') {
    return (length * width * height) / 1_000_000;
  }
  // Conversion from cubic inches to CBM
  return (length * width * height) / 61023.7;
};


export const calculateTotals = (items: SurveyItem[], rates: RateSettings): Totals => {
  const totalCbm = items.reduce((acc, item) => acc + item.cbm * item.quantity, 0);

  let cbmCost = 0;
  if (rates.pricingModel === 'per-cbm') {
    const rate = rates.cbmRates[rates.moveType] || 0;
    cbmCost = Math.max(totalCbm * rate, rates.minCharge);
  } else {
    cbmCost = rates.containerFlatRate;
  }

  const materialsCost = parseFloat(rates.materials) || 0;
  const laborCost = parseFloat(rates.labor) || 0;
  const surchargesCost = parseFloat(rates.surcharges) || 0;

  const subtotal = cbmCost + materialsCost + laborCost + surchargesCost;

  const insuranceAmount = subtotal * (rates.insurance / 100);
  const totalBeforeVat = subtotal + insuranceAmount;
  const markupAmount = totalBeforeVat * (rates.markup / 100);
  const totalBeforeVatWithMarkup = totalBeforeVat + markupAmount;
  const vatAmount = totalBeforeVatWithMarkup * (rates.vat / 100);
  const grandTotal = totalBeforeVatWithMarkup + vatAmount;

  return {
    totalCbm: parseFloat(totalCbm.toFixed(3)),
    cbmCost: parseFloat(cbmCost.toFixed(2)),
    materialsCost,
    laborCost,
    surchargesCost,
    subtotal: parseFloat(subtotal.toFixed(2)),
    insuranceAmount: parseFloat(insuranceAmount.toFixed(2)),
    markupAmount: parseFloat(markupAmount.toFixed(2)),
    vatAmount: parseFloat(vatAmount.toFixed(2)),
    grandTotal: parseFloat(grandTotal.toFixed(2)),
  };
};

export const compressImage = (file: File, quality = 0.7): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 800;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return reject(new Error('Could not get canvas context'));
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
    };
    reader.onerror = (error) => reject(error);
  });
};


export const exportJson = (data: unknown, filename: string) => {
  const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
    JSON.stringify(data, null, 2)
  )}`;
  const link = document.createElement("a");
  link.href = jsonString;
  link.download = `${filename}.json`;
  link.click();
};

export const importJson = (file: File): Promise<any> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsText(file, "UTF-8");
    reader.onload = e => {
      try {
        const content = e.target?.result;
        if (typeof content === 'string') {
          resolve(JSON.parse(content));
        } else {
          reject(new Error("File content is not a string"));
        }
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = error => reject(error);
  });
};
