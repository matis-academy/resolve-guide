// Интерактивный справочник DaVinci Resolve: скриншоты страниц + зоны элементов (data/*.json).
// Зона: { id, group, kind: 'panel'|'control', box: [x, y, w, h] в пикселях скриншота, en, ru, what, use, keys, view?, go? }
const PAGES = [
  { id: 'edit', en: 'Edit', ru: 'Монтаж' },
  { id: 'color', en: 'Color', ru: 'Цвет' },
  { id: 'deliver', en: 'Deliver', ru: 'Экспорт' },
];
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const cache = {};
const load = async (name) => (cache[name] ??= fetch(`data/${name}.json?v=1`).then((r) => r.json()));

let common = null, page = null, view = null, pinned = null, hovered = null;
const zoneEl = new Map();             // id → элемент зоны на текущем виде

// ───────── загрузка страницы ─────────
async function openPage(id, viewId, areaId) {
  common ??= await load('common');
  page = await load(id);
  view = page.views.find((v) => v.id === viewId) || page.views[0];
  pinned = hovered = null;
  $('pages').querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.page === id)));
  $('views').hidden = page.views.length < 2;
  $('views').innerHTML = page.views.map((v, i) => `<button data-view="${v.id}" aria-pressed="${v.id === view.id}">${esc(v.ru || `Вид ${i + 1}`)}</button>`).join('');
  $('shot').src = view.image;
  $('shot').alt = `Страница ${page.en} в DaVinci Resolve`;
  $('stage').style.aspectRatio = `${view.w} / ${view.h}`;
  $('pageTitle').textContent = `Страница ${page.en} — ${page.ru}`;
  $('pageAbout').textContent = page.about || '';
  renderZones();
  renderList();
  hideCard();
  if (areaId) { const a = areaById(areaId); if (a) { pin(a); zoneEl.get(a.id)?.scrollIntoView({ block: 'center', inline: 'center' }); } }
  setHash();
}
const areasOfView = () => [...common.areas, ...page.areas.filter((a) => (a.view || page.views[0].id) === view.id)];
const allAreas = () => [...common.areas, ...page.areas];
const areaById = (id) => allAreas().find((a) => a.id === id);
const groupName = (gid) => [...(page.groups || []), ...common.groups].find((g) => g.id === gid)?.ru || '';

// панели снизу, кнопки сверху; крупные панели под мелкими
function renderZones() {
  const W = view.w, H = view.h;
  const list = areasOfView().slice().sort((a, b) => (a.kind === 'panel') === (b.kind === 'panel')
    ? b.box[2] * b.box[3] - a.box[2] * a.box[3] : a.kind === 'panel' ? -1 : 1);
  zoneEl.clear();
  $('zones').innerHTML = '';
  for (const a of list) {
    const el = document.createElement('button');
    el.className = `zone ${a.kind === 'panel' ? 'panel' : ''}`;
    const [x, y, w, h] = a.box;
    el.style.cssText = `left:${(x / W) * 100}%;top:${(y / H) * 100}%;width:${(w / W) * 100}%;height:${(h / H) * 100}%`;
    el.setAttribute('aria-label', `${a.en} — ${a.ru}`);
    el.dataset.id = a.id;
    $('zones').appendChild(el);
    zoneEl.set(a.id, el);
  }
  applySearch();
}

// ───────── подсветка и карточка ─────────
function highlight(a) {
  const hl = $('hl');
  if (!a) { hl.hidden = true; return; }
  const [x, y, w, h] = a.box, W = view.w, H = view.h;
  hl.hidden = false;
  hl.className = `hl ${a.kind === 'panel' ? 'panel' : ''}`;
  hl.style.cssText = `left:${(x / W) * 100}%;top:${(y / H) * 100}%;width:${(w / W) * 100}%;height:${(h / H) * 100}%`;
}
function cardHtml(a) {
  const keys = a.keys ? `<p class="keys">${a.keys.split(/\s*,\s*/).map((k) => `<kbd>${esc(k)}</kbd>`).join(' ')}</p>` : '';
  const src = a.unsure ? '<span class="src warn">Черновик: назначение элемента уточняется</span>' : a.src === 'manual' ? `<span class="src ok">Сверено с руководством${a.manual ? `, стр. ${esc(a.manual)}` : ''}</span>` : '<span class="src">Черновик — сверяется с руководством</span>';
  return `
    <div class="c-head"><small>${esc(groupName(a.group))}${a.kind === 'panel' ? ' · панель' : ''}</small><h3>${esc(a.en)}</h3><p class="ru">${esc(a.ru)}</p></div>
    <p>${esc(a.what)}</p>
    ${a.use ? `<p class="use"><b>Когда пригодится.</b> ${esc(a.use)}</p>` : ''}
    ${keys}
    <div class="c-foot">${src}${a.go && a.go !== page.id ? `<button data-go="${a.go}">Открыть страницу ${esc(a.en)} →</button>` : ''}${pinned === a ? '<button data-unpin>Закрыть</button>' : ''}</div>`;
}
function showCard(a) {
  const card = $('card');
  card.innerHTML = cardHtml(a);
  card.hidden = false;
  card.classList.toggle('pinned', pinned === a);
  placeCard(a);
}
function hideCard() { $('card').hidden = true; highlight(null); }
// карточка рядом с элементом: снизу, сверху или сбоку — где помещается
function placeCard(a) {
  const card = $('card');
  if (matchMedia('(max-width: 760px)').matches) { card.style.cssText = ''; return; }
  const z = zoneEl.get(a.id)?.getBoundingClientRect();
  if (!z) return;
  const cw = card.offsetWidth, ch = card.offsetHeight, vw = innerWidth, vh = innerHeight, gap = 10;
  let left = Math.min(vw - cw - 12, Math.max(12, z.left + z.width / 2 - cw / 2));
  let top = z.bottom + gap;
  if (a.kind === 'panel') { top = Math.min(vh - ch - 12, Math.max(12, z.top + 12)); left = z.right + gap + cw < vw ? z.right + gap : Math.max(12, z.left - cw - gap); if (z.width > vw * 0.5) left = Math.min(vw - cw - 12, Math.max(12, z.left + 20)); }
  else if (top + ch > vh - 8) top = z.top - gap - ch;
  if (top < 8) { top = Math.min(vh - ch - 8, Math.max(8, z.top)); left = z.right + gap + cw < vw ? z.right + gap : z.left - gap - cw; }
  card.style.left = `${Math.max(8, left)}px`;
  card.style.top = `${Math.max(8, top)}px`;
}
function hover(a) {
  if (pinned) return;
  hovered = a;
  if (!a) return hideCard();
  highlight(a); showCard(a);
}
function pin(a) {
  pinned = a; hovered = a;
  highlight(a); showCard(a);
  document.querySelectorAll('.list .on').forEach((x) => x.classList.remove('on'));
  document.querySelector(`.list [data-id="${CSS.escape(a.id)}"]`)?.classList.add('on');
  setHash();
}
function unpin() { pinned = null; hideCard(); document.querySelectorAll('.list .on').forEach((x) => x.classList.remove('on')); setHash(); }

const zones = $('zones');
zones.addEventListener('pointerover', (e) => { if (e.pointerType === 'touch') return; const z = e.target.closest('.zone'); if (z) hover(areaById(z.dataset.id)); });
zones.addEventListener('pointerleave', (e) => { if (e.pointerType !== 'touch') hover(null); });
zones.addEventListener('click', (e) => {
  const z = e.target.closest('.zone');
  if (!z) return;
  const a = areaById(z.dataset.id);
  if (pinned === a) unpin(); else pin(a);
});
$('card').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.go) openPage(b.dataset.go);
  if (b.dataset.unpin !== undefined) unpin();
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && pinned) unpin(); });
addEventListener('scroll', () => { const a = pinned || hovered; if (a && !$('card').hidden) placeCard(a); }, { passive: true });
$('stageScroll').addEventListener('scroll', () => { const a = pinned || hovered; if (a && !$('card').hidden) placeCard(a); }, { passive: true });
addEventListener('resize', () => { const a = pinned || hovered; if (a && !$('card').hidden) placeCard(a); });

// ───────── список всех элементов ─────────
function renderList() {
  const groups = [...(page.groups || []), ...common.groups];
  const areas = allAreas();
  $('list').innerHTML = groups.map((g) => {
    const items = areas.filter((a) => a.group === g.id);
    if (!items.length) return '';
    return `<details open><summary>${esc(g.ru)} <small>${items.length}</small></summary><ul>${items.map((a) => `<li><button data-id="${esc(a.id)}"><b>${esc(a.en)}</b><span>${esc(a.ru)}</span>${a.keys ? `<kbd>${esc(a.keys.split(/\s*,\s*/)[0])}</kbd>` : ''}</button></li>`).join('')}</ul></details>`;
  }).join('');
  applySearch();
}
$('list').addEventListener('pointerover', (e) => {
  const b = e.target.closest('button[data-id]');
  if (!b || pinned || e.pointerType === 'touch') return;
  const a = areaById(b.dataset.id);
  if ((a.view || page.views[0].id) === view.id || a.id.startsWith('common.')) highlight(a);
});
$('list').addEventListener('pointerleave', () => { if (!pinned) highlight(null); });
$('list').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-id]');
  if (!b) return;
  const a = areaById(b.dataset.id);
  const go = () => { zoneEl.get(a.id)?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' }); setTimeout(() => pin(a), 350); };
  if (!a.id.startsWith('common.') && (a.view || page.views[0].id) !== view.id) openPage(page.id, a.view).then(go); else go();
});

// ───────── поиск ─────────
function applySearch() {
  const q = $('q').value.trim().toLowerCase();
  let n = 0;
  for (const a of allAreas()) {
    const hit = !q || [a.en, a.ru, a.what, a.use, a.keys].join(' ').toLowerCase().includes(q);
    if (hit && q) n++;
    zoneEl.get(a.id)?.classList.toggle('found', !!q && hit);
    zoneEl.get(a.id)?.classList.toggle('dim', !!q && !hit);
    const li = document.querySelector(`.list [data-id="${CSS.escape(a.id)}"]`)?.parentElement;
    if (li) li.hidden = !hit;
  }
  document.querySelectorAll('.list details').forEach((d) => { d.hidden = ![...d.querySelectorAll('li')].some((li) => !li.hidden); });
  $('qCount').textContent = q ? `${n}` : '';
  $('stage').classList.toggle('searching', !!q);
}
$('q').addEventListener('input', applySearch);
$('showAll').addEventListener('change', (e) => $('stage').classList.toggle('show-all', e.target.checked));

// ───────── переключатели и адрес ─────────
$('pages').innerHTML = PAGES.map((p) => `<button data-page="${p.id}"><b>${p.en}</b><small>${p.ru}</small></button>`).join('');
$('pages').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) openPage(b.dataset.page); });
$('views').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) openPage(page.id, b.dataset.view); });
function setHash() { history.replaceState(null, '', `#${page.id}${view.id !== page.views[0].id ? `:${view.id}` : ''}${pinned ? `/${pinned.id}` : ''}`); }
function fromHash() {
  const m = location.hash.slice(1).match(/^(\w+)(?::(\w+))?(?:\/(.+))?$/);
  const id = m && PAGES.some((p) => p.id === m[1]) ? m[1] : 'edit';
  openPage(id, m?.[2], m?.[3] && decodeURIComponent(m[3]));
}
addEventListener('hashchange', fromHash);
fromHash();
window.__guide = { openPage, areaById, get page() { return page; }, get view() { return view; } };
