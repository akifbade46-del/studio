// src/lib/types.ts

// --- Editor Settings Types ---

export interface CompanyInfo {
  name: string;
  logoUrl: string;
  address: string;
  phone: string;
  email: string;
}

export interface ItemPreset {
  id: string;
  name: string;
  length: number;
  width: number;
  height: number;
  unit: 'cm' | 'in';
}

export interface CustomerField {
  id: string;
  label: string;
  type: 'text' | 'email' | 'tel';
  enabled: boolean;
  required: boolean;
}

export interface ContainerSettings {
  id: '20ft' | '40ft' | '40hc';
  name: string;
  capacity: number;
  efficiency: number;
}

export type MoveType = 'local' | 'gcc' | 'international';

export interface RateSettings {
  currency: string;
  pricingModel: 'per-cbm' | 'flat-rate';
  cbmRates: Record<MoveType, number>;
  minCharge: number;
  containerFlatRate: number;
  materials: number;
  labor: number;
  surcharges: number;
  insurance: number; // Percentage
  vat: number; // Percentage
  markup: number; // Percentage
  moveType: MoveType;
}

export interface TemplateSettings {
  whatsappMessage: string;
  pdfTerms: string;
}

export interface EditorSettings {
  companyInfo: CompanyInfo;
  itemPresets: ItemPreset[];
  customerFields: CustomerField[];
  containerSettings: ContainerSettings[];
  rateSettings: Omit<RateSettings, 'moveType'>;
  templateSettings: TemplateSettings;
}

// --- Survey Data Types ---

export interface SurveyItem {
  id: string;
  name: string;
  quantity: number;
  length: number;
  width: number;
  height: number;
  unit: 'cm' | 'in';
  cbm: number;
}

export interface CustomerData {
  [key: string]: string; // Dynamically populated from customerFields
}

export interface Photo {
  id: string;
  dataUrl: string;
}

export interface Signature {
  dataUrl: string;
  timestamp: string;
}

export interface Totals {
  totalCbm: number;
  cbmCost: number;
  materialsCost: number;
  laborCost: number;
  surchargesCost: number;
  subtotal: number;
  insuranceAmount: number;
  markupAmount: number;
  vatAmount: number;
  grandTotal: number;
}

export interface SurveyData {
  id: string;
  customer: CustomerData;
  items: SurveyItem[];
  moveType: MoveType;
  itemUnit: 'cm' | 'in';
  containerPlan: {
    totalCbm: number;
    recommendedContainerId: ContainerSettings['id'] | null;
  };
  pricing: Totals | null;
  photos: Photo[];
  signature: Signature | null;
  createdAt: string;
}
