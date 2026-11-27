import { v2 as cloudinary } from 'cloudinary';
import {
  CLOUDINARY_BASE_FOLDER,
  createBadGatewayError,
  createServiceUnavailableError,
} from './ym09.constants.js';

/**
 * Reads Cloudinary configuration exclusively from backend environment variables.
 * Never logs or exposes CLOUDINARY_API_SECRET in responses or client payloads.
 */
function readCloudinaryConfig(overrides = {}) {
  const cloudName = (overrides.cloudName ?? process.env.CLOUDINARY_CLOUD_NAME ?? '').trim();
  const apiKey = (overrides.apiKey ?? process.env.CLOUDINARY_API_KEY ?? '').trim();
  const apiSecret = (overrides.apiSecret ?? process.env.CLOUDINARY_API_SECRET ?? '').trim();
  const baseFolder = (
    overrides.baseFolder ??
    process.env.CLOUDINARY_UPLOAD_FOLDER ??
    CLOUDINARY_BASE_FOLDER
  )
    .trim()
    .replace(/^\/+|\/+$/g, '');

  return {
    cloudName,
    apiKey,
    apiSecret,
    baseFolder: baseFolder || CLOUDINARY_BASE_FOLDER,
  };
}

function isCloudinaryNotFoundError(error) {
  const httpCode = error?.http_code ?? error?.error?.http_code;
  return httpCode === 404;
}

/**
 * Creates a Cloudinary produce-image storage adapter (injectable for unit tests).
 */
export function createYm09CloudinaryStorage(configOverrides = {}) {
  function getConfig() {
    return readCloudinaryConfig(configOverrides);
  }

  function assertConfigured() {
    const cfg = getConfig();
    if (!cfg.cloudName || !cfg.apiKey || !cfg.apiSecret) {
      throw createServiceUnavailableError(
        'Cloudinary produce image storage is not configured on the server.'
      );
    }
    return cfg;
  }

  function buildPublicImageUrl(publicId) {
    if (!publicId || typeof publicId !== 'string') {
      return null;
    }
    const trimmedId = publicId.trim().replace(/^\/+/, '');
    if (!trimmedId) {
      return null;
    }
    const cfg = getConfig();
    if (!cfg.cloudName) {
      return null;
    }
    return cloudinary.url(trimmedId, {
      cloud_name: cfg.cloudName,
      resource_type: 'image',
      type: 'upload',
      secure: true,
      analytics: false,
    });
  }

  async function generateUploadSignature({ folder, publicId }) {
    const cfg = assertConfigured();
    const timestamp = Math.floor(Date.now() / 1000);
    const paramsToSign = {
      folder,
      public_id: publicId,
      timestamp,
    };

    try {
      const signature = cloudinary.utils.api_sign_request(paramsToSign, cfg.apiSecret);
      return {
        uploadUrl: `https://api.cloudinary.com/v1_1/${cfg.cloudName}/image/upload`,
        cloudName: cfg.cloudName,
        apiKey: cfg.apiKey,
        timestamp,
        signature,
        folder,
        publicId,
        fullPublicId: `${folder}/${publicId}`,
      };
    } catch {
      throw createBadGatewayError('Failed to generate Cloudinary produce image upload signature.');
    }
  }

  async function verifyImageAssetExists(fullPublicId) {
    const cfg = assertConfigured();
    try {
      const asset = await cloudinary.api.resource(fullPublicId, {
        cloud_name: cfg.cloudName,
        api_key: cfg.apiKey,
        api_secret: cfg.apiSecret,
        resource_type: 'image',
        type: 'upload',
      });

      return {
        exists: true,
        resourceType: typeof asset?.resource_type === 'string' ? asset.resource_type : 'image',
        format: typeof asset?.format === 'string' ? asset.format.toLowerCase() : undefined,
        bytes: typeof asset?.bytes === 'number' ? asset.bytes : undefined,
        secureUrl: typeof asset?.secure_url === 'string' ? asset.secure_url : undefined,
      };
    } catch (error) {
      if (isCloudinaryNotFoundError(error)) {
        return { exists: false };
      }
      throw createBadGatewayError('Failed to verify uploaded produce image in Cloudinary.');
    }
  }

  async function deleteImageAsset(fullPublicId) {
    const cfg = assertConfigured();
    try {
      const result = await cloudinary.uploader.destroy(fullPublicId, {
        cloud_name: cfg.cloudName,
        api_key: cfg.apiKey,
        api_secret: cfg.apiSecret,
        resource_type: 'image',
        type: 'upload',
        invalidate: true,
      });

      const status = result?.result;
      if (status === 'ok' || status === 'not found') {
        return { deleted: true };
      }
      throw createBadGatewayError('Cloudinary rejected produce image deletion.');
    } catch (error) {
      if (error?.name === 'Ym09AppError') {
        throw error;
      }
      throw createBadGatewayError('Failed to delete produce image from Cloudinary.');
    }
  }

  return {
    getBaseFolder: () => getConfig().baseFolder,
    buildPublicImageUrl,
    generateUploadSignature,
    verifyImageAssetExists,
    deleteImageAsset,
  };
}

export const ym09CloudinaryStorage = createYm09CloudinaryStorage();
