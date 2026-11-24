import axios from 'axios';
import api from '../../../services/api';

export type RegistrationRole = 'farmer' | 'buyer' | 'driver';

export interface RegistrationError {
  message: string;
  status?: number;
  fields?: Record<string, string>;
  requestId?: string;
}

export interface FarmerRegistrationPayload {
  role: 'farmer';
  fullName: string;
  email: string;
  phone: string;
  district: string;
  password: string;
  farmName: string;
  pickupAddress: string;
}

export interface RegistrationSuccess {
  registrationId: string;
  role: RegistrationRole;
  approvalStatus: 'pending';
}

export async function registerFarmer(
  payload: FarmerRegistrationPayload
): Promise<RegistrationSuccess> {
  const response = await api.post<RegistrationSuccess>(
    '/ym03/register',
    payload
  );

  return response.data;
}

export function getRegistrationError(
  error: unknown
): RegistrationError {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const data = error.response?.data as
      | {
          error?: string;
          code?: string;
          fields?: Record<string, string>;
          requestId?: string;
        }
      | undefined;

    if (status === 400) {
      return {
        message: 'Please correct the highlighted registration details.',
        status,
        fields: data?.fields,
        requestId: data?.requestId,
      };
    }

    if (status === 409) {
      return {
        message: 'An account with these details may already exist.',
        status,
        fields: data?.fields,
        requestId: data?.requestId,
      };
    }

    if (
      status === 501 &&
      (
        data?.code === 'REGISTRATION_NOT_IMPLEMENTED' ||
        data?.code === 'ROLE_REGISTRATION_NOT_IMPLEMENTED'
      )
    ) {
      return {
        message:
          'Your form is valid, but account registration is not available yet. No account has been created.',
        status,
        requestId: data?.requestId,
      };
    }

    if (!error.response) {
      return {
        message:
          'Unable to connect to YieldMatrix. ' +
          'Please check that the backend is running.',
      };
    }

    return {
      message:
        'Registration could not be completed. ' +
        'Please try again later.',
      status,
      requestId: data?.requestId,
    };
  }

  return {
    message: 'An unexpected error occurred.',
  };
}

export interface BuyerRegistrationPayload {
  role: 'buyer';
  fullName: string;
  email: string;
  phone: string;
  district: string;
  password: string;
  buyerType: 'individual' | 'commercial';
  businessName: string;
}

export interface DriverRegistrationPayload {
  role: 'driver';
  fullName: string;
  email: string;
  phone: string;
  district: string;
  password: string;
  operatingArea: string;
  vehicleType: string;
  registrationNumber: string;
  licenceNumber: string;
  capacityKg: number;
}

export async function registerBuyer(
  payload: BuyerRegistrationPayload
): Promise<RegistrationSuccess> {
  const response = await api.post<RegistrationSuccess>(
    '/ym03/register',
    payload
  );

  return response.data;
}

export async function registerDriver(
  payload: DriverRegistrationPayload
): Promise<RegistrationSuccess> {
  const response = await api.post<RegistrationSuccess>(
    '/ym03/register',
    payload
  );

  return response.data;
}
