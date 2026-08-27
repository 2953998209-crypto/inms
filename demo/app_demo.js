/* 库存进销存智能管理看板系统 - 演示版（虚假数据，完整功能） */
'use strict';

/* ---------------- 工具函数 ---------------- */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const N = v => { if (v == null) return 0; const n = parseFloat(String(v).replace(/[,，\s¥￥]/g, '')); return isNaN(n) ? 0 : n; };
const fmt = (n, d = 2) => (Math.round(n * 1e6) / 1e6).toLocaleString('zh-CN', { minimumFractionDigits: d, maximumFractionDigits: d });
const money = n => '¥' + fmt(n, 2);
const qtyF = n => fmt(n, 3);
const wan = n => Math.abs(n) >= 10000 ? (n / 10000).toFixed(2) + ' 万' : fmt(n, 2);
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const uniq = a => [...new Set(a)].filter(x => x !== '' && x != null).sort((x, y) => String(x).localeCompare(String(y), 'zh'));
const sum = (a, f) => a.reduce((s, x) => s + (f ? f(x) : x), 0);

function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('on'); clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('on'), 2600); }

/* 商品名归一化 */
function nk(s) {
  return String(s || '')
    .replace(/（每[袋瓶桶件箱]）/g, '')
    .replace(/[（(][^）)]*[）)]/g, '')
    .replace(/20\d\d版|新版|旧版/g, '')
    .replace(/[\s\-—_.、,，/／]/g, '')
    .toLowerCase();
}

const PALETTE = ['#4aa8ff', '#22d3a8', '#ffab3d', '#a78bfa', '#ff5d6c', '#2fd07a', '#f472b6', '#38bdf8', '#fbbf24', '#818cf8', '#34d399', '#fb7185', '#60a5fa', '#c084fc', '#facc15'];

// 17类商品分类
const CATS = [
  { cat: '中端盐', keywords: ['中端盐', '加碘精制盐', '绿色加碘', '加碘盐', '400g', '500g'] },
  { cat: '洗涤盐', keywords: ['洗涤盐', '洗涤用'] },
  { cat: '高端盐', keywords: ['高端盐', '精制盐', '精致盐', '晶盐', '礼盒'] },
  { cat: '工业海湖盐', keywords: ['工业海湖盐'] },
  { cat: '小包装白砂糖', keywords: ['小包装白砂糖', '400g白砂糖'] },
  { cat: '农发产品', keywords: ['大豆油', '菜籽油', '花生油', '大米', '面粉', '酱油', '料酒', '千湖'] },
  { cat: '大包装白砂糖', keywords: ['大包装白砂糖', '25kg白砂糖'] },
  { cat: '食用海湖盐', keywords: ['食用海湖盐'] },
  { cat: '基础盐', keywords: ['基础盐', '未加碘盐', '无碘盐'] },
  { cat: '工业盐', keywords: ['工业盐', '工业用盐'] },
  { cat: '特渠盐', keywords: ['特渠盐', '特通盐', '特供'] },
  { cat: '大袋未加碘盐', keywords: ['大袋未加碘盐'] },
  { cat: '大袋精制碘盐', keywords: ['大袋精制碘盐', '大袋加碘'] },
  { cat: '次品盐', keywords: ['次品盐'] },
  { cat: '醋', keywords: ['醋', '香醋', '陈醋', '白醋', '武当醋'] },
  { cat: '酱油', keywords: ['酱油', '生抽', '老抽'] },
  { cat: '其他调味品', keywords: ['鸡精', '味精', '糖', '胡椒'] },
];

function guessCatByImage(name) {
  const n = nk(name);
  for (const c of CATS) {
    for (const kw of c.keywords) {
      if (n.includes(nk(kw))) return c.cat;
    }
  }
  return '其他调味品';
}

// ==================== 演示数据生成器 ====================
function generateDemoData() {
  const products = [
    { name: '云鹤牌500g加碘精制盐', cat: '中端盐', unit: '吨' },
    { name: '九凤来500g精制碘盐', cat: '中端盐', unit: '吨' },
    { name: '绿色加碘精制盐400g', cat: '中端盐', unit: '吨' },
    { name: '洗涤盐500g', cat: '洗涤盐', unit: '吨' },
    { name: '晶盐礼盒装', cat: '高端盐', unit: '吨' },
    { name: '工业海湖盐50kg', cat: '工业海湖盐', unit: '吨' },
    { name: '小包装白砂糖400g', cat: '小包装白砂糖', unit: '吨' },
    { name: '千湖大豆油5L', cat: '农发产品', unit: '吨' },
    { name: '千湖菜籽油5L', cat: '农发产品', unit: '吨' },
    { name: '千湖大米10kg', cat: '农发产品', unit: '吨' },
    { name: '大包装白砂糖25kg', cat: '大包装白砂糖', unit: '吨' },
    { name: '食用海湖盐500g', cat: '食用海湖盐', unit: '吨' },
    { name: '基础盐500g未加碘', cat: '基础盐', unit: '吨' },
    { name: '云鹤牌工业盐50kg', cat: '工业盐', unit: '吨' },
    { name: '特渠盐定制装', cat: '特渠盐', unit: '吨' },
    { name: '大袋未加碘盐25kg', cat: '大袋未加碘盐', unit: '吨' },
    { name: '大袋精制碘盐25kg', cat: '大袋精制碘盐', unit: '吨' },
    { name: '次品盐处理装', cat: '次品盐', unit: '吨' },
    { name: '武当原醋500ml', cat: '醋', unit: '吨' },
    { name: '土家梭酱油500ml', cat: '酱油', unit: '吨' },
    { name: '鸡精调味料100g', cat: '其他调味品', unit: '吨' },
  ];

  const warehouses = ['荆州市中心库', '沙市区储备仓库', '江陵县中心库'];
  const staff = ['张明', '李华', '王强', '刘洋', '陈静', '赵敏'];
  const months = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06'];

  const salesSummary = [];
  const purchase = [];
  const stock = [];
  const sales = [];

  // 为每个月生成数据
  months.forEach((period, monthIdx) => {
    products.forEach((p, i) => {
      const baseQty = 50 + Math.random() * 200;
      const basePrice = 2000 + Math.random() * 3000;
      const totalQty = baseQty * (1 + Math.sin(monthIdx * 0.8) * 0.3);
      const totalAmt = totalQty * basePrice;

      // 销售汇总
      salesSummary.push({
        period,
        product: p.name,
        cat: p.cat,
        unit: p.unit,
        qty: Math.round(totalQty * 1000) / 1000,
        amount: Math.round(totalAmt * 100) / 100,
        warehouse: warehouses[Math.floor(Math.random() * warehouses.length)],
        catSource: 'image'
      });

      // 购进
      const purchaseQty = totalQty * (0.9 + Math.random() * 0.3);
      purchase.push({
        period,
        product: p.name,
        cat: p.cat,
        unit: p.unit,
        qty: Math.round(purchaseQty * 1000) / 1000,
        amount: Math.round(purchaseQty * basePrice * 0.85 * 100) / 100,
        warehouse: warehouses[Math.floor(Math.random() * warehouses.length)],
        catSource: 'image'
      });

      // 业务员销售
      staff.forEach(s => {
        if (Math.random() > 0.5) {
          const staffQty = totalQty * (0.1 + Math.random() * 0.2);
          sales.push({
            period,
            staff: s,
            product: p.name,
            cat: p.cat,
            unit: p.unit,
            qty: Math.round(staffQty * 1000) / 1000,
            amount: Math.round(staffQty * basePrice * 100) / 100
          });
        }
      });
    });

    // 库存（只取最后一个月）
    if (monthIdx === months.length - 1) {
      products.forEach(p => {
        const stockQty = 20 + Math.random() * 100;
        stock.push({
          period,
          product: p.name,
          cat: p.cat,
          unit: p.unit,
          stock: Math.round(stockQty * 1000) / 1000,
          warehouse: warehouses[Math.floor(Math.random() * warehouses.length)],
          status: stockQty < 30 ? '缺货' : stockQty > 80 ? '呆滞积压' : '正常'
        });
      });
    }
  });

  return {
    periods: {
      '2026-01': { period: '2026-01', salesSummary: salesSummary.filter(s => s.period === '2026-01'), purchase: purchase.filter(p => p.period === '2026-01'), stock: [], sales: sales.filter(s => s.period === '2026-01') },
      '2026-02': { period: '2026-02', salesSummary: salesSummary.filter(s => s.period === '2026-02'), purchase: purchase.filter(p => p.period === '2026-02'), stock: [], sales: sales.filter(s => s.period === '2026-02') },
      '2026-03': { period: '2026-03', salesSummary: salesSummary.filter(s => s.period === '2026-03'), purchase: purchase.filter(p => p.period === '2026-03'), stock: [], sales: sales.filter(s => s.period === '2026-03') },
      '2026-04': { period: '2026-04', salesSummary: salesSummary.filter(s => s.period === '2026-04'), purchase: purchase.filter(p => p.period === '2026-04'), stock: [], sales: sales.filter(s => s.period === '2026-04') },
      '2026-05': { period: '2026-05', salesSummary: salesSummary.filter(s => s.period === '2026-05'), purchase: purchase.filter(p => p.period === '2026-05'), stock: [], sales: sales.filter(s => s.period === '2026-05') },
      '2026-06': { period: '2026-06', salesSummary: salesSummary.filter(s => s.period === '2026-06'), purchase: purchase.filter(p => p.period === '2026-06'), stock, sales: sales.filter(s => s.period === '2026-06') }
    },
    updatedAt: Date.now()
  };
}

// ==================== 全局状态 ====================
const S = {
  data: null,
  period: '2026-06',
  charts: {},
  tab: 'overview'
};

function cur() {
  return S.data.periods[S.period] || {};
}

// ==================== 初始化 ====================
function init() {
  S.data = generateDemoData();
  const periods = Object.keys(S.data.periods).sort();
  S.period = periods[periods.length - 1];

  const sel = $('#periodSel');
  sel.innerHTML = periods.map(p => `<option value="${p}" ${p === S.period ? 'selected' : ''}>${p.replace('-', '年')}月</option>`).join('');
  sel.onchange = () => { S.period = sel.value; renderAll(); };

  setupTabs();
  renderAll();
  $('#loader').style.display = 'none';
  toast('演示数据加载完成（虚假数据，仅供体验）');
}

function setupTabs() {
  $$('#tabs button').forEach(btn => {
    btn.onclick = () => {
      $$('#tabs button').forEach(b => b.classList.remove('on'));
      btn.classList.add('on');
      $$('.tab').forEach(t => t.classList.remove('on'));
      const tabId = 'tab-' + btn.dataset.tab;
      const tabEl = $(`#${tabId}`);
      if (tabEl) tabEl.classList.add('on');
      S.tab = btn.dataset.tab;
      renderTab(S.tab);
    };
  });
}

function renderAll() {
  renderOverview();
  renderStock();
  renderSales();
  renderStaff();
  renderForecast();
  renderYear();
  renderUpload();
}

function renderTab(tab) {
  switch (tab) {
    case 'overview': renderOverview(); break;
    case 'stock': renderStock(); break;
    case 'sales': renderSales(); break;
    case 'staff': renderStaff(); break;
    case 'forecast': renderForecast(); break;
    case 'year': renderYear(); break;
    case 'upload': renderUpload(); break;
  }
}

// ==================== 总览模块 ====================
function renderOverview() {
  const d = cur();
  const salesData = d.salesSummary || [];
  const purchaseData = d.purchase || [];
  const stockData = d.stock || [];

  const totalQty = sum(salesData, x => x.qty);
  const totalAmt = sum(salesData, x => x.amount);
  const totalPurchase = sum(purchaseData, x => x.qty);
  const totalStock = sum(stockData, x => x.stock);

  $('#kpis').innerHTML = `
    <div class="kpi"><div class="kv"><span class="v">${qtyF(totalQty)}</span><span class="u">吨</span></div><div class="kl">总销量</div></div>
    <div class="kpi"><div class="kv"><span class="v">${money(totalAmt)}</span></div><div class="kl">总金额</div></div>
    <div class="kpi"><div class="kv"><span class="v">${qtyF(totalPurchase)}</span><span class="u">吨</span></div><div class="kl">购进总量</div></div>
    <div class="kpi"><div class="kv"><span class="v">${qtyF(totalStock)}</span><span class="u">吨</span></div><div class="kl">期末库存</div></div>
  `;

  // 分类占比饼图
  const catStats = {};
  salesData.forEach(s => {
    if (!catStats[s.cat]) catStats[s.cat] = 0;
    catStats[s.cat] += s.qty;
  });
  const catArr = Object.entries(catStats).sort((a, b) => b[1] - a[1]).slice(0, 10);
  renderPie('chCatPie', catArr.map(c => c[0]), catArr.map(c => c[1]), '销量分布');

  // 月度趋势
  const periods = Object.keys(S.data.periods).sort();
  const trendData = periods.map(p => {
    const pd = S.data.periods[p];
    return { period: p, qty: sum(pd.salesSummary || [], x => x.qty), purchase: sum(pd.purchase || [], x => x.qty) };
  });
  renderLine('chTrend', trendData);

  // 库存预警
  const warnings = stockData.filter(s => s.status !== '正常').length;
  $('#warnCount').textContent = warnings;
  const warnList = stockData.filter(s => s.status !== '正常').slice(0, 10);
  $('#warnList').innerHTML = warnList.length ? warnList.map(s => `<tr><td>${s.product}</td><td>${s.cat}</td><td>${qtyF(s.stock)}</td><td class="st ${s.status === '缺货' ? 'low' : 'high'}">${s.status}</td></tr>`).join('') : '<tr><td colspan="4">暂无预警</td></tr>';
}

// ==================== 库存管理 ====================
function renderStock() {
  const stockData = cur().stock || [];
  const tbody = $('#stockBody');
  tbody.innerHTML = stockData.map(s => `
    <tr>
      <td>${s.product}</td>
      <td>${s.cat}</td>
      <td>${s.unit}</td>
      <td>${qtyF(s.stock)}</td>
      <td>${s.warehouse}</td>
      <td class="st ${s.status === '缺货' ? 'low' : s.status === '呆滞积压' ? 'high' : ''}">${s.status}</td>
    </tr>
  `).join('');
}

// ==================== 销售汇总 ====================
function renderSales() {
  const salesData = cur().salesSummary || [];
  const tbody = $('#salesBody');
  tbody.innerHTML = salesData.slice(0, 50).map(s => `
    <tr>
      <td>${s.product}</td>
      <td>${s.cat}</td>
      <td>${s.unit}</td>
      <td>${qtyF(s.qty)}</td>
      <td>${money(s.amount)}</td>
      <td>${s.warehouse}</td>
    </tr>
  `).join('');
}

// ==================== 业务员分析 ====================
function renderStaff() {
  const salesData = cur().sales || [];
  const staffStats = {};
  salesData.forEach(s => {
    if (!staffStats[s.staff]) staffStats[s.staff] = { qty: 0, amount: 0 };
    staffStats[s.staff].qty += s.qty;
    staffStats[s.staff].amount += s.amount;
  });
  const staffArr = Object.entries(staffStats).sort((a, b) => b[1].qty - a[1].qty);
  const tbody = $('#staffBody');
  tbody.innerHTML = staffArr.map(([name, data], i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${name}</td>
      <td>${qtyF(data.qty)}</td>
      <td>${money(data.amount)}</td>
    </tr>
  `).join('');
}

// ==================== 预测分析 ====================
function renderForecast() {
  const periods = Object.keys(S.data.periods).sort();
  const trendData = periods.map(p => {
    const pd = S.data.periods[p];
    return { period: p, qty: sum(pd.salesSummary || [], x => x.qty) };
  });
  renderLine('chForecast', trendData, true);
  $('#forecastTip').textContent = '基于历史数据趋势预测下月销量';
}

// ==================== 年度汇总 ====================
function renderYear() {
  const periods = Object.keys(S.data.periods).sort();
  const yearData = periods.map(p => {
    const pd = S.data.periods[p];
    return {
      period: p,
      salesQty: sum(pd.salesSummary || [], x => x.qty),
      salesAmt: sum(pd.salesSummary || [], x => x.amount),
      purchaseQty: sum(pd.purchase || [], x => x.qty)
    };
  });
  const tbody = $('#yearBody');
  tbody.innerHTML = yearData.map(y => `
    <tr>
      <td>${y.period.replace('-', '年')}月</td>
      <td>${qtyF(y.salesQty)}</td>
      <td>${money(y.salesAmt)}</td>
      <td>${qtyF(y.purchaseQty)}</td>
    </tr>
  `).join('');
}

// ==================== 数据上传 ====================
function renderUpload() {
  $('#uploadLog').innerHTML = `
    <div style="color:#ffab3d;">⚠️ 演示版不支持上传真实数据</div>
    <div style="margin-top:10px;">系统已内置虚假示例数据，展示了完整的7大模块功能。</div>
    <div style="margin-top:10px;">如需真实使用，请访问：<a href="https://2953998209-crypto.github.io/inms/real.html" style="color:#4aa8ff;">真实系统</a></div>
  `;
}

// ==================== 图表函数 ====================
function renderPie(id, labels, data, title) {
  const ctx = document.getElementById(id);
  if (!ctx) return;
  if (S.charts[id]) S.charts[id].destroy();
  S.charts[id] = new Chart(ctx, {
    type: 'pie',
    data: {
      labels,
      datasets: [{ data, backgroundColor: PALETTE.slice(0, labels.length) }]
    },
    options: {
      responsive: true,
      plugins: { legend: { position: 'right', labels: { color: '#b0bec5' } } }
    }
  });
}

function renderLine(id, data, showForecast = false) {
  const ctx = document.getElementById(id);
  if (!ctx) return;
  if (S.charts[id]) S.charts[id].destroy();

  const labels = data.map(d => d.period.replace('-', '年') + '月');
  const values = data.map(d => d.qty);
  const purchases = data.map(d => d.purchase || 0);

  const datasets = [{
    label: '销量',
    data: values,
    borderColor: '#4aa8ff',
    backgroundColor: 'rgba(74, 168, 255, 0.1)',
    fill: true,
    tension: 0.3
  }];

  if (purchases.some(p => p > 0)) {
    datasets.push({
      label: '购进',
      data: purchases,
      borderColor: '#ffab3d',
      backgroundColor: 'rgba(255, 171, 61, 0.1)',
      fill: true,
      tension: 0.3
    });
  }

  if (showForecast && values.length > 2) {
    const forecast = values[values.length - 1] * (1 + (Math.random() - 0.5) * 0.2);
    datasets.push({
      label: '预测',
      data: [...Array(values.length - 1).fill(null), values[values.length - 1], forecast],
      borderColor: '#22d3a8',
      borderDash: [5, 5],
      fill: false
    });
    labels.push('预测');
  }

  S.charts[id] = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      plugins: { legend: { labels: { color: '#b0bec5' } } },
      scales: {
        x: { ticks: { color: '#b0bec5' }, grid: { color: '#1e3a5f' } },
        y: { ticks: { color: '#b0bec5' }, grid: { color: '#1e3a5f' } }
      }
    }
  });
}

// 启动
window.addEventListener('DOMContentLoaded', init);
