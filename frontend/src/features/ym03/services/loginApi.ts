
import axios from 'axios';

import api from '../../../services/api';

export type LoginRole = 'farmer' | 'buyer' | 'driver';

export interface LoginPayload {
  email: string;
  password: string;
}

export interface LoginUser {
  id: string;
  name: string;
  role: 'farmer' | 'buyer' | 'driver' | 'admin';
}

export interface LoginResponse {
  token: string;
  user: LoginUser;
  requestId?: string;
}

export interface LoginError {
  message: string;
  status?: number;
  approvalStatus?: string;
  requestId?: string;
}

export async function loginWithYm03(
  payload: LoginPayload,
  expectedRole: LoginRole
): Promise<LoginResponse> {
  const email = payload.email.trim().toLowerCase();

  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    email.length > 254
  ) {
    throw new Error('Enter a valid email address.');
  }

  if (!payload.password || payload.password.length > 128) {
    throw new Error('Enter a valid password.');
  }

  const response = await api.post<LoginResponse>(
    '/ym03/login',
    {
      email,
      password: payload.password,
    }
  );

  const data = response.data;

  if (
    !data ||
    typeof data.token !== 'string' ||
    !data.token ||
    !data.user ||
    data.user.role !== expectedRole
  ) {
    throw new Error(
      'The authenticated account does not match the selected role.'
    );
  }

  return data;
}

export function getLoginError(error: unknown): LoginError {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;

    const data = error.response?.data as
      | {
          error?: string;
          approvalStatus?: string;
          requestId?: string;
        }
      | undefined;

    if (status === 401) {
      return {
        message: 'Email or password is incorrect.',
        status,
        requestId: data?.requestId,
      };
    }

    if (status === 403) {
      return {
        message:
          'Your account is not currently approved for access.',
        status,
        approvalStatus: data?.approvalStatus,
        requestId: data?.requestId,
      };
    }

    if (status === 429) {
      return {
        message:
          'Too many login attempts. Please try again later.',
        status,
        requestId: data?.requestId,
      };
    }

    if (status === 422) {
      return {
        message: 'Please enter a valid email and password.',
        status,
        requestId: data?.requestId,
      };
    }

    if (!error.response) {
      return {
        message:
          'Unable to connect to YieldMatrix. Check that the backend is running.',
      };
    }

    return {
      message: 'Login is temporarily unavailable.',
      status,
      requestId: data?.requestId,
    };
  }

  return {
    message:
      error instanceof Error
        ? error.message
        : 'An unexpected login error occurred.',
  };
}
