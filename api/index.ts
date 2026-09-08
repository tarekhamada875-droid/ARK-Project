import { createRequire } from 'node:module';

/**
 * Vercel entry point. The build command creates api/server.cjs beside this
 * handler, avoiding extensionless ESM tracing and output-directory pruning.
 */
export default async function handler(req: any, res: any) {
  try {
    const require = createRequire(import.meta.url);
    const serverModule = require('./server.cjs');
    const appPromise = serverModule.default ?? serverModule;
    const app = await appPromise;
    return app(req, res);
  } catch (error) {
    console.error('[Vercel API] Express startup failed:', error);
    const detail = error instanceof Error ? error.message : String(error);
    return res.status(503).json({ success: false, error: 'API_STARTUP_FAILED', detail });
  }
}
