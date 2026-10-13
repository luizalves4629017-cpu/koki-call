import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import { createHash } from 'crypto';
import { defineConfig, type Plugin } from 'vite';

// Id deste build: o cliente guarda o que carregou e o servidor lê dist/version.json.
// Quando o Render sobe uma versão nova, os dois ficam diferentes e aparece "Nova atualização do Eco!".
// O id é um hash do CONTEÚDO do front (src, public, index.html, package.json...): o Cloudflare Pages e o
// Railway constroem o mesmo commit e chegam no MESMO id (antes era aleatório e os dois nunca batiam).
function hashFront(): string {
  const h = createHash('sha1');
  const raiz = __dirname;
  const visitar = (rel: string) => {
    const abs = path.join(raiz, rel);
    if (!fs.existsSync(abs)) return;
    const st = fs.statSync(abs);
    if (st.isDirectory()) {
      for (const n of fs.readdirSync(abs).sort()) visitar(path.join(rel, n));
    } else {
      h.update(rel.replace(/\\/g, '/'));
      h.update(fs.readFileSync(abs));
    }
  };
  ['src', 'public', 'index.html', 'package.json', 'package-lock.json', 'vite.config.ts', 'tsconfig.json'].forEach(visitar);
  return h.digest('hex').slice(0, 16);
}
const ECO_BUILD = (process.env.ECO_BUILD_ID || '').trim() || hashFront();
let saida = '';
const versaoEco = (): Plugin => ({
  name: 'eco-versao',
  apply: 'build',
  configResolved(c) {
    saida = path.resolve(c.root, c.build.outDir);
  },
  closeBundle() {
    const dir = saida || path.resolve(__dirname, 'dist');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'version.json'), JSON.stringify({ versao: ECO_BUILD, geradoEm: Date.now() }));
  },
});

export default defineConfig(() => {
  return {
    base: '/',
    define: {
      __ECO_BUILD__: JSON.stringify(ECO_BUILD),
    },
    plugins: [react(), tailwindcss(), versaoEco()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    build: {
      outDir: 'dist',
      // No Cloudflare Pages (CF_PAGES=1) não publica sourcemaps
      sourcemap: process.env.CF_PAGES ? false : true,
    },
  };
});
