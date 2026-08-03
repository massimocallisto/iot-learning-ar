import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';

const backendTarget = process.env.BACKEND_URL || 'https://localhost:3001';

const backendProxy = {
  target: backendTarget,
  changeOrigin: true,
  secure: false
};

function httpsConfig() {
  const keyPath = process.env.HTTPS_KEY_PATH;
  const certPath = process.env.HTTPS_CERT_PATH;

  if (!keyPath || !certPath) return undefined;

  const resolvedKey = path.resolve(process.cwd(), keyPath);
  const resolvedCert = path.resolve(process.cwd(), certPath);

  if (!fs.existsSync(resolvedKey) || !fs.existsSync(resolvedCert)) {
    console.warn('[vite] HTTPS cert/key non trovati. Avvio senza HTTPS.');
    return undefined;
  }

  return {
    key: fs.readFileSync(resolvedKey),
    cert: fs.readFileSync(resolvedCert)
  };
}

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 4200,
    https: httpsConfig(),
    proxy: {
      '/api': backendProxy,
      '/textures': backendProxy
    }
  },
  preview: {
    host: '0.0.0.0',
    port: 4200,
    https: httpsConfig(),
    proxy: {
      '/api': backendProxy,
      '/textures': backendProxy
    }
  }
});
