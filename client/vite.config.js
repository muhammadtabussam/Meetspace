import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export default defineConfig(({ mode }) => {
  const isHttps = process.env.HTTPS === 'true';
  let runtimePort;
  try {
    const portFromFile = Number(
      readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '..', '.server-port'), 'utf8').trim()
    );
    if (Number.isInteger(portFromFile) && portFromFile > 0 && portFromFile <= 65535) {
      runtimePort = portFromFile;
    }
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.warn('[Vite] Could not read the active backend port:', error.message);
    }
  }

  const backendPort =
    Number(process.env.VITE_SERVER_PORT) ||
    runtimePort ||
    Number(process.env.PORT) ||
    3001;
  const backendUrl = process.env.VITE_SERVER_URL || `http://localhost:${backendPort}`;
  const clientPortFile = resolve(dirname(fileURLToPath(import.meta.url)), '..', '.client-port');
  const recordClientPort = {
    name: 'meetspace-runtime-client-port',
    configureServer(server) {
      let activeClientPort;
      server.httpServer?.once('listening', () => {
        const address = server.httpServer.address();
        if (!address || typeof address === 'string') return;
        try {
          activeClientPort = address.port;
          writeFileSync(clientPortFile, `${activeClientPort}\n`, 'utf8');
        } catch (error) {
          console.error('[Vite] Could not record the active client port:', error.message);
        }
      });

      server.httpServer?.once('close', () => {
        try {
          if (readFileSync(clientPortFile, 'utf8').trim() === String(activeClientPort)) {
            unlinkSync(clientPortFile);
          }
        } catch (error) {
          if (error.code !== 'ENOENT') {
            console.error('[Vite] Could not clear the active client port file:', error.message);
          }
        }
      });
    },
  };

  return {
    plugins: [react(), isHttps ? basicSsl() : null, recordClientPort].filter(Boolean),
    server: {
      host: true,
      port: 5173,
      allowedHosts: ['.loca.lt'],
      proxy: {
        '/health': backendUrl,
        '/api': backendUrl,
        '/socket.io': {
          target: backendUrl,
          ws: true,
        },
      },
    },
  };
});
