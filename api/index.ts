/**
 * Vercel entry point. The build command creates api/server.mjs beside this
 * handler. Dynamic import keeps Firebase Admin's ESM dependencies compatible.
 */
export default async function handler(req: any, res: any) {
  try {
    const serverModule = await import('./server.mjs');
    const appPromise = serverModule.default ?? serverModule;
    const app = await appPromise;
    return app(req, res);
  } catch (error) {
    console.error('[Vercel API] Express startup failed:', error);
    const detail = error instanceof Error ? error.message : String(error);
    return res.status(503).json({ success: false, error: 'API_STARTUP_FAILED', detail });
  }
}
