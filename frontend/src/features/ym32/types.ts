import type { Role } from '../../context/AuthContext';

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'suspended';

/** Shape of the user profile record returned by GET/PUT /api/ym32/profile */
export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: Role;
  approval_status: ApprovalStatus;
  phone: string | null;
  district: string | null;
  created_at: string;
  updated_at: string;
}

/** Response payload for GET /api/ym32/profile */
export interface GetProfileResponse {
  profile: UserProfile;
  requestId: string;
}
