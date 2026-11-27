export interface FarmProfile {
  name: string;
  district: string;
  pickup_address: string;
}

export interface FarmRecord extends FarmProfile {
  id: string;
  status: 'active' | 'inactive';
  created_at: string;
  latitude: string | null;
  longitude: string | null;
  harvest_batches: { id: string; crop_name: string; reserved_kg: string; uncollected_kg: string }[];
}

export const farmsPath = '/farmer/farms';

export function farmPath(id: string) {
  return `${farmsPath}/${encodeURIComponent(id)}`;
}
