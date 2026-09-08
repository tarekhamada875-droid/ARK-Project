/**
 * Vercel entry point. The explicit source extension lets Vercel's Node
 * builder trace and package the Express server instead of leaving an
 * extensionless /var/task/server import that fails at runtime.
 */
export default async function handler(req: any, res: any) {
  try {
    // @ts-expect-error Vercel resolves and transpiles this server entry point.
    const serverModule = await import('../server.ts');
    const appPromise = serverModule.default ?? serverModule;
    const app = await appPromise;
    return app(req, res);
  } catch (error) {
    console.error('[Vercel API] Express startup failed:', error);
    return res.status(503).json({ success: false, error: 'API_STARTUP_FAILED' });
  }
}
