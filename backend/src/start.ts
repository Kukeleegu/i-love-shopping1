/**
 * Entry point for the backend server.
 * Imports the Express app from server.ts and starts listening.
 * HOST defaults to 0.0.0.0 so the server is reachable from outside the process (e.g. Docker).
 */
import { app, PORT } from './server';

const HOST = process.env.HOST ?? '0.0.0.0';

app.listen(Number(PORT), HOST, () => {
  console.log(`🚀 Server running on http://${HOST}:${PORT}`);
  console.log(`📱 Testing page: http://${HOST}:${PORT}/test.html`);
});
