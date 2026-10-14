#!/usr/bin/env node
// Gera um HTML único (sem servidor) com a documentação AsyncAPI embutida.
//   node build.mjs <spec.yaml> [-o saida.html] [--title "Texto"] [--check]
// Os bundles do AsyncAPI, js-yaml e marked são baixados do npm (só o tarball, versão fixa) e guardados em cache.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const ASYNCAPI_VERSION = '2.6.5';
const JSYAML_VERSION = '4.1.0';
const MARKED_VERSION = '4.3.0';
const here = dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);
const flag = (name) => { const i = args.indexOf(name); if (i < 0) return undefined; return args.splice(i, name === '--check' ? 1 : 2)[name === '--check' ? 0 : 1] ?? true; };
const check = flag('--check') === '--check';
const out = flag('-o');
const titleArg = flag('--title');
const specPath = args[0];
if (!specPath) { console.error('uso: node build.mjs <spec.yaml> [-o saida.html] [--title "Texto"] [--check]'); process.exit(2); }

const text = readFileSync(specPath, 'utf8');
if (!/^\s*["']?asyncapi["']?\s*:\s*["']?3\./m.test(text)) console.warn('aviso: não parece um AsyncAPI 3.x (falta "asyncapi: 3.x.x")');
const output = resolve(out || join(dirname(specPath), basename(specPath).replace(/\.(ya?ml|json)$/i, '') + '.html'));
const title = titleArg || text.match(/^\s{2}title:\s*(.+)$/m)?.[1].replace(/^["']|["']$/g, '') || 'Catálogo de eventos';

// baixa (uma vez) os pacotes npm usados; só o tarball, sem instalar dependências
function fetchPackage(name, version) {
  const cache = join(tmpdir(), `${name.replace(/[@/]/g, '_')}-${version}`);
  const pkg = join(cache, 'package');
  if (!existsSync(pkg)) {
    console.log(`Baixando ${name}@${version} do npm...`);
    mkdirSync(cache, { recursive: true });
    const tgz = execFileSync('npm', ['pack', `${name}@${version}`, '--silent', '--pack-destination', cache], { encoding: 'utf8', shell: process.platform === 'win32' }).trim().split('\n').pop();
    execFileSync('tar', ['-xzf', join(cache, tgz), '-C', cache]);
  }
  return pkg;
}
const pkg = fetchPackage('@asyncapi/react-component', ASYNCAPI_VERSION);
const marked = readFileSync(join(fetchPackage('marked', MARKED_VERSION), 'marked.min.js'), 'utf8');
const jsyaml = readFileSync(join(fetchPackage('js-yaml', JSYAML_VERSION), 'dist/js-yaml.min.js'), 'utf8');

// nada pode fechar a tag <script>/<style> antes da hora
const safeJs = (s) => s.replace(/<\/(script)/gi, '<\\/$1');
const safeCss = (s) => s.replace(/<\/(style)/gi, '<\\/$1');
const bundle = readFileSync(join(pkg, 'browser/standalone/index.js'), 'utf8');
const libCss = readFileSync(join(pkg, 'styles/default.min.css'), 'utf8');
const appCss = readFileSync(join(here, 'app.css'), 'utf8');
const appJs = readFileSync(join(here, 'app.js'), 'utf8');
const exportJs = readFileSync(join(here, 'export.js'), 'utf8');
const spec = JSON.stringify({ name: basename(specPath), title, text }).replace(/</g, '\\u003c');

const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="robots" content="noindex, nofollow" />
<title>${title.replace(/[<&]/g, (c) => (c === '<' ? '&lt;' : '&amp;'))}</title>
<style>${safeCss(libCss)}</style>
<style>${safeCss(appCss)}</style>
</head>
<body>
<div id="root"></div>
<script>window.__SPEC__ = ${spec};</script>
<script>${safeJs(bundle)}</script>
<script>${safeJs(jsyaml)}</script>
<script>${safeJs(marked)}</script>
<script>${safeJs(appJs)}</script>
<script>${safeJs(exportJs)}</script>
</body>
</html>
`;

if (check) {
  const current = existsSync(output) ? readFileSync(output, 'utf8') : null;
  if (current !== html) { console.error(`DEFASADO: ${output} não corresponde a ${specPath}. Rode: node ${join(here, 'build.mjs')} ${specPath}`); process.exit(1); }
  console.log('ok: HTML em dia com o YAML');
} else {
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, html);
  console.log(`Gerado ${output} (${(html.length / 1048576).toFixed(1)} MB)`);
}
