import api from '../../services/api';
import type { AxiosRequestConfig } from 'axios';

export const YM01_API_BASE = import.meta.env.VITE_YM01_API_URL || 'http://localhost:5001/api';

export type ApiEnvelope<T> = {
  success: boolean;
  message: string;
  data: T;
  requestId?: string;
  pagination?: { page: number; pageSize: number; totalRecords: number; totalPages: number };
};

export type PublicHarvest = {
  id: string;
  listingId: string;
  cropName: string;
  category: string;
  grade: string;
  farmName: string;
  supplierName: string;
  district: string;
  harvestDate: string | null;
  plannedQuantityKg: number;
  actualQuantityKg: number | null;
  offeredQuantityKg: number;
  availableQuantityKg: number;
  unitPriceLkrPerKg: number;
  listingValidFrom: string;
  listingValidUntil: string;
  listingStatus: string;
  harvestStatus: string;
  publicTraceToken?: string;
  gradeDescription?: string | null;
};

export type LandingResponse = {
  platform: { name: string; description: string; currency: string; quantityUnit: string };
  statistics: {
    total_eligible_public_listings: number;
    total_active_crop_categories: number;
    total_participating_approved_farmers: number;
    total_eligible_available_quantity_kg: number | string;
  };
  featuredHarvests: PublicHarvest[];
  recentlyPublished: PublicHarvest[];
};

export type TraceEvent = {
  eventType: string;
  eventDateTime: string;
  description: string | null;
  locality: string | null;
  verificationStatus: 'unanchored' | 'pending' | 'verified' | 'failed';
};

export type PublicRole = {
  role: 'farmer' | 'buyer' | 'driver' | 'admin';
  name: string;
  description: string;
  responsibilities: string[];
  benefits: string[];
  registrationPath?: string;
  loginPath?: string;
};

export function ym01Get<T>(path: string, config: AxiosRequestConfig = {}) {
  return api.get<ApiEnvelope<T>>(`/ym01/${path}`, { ...config, baseURL: YM01_API_BASE });
}

export function formatNumber(value: number | string | null | undefined, maximumFractionDigits = 0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '—';
  return new Intl.NumberFormat('en-LK', { maximumFractionDigits }).format(numeric);
}

export function formatDate(value: string | null | undefined) {
  if (!value) return 'Not recorded';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat('en-LK', { day: 'numeric', month: 'short', year: 'numeric' }).format(parsed);
}

export type CropImage = {
  url: string;
  credit?: { url: string; label: string };
};

const commonsImage = (filename: string) => `https://upload.wikimedia.org/wikipedia/commons/${filename}`;

export function cropImage(cropName: string): CropImage {
  const crop = cropName.toLowerCase();
  const unsplash = (id: string): CropImage => ({
    url: `https://images.unsplash.com/${id}?auto=format&fit=crop&w=900&q=82`,
  });

  if (crop.includes('tomato')) return unsplash('photo-1546094096-0df4bcaaa337');
  if (crop.includes('carrot')) return unsplash('photo-1445282768818-728615cc910a');
  if (crop.includes('beetroot')) return { url: commonsImage('2/21/Beets-Bundle.jpg') };
  if (crop.includes('dried') && (crop.includes('chilli') || crop.includes('chili'))) return unsplash('photo-1583119022894-919a68a3d0e3');
  if (crop.includes('chilli') || crop.includes('chili')) return unsplash('photo-1563565375-f3fdfdbefa83');
  if (crop.includes('bell pepper') || crop.includes('capsicum')) return unsplash('photo-1563565375-f3fdfdbefa83');
  if (crop.includes('onion')) return unsplash('photo-1508747703725-719777637510');
  if (crop.includes('garlic')) return { url: commonsImage('6/61/Garlic_Bulbs_%28Unsplash%29.jpg') };
  if (crop.includes('leek')) return { url: commonsImage('4/43/Leek.jpg') };
  if (crop.includes('cabbage')) return { url: commonsImage('f/f9/White_cabbage_garden.jpg') };
  if (crop.includes('cauliflower')) return {
    url: commonsImage('1/12/Liat_Portal_for_Foodie_Disorder_-_Cauliflower_from_SF_farmers%27_market.jpg'),
    credit: {
      url: 'https://commons.wikimedia.org/wiki/File:Liat_Portal_for_Foodie_Disorder_-_Cauliflower_from_SF_farmers%27_market.jpg',
      label: 'Photo: Wikimedia Commons, CC BY-SA 4.0',
    },
  };
  if (crop.includes('brinjal') || crop.includes('eggplant')) return { url: commonsImage('b/b3/Brinjal..JPG') };
  if (crop.includes('sweet potato')) return { url: commonsImage('4/41/Raw_sweet_potato.jpg') };
  if (crop.includes('potato')) return unsplash('photo-1518977676601-b53f82aba655');
  if (crop.includes('corn')) return unsplash('photo-1551754655-cd27e38d2076');
  if (crop.includes('bean')) return { url: commonsImage('1/18/Fresh_Green_Beans_%28Unsplash%29.jpg') };
  if (crop.includes('okra')) return { url: commonsImage('0/05/Fresh_okra_%281%29.jpg') };
  if (crop.includes('pumpkin')) return unsplash('photo-1570586437263-ab629fccc818');
  if (crop.includes('bitter gourd') || crop.includes('bitter melon')) return { url: commonsImage('0/00/Fresh_bitter_melons.jpg') };
  if (crop.includes('snake gourd')) return {
    url: commonsImage('c/cf/Snake_gourd%2C_kerala.jpg'),
    credit: {
      url: 'https://commons.wikimedia.org/wiki/File:Snake_gourd,_kerala.jpg',
      label: 'Photo: Wikimedia Commons, CC BY-SA 4.0',
    },
  };
  if (crop.includes('cucumber')) return unsplash('photo-1604977042946-1eecc30f269e');
  if (crop.includes('spinach')) return unsplash('photo-1576045057995-568f588f82fb');
  if (crop.includes('lettuce')) return unsplash('photo-1556801712-76c8eb07bbc9');
  if (crop.includes('radish')) return { url: commonsImage('6/6d/Fresh_radishes_%28Unsplash%29.jpg') };
  return unsplash('photo-1542838132-92c53300491e');
}
