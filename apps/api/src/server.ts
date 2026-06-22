/**
 * Long-lived server entry — boots the Express app, pg-boss jobs, and an HTTP
 * listener. Used by the local `dev` script and any traditional Node host.
 *
 * NOTE: This file is intentionally NOT used by the Vercel serverless deploy.
 * Serverless imports `createApp()` from ./index.js directly (no port binding,
 * no pg-boss worker — see api/[...path].ts). The boot logic lives here, split
 * out of index.ts, so that importing the app factory has zero side effects.
 */

import { createApp } from './index.js';
import { env } from './env.js';
import { startJobs, stopJobs } from './jobs/index.js';

// Guard preserved for parity with the previous index.ts behaviour: in the test
// env we never boot (integration tests import createApp() directly).
if (env.NODE_ENV !== 'test') {
  const app = createApp();
  const port = env.PORT;

  // Boot pg-boss (escalation queue + worker) BEFORE the HTTP server starts so
  // the very first inbound request can already enqueue jobs.
  //
  // If startJobs() rejects (e.g. transient DB blip during boot), we crash the
  // process loudly with exit-code 1 so the deploy probe sees the failure.
  // Swallowing the rejection would leave getBossInstance() returning null
  // forever, silently skipping every escalation — a worse outcome than a
  // restart loop that surfaces the underlying problem.
  void (async () => {
    try {
      await startJobs();
    } catch (err) {
      console.error(
        JSON.stringify({
          event: 'startJobs_failed',
          err: err instanceof Error ? err.message : String(err),
        }),
      );
      process.exit(1);
    }

    const server = app.listen(port, () => {
      console.log(
        JSON.stringify({
          event: 'server_started',
          port,
          nodeEnv: env.NODE_ENV,
          timestamp: new Date().toISOString(),
        }),
      );
    });

    // Graceful shutdown — close the HTTP listener, drain pg-boss, exit.
    const shutdown = async (signal: string): Promise<void> => {
      console.log(JSON.stringify({ event: 'shutdown_received', signal }));
      server.close();
      await stopJobs();
      process.exit(0);
    };
    process.on('SIGTERM', () => void shutdown('SIGTERM'));
    process.on('SIGINT', () => void shutdown('SIGINT'));
  })();
}
