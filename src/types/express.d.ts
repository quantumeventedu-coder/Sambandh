// Express Request augmentation.
//
// requireAuth / requireAdmin / requireSuperAdmin attach the caller's identity to
// the request object (src/routes-auth.js). Express's own Request type knows
// nothing about those fields, so every `req.userId` read is a type error until we
// declare them here. Declaring them once, centrally, is also documentation: this
// is the complete set of things auth puts on a request.

import 'express';

declare global {
  namespace Express {
    interface Request {
      /** Set by requireAuth from the JWT. 'super-admin' / 'admin-panel' for key auth. */
      userId?: string;
      /** Set by requireAuth from the JWT payload. */
      phone?: string;
      /** 'user' | 'moderator' | 'admin' | 'super_admin'. */
      role?: string;
      /** Set by requireAuth when the token is within 7 days of expiry (auto-refresh). */
      refreshedToken?: string;
    }
  }
}
