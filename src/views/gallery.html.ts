import type { Artifact } from '../lib/types.js';

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[character] as string);
}

export function galleryHtml(artifacts: Artifact[], selectedId?: string) {
  const selected = artifacts.find((artifact) => artifact.id === selectedId) ?? artifacts[0];
  const tags = [...new Set(artifacts.flatMap((artifact) => artifact.tags))].sort();
  const cards = artifacts.map((artifact) => `
    <a class="artifact-card" data-artifact-link href="/artifacts/${artifact.id}.html" data-title="${escapeHtml(artifact.title)}">
      <span class="source">${escapeHtml(artifact.source)}</span>
      <strong>${escapeHtml(artifact.title)}</strong>
      <span class="metadata">${new Date(artifact.createdAt).toLocaleDateString()} · ${Math.ceil(artifact.sizeBytes / 1024)} KB</span>
      <span class="tags">${artifact.tags.map((tag) => `<i>${escapeHtml(tag)}</i>`).join('')}</span>
    </a>`).join('');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#10120f">
  <link rel="manifest" href="/manifest.webmanifest">
  <title>Artifact Vault</title>
  <style>
    :root { color-scheme: dark; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; background: #10120f; color: #eeeede; }
    * { box-sizing: border-box; } body { margin: 0; min-height: 100vh; display: grid; grid-template-columns: minmax(240px, 330px) 1fr; }
    aside { padding: 24px; border-right: 1px solid #30362d; overflow-y: auto; } main { min-width: 0; padding: 24px; }
    h1 { font-size: 20px; letter-spacing: .08em; margin: 0 0 8px; text-transform: uppercase; } .subtitle { color: #9ba391; margin: 0 0 28px; font-size: 13px; }
    form { display: grid; gap: 10px; margin-bottom: 24px; } select, button { background: #1b2019; border: 1px solid #495245; color: inherit; padding: 9px; font: inherit; }
    button { background: #c9d69e; color: #10120f; cursor: pointer; } .artifact-list { display: grid; gap: 8px; }
    .artifact-card { display: grid; gap: 7px; padding: 13px; color: inherit; text-decoration: none; border: 1px solid #30362d; background: #151914; }
    .artifact-card:hover, .artifact-card:focus { border-color: #c9d69e; } .artifact-card strong { font-size: 14px; line-height: 1.35; }
    .source, .metadata { font-size: 11px; color: #9ba391; } .source { color: #c9d69e; text-transform: uppercase; } .tags { display: flex; flex-wrap: wrap; gap: 4px; }
    i { font-size: 10px; padding: 3px 5px; background: #293026; color: #c9d69e; font-style: normal; } .viewer-heading { display: flex; justify-content: space-between; gap: 16px; align-items: center; margin: 0 0 14px; }
    .viewer-heading h2 { margin: 0; font-size: 18px; } .viewer-heading a { color: #c9d69e; font-size: 12px; } iframe { width: 100%; height: calc(100vh - 100px); border: 1px solid #30362d; background: white; }
    .empty { color: #9ba391; padding: 20px 0; } @media (max-width: 720px) { body { display: block; } aside { border-right: 0; border-bottom: 1px solid #30362d; max-height: 45vh; } main { padding: 16px; } iframe { height: 70vh; } }
  </style>
</head>
<body>
  <aside>
    <h1>Artifact Vault</h1>
    <p class="subtitle">${artifacts.length} curated artifact${artifacts.length === 1 ? '' : 's'} · offline-ready</p>
    <form method="get">
      <select name="bucket" aria-label="Bucket"><option value="">All buckets</option><option value="operational">Operational</option><option value="understanding">Understanding</option></select>
      <select name="tag" aria-label="Tag"><option value="">All tags</option>${tags.map((tag) => `<option value="${escapeHtml(tag)}">${escapeHtml(tag)}</option>`).join('')}</select>
      <button type="submit">Filter</button>
    </form>
    <div class="artifact-list">${cards || '<p class="empty">No artifacts match this filter.</p>'}</div>
  </aside>
  <main>
    ${selected ? `<div class="viewer-heading"><h2 id="artifact-title">${escapeHtml(selected.title)}</h2><a id="open-artifact" href="/artifacts/${selected.id}.html" target="_blank" rel="noopener">Open directly</a></div><iframe id="artifact-viewer" title="${escapeHtml(selected.title)}" sandbox="allow-scripts allow-forms allow-popups allow-downloads" src="/artifacts/${selected.id}.html"></iframe>` : '<p class="empty">Push an HTML file to begin curating.</p>'}
  </main>
  <script>
    for (const select of document.querySelectorAll('select')) select.value = new URLSearchParams(location.search).get(select.name) || '';
    for (const link of document.querySelectorAll('[data-artifact-link]')) link.addEventListener('click', (event) => {
      event.preventDefault(); const viewer = document.querySelector('#artifact-viewer'); if (!viewer) return;
      viewer.src = link.href; viewer.title = link.dataset.title; document.querySelector('#artifact-title').textContent = link.dataset.title;
      document.querySelector('#open-artifact').href = link.href;
    });
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').then((registration) => {
      registration.addEventListener('updatefound', () => { const worker = registration.installing; worker?.addEventListener('statechange', () => { if (worker.state === 'installed' && navigator.serviceWorker.controller) location.reload(); }); });
    });
  </script>
</body>
</html>`;
}
