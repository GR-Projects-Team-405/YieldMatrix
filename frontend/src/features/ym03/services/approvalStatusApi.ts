import axios from 'axios';
import api from '../../../services/api';

export type ApprovalStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'suspended';

export type RegistrationRole =
  | 'farmer'
  | 'buyer'
  | 'driver';

export interface ApprovalStatusRequest {
  email: string;
  password: string;
}

export interface ApprovalStatusResponse {
  registrationId: string;
  role: RegistrationRole;
  approvalStatus: ApprovalStatus;
  reason: string | null;
  requestId?: string;
}

export interface ApprovalStatusError {
  message: string;
  status?: number;
  requestId?: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function fetchApprovalStatus(
  credentials: ApprovalStatusRequest
): Promise<ApprovalStatusResponse> {
  const email = credentials.email.trim().toLowerCase();

  if (
    !EMAIL_PATTERN.test(email) ||
    email.length > 254
  ) {
    throw new Error('Enter a valid email address.');
  }

  if (
    !credentials.password ||
    credentials.password.length > 128
  ) {
    throw new Error('Enter your password.');
  }

  const response = await api.post<ApprovalStatusResponse>(
    '/ym03/approval-status',
    {
      email,
      password: credentials.password,
    }
  );

  const result = response.data;

  if (
    !result ||
    typeof result.registrationId !== 'string' ||
    !['farmer', 'buyer', 'driver'].includes(result.role) ||
    !['pending', 'approved', 'rejected', 'suspended']
      .includes(result.approvalStatus) ||
    (
      result.reason !== null &&
      typeof result.reason !== 'string'
    )
  ) {
    throw new Error(
      'The server returned an invalid approval status.'
    );
  }

  return result;
}

export function getApprovalStatusError(
  error: unknown
): ApprovalStatusError {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;

    const data = error.response?.data as
      | { requestId?: string }
      | undefined;

    if (status === 401) {
      return {
        message: 'Email or password is incorrect.',
        status,
        requestId: data?.requestId,
      };
    }

    if (status === 422) {
      return {
        message: 'Enter a valid email and password.',
        status,
        requestId: data?.requestId,
      };
    }

    if (status === 429) {
      return {
        message: 'Too many attempts. Please try again later.',
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
      message: 'Unable to retrieve your approval status.',
      status,
      requestId: data?.requestId,
    };
  }

  return {
    message:
      error instanceof Error
        ? error.message
        : 'An unexpected error occurred.',
  };
}
