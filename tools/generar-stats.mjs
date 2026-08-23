/**
 * Genera assets/stats.svg con datos reales de la cuenta.
 *
 * Existe para no depender de github-readme-stats: ese servicio corre en una
 * cuenta gratuita de Vercel y devuelve 503 con frecuencia, así que el perfil
 * acaba mostrando imágenes rotas. Aquí el SVG se genera y se guarda en el
 * repositorio, de modo que servirlo no depende de que nadie esté disponible.
 *
 * Uso:  GITHUB_TOKEN=... node tools/generar-stats.mjs TheJose24
 */
import { writeFileSync, mkdirSync } from 'node:fs';

const USUARIO = process.argv[2] ?? 'TheJose24';
const TOKEN = process.env.GITHUB_TOKEN;

const cabeceras = {
  accept: 'application/vnd.github+json',
  'user-agent': `perfil-${USUARIO}`,
  ...(TOKEN ? { authorization: `Bearer ${TOKEN}` } : {}),
};

async function api(ruta) {
  const res = await fetch(`https://api.github.com${ruta}`, { headers: cabeceras });
  if (!res.ok) throw new Error(`GET ${ruta} → ${res.status} ${await res.text()}`);
  return res.json();
}

/** Recorre la paginación hasta agotarla. */
async function todos(ruta) {
  const salida = [];
  for (let pagina = 1; ; pagina++) {
    const lote = await api(`${ruta}${ruta.includes('?') ? '&' : '?'}per_page=100&page=${pagina}`);
    salida.push(...lote);
    if (lote.length < 100) return salida;
  }
}

const usuario = await api(`/users/${USUARIO}`);
const repos = (await todos(`/users/${USUARIO}/repos`)).filter((r) => !r.fork);

const estrellas = repos.reduce((n, r) => n + r.stargazers_count, 0);

// Lenguajes por bytes reales, no por el lenguaje principal de cada repo: un
// repo con 3 KB de HTML no debería pesar igual que uno con 300 KB de Java.
const bytes = {};
for (const r of repos) {
  try {
    for (const [lenguaje, n] of Object.entries(await api(`/repos/${USUARIO}/${r.name}/languages`))) {
      bytes[lenguaje] = (bytes[lenguaje] ?? 0) + n;
    }
  } catch {
    // Un repo que falle no debe tumbar la generación entera.
  }
}

/**
 * Se excluye el marcado. Linguist cuenta las plantillas HTML y las hojas de
 * estilo de un proyecto Angular como lenguaje, y pesan tanto que HTML sale por
 * delante de Java. No es falso, pero describe mal a quien escribe backend: son
 * plantillas, no lógica. El SVG lo declara para que la exclusión sea visible.
 */
const IGNORAR = new Set([
  'HTML', 'CSS', 'SCSS', 'Less', 'Dockerfile', 'Batchfile', 'Shell',
  'Procfile', 'Makefile', 'Roff',
]);
const total = Object.entries(bytes)
  .filter(([l]) => !IGNORAR.has(l))
  .sort((a, b) => b[1] - a[1]);
const suma = total.reduce((n, [, v]) => n + v, 0);
const top = total.slice(0, 5).map(([lenguaje, n]) => ({
  lenguaje,
  pct: suma ? (n / suma) * 100 : 0,
}));

const COLORES = {
  Java: '#b07219', TypeScript: '#3178c6', HTML: '#e34c26', CSS: '#563d7c',
  JavaScript: '#f1e05a', Python: '#3572A5', PHP: '#4F5D95', SCSS: '#c6538c',
};
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const ANCHO = 480;
const filas = top
  .map((l, i) => {
    const y = 132 + i * 30;
    const barra = Math.max(2, (l.pct / 100) * 250);
    return `  <text class="m" x="24" y="${y + 4}" font-size="13" fill="#c9d1cd">${esc(l.lenguaje)}</text>
  <rect x="150" y="${y - 7}" width="250" height="8" rx="4" fill="#1b2022"/>
  <rect x="150" y="${y - 7}" width="${barra.toFixed(1)}" height="8" rx="4" fill="${COLORES[l.lenguaje] ?? '#4ade80'}"/>
  <text class="m" x="410" y="${y + 4}" font-size="12" fill="#697570">${l.pct.toFixed(1)} %</text>`;
  })
  .join('\n');

const ALTO = 132 + top.length * 30 + 26;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${ANCHO}" height="${ALTO}" viewBox="0 0 ${ANCHO} ${ALTO}" role="img" aria-label="Estadísticas de GitHub de ${esc(USUARIO)}">
  <style>
    .m { font-family: 'JetBrains Mono','Fira Code','SFMono-Regular',Consolas,monospace }
    .barra { animation: crecer .9s ease-out both }
    @keyframes crecer { from { transform: scaleX(0); transform-origin: left } to { transform: scaleX(1) } }
    @media (prefers-reduced-motion: reduce) { .barra { animation: none } }
  </style>
  <rect width="${ANCHO}" height="${ALTO}" rx="12" fill="#0b0d0e"/>
  <rect x="1" y="1" width="${ANCHO - 2}" height="${ALTO - 2}" rx="11" fill="none" stroke="#1b2022" stroke-width="2"/>

  <text class="m" x="24" y="38" font-size="15"><tspan fill="#4ade80">$ </tspan><tspan fill="#eef3ef">gh stats --user ${esc(USUARIO)}</tspan><tspan fill="#465049"> --sin-marcado</tspan></text>
  <line x1="24" y1="54" x2="${ANCHO - 24}" y2="54" stroke="#1b2022" stroke-width="2"/>

  <text class="m" x="24"  y="84" font-size="24" fill="#eef3ef">${repos.length}</text>
  <text class="m" x="24"  y="104" font-size="12" fill="#697570">repos</text>
  <text class="m" x="140" y="84" font-size="24" fill="#eef3ef">${estrellas}</text>
  <text class="m" x="140" y="104" font-size="12" fill="#697570">estrellas</text>
  <text class="m" x="270" y="84" font-size="24" fill="#eef3ef">${usuario.followers}</text>
  <text class="m" x="270" y="104" font-size="12" fill="#697570">seguidores</text>
  <text class="m" x="400" y="84" font-size="24" fill="#eef3ef">${new Date(usuario.created_at).getFullYear()}</text>
  <text class="m" x="400" y="104" font-size="12" fill="#697570">desde</text>

<g class="barra">
${filas}
</g>
</svg>
`;

mkdirSync('assets', { recursive: true });
writeFileSync('assets/stats.svg', svg);
console.log(`stats.svg: ${repos.length} repos · ${estrellas} estrellas · ${top.length} lenguajes`);
for (const l of top) console.log(`  ${l.lenguaje.padEnd(12)} ${l.pct.toFixed(1)} %`);
