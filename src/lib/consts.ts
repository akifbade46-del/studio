import type { EditorSettings, SurveyData } from './types';
import { v4 as uuidv4 } from 'uuid';

export const DEFAULT_EDITOR_SETTINGS: EditorSettings = {
  companyInfo: {
    name: "Q'go Cargo",
    logoUrl: '/logo-placeholder.svg',
    address: '123 Cargo Lane, Kuwait City, Kuwait',
    phone: '+965 1234 5678',
    email: 'contact@qgocargo.com',
  },
  itemPresets: [
    { id: uuidv4(), name: 'Small Carton', length: 30, width: 30, height: 30, unit: 'cm' },
    { id: uuidv4(), name: 'Medium Carton', length: 45, width: 45, height: 45, unit: 'cm' },
    { id: uuidv4(), name: 'Large Carton', length: 60, width: 60, height: 60, unit: 'cm' },
    { id: uuidv4(), name: 'Sofa (3-Seater)', length: 200, width: 90, height: 80, unit: 'cm' },
    { id: uuidv4(), name: 'Queen Bed', length: 200, width: 150, height: 100, unit: 'cm' },
    { id: uuidv4(), name: 'Wardrobe', length: 180, width: 60, height: 200, unit: 'cm' },
    { id: uuidv4(), name: 'Refrigerator', length: 80, width: 80, height: 180, unit: 'cm' },
    { id: uuidv4(), name: 'Washing Machine', length: 60, width: 60, height: 85, unit: 'cm' },
    { id: uuidv4(), name: 'Dining Table (6p)', length: 180, width: 90, height: 75, unit: 'cm' },
    { id: uuidv4(), name: 'TV (55")', length: 125, width: 10, height: 75, unit: 'cm' },
  ],
  customerFields: [
    { id: 'name', label: 'Customer Name', type: 'text', enabled: true, required: true },
    { id: 'phone', label: 'Phone Number', type: 'tel', enabled: true, required: true },
    { id: 'email', label: 'Email Address', type: 'email', enabled: true, required: false },
    { id: 'pickupAddress', label: 'Pickup Address', type: 'text', enabled: true, required: true },
    { id: 'destinationAddress', label: 'Destination Address', type: 'text', enabled: true, required: true },
  ],
  containerSettings: [
    { id: '20ft', name: '20ft Container', capacity: 33.2, efficiency: 85 },
    { id: '40ft', name: '40ft Container', capacity: 67.7, efficiency: 85 },
    { id: '40hc', name: '40ft High Cube', capacity: 76.0, efficiency: 85 },
  ],
  rateSettings: {
    currency: 'KWD',
    pricingModel: 'per-cbm',
    cbmRates: {
      local: 15,
      gcc: 25,
      international: 40,
    },
    minCharge: 100,
    containerFlatRate: 500,
    materials: '50.00',
    labor: '100.00',
    surcharges: '0.00',
    insurance: 1.5,
    vat: 5,
    markup: 10,
  },
  templateSettings: {
    whatsappMessage: 'Dear {{customerName}},\n\nPlease find your quotation summary attached. For full details, view the complete quote here: {{pdfLink}}.\n\nThank you,\nQ\'go Cargo',
    pdfTerms: '1. This quote is valid for 30 days.\n2. Payment terms: 50% upfront, 50% upon completion.\n3. All goods are handled with care, but insurance is recommended for valuable items.',
  },
};

export const INITIAL_SURVEY_DATA: Omit<SurveyData, 'id' | 'createdAt'> = {
  customer: {},
  items: [],
  moveType: 'local',
  itemUnit: 'cm',
  containerPlan: {
    totalCbm: 0,
    recommendedContainerId: null,
  },
  pricing: null,
  photos: [],
  signature: null,
};
