/**
 * Vercel entry point. The build command creates api/server.cjs beside this
 * handler. Firebase Admin 13 uses a CommonJS-compatible dependency tree.
 */
export default async function handler(req: any, res: any) {
  try {
    const serverModule = await import('./server.cjs');
    const appPromise = serverModule.default?.default ?? serverModule.default ?? serverModule;
    const app = await appPromise;
    return app(req, res);
  } catch (error) {
    console.error('[Vercel API] Express startup failed:', error);
    const detail = error instanceof Error ? error.message : String(error);
    return res.status(503).json({ success: false, error: 'API_STARTUP_FAILED', detail });
  }
}
