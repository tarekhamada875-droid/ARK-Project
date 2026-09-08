import { createRequire } from 'node:module';

/**
 * Vercel entry point. The build command emits dist/server.cjs. Requiring that
 * explicit CommonJS filename avoids Vercel's extensionless ESM trace issue
 * (`Cannot find module /var/task/server`).
 */
export default async function handler(req: any, res: any) {
  try {
    const require = createRequire(import.meta.url);
    const serverModule = require('../dist/server.cjs');
    const appPromise = serverModule.default ?? serverModule;
    const app = await appPromise;
    return app(req, res);
  } catch (error) {
    console.error('[Vercel API] Express startup failed:', error);
    return res.status(503).json({ success: false, error: 'API_STARTUP_FAILED' });
  }
}
