/**
 * storeAccess middleware — verifies a URL resource belongs to the authenticated user's store.
 *
 * Usage: Pass the Mongoose model to check ownership against.
 * Example in routes: router.delete('/:id', protect, storeAccess(Product), deleteProduct)
 *
 * This prevents IDOR/BOLA vulnerabilities where User A modifies User B's resources
 * by guessing or manipulating resource IDs.
 *
 * Returns 404 (not 403) for unowned resources to avoid leaking resource existence.
 */
const storeAccess = (Model) => {
  return async (req, res, next) => {
    try {
      if (!req.user || !req.storeId) {
        res.status(401);
        const err = new Error('Not authorized');
        return next(err);
      }

      const resourceId = req.params.id;
      if (!resourceId) {
        // No ID param — nothing to check ownership on, proceed
        return next();
      }

      // Validate it's a valid ObjectId to prevent CastError leaking
      if (!/^[a-fA-F0-9]{24}$/.test(resourceId)) {
        res.status(404);
        return next(new Error('Resource not found'));
      }

      const resource = await Model.findOne({ _id: resourceId, store: req.storeId });

      if (!resource) {
        // Log potential IDOR attempt
        console.warn(
          `[IDOR] Ownership check failed | userId: ${req.user._id} | storeId: ${req.storeId} | model: ${Model.modelName} | resourceId: ${resourceId} | IP: ${req.ip} | ${req.method} ${req.originalUrl}`
        );
        res.status(404);
        return next(new Error('Resource not found'));
      }

      // Attach the verified resource to the request for controller use (avoids a second DB lookup)
      req.resource = resource;
      next();
    } catch (err) {
      next(err);
    }
  };
};

module.exports = storeAccess;
