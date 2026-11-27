import { Ym09AppError } from './ym09.constants.js';
import { ym09Service as defaultService } from './ym09.service.js';

// YM09 · Imalka Randev · Produce listings

function handleControllerError(error, req, res, next) {
  if (error instanceof Ym09AppError) {
    return res.status(error.statusCode).json({
      error: error.message,
      ...(error.fields ? { fields: error.fields } : {}),
      requestId: req.requestId,
    });
  }
  return next(error);
}

/**
 * Creates a thin HTTP controller bound to a YM09 service instance.
 */
export function createYm09Controller(service = defaultService) {
  async function getStatus(req, res, next) {
    try {
      const result = await service.getModuleStatus({
        userId: req.user?.id,
        userRole: req.user?.role,
      });

      return res.json({
        ...result,
        requestId: req.requestId,
      });
    } catch (error) {
      return handleControllerError(error, req, res, next);
    }
  }

  async function getProduceListings(req, res, next) {
    try {
      const result = await service.listFarmerProduceListings({
        farmerId: req.user?.id,
        userRole: req.user?.role,
        query: req.query,
      });

      return res.json({
        success: true,
        data: result.data,
        total: result.total,
        requestId: req.requestId,
      });
    } catch (error) {
      return handleControllerError(error, req, res, next);
    }
  }

  async function getProduceListingById(req, res, next) {
    try {
      const data = await service.getFarmerProduceListingById({
        listingId: req.params.id,
        farmerId: req.user?.id,
        userRole: req.user?.role,
      });

      return res.json({
        success: true,
        data,
        requestId: req.requestId,
      });
    } catch (error) {
      return handleControllerError(error, req, res, next);
    }
  }

  async function getProduceListingDetails(req, res, next) {
    try {
      const data = await service.getFarmerProduceListingDetails({
        listingId: req.params.id,
        farmerId: req.user?.id,
        userRole: req.user?.role,
      });

      return res.json({
        success: true,
        data,
        requestId: req.requestId,
      });
    } catch (error) {
      return handleControllerError(error, req, res, next);
    }
  }

  async function createProduceListing(req, res, next) {
    try {
      const data = await service.createFarmerProduceListing({
        farmerId: req.user?.id,
        userRole: req.user?.role,
        requestId: req.requestId,
        payload: req.body,
      });

      return res.status(201).json({
        success: true,
        data,
        requestId: req.requestId,
      });
    } catch (error) {
      return handleControllerError(error, req, res, next);
    }
  }

  async function updateProduceListing(req, res, next) {
    try {
      const data = await service.updateFarmerProduceListing({
        listingId: req.params.id,
        farmerId: req.user?.id,
        userRole: req.user?.role,
        requestId: req.requestId,
        payload: req.body,
      });

      return res.json({
        success: true,
        data,
        requestId: req.requestId,
      });
    } catch (error) {
      return handleControllerError(error, req, res, next);
    }
  }

  async function updateProduceListingStatus(req, res, next) {
    try {
      const data = await service.updateFarmerProduceListingStatus({
        listingId: req.params.id,
        farmerId: req.user?.id,
        userRole: req.user?.role,
        requestId: req.requestId,
        payload: req.body,
      });

      return res.json({
        success: true,
        data,
        requestId: req.requestId,
      });
    } catch (error) {
      return handleControllerError(error, req, res, next);
    }
  }

  async function requestProduceImageSignature(req, res, next) {
    try {
      const data = await service.requestFarmerProduceImageUploadSignature({
        listingId: req.params.id,
        farmerId: req.user?.id,
        userRole: req.user?.role,
        payload: req.body,
      });

      return res.json({
        success: true,
        data,
        requestId: req.requestId,
      });
    } catch (error) {
      return handleControllerError(error, req, res, next);
    }
  }

  async function confirmProduceImageUpload(req, res, next) {
    try {
      const data = await service.confirmFarmerProduceImageUpload({
        listingId: req.params.id,
        farmerId: req.user?.id,
        userRole: req.user?.role,
        requestId: req.requestId,
        payload: req.body,
      });

      return res.json({
        success: true,
        data,
        requestId: req.requestId,
      });
    } catch (error) {
      return handleControllerError(error, req, res, next);
    }
  }

  async function deleteProduceImage(req, res, next) {
    try {
      const data = await service.deleteFarmerProduceImage({
        listingId: req.params.id,
        farmerId: req.user?.id,
        userRole: req.user?.role,
        requestId: req.requestId,
      });

      return res.json({
        success: true,
        data,
        requestId: req.requestId,
      });
    } catch (error) {
      return handleControllerError(error, req, res, next);
    }
  }

  return {
    getStatus,
    getProduceListings,
    getProduceListingById,
    getProduceListingDetails,
    createProduceListing,
    updateProduceListing,
    updateProduceListingStatus,
    requestProduceImageSignature,
    confirmProduceImageUpload,
    deleteProduceImage,
  };
}

const defaultController = createYm09Controller();

export const {
  getStatus,
  getProduceListings,
  getProduceListingById,
  getProduceListingDetails,
  createProduceListing,
  updateProduceListing,
  updateProduceListingStatus,
  requestProduceImageSignature,
  confirmProduceImageUpload,
  deleteProduceImage,
} = defaultController;
