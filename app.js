/* 库存进销存智能管理看板系统（销量导向版） */
/* 改造重点：以各产品销量为核心指标，金额弱化展示 */
'use strict';

/* ---------------- 工具 ---------------- */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const N = v => { if (v == null) return 0; const n = parseFloat(String(v).replace(/[,，\s¥￥]/g, '')); return isNaN(n) ? 0 : n; };
const fmt = (n, d = 2) => (Math.round(n * 1e6) / 1e6).toLocaleString('zh-CN', { minimumFractionDigits: d, maximumFractionDigits: d });
const money = n => '¥' + fmt(n, 2);           /* 金额（次要展示） */
const qtyF = n => fmt(n, 3);                  /* 销量格式化（主要展示） */
const wan = n => Math.abs(n) >= 10000 ? (n / 10000).toFixed(2) + ' 万' : fmt(n, 2);
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const uniq = a => [...new Set(a)].filter(x => x !== '' && x != null).sort((x, y) => String(x).localeCompare(String(y), 'zh'));
const sum = (a, f) => a.reduce((s, x) => s + (f ? f(x) : x), 0);

function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('on'); clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('on'), 2600); }
function log(el, m, err) { const e = $(el); e.classList.add('on'); e.innerHTML += (err ? `<span class="e">${esc(m)}</span>` : esc(m)) + '\n'; e.scrollTop = e.scrollHeight; }

/* 商品名归一化 */
function nk(s) {
  return String(s || '')
    .replace(/（每[袋瓶桶件箱]）/g, '')
    .replace(/[（(][^）)]*[）)]/g, '')
    .replace(/20\d\d版|新版|旧版/g, '')
    .replace(/[\s\-—_.、,，/／]/g, '')
    .replace(/\.\.\.$/, '')
    .toLowerCase();
}
const PALETTE = ['#4aa8ff', '#22d3a8', '#ffab3d', '#a78bfa', '#ff5d6c', '#2fd07a', '#f472b6', '#38bdf8', '#fbbf24', '#818cf8', '#34d399', '#fb7185', '#60a5fa', '#c084fc', '#facc15'];
// ====== 图片产品分类体系（17类）======
const CATS = [
  { cat: '中端盐',       keywords: ['中端盐', '加碘精制盐', '绿色加碘', '加碘盐', '400g', '500g'] },
  { cat: '洗涤盐',       keywords: ['洗涤盐', '洗涤用'] },
  { cat: '高端盐',       keywords: ['高端盐', '精制盐', '精致盐', '晶盐', '礼盒'] },
  { cat: '工业海湖盐',   keywords: ['工业海湖盐'] },
  { cat: '小包装白砂糖', keywords: ['小包装白砂糖', '400g白砂糖', '小包白砂糖', '50g白砂糖'] },
  { cat: '农发产品',     keywords: ['农发产品', '大豆油', '菜籽油', '花生油', '茶油', '调和油', '色拉油', '米面', '大米', '面粉', '麦片', '燕麦', '挂面', '面条', '酱油', '料酒', '香油', '麻油', '花生酱', '芝麻酱', '千湖'] },
  { cat: '大包装白砂糖', keywords: ['大包装白砂糖', '25kg白砂糖', '50kg白砂糖', '大包白砂糖', '吨包白砂糖'] },
  { cat: '食用海湖盐',   keywords: ['食用海湖盐'] },
  { cat: '基础盐',       keywords: ['基础盐', '未加碘盐', '无碘盐', '未加碘'] },
  { cat: '工业盐',       keywords: ['工业盐', '工业用盐', '云鹤牌50kg工业盐'] },
  { cat: '特渠盐',       keywords: ['特渠盐', '特通盐', '特供', '特渠'] },
  { cat: '大袋未加碘盐', keywords: ['大袋未加碘盐', '大袋未加碘'] },
  { cat: '大袋精制碘盐', keywords: ['大袋精制碘盐', '大袋加碘盐', '大袋碘盐', '大袋加碘'] },
  { cat: '次品盐',       keywords: ['次品盐', '不合格盐', '废盐'] },
  { cat: '醋',           keywords: ['醋', '香醋', '陈醋', '白醋', '米醋', '果醋', '武当醋', '熏醋'] },
  { cat: '酱油',         keywords: ['酱油', '生抽', '老抽'] },
  { cat: '其他调味品',   keywords: ['鸡精', '味精', '糖', '胡椒', '辣椒', '花椒', '八角', '桂皮', '茴香', '孜然', '咖喱', '番茄酱', '沙拉酱', '芥末', '泡菜', '腐乳'] },
];
function guessCatByImage(name) {
  const n = nk(name);
  for (const c of CATS) {
    for (const kw of c.keywords) {
      if (n.includes(nk(kw))) return c.cat;
    }
  }
  return null;
}

// ============== 多端同步引擎（房间制）==============
const SYNC_BACKEND = 'https://jingzhou-inventory-dashboard.netlify.app/api/data';
const ROOMS_KEY = 'inms_rooms_v1';
const ROOM_KEY = 'inms_current_room_v1';
const CHAN_NAME = 'inms_sync_v1';
const POLL_MS = 30000;

function loadRooms() {
  try { return JSON.parse(localStorage.getItem(ROOMS_KEY)) || []; } catch (e) { return []; }
}
function saveRooms(arr) { try { localStorage.setItem(ROOMS_KEY, JSON.stringify(arr)); } catch (e) { } }
function getRoomId() { return localStorage.getItem(ROOM_KEY) || ''; }
function setRoomId(id) { localStorage.setItem(ROOM_KEY, id); S.roomId = id; updateRoomUI(); }
function makeRoomId(name) {
  const slug = (name || 'room').replace(/[^\w一-\u9fff-]+/g, '-').slice(0, 24) || 'room';
  return 'inv-' + slug + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

async function cloudGet(roomId) {
  try {
    const r = await fetch(SYNC_BACKEND + '?key=' + encodeURIComponent(roomId) + '&t=' + Date.now(), { cache: 'no-store' });
    if (!r.ok) return null;
    const j = await r.json();
    if (j.ok && j.data && j.data.data) return j.data.data;
    return null;
  } catch (e) { return null; }
}
async function cloudPut(roomId, payload) {
  try {
    const body = JSON.stringify({ data: payload });
    const r = await fetch(SYNC_BACKEND + '?key=' + encodeURIComponent(roomId), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, cache: 'no-store' });
    return r.ok;
  } catch (e) { return false; }
}

let _bc = null;
function setupBC() {
  try {
    if ('BroadcastChannel' in window) {
      _bc = new BroadcastChannel(CHAN_NAME);
      _bc.onmessage = e => {
        if (e.data && e.data.type === 'sync' && e.data.roomId === getRoomId()) {
          try {
            const c = localStorage.getItem(LS);
            if (c) {
              const j = JSON.parse(c);
              if (j && j.periods) { S.data = j; fillPeriods(); renderAll(); }
            }
          } catch (err) {}
        }
      };
    }
  } catch (e) { _bc = null; }
}
function broadcastSync() {
  try { if (_bc) _bc.postMessage({ type: 'sync', roomId: getRoomId(), ts: Date.now() }); } catch (e) { }
}

async function push(silent) {
  const roomId = getRoomId();
  if (!roomId) {
    if (!silent) toast('请先创建或加入一个房间');
    setBadge('本地模式', '');
    return false;
  }
  try {
    localStorage.setItem(LS, JSON.stringify(S.data));
  } catch (e) { }
  S.data.updatedAt = Date.now();
  S.data.roomId = roomId;
  try {
    const ok = await cloudPut(roomId, S.data);
    if (ok) {
      S.online = true;
      setBadge('云端已同步', 'ok');
      log('#syncLog', '已上传到房间 ' + roomId + ' · ' + new Date().toLocaleString());
      if (!silent) toast('已同步到云端，其他设备刷新即可看到');
      broadcastSync();
      return true;
    }
    throw new Error('cloud fail');
  } catch (e) {
    setBadge('离线模式', 'err');
    if (!silent) toast('上传失败（离线）：已保存到本机');
    return false;
  }
}

async function pull(silent) {
  const roomId = getRoomId();
  if (!roomId) {
    if (!silent) toast('请先创建或加入一个房间');
    setBadge('本地模式', '');
    return false;
  }
  try {
    const remote = await cloudGet(roomId);
    console.log('[pull] remote:', remote ? { periods: Object.keys(remote.periods||{}), updatedAt: remote.updatedAt } : null);
    console.log('[pull] local:', { periods: Object.keys(S.data.periods), updatedAt: S.data.updatedAt });
    if (remote && remote.periods && Object.keys(remote.periods).length) {
      const remoteTime = remote.updatedAt || 0;
      const localTime = S.data.updatedAt || 0;
      console.log('[pull] timestamp compare: remote=' + remoteTime + ' >= local=' + localTime + ' ?', remoteTime >= localTime);
      if (remoteTime >= localTime) {
        S.data = remote;
        try { localStorage.setItem(LS, JSON.stringify(S.data)); } catch (e) { }
        fillPeriods(); renderAll();
        S.online = true;
        setBadge('云端已同步', 'ok');
        if (!silent) toast('已从云端拉取最新数据');
        return true;
      } else {
        S.online = true;
        setBadge('本地最新', '');
        if (!silent) toast('本地数据已是最新');
        return true;
      }
    }
    S.online = true;
    setBadge('云端为空', '');
    if (!silent) toast('云端无数据，请先上传');
  } catch (e) {
    console.error('[pull] error:', e);
    S.online = false; setBadge('离线模式', 'err');
    if (!silent) toast('拉取失败（离线）');
  }
  return false;
}

let _pollTimer = null;
function startPoll() {
  if (_pollTimer) clearInterval(_pollTimer);
  _pollTimer = setInterval(() => {
    if (!document.hidden && getRoomId()) {
      pull(true);
    }
  }, POLL_MS);
}

function updateRoomUI() {
  const room = getRoomId();
  const el = document.getElementById('roomBadge');
  if (el) el.textContent = room ? ('🏠 ' + room.replace(/^inv-/, '').split('-').slice(0,2).join('-')) : '🏠 未加入房间';
  const meta = document.getElementById('roomMeta');
  if (meta) meta.textContent = room ? ('当前房间：' + room + ' · ' + (S.data.periods ? Object.keys(S.data.periods).length : 0) + ' 个期间') : '当前房间：未加入（仅本机保存）';
}

function showRoomDialog() {
  const dlg = document.getElementById('roomDlg');
  if (!dlg) return;
  dlg.style.display = 'flex';
  renderRoomList();
}
function hideRoomDialog() { const dlg = document.getElementById('roomDlg'); if (dlg) dlg.style.display = 'none'; }

function renderRoomList() {
  const list = document.getElementById('roomList');
  if (!list) return;
  const rooms = loadRooms();
  if (!rooms.length) {
    list.innerHTML = '<div class="empty">暂无房间，请创建或加入</div>';
    return;
  }
  list.innerHTML = rooms.map(r =>
    '<div class="room-row' + (r.id === getRoomId() ? ' cur' : '') + '">' +
      '<div class="rname">' + escapeHtml(r.name) + '<small>' + escapeHtml(r.id) + '</small></div>' +
      '<div class="raction">' +
        (r.id !== getRoomId() ? '<button class="btn" data-act="join" data-id="' + escapeHtml(r.id) + '">加入</button>' : '<span class="badge ok">当前</span>') +
        '<button class="btn ghost" data-act="copy" data-id="' + escapeHtml(r.id) + '">复制ID</button>' +
        '<button class="btn danger" data-act="del" data-id="' + escapeHtml(r.id) + '">删除</button>' +
      '</div>' +
    '</div>'
  ).join('');
}

function escapeHtml(s) { return String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

async function createRoom() {
  const input = document.getElementById('newRoomName');
  const name = (input && input.value || '').trim() || ('room-' + Date.now().toString(36));
  const id = makeRoomId(name);
  const rooms = loadRooms();
  rooms.unshift({ id, name, createdAt: Date.now() });
  saveRooms(rooms);
  setRoomId(id);
  if (!S.data.periods || !Object.keys(S.data.periods).length) {
    try {
      const r = await fetch('data/seed.json?t=' + Date.now());
      const seed = await r.json();
      S.data = { periods: { [seed.period]: seed }, updatedAt: Date.now(), roomId: id };
    } catch (e) {}
  }
  await push(true);
  hideRoomDialog();
  toast('已创建并加入房间「' + name + '」');
  fillPeriods(); renderAll();
  updateRoomUI();
}

function joinRoom(id) {
  setRoomId(id);
  hideRoomDialog();
  toast('已加入房间，正在拉取云端数据…');
  updateRoomUI();
  pull(false).then(() => updateRoomUI());
}

function leaveRoom() {
  setRoomId('');
  hideRoomDialog();
  toast('已退出房间');
  updateRoomUI();
}

async function copyRoomId(id) {
  try {
    await navigator.clipboard.writeText(id);
    toast('房间 ID 已复制：' + id);
  } catch (e) {
    const ta = document.createElement('textarea');
    ta.value = id; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); toast('房间 ID 已复制'); } catch (e2) { toast('复制失败'); }
    document.body.removeChild(ta);
  }
}

function deleteRoom(id) {
  if (!confirm('确定从房间列表中删除「' + id + '」？此操作仅清除本地记录，不会删除云端数据。')) return;
  const rooms = loadRooms().filter(r => r.id !== id);
  saveRooms(rooms);
  if (getRoomId() === id) leaveRoom();
  else renderRoomList();
}
// ============================================================
// END SYNC ENGINE
// ============================================================


/* ---------------- 全局状态 ---------------- */
const S = { data: { periods: {}, updatedAt: 0 }, period: '', charts: {}, pending: null, online: false };
const LS = 'inv_dashboard_v1';

/* ---------------- 图表 ---------------- */
Chart.defaults.color = '#94a6c4';
Chart.defaults.borderColor = 'rgba(255,255,255,.06)';
Chart.defaults.font.family = '-apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
function chart(id, cfg) {
  const el = document.getElementById(id); if (!el) return;
  if (S.charts[id]) S.charts[id].destroy();
  cfg.options = Object.assign({ responsive: true, maintainAspectRatio: false }, cfg.options || {});
  S.charts[id] = new Chart(el, cfg);
}
const shortLabel = s => { s = String(s); return s.length > 14 ? s.slice(0, 13) + '…' : s; };

/* ---------------- 派生计算 ---------------- */
function cur() { return S.data.periods[S.period] || { sales: [], salesSummary: [], purchase: [], stock: [] }; }

/* 单价表：product -> {price, unit, cat} */
function priceMap(P) {
  const m = new Map();
  (P.salesSummary || []).forEach(r => {
    if (r.qty) m.set(nk(r.product), { price: r.amount / r.qty, unit: r.unit, cat: r.cat, name: r.product });
  });
  return m;
}
function catOf(P, name) {
  const pm = priceMap(P); const h = pm.get(nk(name));
  if (h && h.cat) return h.cat;
  const n = nk(name);
  const imgCat = guessCatByImage(name);
  if (imgCat) return imgCat;
  if (/白砂糖|糖/.test(n)) return '小包装白砂糖';
  if (/醋/.test(n)) return '醋';
  if (/酱油/.test(n)) return '酱油';
  if (/油|酒|料酒/.test(n)) return '农发产品';
  if (/工业/.test(n)) return '工业盐';
  if (/洗涤/.test(n)) return '洗涤盐';
  return '基础盐';
}
function amtOf(pm, r) { const h = pm.get(nk(r.product)); return h ? r.mainQty * h.price : 0; }

/* 库存台账 */
function buildLedger(P, opt) {
  const pm = priceMap(P);
  const map = new Map();
  const g = (name) => {
    const k = nk(name);
    if (!map.has(k)) map.set(k, { key: k, name, cat: '', unit: '', purchase: 0, soldQty: 0, soldAmt: 0, stock: 0, whs: new Set(), specs: new Set() });
    return map.get(k);
  };
  (P.purchase || []).forEach(r => { const o = g(r.product); o.purchase += r.qty; o.cat = o.cat || r.cat; o.unit = o.unit || r.unit; });
  (P.salesSummary || []).forEach(r => { const o = g(r.product); o.soldQty += r.qty; o.soldAmt += r.amount; o.cat = o.cat || r.cat; o.unit = o.unit || r.unit; });
  (P.stock || []).forEach(r => { const o = g(r.product); o.stock += r.stock; o.unit = o.unit || r.unit; if (r.warehouse) o.whs.add(r.warehouse); if (r.spec) o.specs.add(r.spec); });
  (P.sales || []).forEach(r => {
    const k = nk(r.product);
    if (!map.has(k)) { const o = g(r.product); o.soldQty += r.mainQty; o.soldAmt += amtOf(pm, r); o.unit = o.unit || r.mainUnit; }
  });

  const days = opt.warnDays, arr = [];
  map.forEach(o => {
    if (!o.cat) {
      const imgCat = guessCatByImage(o.name);
      o.catSource = imgCat ? 'image' : 'fallback';
      o.cat = imgCat || catOf(P, o.name);
    } else {
      o.catSource = 'original';
    }
    o.open = o.stock + o.soldQty - o.purchase;
    o.daily = o.soldQty / 30;
    o.turn = o.daily > 0 ? o.stock / o.daily : (o.stock > 0 ? 999 : 0);
    o.safe = o.daily * days;
    if (o.soldQty > 0 && o.stock <= 0) o.status = '断货/缺货';
    else if (o.soldQty > 0 && o.stock < o.safe) o.status = '低于安全库存';
    else if (o.soldQty <= 0 && o.stock > 0) o.status = '呆滞积压';
    else o.status = '正常';
    o.warehouse = [...o.whs].join(' / ');
    o.spec = [...o.specs][0] || '';
    arr.push(o);
  });
  return arr.sort((a, b) => b.soldQty - a.soldQty);  /* 核心排序：按销量 */
}
const STCLS = { '断货/缺货': 'p-red', '低于安全库存': 'p-org', '正常': 'p-grn', '呆滞积压': 'p-gry' };
function opts() { return { warnDays: N($('#warnDays').value) || 30, warnZero: $('#warnZero').checked, warnDead: N($('#warnDead').value) }; }

/* 表格渲染 */
function table(sel, cols, rows, extra) {
  const el = $(sel);
  if (!rows.length) { el.innerHTML = `<tbody><tr><td class="empty">暂无数据</td></tr></tbody>`; return; }
  const th = cols.map(c => `<th class="${c.n ? 'num' : ''}">${esc(c.t)}</th>`).join('');
  const tb = rows.map(r => `<tr class="${r._cls || ''}">` + cols.map(c => {
    const v = c.f ? c.f(r) : r[c.k];
    return `<td class="${c.n ? 'num' : ''}">${c.html ? v : esc(v)}</td>`;
  }).join('') + '</tr>').join('');
  el.innerHTML = `<thead><tr>${th}</tr></thead><tbody>${tb}${extra || ''}</tbody>`;
}
function csv(name, cols, rows) {
  const lines = [cols.map(c => c.t).join(',')];
  rows.forEach(r => lines.push(cols.map(c => {
    let v = c.f ? String(c.f(r)).replace(/<[^>]+>/g, '') : r[c.k];
    v = String(v == null ? '' : v).replace(/"/g, '""');
    return /[",\n]/.test(v) ? `"${v}"` : v;
  }).join(',')));
  const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click();
  toast('已导出 ' + name);
}

/* ================= 渲染：总览 ================= */
function renderOverview() {
  const P = cur(), pm = priceMap(P), L = buildLedger(P, opts());
  const totalAmt = sum(P.salesSummary, r => r.amount);
  const totalQty = sum(P.salesSummary, r => r.qty);
  const purQty = sum(P.purchase, r => r.qty);
  const stkQty = sum(P.stock, r => r.stock);
  const warns = L.filter(o => o.status !== '正常');
  const staffN = uniq(P.sales.map(r => r.sales)).length;
  const custN = uniq(P.sales.map(r => r.customer)).length;

  /* KPI：销量为主，金额为辅 */
  $('#kpis').innerHTML = [
    ['本期总销量', qtyF(totalQty), '主数量合计', 'g'],
    ['销售总额', money(totalAmt), wan(totalAmt) + ' 元（参考）', ''],
    ['本期购进', qtyF(purQty), '主数量合计', 'p'],
    ['期末现存量', qtyF(stkQty), P.stock.length + ' 个库存条目', 'o'],
    ['预警商品', warns.length, '需关注 / 共 ' + L.length + ' 个SKU', warns.length ? 'r' : 'g'],
    ['业务员 / 客户', staffN + ' / ' + custN, P.sales.length + ' 条销售明细', 'p'],
  ].map(([k, v, s, c]) => `<div class="kpi ${c}"><div class="k">${k}</div><div class="v">${v}</div><div class="s">${s}</div></div>`).join('');

  /* 品类饼图：按销量 */
  const byCat = {}; P.salesSummary.forEach(r => byCat[r.cat] = (byCat[r.cat] || 0) + r.qty);
  const cats = Object.keys(byCat).sort((a, b) => byCat[b] - byCat[a]);
  chart('chCatPie', {
    type: 'doughnut',
    data: { labels: cats, datasets: [{ data: cats.map(c => byCat[c]), backgroundColor: PALETTE, borderWidth: 0 }] },
    options: { cutout: '58%', plugins: { legend: { position: 'right', labels: { boxWidth: 10, font: { size: 11 } } }, tooltip: { callbacks: { label: c => c.label + ' ' + qtyF(c.raw) + '（' + (totalQty ? c.raw / totalQty * 100 : 0).toFixed(1) + '%）' } } } }
  });

  /* 进销存对比（PSI）：数量维度 */
  const cc = {}; L.forEach(o => { const c = o.cat || '其他'; cc[c] = cc[c] || { p: 0, s: 0, k: 0 }; cc[c].p += o.purchase; cc[c].s += o.soldQty; cc[c].k += o.stock; });
  const ck = Object.keys(cc).sort((a, b) => cc[b].s - cc[a].s).slice(0, 9);
  chart('chPSI', {
    type: 'bar',
    data: {
      labels: ck.map(shortLabel), datasets: [
        { label: '购进', data: ck.map(c => cc[c].p), backgroundColor: '#a78bfa' },
        { label: '销售', data: ck.map(c => cc[c].s), backgroundColor: '#4aa8ff' },
        { label: '现存', data: ck.map(c => cc[c].k), backgroundColor: '#22d3a8' }]
    },
    options: { scales: { y: { type: 'logarithmic', ticks: { font: { size: 10 } } }, x: { ticks: { font: { size: 10 }, maxRotation: 40 } } }, plugins: { legend: { labels: { boxWidth: 10 } } } }
  });

  /* 每日趋势：展示销量和金额（金额弱化） */
  const byDayAmt = {}; P.sales.forEach(r => { if (r.date) byDayAmt[r.date] = (byDayAmt[r.date] || 0) + amtOf(pm, r); });
  const byDayQty = {}; P.sales.forEach(r => { if (r.date) byDayQty[r.date] = (byDayQty[r.date] || 0) + r.mainQty; });
  const ds = Object.keys(byDayQty).sort();
  chart('chDaily', {
    type: 'line',
    data: {
      labels: ds.map(d => d.slice(5)),
      datasets: [
        { label: '销量', data: ds.map(d => byDayQty[d]), borderColor: '#22d3a8', backgroundColor: 'rgba(34,211,168,.18)', fill: true, tension: .35, pointRadius: 3, yAxisID: 'y' },
        { label: '金额(万)', data: ds.map(d => byDayAmt[d]), borderColor: '#4aa8ff', backgroundColor: 'rgba(74,168,255,.1)', fill: false, tension: .35, pointRadius: 2, yAxisID: 'y1' }
      ]
    },
    options: {
      plugins: { legend: { display: true, labels: { boxWidth: 10 } }, tooltip: { callbacks: { label: c => c.dataset.label + '：' + (c.datasetIndex === 0 ? qtyF(c.raw) : money(c.raw)) } } },
      scales: {
        y: { type: 'linear', position: 'left', title: { display: true, text: '销量', color: '#22d3a8' }, ticks: { font: { size: 10 } } },
        y1: { type: 'linear', position: 'right', title: { display: true, text: '金额', color: '#4aa8ff' }, grid: { drawOnChartArea: false }, ticks: { callback: v => wan(v), font: { size: 10 } } }
      }
    }
  });

  /* 业务员排名：按销量 */
  const st = {}; P.sales.forEach(r => { st[r.sales] = st[r.sales] || { qty: 0, amt: 0, cnt: 0 }; st[r.sales].qty += r.mainQty; st[r.sales].amt += amtOf(pm, r); st[r.sales].cnt++; });
  const sk = Object.keys(st).sort((a, b) => st[b].qty - st[a].qty);
  chart('chStaff', {
    type: 'bar',
    data: { labels: sk.map(shortLabel), datasets: [{ label: '销量', data: sk.map(k => st[k].qty), backgroundColor: PALETTE }] },
    options: { indexAxis: 'y', plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => c.label + ' ' + qtyF(c.raw) } } }, scales: { x: { ticks: { font: { size: 10 } } } } }
  });

  $('#warnCount').textContent = warns.length;
  table('#tbWarnTop', [
    { t: '商品', k: 'name' }, { t: '分类', k: 'cat' }, { t: '单位', k: 'unit' },
    { t: '现存量', n: 1, f: r => qtyF(r.stock) }, { t: '本期销量', n: 1, f: r => qtyF(r.soldQty) },
    { t: '可用天数', n: 1, f: r => r.turn >= 999 ? '—' : fmt(r.turn, 1) },
    { t: '状态', html: 1, f: r => `<span class="pill ${STCLS[r.status]}">${r.status}</span>` }
  ], warns.slice(0, 12));
}

/* ================= 渲染：库存 ================= */
let LEDGER = [];
function renderStock() {
  const P = cur(); LEDGER = buildLedger(P, opts());
  const whs = uniq(P.stock.map(r => r.warehouse));
  const sel = $('#stkWh'), pv = sel.value;
  sel.innerHTML = '<option value="">全部仓库</option>' + whs.map(w => `<option>${esc(w)}</option>`).join('');
  sel.value = pv;
  filterStock();

  const top = [...LEDGER].sort((a, b) => b.soldQty - a.soldQty).slice(0, 15);
  chart('chStockFlow', {
    type: 'bar',
    data: {
      labels: top.map(o => shortLabel(o.name)), datasets: [
        { label: '期初', data: top.map(o => o.open), backgroundColor: '#7b8aa3' },
        { label: '购进', data: top.map(o => o.purchase), backgroundColor: '#a78bfa' },
        { label: '销售', data: top.map(o => o.soldQty), backgroundColor: '#ff5d6c' },
        { label: '现存', data: top.map(o => o.stock), backgroundColor: '#22d3a8' }]
    },
    options: { scales: { y: { type: 'logarithmic' }, x: { ticks: { font: { size: 9 }, maxRotation: 55 } } }, plugins: { legend: { labels: { boxWidth: 10 } } } }
  });

  const wh = {}; P.stock.forEach(r => wh[r.warehouse || '未知'] = (wh[r.warehouse || '未知'] || 0) + r.stock);
  const wk = Object.keys(wh).sort((a, b) => wh[b] - wh[a]);
  chart('chWh', {
    type: 'bar',
    data: { labels: wk.map(shortLabel), datasets: [{ label: '库存主数量', data: wk.map(k => wh[k]), backgroundColor: '#4aa8ff' }] },
    options: { indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { type: 'logarithmic' } } }
  });
}
const STOCK_COLS = [
  { t: '商品名称', k: 'name' }, { t: '分类', k: 'cat' }, { t: '规格', k: 'spec' }, { t: '单位', k: 'unit' },
  { t: '期初', n: 1, f: r => qtyF(r.open) }, { t: '本期购进', n: 1, f: r => qtyF(r.purchase) },
  { t: '本期销量', n: 1, f: r => qtyF(r.soldQty) }, { t: '销售金额', n: 1, f: r => money(r.soldAmt) }, /* 保留金额参考 */
  { t: '现存量', n: 1, f: r => qtyF(r.stock) }, { t: '日均销量', n: 1, f: r => qtyF(r.daily) },
  { t: '可用天数', n: 1, f: r => r.turn >= 999 ? '—' : fmt(r.turn, 1) },
  { t: '仓库', k: 'warehouse' },
  { t: '预警状态', html: 1, f: r => `<span class="pill ${STCLS[r.status]}">${r.status}</span>` }
];
function stockFiltered() {
  const q = $('#stkSearch').value.trim().toLowerCase(), w = $('#stkWh').value, st = $('#stkStatus').value;
  return LEDGER.filter(o =>
    (!q || (o.name + o.cat + o.warehouse).toLowerCase().includes(q)) &&
    (!w || o.warehouse.includes(w)) && (!st || o.status === st));
}
function filterStock() {
  const rows = stockFiltered();
  const tot = `<tr class="tot"><td>合计（${rows.length}项）</td><td></td><td></td><td></td>
   <td class="num">${qtyF(sum(rows, r => r.open))}</td><td class="num">${qtyF(sum(rows, r => r.purchase))}</td>
   <td class="num">${qtyF(sum(rows, r => r.soldQty))}</td><td class="num">${money(sum(rows, r => r.soldAmt))}</td>
   <td class="num">${qtyF(sum(rows, r => r.stock))}</td><td></td><td></td><td></td><td></td></tr>`;
  table('#tbStock', STOCK_COLS, rows, tot);
}

/* ================= 渲染：销售汇总 ================= */
function renderSales() {
  const P = cur(), pm = priceMap(P);
  const tot = sum(P.salesSummary, r => r.amount), qty = sum(P.salesSummary, r => r.qty);
  const skus = P.salesSummary.length;
  /* 客户排名：按销量 */
  const custs = {}; P.sales.forEach(r => { custs[r.customer] = custs[r.customer] || { qty: 0, amt: 0, cnt: 0 }; custs[r.customer].qty += r.mainQty; custs[r.customer].amt += amtOf(pm, r); custs[r.customer].cnt++; });
  const ck = Object.keys(custs).sort((a, b) => custs[b].qty - custs[a].qty);
  /* KPI：销量领先，金额跟随 */
  $('#kpisSales').innerHTML = [
    ['销售总量', qtyF(qty), '主数量合计', 'g'],
    ['在销SKU', skus, '个商品', 'p'],
    ['成交客户', ck.length, '家', 'o'],
    ['销售总额', money(tot), wan(tot) + ' 元（参考）', ''],
    ['平均单客走量', qtyF(ck.length ? qty / ck.length : 0), '量/客户', 'g'],
  ].map(([k, v, s, c]) => `<div class="kpi ${c}"><div class="k">${k}</div><div class="v">${v}</div><div class="s">${s}</div></div>`).join('');

  /* 品类排名：按销量 */
  const byCat = {}; P.salesSummary.forEach(r => byCat[r.cat] = (byCat[r.cat] || 0) + r.qty);
  const cats = Object.keys(byCat).sort((a, b) => byCat[b] - byCat[a]);
  chart('chSalesCat', {
    type: 'bar', data: { labels: cats.map(shortLabel), datasets: [{ data: cats.map(c => byCat[c]), backgroundColor: PALETTE }] },
    options: { indexAxis: 'y', plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => c.label + ' ' + qtyF(c.raw) } } }, scales: { x: { ticks: { font: { size: 10 } } } } }
  });
  /* 产品排行：按销量 */
  const top = [...P.salesSummary].sort((a, b) => b.qty - a.qty).slice(0, 10);
  chart('chSalesTop', {
    type: 'bar', data: { labels: top.map(r => shortLabel(r.product)), datasets: [{ data: top.map(r => r.qty), backgroundColor: '#22d3a8' }] },
    options: { plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => '销量 ' + qtyF(c.raw) } } }, scales: { y: { title: { display: true, text: '销量' } }, x: { ticks: { font: { size: 9 }, maxRotation: 55 } } } }
  });

  const cs = $('#sumCat'), pv = cs.value;
  cs.innerHTML = '<option value="">全部分类</option>' + uniq(P.salesSummary.map(r => r.cat)).map(c => `<option>${esc(c)}</option>`).join('');
  cs.value = pv;
  filterSum();

  /* 客户排名表：按销量 */
  table('#tbCust', [
    { t: '排名', f: (r, i) => r._i }, { t: '客户名称', k: 'name' },
    { t: '销量', n: 1, f: r => qtyF(r.qty) }, { t: '占比', n: 1, f: r => (qty ? r.qty / qty * 100 : 0).toFixed(2) + '%' },
    { t: '销售金额', n: 1, f: r => money(r.amt) },
    { t: '订单笔数', n: 1, f: r => r.cnt }, { t: '主要业务员', k: 'staff' }
  ], ck.map((name, i) => {
    const rows = P.sales.filter(r => r.customer === name);
    const st = {}; rows.forEach(r => { st[r.sales] = st[r.sales] || { qty: 0, amt: 0 }; st[r.sales].qty += r.mainQty; st[r.sales].amt += amtOf(pm, r); });
    return { _i: i + 1, name, qty: custs[name].qty, amt: custs[name].amt, cnt: custs[name].cnt, staff: Object.keys(st).sort((a, b) => st[b].qty - st[a].qty)[0] || '' };
  }));
}
const SUM_COLS = [
  { t: '物料分类', k: 'cat' }, { t: '分类来源', k: 'catSource', f: r => { const m = {'image':'图片分类','original':'原表分类','fallback':'自动分类'}; return m[r.catSource] || '—'; } }, { t: '商品名称', k: 'product' }, { t: '统计单位', k: 'unit' },
  { t: '销量', n: 1, f: r => qtyF(r.qty) }, { t: '销售金额', n: 1, f: r => money(r.amount) },
  { t: '平均单价', n: 1, f: r => r.qty ? money(r.amount / r.qty) : '—' },
  { t: '销量占比', n: 1, f: r => r._p }
];
function filterSum() {
  const P = cur(), q = $('#sumSearch').value.trim().toLowerCase(), c = $('#sumCat').value;
  const src = $('#sumCatSrc') ? $('#sumCatSrc').value : '';
  const totalQty = sum(P.salesSummary, r => r.qty);
  const rows = P.salesSummary.filter(r => {
    if (q && !(r.product + (r.cat || '')).toLowerCase().includes(q)) return false;
    if (c && r.cat !== c) return false;
    if (src && (r.catSource || 'fallback') !== src) return false;
    return true;
  })
    .sort((a, b) => b.qty - a.qty).map(r => Object.assign({}, r, { _p: (totalQty ? r.qty / totalQty * 100 : 0).toFixed(2) + '%' }));
  const t = `<tr class="tot"><td>合计</td><td>${rows.length} 项</td><td></td><td class="num">${qtyF(sum(rows, r => r.qty))}</td><td class="num">${money(sum(rows, r => r.amount))}</td><td></td><td></td></tr>`;
  table('#tbSalesSum', SUM_COLS, rows, t);
}

/* ================= 渲染：业务员 ================= */
function fillStaffFilters() {
  const P = cur();
  const set = (sel, arr, ph) => { const e = $(sel), v = e.value; e.innerHTML = `<option value="">${ph}</option>` + arr.map(x => `<option>${esc(x)}</option>`).join(''); e.value = arr.includes(v) ? v : ''; };
  set('#fStaff', uniq(P.sales.map(r => r.sales)), '全部业务员');
  set('#fProd', uniq(P.sales.map(r => r.product)), '全部产品');
  set('#fCust', uniq(P.sales.map(r => r.customer)), '全部客户');
  const ds = P.sales.map(r => r.date).filter(Boolean).sort();
  if (ds.length && !$('#fFrom').value) { $('#fFrom').value = ds[0]; $('#fTo').value = ds[ds.length - 1]; }
}
function staffRows() {
  const P = cur(), s = $('#fStaff').value, p = $('#fProd').value, c = $('#fCust').value,
    f = $('#fFrom').value, t = $('#fTo').value;
  return P.sales.filter(r => (!s || r.sales === s) && (!p || r.product === p) && (!c || r.customer === c)
    && (!f || r.date >= f) && (!t || r.date <= t));
}
let LEDGER_ROWS = [];
function renderStaff() {
  const P = cur(), pm = priceMap(P);
  fillStaffFilters();
  const rows = staffRows().map(r => Object.assign({}, r, { qty: r.mainQty, amt: amtOf(pm, r) }));
  LEDGER_ROWS = rows;
  const totQty = sum(rows, r => r.qty);
  const totAmt = sum(rows, r => r.amt);
  const staffs = uniq(rows.map(r => r.sales));
  /* KPI：销量领先 */
  $('#kpisStaff').innerHTML = [
    ['筛选总销量', qtyF(totQty), '主数量合计', 'g'],
    ['筛选销售额', money(totAmt), wan(totAmt) + ' 元（参考）', ''],
    ['明细笔数', rows.length, '条记录', 'p'],
    ['涉及业务员', staffs.length, '人', 'o'],
    ['涉及客户', uniq(rows.map(r => r.customer)).length, '家', 'g'],
    ['涉及产品', uniq(rows.map(r => r.product)).length, '个SKU', 'p'],
  ].map(([k, v, s, c]) => `<div class="kpi ${c}"><div class="k">${k}</div><div class="v">${v}</div><div class="s">${s}</div></div>`).join('');

  /* 业务员排名：按销量 */
  const st = {}; rows.forEach(r => { st[r.sales] = st[r.sales] || { qty: 0, amt: 0, cnt: 0, cust: new Set() }; st[r.sales].qty += r.qty; st[r.sales].amt += r.amt; st[r.sales].cnt++; st[r.sales].cust.add(r.customer); });
  const sk = Object.keys(st).sort((a, b) => st[b].qty - st[a].qty);
  chart('chStaffAmt', {
    type: 'bar', data: { labels: sk.map(shortLabel), datasets: [{ label: '销量', data: sk.map(k => st[k].qty), backgroundColor: PALETTE }] },
    options: { plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => c.label + ' ' + qtyF(c.raw) } } }, scales: { x: { ticks: { font: { size: 10 } } } } }
  });

  /* 商品分布：按销量 */
  const pr = {}; rows.forEach(r => pr[r.product] = (pr[r.product] || 0) + r.qty);
  const pk = Object.keys(pr).sort((a, b) => pr[b] - pr[a]).slice(0, 10);
  chart('chStaffProd', {
    type: 'doughnut', data: { labels: pk, datasets: [{ data: pk.map(k => pr[k]), backgroundColor: PALETTE, borderWidth: 0 }] },
    options: { cutout: '55%', plugins: { legend: { position: 'right', labels: { boxWidth: 9, font: { size: 10 } } }, tooltip: { callbacks: { label: c => shortLabel(c.label) + ' ' + qtyF(c.raw) } } } }
  });

  /* 每日趋势：按销量 */
  const dd = {}; rows.forEach(r => { if (r.date) dd[r.date] = (dd[r.date] || 0) + r.qty; });
  const dk = Object.keys(dd).sort();
  chart('chStaffDaily', {
    type: 'bar', data: { labels: dk.map(d => d.slice(5)), datasets: [{ label: '销量', data: dk.map(k => dd[k]), backgroundColor: '#4aa8ff' }] },
    options: { plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => '销量 ' + qtyF(c.raw) } } } }
  });

  /* 业务员×商品 销量矩阵 */
  const prods = uniq(rows.map(r => r.product));
  const mat = sk.map(s => {
    const o = { staff: s, _totQty: st[s].qty, _totAmt: st[s].amt };
    prods.forEach(p => o[p] = sum(rows.filter(r => r.sales === s && r.product === p), r => r.qty));
    return o;
  });
  const topProds = prods.slice().sort((a, b) => pr[b] - pr[a]).slice(0, 6);
  table('#tbMatrix', [{ t: '业务员', k: 'staff' }].concat(topProds.map(p => ({ t: shortLabel(p), n: 1, f: r => r[p] ? qtyF(r[p]) : '—' })))
    .concat([{ t: '销量合计', n: 1, f: r => qtyF(r._totQty) }]), mat);

  /* 每日客户：按销量 */
  const dc = {};
  rows.forEach(r => { const k = r.date + '|' + r.customer + '|' + r.sales; dc[k] = dc[k] || { date: r.date, customer: r.customer, sales: r.sales, amt: 0, qty: 0, cnt: 0 }; dc[k].amt += r.amt; dc[k].qty += r.qty; dc[k].cnt++; });
  table('#tbDayCust', [
    { t: '日期', k: 'date' }, { t: '客户', f: r => shortLabel(r.customer) }, { t: '业务员', k: 'sales' },
    { t: '品项', n: 1, f: r => r.cnt }, { t: '销量', n: 1, f: r => qtyF(r.qty) }, { t: '金额', n: 1, f: r => money(r.amt) }
  ], Object.values(dc).sort((a, b) => a.date < b.date ? 1 : a.date > b.date ? -1 : b.qty - a.qty));

  /* 台账 */
  $('#ledgerCount').textContent = rows.length;
  table('#tbLedger', LEDGER_COLS, rows,
    `<tr class="tot"><td>合计</td><td></td><td></td><td></td><td></td><td></td><td></td>
     <td class="num">${qtyF(totQty)}</td><td></td><td class="num">${money(totAmt)}</td></tr>`);
}
const LEDGER_COLS = [
  { t: '业务员', k: 'sales' }, { t: '往来客户', k: 'customer' }, { t: '单据类型', k: 'docType' },
  { t: '日期', k: 'date' }, { t: '商品名称', k: 'product' }, { t: '规格', k: 'spec' },
  { t: '数量', n: 1, f: r => qtyF(r.qty) }, { t: '单位', k: 'unit' },
  { t: '主数量', n: 1, f: r => qtyF(r.mainQty) }, { t: '主单位', k: 'mainUnit' },
  { t: '估算金额', n: 1, f: r => money(r.amt || 0) }  /* 金额保留，弱化显示 */
];

/* ================= 渲染：预测 ================= */
function periodsSorted() { return Object.keys(S.data.periods).sort(); }
function nextPeriod(p) { const [y, m] = p.split('-').map(Number); return m === 12 ? (y + 1) + '-01' : y + '-' + String(m + 1).padStart(2, '0'); }
function renderForecast() {
  const ps = periodsSorted(), method = $('#fcMethod').value, grow = N($('#fcGrow').value) || 1;
  const P = cur(), L = buildLedger(P, opts());
  const nxt = nextPeriod(S.period);

  /* 历史序列：按销量预测 */
  const names = uniq(ps.flatMap(p => (S.data.periods[p].salesSummary || []).map(r => r.product)));
  const series = {};
  names.forEach(n => series[nk(n)] = ps.map(p => {
    const rs = (S.data.periods[p].salesSummary || []).filter(r => nk(r.product) === nk(n));
    return { qty: sum(rs, r => r.qty), amt: sum(rs, r => r.amount) };
  }));

  function predict(arr) {
    const v = arr.map(x => x); const n = v.length;
    if (!n) return 0;
    if (n === 1 || method === 'flat') return v[n - 1];
    if (method === 'ma') { const k = Math.min(3, n); return sum(v.slice(-k)) / k; }
    if (method === 'trend' || method === 'auto') {
      const xs = v.map((_, i) => i), my = sum(v) / n, mx = sum(xs) / n;
      const den = sum(xs.map(x => (x - mx) ** 2)) || 1;
      const b = sum(xs.map((x, i) => (x - mx) * (v[i] - my))) / den;
      const pred = my + b * (n - mx);
      if (method === 'auto') { const k = Math.min(3, n); const ma = sum(v.slice(-k)) / k; return (pred + ma) / 2; }
      return pred;
    }
    return v[n - 1];
  }

  $('#fcNote').textContent = ps.length > 1
    ? `已有 ${ps.length} 个期间（${ps.join('、')}），采用多期建模预测 ${nxt}。`
    : `当前仅有 1 个期间（${S.period}），以本期为基准 × 增长系数预测 ${nxt}；导入更多月份后预测精度将显著提升。`;

  const rows = [];
  L.forEach(o => {
    const s = series[o.key] || [{ qty: o.soldQty, amt: o.soldAmt }];
    /* 核心：预测销量 */
    const fq = Math.max(0, predict(s.map(x => x.qty)) * grow);
    /* 金额：根据预测销量 × 平均单价推算 */
    const avgPrice = o.soldQty > 0 ? o.soldAmt / o.soldQty : 0;
    const fa = fq * avgPrice;
    const gap = fq - o.stock;
    rows.push({
      name: o.name, cat: o.cat, unit: o.unit, stock: o.stock, cur: o.soldQty, curAmt: o.soldAmt,
      fq, fa, cover: fq > 0 ? o.stock / fq : (o.stock > 0 ? 99 : 0), gap,
      advice: fq <= 0 ? (o.stock > 0 ? '清理呆滞库存' : '暂不备货')
        : gap > 0 ? '需补货 ' + qtyF(gap) + ' ' + (o.unit || '')
          : o.stock / fq > 3 ? '库存充裕，暂停采购' : '库存可覆盖，正常周转'
    });
  });
  /* 排序：按预测销量 */
  rows.sort((a, b) => b.fq - a.fq);

  const fcQty = sum(rows, r => r.fq), curQty = sum(rows, r => r.cur);
  const fcAmt = sum(rows, r => r.fa), curAmt = sum(rows, r => r.curAmt);
  const need = rows.filter(r => r.gap > 0);
  /* KPI：预测销量领先 */
  $('#kpisFc').innerHTML = [
    ['下月预测销量', qtyF(fcQty), nxt + ' 预测', 'g'],
    ['本期实际销量', qtyF(curQty), S.period, 'p'],
    ['环比变化', (curQty ? ((fcQty / curQty - 1) * 100).toFixed(1) : '0') + '%', fcQty >= curQty ? '预计增长' : '预计下降', fcQty >= curQty ? 'g' : 'r'],
    ['下月预测销售额', money(fcAmt), wan(fcAmt) + ' 元（参考）', ''],
    ['需补货SKU', need.length, '共 ' + rows.length + ' 个', need.length ? 'o' : 'g'],
    ['预测方法', { auto: '智能组合', ma: '移动平均', trend: '线性趋势', flat: '同期持平' }[method], '系数 ×' + grow.toFixed(2), 'p'],
  ].map(([k, v, s, c]) => `<div class="kpi ${c}"><div class="k">${k}</div><div class="v">${v}</div><div class="s">${s}</div></div>`).join('');

  const top = rows.slice(0, 12);
  chart('chFc', {
    type: 'bar',
    data: {
      labels: top.map(r => shortLabel(r.name)), datasets: [
        { label: '本期销量', data: top.map(r => r.cur), backgroundColor: '#4aa8ff' },
        { label: nxt + ' 预测销量', data: top.map(r => r.fq), backgroundColor: '#ffab3d' }]
    },
    options: { plugins: { tooltip: { callbacks: { label: c => c.dataset.label + ' ' + qtyF(c.raw) } }, legend: { labels: { boxWidth: 10 } } }, scales: { y: { title: { display: true, text: '销量' } }, x: { ticks: { font: { size: 9 }, maxRotation: 55 } } } }
  });

  window.__FC = rows;
  table('#tbFc', FC_COLS, rows,
    `<tr class="tot"><td>合计</td><td></td><td></td><td class="num">${qtyF(sum(rows, r => r.stock))}</td><td class="num">${qtyF(curQty)}</td><td class="num">${money(curAmt)}</td><td class="num">${qtyF(fcQty)}</td><td class="num">${money(fcAmt)}</td><td></td><td></td></tr>`);

  /* 业务员预测：按销量占比 */
  const pm = priceMap(P), st = {};
  P.sales.forEach(r => { st[r.sales] = st[r.sales] || { qty: 0, amt: 0, cnt: 0 }; st[r.sales].qty += r.mainQty; st[r.sales].amt += amtOf(pm, r); st[r.sales].cnt++; });
  const tQty = sum(Object.values(st), x => x.qty);
  const tAmt = sum(Object.values(st), x => x.amt);
  const tFcQty = tQty ? tQty / tQty * fcQty : 0;
  table('#tbFcStaff', [
    { t: '业务员', k: 'k' }, { t: '本期销量', n: 1, f: r => qtyF(r.qty) },
    { t: '销量占比', n: 1, f: r => (tQty ? r.qty / tQty * 100 : 0).toFixed(2) + '%' },
    { t: '本期业绩', n: 1, f: r => money(r.amt) },
    { t: nxt + ' 预测销量', n: 1, f: r => qtyF(tQty ? r.qty / tQty * fcQty : 0) },
    { t: '评级', f: r => { const p = tQty ? r.qty / tQty : 0; return p > .3 ? '★★★ 核心' : p > .1 ? '★★ 骨干' : '★ 培育'; } }
  ], Object.keys(st).map(k => ({ k, qty: st[k].qty, amt: st[k].amt, cnt: st[k].cnt })).sort((a, b) => b.qty - a.qty));
}
const FC_COLS = [
  { t: '商品名称', k: 'name' }, { t: '分类', k: 'cat' }, { t: '单位', k: 'unit' },
  { t: '现存量', n: 1, f: r => qtyF(r.stock) }, { t: '本期销量', n: 1, f: r => qtyF(r.cur) },
  { t: '本期金额', n: 1, f: r => money(r.curAmt) },
  { t: '下月预测销量', n: 1, f: r => qtyF(r.fq) }, { t: '下月预测金额', n: 1, f: r => money(r.fa) },
  { t: '库存覆盖月数', n: 1, f: r => r.cover >= 99 ? '充足' : fmt(r.cover, 2) },
  { t: '备货建议', k: 'advice' }
];

/* ================= 渲染：年度 ================= */
function renderYear() {
  const ps = periodsSorted();
  let tAmt = 0, tQty = 0, tPur = 0;
  const per = ps.map(p => {
    const D = S.data.periods[p];
    const a = sum(D.salesSummary, r => r.amount), q = sum(D.salesSummary, r => r.qty), pu = sum(D.purchase, r => r.qty);
    tAmt += a; tQty += q; tPur += pu;
    return { p, amt: a, qty: q, pur: pu, stock: sum(D.stock, r => r.stock), rows: (D.sales || []).length, staff: uniq((D.sales || []).map(r => r.sales)).length };
  });
  $('#periodCount').textContent = ps.length;
  /* KPI：销量领先 */
  $('#kpisYear').innerHTML = [
    ['累计销量', qtyF(tQty), ps.length + ' 个期间累计', 'g'],
    ['累计销售额', money(tAmt), wan(tAmt) + ' 元（参考）', ''],
    ['累计购进', qtyF(tPur), '主数量', 'p'],
    ['月均销量', qtyF(ps.length ? tQty / ps.length : 0), '量/月', 'o'],
    ['月均销售额', money(ps.length ? tAmt / ps.length : 0), '元/月', 'g'],
  ].map(([k, v, s, c]) => `<div class="kpi ${c}"><div class="k">${k}</div><div class="v">${v}</div><div class="s">${s}</div></div>`).join('');

  /* 期间表：按销量排序 */
  table('#tbPeriods', [
    { t: '期间', k: 'p' }, { t: '销量', n: 1, f: r => qtyF(r.qty) },
    { t: '销售金额', n: 1, f: r => money(r.amt) },
    { t: '购进量', n: 1, f: r => qtyF(r.pur) }, { t: '期末现存', n: 1, f: r => qtyF(r.stock) },
    { t: '明细条数', n: 1, f: r => r.rows }, { t: '业务员数', n: 1, f: r => r.staff },
    { t: '环比', n: 1, f: (r) => { const i = per.findIndex(x => x.p === r.p); if (i <= 0 || !per[i - 1].qty) return '—'; const d = (r.qty / per[i - 1].qty - 1) * 100; return (d >= 0 ? '+' : '') + d.toFixed(1) + '%'; } }
  ], per, `<tr class="tot"><td>合计</td><td class="num">${qtyF(tQty)}</td><td class="num">${money(tAmt)}</td><td class="num">${qtyF(tPur)}</td><td></td><td></td><td></td><td></td></tr>`);

  /* 年度趋势：按销量 */
  chart('chYearTrend', {
    type: 'line',
    data: {
      labels: per.map(r => r.p),
      datasets: [
        { label: '销量', data: per.map(r => r.qty), borderColor: '#22d3a8', backgroundColor: 'rgba(34,211,168,.18)', fill: true, tension: .3, pointRadius: 4, yAxisID: 'y' },
        { label: '金额(万)', data: per.map(r => r.amt), borderColor: '#4aa8ff', backgroundColor: 'rgba(74,168,255,.1)', fill: false, tension: .3, pointRadius: 3, yAxisID: 'y1' }
      ]
    },
    options: {
      plugins: { legend: { display: true, labels: { boxWidth: 10 } }, tooltip: { callbacks: { label: c => c.dataset.label + '：' + (c.datasetIndex === 0 ? qtyF(c.raw) : money(c.raw)) } } },
      scales: {
        y: { type: 'linear', position: 'left', title: { display: true, text: '销量', color: '#22d3a8' } },
        y1: { type: 'linear', position: 'right', title: { display: true, text: '金额', color: '#4aa8ff' }, grid: { drawOnChartArea: false } }
      }
    }
  });

  /* 品类分布：按销量 */
  const cat = {}; ps.forEach(p => (S.data.periods[p].salesSummary || []).forEach(r => cat[r.cat] = (cat[r.cat] || 0) + r.qty));
  const ck = Object.keys(cat).sort((a, b) => cat[b] - cat[a]);
  chart('chYearCat', {
    type: 'polarArea', data: { labels: ck, datasets: [{ data: ck.map(k => cat[k]), backgroundColor: PALETTE.map(c => c + 'cc') }] },
    options: { plugins: { legend: { position: 'right', labels: { boxWidth: 9, font: { size: 10 } } }, tooltip: { callbacks: { label: c => c.label + ' ' + qtyF(c.raw) } } }, scales: { r: { ticks: { display: false } } } }
  });

  /* 商品排名：按累计销量 */
  const prod = {};
  ps.forEach(p => (S.data.periods[p].salesSummary || []).forEach(r => {
    const k = nk(r.product);
    prod[k] = prod[k] || { name: r.product, cat: r.cat, unit: r.unit, qty: 0, amt: 0, months: new Set() };
    prod[k].qty += r.qty; prod[k].amt += r.amount; prod[k].months.add(p);
  }));
  const pr = Object.values(prod).sort((a, b) => b.qty - a.qty).map(o => Object.assign(o, { mn: o.months.size, avg: o.months.size ? o.qty / o.months.size : 0 }));
  window.__YEAR = pr;
  table('#tbYearProd', YEAR_COLS, pr,
    `<tr class="tot"><td>合计（${pr.length}项）</td><td></td><td></td><td class="num">${qtyF(sum(pr, r => r.qty))}</td><td class="num">${money(sum(pr, r => r.amt))}</td><td></td><td></td><td></td></tr>`);

  /* 业务员年度：按累计销量 */
  const stf = {};
  ps.forEach(p => { const D = S.data.periods[p], pm = priceMap(D); (D.sales || []).forEach(r => { stf[r.sales] = stf[r.sales] || { qty: 0, amt: 0, cnt: 0, cust: new Set(), ms: new Set() }; stf[r.sales].qty += r.mainQty; stf[r.sales].amt += amtOf(pm, r); stf[r.sales].cnt++; stf[r.sales].cust.add(r.customer); stf[r.sales].ms.add(p); }); });
  const sTotQty = sum(Object.values(stf), x => x.qty);
  table('#tbYearStaff', [
    { t: '排名', f: r => r.i }, { t: '业务员', k: 'k' }, { t: '累计销量', n: 1, f: r => qtyF(r.qty) },
    { t: '销量占比', n: 1, f: r => (sTotQty ? r.qty / sTotQty * 100 : 0).toFixed(2) + '%' },
    { t: '累计业绩', n: 1, f: r => money(r.amt) },
    { t: '月均销量', n: 1, f: r => qtyF(r.ms ? r.qty / r.ms : 0) }, { t: '客户数', n: 1, f: r => r.cust },
    { t: '明细笔数', n: 1, f: r => r.cnt }, { t: '活跃月份', n: 1, f: r => r.ms }
  ], Object.keys(stf).map(k => ({ k, qty: stf[k].qty, amt: stf[k].amt, cnt: stf[k].cnt, cust: stf[k].cust.size, ms: stf[k].ms.size }))
    .sort((a, b) => b.qty - a.qty).map((r, i) => Object.assign(r, { i: i + 1 })));
}
const YEAR_COLS = [
  { t: '商品名称', k: 'name' }, { t: '分类', k: 'cat' }, { t: '单位', k: 'unit' },
  { t: '累计销量', n: 1, f: r => qtyF(r.qty) }, { t: '累计金额', n: 1, f: r => money(r.amt) },
  { t: '在销月数', n: 1, f: r => r.mn }, { t: '月均销量', n: 1, f: r => qtyF(r.avg) },
  { t: '均价', n: 1, f: r => r.qty ? money(r.amt / r.qty) : '—' }
];

/* ================= 智能上传解析 ================= */
const HDR = {
  sales: ['业务员', '销售员', '业务人员', '营销员'],
  customer: ['往来客户', '客户', '客户名称', '购货单位', '往来单位'],
  docType: ['单据类型', '类型'],
  date: ['单据日期', '日期', '销售日期', '出库日期', '业务日期'],
  product: ['存货名称', '物料名称', '商品名称', '商品', '物料', '产品名称', '存货'],
  spec: ['规格', '规格型号'],
  qty: ['数量', '数量合计', '销量合计', '销量'],
  unit: ['单位'],
  mainQty: ['主数量', '成成主数量', '折主数量', '换算主数量'],
  mainUnit: ['主单位'],
  warehouse: ['发货仓库', '仓库', '库存组织'],
  amount: ['金额', '销售收入', '销售金额', '收入'],
  stock: ['结存主数量', '现存量', '结存数量', '库存数量', '结存'],
  cat: ['物料分类', '分类', '类别', '商品分类'],
  purchaseQty1: ['郴州分公司中心库', '中心库'],
  purchaseQty2: ['郴州分公司储备仓库', '储备仓库', '储备'],
  purchaseQty3: ['合计', '总购进', '购进合计'],
  code: ['物料编码', '编码', '存货编码'],
  location: ['货位'],
  org: ['库存组织'],
};
function mapHeader(row) {
  const idx = {};
  const set = (key, i) => { if (idx[key] === undefined) idx[key] = i; };
  row.forEach((c, i) => {
    const v = String(c || '').replace(/\s/g, '');
    if (!v) return;
    for (const key in HDR) if (HDR[key].some(h => v === h)) { set(key, i); return; }
  });
  row.forEach((c, i) => {
    const v = String(c || '').replace(/\s/g, '');
    if (!v) return;
    for (const key in HDR) {
      if (idx[key] !== undefined) continue;
      if (HDR[key].some(h => v === h)) { idx[key] = i; return; }
      // qty must NOT match '鍚堣' headers; only do substring match for non-qty fields
      if (key !== 'qty' && HDR[key].some(h => v.includes(h))) { idx[key] = i; return; }
    }
  });
  return idx;
}
function findHeader(rows) {
  for (let i = 0; i < Math.min(12, rows.length); i++) {
    const idx = mapHeader(rows[i]);
    const score = Object.keys(idx).length;
    if (score >= 3 && (idx.product !== undefined)) return { i, idx };
  }
  for (let i = 0; i < Math.min(12, rows.length); i++) {
    const idx = mapHeader(rows[i]);
    if (Object.keys(idx).length >= 3) return { i, idx };
  }
  return null;
}
function normDate(v) {
  if (v == null || v === '') return '';
  if (typeof v === 'number') { const d = new Date(Date.UTC(1899, 11, 30 + Math.floor(v))); return d.toISOString().slice(0, 10); }
  const s = String(v).trim();
  let m = s.match(/(\d{4})[-/年.](\d{1,2})[-/月.](\d{1,2})/);
  if (m) return `${m[1]}-${String(m[2]).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}`;
  return s.slice(0, 10);
}
function classify(idx, rows) {
  const has = k => idx[k] !== undefined;
  if (has('stock')) return 'stock';
  if (has('sales') && has('customer')) return 'sales';
  if (has('purchaseQty1') || has('purchaseQty2') || has('purchaseQty3') || (has('product') && has('qty') && !has('customer'))) return 'purchase';
  if (has('amount') && has('product')) return 'salesSummary';
  if (has('product')) return 'salesSummary';
  return null;
}
function parseSheet(name, rows, out, logs) {
  const h = findHeader(rows);
  if (!h) { logs.push(['⚠ 工作表「' + name + '」未识别到有效表头，已跳过', 1]); return; }
  const { i, idx } = h, kind = classify(idx, rows);
  if (!kind) { logs.push(['⚠ 工作表「' + name + '」无法判定数据类型，已跳过', 1]); return; }
  const G = (r, k) => idx[k] === undefined ? '' : (r[idx[k]] == null ? '' : String(r[idx[k]]).trim());
  let cat = '', n = 0;
  for (let j = i + 1; j < rows.length; j++) {
    const r = rows[j];
    if (!r || !r.some(c => c != null && String(c).trim() !== '')) continue;
    const prod = G(r, 'product');
    const c0 = G(r, 'cat'); if (c0 && !/小计|合计|总计/.test(c0)) cat = c0;
    if (/^(小计|合计|总计|物料分类小计|本页合计)$/.test(prod) || /^(小计|合计|总计)$/.test(String(r[0] || '').trim())) continue;
    if (!prod) continue;
    if (kind === 'sales') {
      out.sales.push({
        sales: G(r, 'sales') || name, customer: G(r, 'customer'), docType: G(r, 'docType') || '销售订单',
        date: normDate(idx.date !== undefined ? r[idx.date] : ''), product: prod, spec: G(r, 'spec'),
        qty: N(G(r, 'qty')), unit: G(r, 'unit'), mainQty: N(G(r, 'mainQty')) || N(G(r, 'qty')),
        mainUnit: G(r, 'mainUnit') || G(r, 'unit'), warehouse: G(r, 'warehouse'),
        amount: N(G(r, 'amount'))
      });
    } else if (kind === 'salesSummary') {
      if (!prod) continue;
      const q = N(G(r, 'qty')), a = N(G(r, 'amount'));
      if (!q && !a) continue;
      const imgCat = guessCatByImage(prod);
      const finalCat = cat || imgCat || '其他';
      out.salesSummary.push({ cat: finalCat, product: prod, unit: G(r, 'unit'), qty: q, amount: a, catSource: cat ? 'original' : (imgCat ? 'image' : 'fallback') });
      n++;
    } else if (kind === 'purchase') {
      const q1 = N(G(r, 'purchaseQty1')), q2 = N(G(r, 'purchaseQty2')), q3 = N(G(r, 'purchaseQty3'));
      const pq = q3 || (q1 + q2) || N(G(r, 'qty'));
      if (!pq) continue;
      const imgCat = guessCatByImage(prod);
      const finalCat = cat || imgCat || '基础盐';
      out.purchase.push({ cat: finalCat, product: prod, unit: G(r, 'unit'), qty: pq, catSource: cat ? 'original' : (imgCat ? 'image' : 'fallback') });
    } else if (kind === 'stock') {
      out.stock.push({ org: G(r, 'org'), warehouse: G(r, 'warehouse'), location: G(r, 'location'), code: G(r, 'code'), product: prod, spec: G(r, 'spec'), model: '', unit: G(r, 'unit'), stock: N(G(r, 'stock')) });
    }
    n++;
  }
  logs.push(['✔ 「' + name + '」→ ' + ({ sales: '销售明细', salesSummary: '销售汇总', purchase: '购进汇总', stock: '现存量' }[kind]) + '，解析 ' + n + ' 行', 0]);
}
function inferPeriod(files) {
  const now = new Date(); const y = now.getFullYear();
  for (const f of files) {
    const n = f.name || '';
    let m = n.match(/(\d{4})[-/.年](\d{1,2})/);
    if (m) return m[1] + '-' + String(+m[2]).padStart(2, '0');
    m = n.match(/(\d{1,2})\s*月/);
    if (m) return y + '-' + String(+m[1]).padStart(2, '0');
  }
  return null;
}
async function handleFiles(files) {
  const out = { sales: [], salesSummary: [], purchase: [], stock: [] }, logs = [];
  $('#parseLog').innerHTML = ''; $('#parseLog').classList.add('on');
  for (const f of files) {
    try {
      const buf = await f.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array', cellDates: false, codepage: 936 });
      logs.push(['📄 ' + f.name + '（' + wb.SheetNames.length + ' 个工作表）', 0]);
      wb.SheetNames.forEach(sn => {
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, defval: '', raw: true });
        parseSheet(sn, rows, out, logs);
      });
    } catch (e) { logs.push(['✘ ' + f.name + ' 解析失败：' + e.message, 1]); }
  }
  if (out.sales.length && !out.salesSummary.length) {
    const m = {};
    out.sales.forEach(r => { const k = nk(r.product); m[k] = m[k] || { cat: '未分类', product: r.product, unit: r.mainUnit, qty: 0, amount: 0 }; m[k].qty += r.mainQty; m[k].amount += r.amount; });
    out.salesSummary = Object.values(m);
    logs.push(['⚙ 已根据销售明细自动生成销售汇总 ' + out.salesSummary.length + ' 条', 0]);
  }
  logs.forEach(([m, e]) => log('#parseLog', m, e));
  const tot = out.sales.length + out.salesSummary.length + out.purchase.length + out.stock.length;
  log('#parseLog', `\n共整理：销售明细 ${out.sales.length} 条 / 销售汇总 ${out.salesSummary.length} 条 / 购进 ${out.purchase.length} 条 / 现存量 ${out.stock.length} 条`);
  if (tot) {
    S.pending = out; $('#btnCommit').disabled = false;
    if (!$('#upPeriod').value) {
      const ym = inferPeriod(files);
      if (ym) { $('#upPeriod').value = ym; log('#parseLog', '🗓 已根据文件名推断归属期间：' + ym, 0); }
    }
    log('#parseLog', '➡ 请确认「归属期间」后点击【确认导入并同步】');
  }
  else { S.pending = null; $('#btnCommit').disabled = true; log('#parseLog', '未解析到有效数据', 1); }
}
function commitImport() {
  if (!S.pending) return;
  let p = $('#upPeriod').value;
  if (!p) {
    const ds = S.pending.sales.map(r => r.date).filter(Boolean).sort();
    p = ds.length ? ds[0].slice(0, 7) : new Date().toISOString().slice(0, 7);
  }
  const mode = $('#upMode').value;
  const cur = S.data.periods[p];
  if (!cur || mode === 'replace') S.data.periods[p] = S.pending;
  else ['sales', 'salesSummary', 'purchase', 'stock'].forEach(k => cur[k] = (cur[k] || []).concat(S.pending[k]));
  S.pending = null; $('#btnCommit').disabled = true;
  S.period = p; save(); fillPeriods(); renderAll(); push(true);
  log('#parseLog', '✔ 已导入到期间 ' + p + '，并同步至云端');
  toast('导入成功：' + p);
}

/* ================= 同步 ================= */
function save() { S.data.updatedAt = Date.now(); try { localStorage.setItem(LS, JSON.stringify(S.data)); } catch (e) { } }
function setBadge(t, c) { const b = $('#syncBadge'); b.textContent = t; b.className = 'badge ' + (c || ''); }
/* pull() replaced by sync engine above */
async function push(silent) {
  try {
    // Netlify sync disabled on GitHub Pages
    try { localStorage.setItem(LS, JSON.stringify(S.data)); } catch (e) { }
    log('#syncLog', '已保存到本地（GitHub Pages 离线模式）');
    toast('已保存');
    return;
    const j = await r.json();
    if (j.ok) { S.online = true; setBadge('云端已同步', 'ok'); if (!silent) toast('已上传到云端，其他设备刷新即可看到'); return true; }
    throw new Error(j.error || 'fail');
  } catch (e) { setBadge('离线模式', 'err'); if (!silent) toast('上传失败（离线）：已保存到本机'); }
  return false;
}

/* ================= 启动 ================= */
function fillPeriods() {
  const ps = periodsSorted();
  if (!ps.includes(S.period)) S.period = ps[ps.length - 1] || '';
  $('#periodSel').innerHTML = ps.map(p => `<option ${p === S.period ? 'selected' : ''}>${p}</option>`).join('');
  $('#ftPeriod').textContent = S.period || '—';
  $('#ftUpdated').textContent = S.data.updatedAt ? '更新于 ' + new Date(S.data.updatedAt).toLocaleString('zh-CN') : '';
  if (!$('#upPeriod').value) $('#upPeriod').value = S.period;
}
function renderAll() {
  try { renderOverview(); } catch (e) { console.error(e); }
  try { renderStock(); } catch (e) { console.error(e); }
  try { renderSales(); } catch (e) { console.error(e); }
  try { renderStaff(); } catch (e) { console.error(e); }
  try { renderForecast(); } catch (e) { console.error(e); }
  try { renderYear(); } catch (e) { console.error(e); }
}

function bind() {
  $$('#tabs button').forEach(b => b.onclick = () => {
    $$('#tabs button').forEach(x => x.classList.remove('on')); b.classList.add('on');
    $$('.tab').forEach(t => t.classList.remove('on')); $('#tab-' + b.dataset.tab).classList.add('on');
    Object.values(S.charts).forEach(c => { try { c.resize(); } catch (e) { } });
  });
  $('#periodSel').onchange = e => { S.period = e.target.value; $('#ftPeriod').textContent = S.period; renderAll(); };
  $('#btnSync').onclick = async () => { setBadge('同步中…'); await push(true); await pull(); };
  $('#btnRecalc').onclick = () => { renderStock(); renderOverview(); renderForecast(); toast('已按新阈值重算'); };
  ['#stkSearch', '#stkWh', '#stkStatus'].forEach(s => { $(s).oninput = filterStock; $(s).onchange = filterStock; });
  $('#expStock').onclick = () => csv('库存产品台账_' + S.period + '.csv', STOCK_COLS, stockFiltered());
  ['#sumSearch', '#sumCat'].forEach(s => { $(s).oninput = filterSum; $(s).onchange = filterSum; });
  // catSource filter
  ['#sumCatSrc'].forEach(s => { $(s).oninput = filterSum; $(s).onchange = filterSum; });
  $('#expSum').onclick = () => csv('商品销售汇总_' + S.period + '.csv', SUM_COLS, cur().salesSummary);
  $('#btnFilter').onclick = renderStaff;
  ['#fStaff', '#fProd', '#fCust', '#fFrom', '#fTo'].forEach(s => $(s).onchange = renderStaff);
  $('#btnReset').onclick = () => { ['#fStaff', '#fProd', '#fCust'].forEach(s => $(s).value = ''); $('#fFrom').value = ''; $('#fTo').value = ''; renderStaff(); };
  $('#expStaff').onclick = () => csv('业务员销售台账_' + S.period + '.csv', LEDGER_COLS, LEDGER_ROWS);
  $('#btnForecast').onclick = () => { renderForecast(); toast('预测已更新'); };
  $('#fcMethod').onchange = renderForecast;
  $('#expFc').onclick = () => csv('下月销售预测与备货建议_' + S.period + '.csv', FC_COLS, window.__FC || []);
  $('#expYear').onclick = () => csv('年度商品销量分析.csv', YEAR_COLS, window.__YEAR || []);

  const drop = $('#drop'), fi = $('#fileInput');
  fi.onchange = e => { if (e.target.files.length) handleFiles([...e.target.files]); };
  ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('hot'); }));
  ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('hot'); }));
  drop.addEventListener('drop', e => { if (e.dataTransfer.files.length) handleFiles([...e.dataTransfer.files]); });
  $('#btnCommit').onclick = commitImport;
  $('#btnPush').onclick = () => push();
  $('#btnPull').onclick = () => pull();
  $('#btnExportAll').onclick = () => {
    const b = new Blob([JSON.stringify(S.data, null, 1)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = '进销存数据备份_' + new Date().toISOString().slice(0, 10) + '.json'; a.click();
    toast('已导出备份');
  };
  $('#jsonIn').onchange = e => {
    const f = e.target.files[0]; if (!f) return;
    const rd = new FileReader();
    rd.onload = () => { try { const j = JSON.parse(rd.result); if (!j.periods) throw new Error('格式不正确'); S.data = j; save(); fillPeriods(); renderAll(); log('#syncLog', '✔ 已导入备份，共 ' + Object.keys(j.periods).length + ' 个期间'); toast('备份已导入'); } catch (er) { log('#syncLog', '✘ ' + er.message, 1); } };
    rd.readAsText(f);
  };
  $('#btnResetAll').onclick = async () => {
    if (!confirm('确定重置为初始数据？本地修改将丢失。')) return;
    const r = await fetch('data/seed.json?t=' + Date.now()); const seed = await r.json();
    S.data = { periods: { [seed.period]: seed }, updatedAt: Date.now() };
    S.period = seed.period; save(); fillPeriods(); renderAll(); toast('已重置');
  };
  // Room dialog
  $('#btnRoom').onclick = showRoomDialog;
  $('#btnRoomClose').onclick = hideRoomDialog;
  $('#btnCreateRoom').onclick = createRoom;
  $('#btnJoinRoom').onclick = () => {
    const id = (document.getElementById('joinRoomId').value || '').trim();
    if (!id) { toast('请输入房间 ID'); return; }
    const rooms = loadRooms();
    if (!rooms.find(r => r.id === id)) {
      rooms.unshift({ id, name: id, createdAt: Date.now(), joined: true });
      saveRooms(rooms);
    }
    joinRoom(id);
  };
  $('#btnLeaveRoom').onclick = leaveRoom;
  $('#roomList').onclick = e => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    const id = b.dataset.id;
    const act = b.dataset.act;
    if (act === 'join') joinRoom(id);
    else if (act === 'copy') copyRoomId(id);
    else if (act === 'del') deleteRoom(id);
  };
  window.addEventListener('resize', () => { clearTimeout(window._rz); window._rz = setTimeout(() => Object.values(S.charts).forEach(c => { try { c.resize(); } catch (e) { } }), 200); });
}

(async function init() {
  bind();
  try { const c = localStorage.getItem(LS); if (c) { const j = JSON.parse(c); if (j && j.periods && Object.keys(j.periods).length) S.data = j; } } catch (e) { }
  if (!Object.keys(S.data.periods).length) {
    try {
      const r = await fetch('data/seed.json?t=' + Date.now()); const seed = await r.json();
      // 兼容两种格式：periods 结构或扁平结构
      if (seed.periods && typeof seed.periods === 'object') {
        S.data = { periods: seed.periods, updatedAt: seed.updatedAt || Date.now() };
      } else {
        S.data = { periods: { [seed.period]: seed }, updatedAt: Date.now() };
      }
      if (seed.meta && seed.meta.org) $('#orgName').textContent = seed.meta.org;
      // 如果 seed 本身有 meta，也要设置
      const firstPeriod = Object.values(S.data.periods)[0];
      if (firstPeriod && firstPeriod.meta && firstPeriod.meta.org) $('#orgName').textContent = firstPeriod.meta.org;
    } catch (e) { console.error(e); }
  }
  // Multi-end sync engine setup (room-based)
  setupBC();
  startPoll();
  S.roomId = getRoomId();
  console.log('[init] roomId:', S.roomId, 'local periods:', Object.keys(S.data.periods), 'updatedAt:', S.data.updatedAt);
  if (S.roomId) {
    const remote = await cloudGet(S.roomId);
    console.log('[init] remote:', remote ? { periods: Object.keys(remote.periods||{}), updatedAt: remote.updatedAt } : null);
    if (remote && remote.periods && Object.keys(remote.periods).length) {
      const remoteTime = remote.updatedAt || 0;
      const localTime = S.data.updatedAt || 0;
      console.log('[init] timestamp compare: remote=' + remoteTime + ' >= local=' + localTime + ' ?', remoteTime >= localTime);
      if (remoteTime >= localTime) {
        S.data = remote;
        try { localStorage.setItem(LS, JSON.stringify(S.data)); } catch (e) {}
        console.log('[init] adopted remote data');
      }
      S.online = true;
      setBadge('云端已同步', 'ok');
    } else {
      S.online = true;
      setBadge('云端为空', '');
      console.log('[init] remote is empty or invalid');
    }
  } else {
    setBadge('本地模式', '');
  }

  const org = (Object.values(S.data.periods)[0] || {}).meta;
  if (org && org.org) $('#orgName').textContent = org.org;
  fillPeriods();
  renderAll();
  save();
  $('#loader').style.display = 'none';
  updateRoomUI();
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && getRoomId()) pull(true);
  });
  console.log('======== 图片产品分类体系 ========');
  CATS.forEach(c => console.log(c.cat + ': ' + c.keywords.join(' / ')));
  console.log('======== 多端同步已启用 ========');
  console.log('当前房间：' + (getRoomId() || '(未加入)'));
})();
