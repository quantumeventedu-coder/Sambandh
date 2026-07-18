// Ambient augmentation: the per-request fields our tracing middleware hangs off
// the Express Request (see src/lib/request-log.js). Keeps @ts-check happy in the
// files that read req.reqId / req.log.
import 'express';
import type { Logger } from 'pino';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      reqId?: string;
      log?: Logger;
    }
  }
}

export {};
