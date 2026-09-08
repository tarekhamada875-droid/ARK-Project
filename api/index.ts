import appPromise from '../server';

/**
 * Vercel entry point. The Express app is initialized once per warm function
 * and awaited before forwarding the request, rather than exporting a Promise
 * as the handler itself.
 */
export default async function handler(req: any, res: any) {
  const app = await appPromise;
  return app(req, res);
}
