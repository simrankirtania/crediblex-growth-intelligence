/* =============================================================================
   CredibleX Growth Intelligence Engine — Dashboard logic
   Consumes SME_DATA / PARTNER_DATA from data.js (exported by
   python/opportunity_engine.ipynb). AI briefs are generated client-side
   using the same template logic as python/ai_insights.ipynb, so every
   record — not just the top 20 exported to ai_briefs.json — has a brief.
============================================================================= */

const CHART_COLORS = {
  emerald: '#1F8A63',
  amber: '#C98A2C',
  rust: '#B4502F',
  slate: '#5B6B78',
  inkLine: '#DAD6C6',
};

const SEGMENT_ORDER = ['High Opportunity', 'Emerging Opportunity', 'Moderate Opportunity', 'Low Opportunity'];
const SEGMENT_COLORS = {
  'High Opportunity': CHART_COLORS.emerald,
  'Emerging Opportunity': CHART_COLORS.amber,
  'Moderate Opportunity': CHART_COLORS.slate,
  'Low Opportunity': '#C7C2AF',
};
const PARTNER_SEG_COLORS = { Priority: CHART_COLORS.emerald, Emerging: CHART_COLORS.amber, Monitor: CHART_COLORS.slate };

if (typeof Chart !== 'undefined') {
  Chart.defaults.font.family = "'IBM Plex Sans', sans-serif";
  Chart.defaults.font.size = 11.5;
  Chart.defaults.color = '#4A5654';
} else {
  console.error('Chart.js failed to load — charts will be skipped, but KPIs, tables and briefs will still render.');
}

/* ---------------------------------------------------------------- nav */
document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('page-' + btn.dataset.page).classList.add('active');
  });
});

/* ---------------------------------------------------------------- helpers */
const fmtAED = n => 'AED ' + Math.round(n).toLocaleString('en-US');
const fmtAEDShort = n => {
  if (n >= 1e9) return 'AED ' + (n/1e9).toFixed(1) + 'B';
  if (n >= 1e6) return 'AED ' + (n/1e6).toFixed(1) + 'M';
  if (n >= 1e3) return 'AED ' + (n/1e3).toFixed(0) + 'K';
  return 'AED ' + Math.round(n);
};
const fmtPct = n => (n*100).toFixed(1) + '%';
const segClass = seg => seg.toLowerCase().split(' ')[0];
const statusClass = st => st.toLowerCase().split(' ')[0];

function pillHTML(text, cls) {
  return `<span class="pill ${cls}">${text}</span>`;
}

/* ---------------------------------------------------------------- score ring */
function scoreRingHTML(score, colorVar, size) {
  const pct = Math.max(0, Math.min(100, score));
  const cls = size === 'lg' ? 'score-ring lg' : 'score-ring';
  return `<div class="${cls}" style="--pct:${pct};--ring-color:${colorVar}"><div class="inner">${score}</div></div>`;
}

/* ---------------------------------------------------------------- animated count-up */
function animateValue(el, end, opts = {}) {
  const { duration = 900, formatter = (n) => Math.round(n).toLocaleString(), start = 0 } = opts;
  const startTime = performance.now();
  function tick(now) {
    const t = Math.min(1, (now - startTime) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    el.textContent = formatter(start + (end - start) * eased);
    if (t < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

/* ---------------------------------------------------------------- KPIs */
function renderKPIs() {
  const high = SME_DATA.filter(d => d.Opportunity_Segment === 'High Opportunity').length;
  const totalFin = SME_DATA.reduce((s, d) => s + d.Financing_Requirement, 0);
  const priority = PARTNER_DATA.filter(d => d.Partner_Segment === 'Priority').length;

  const kpis = [
    { id: 'k-smes', label: 'SMEs Analysed', value: SME_DATA.length, cls: '', fmt: n => Math.round(n).toLocaleString() },
    { id: 'k-high', label: 'High-Opportunity SMEs', value: high, cls: 'emerald', bar: high / SME_DATA.length, barColor: 'var(--emerald)', fmt: n => Math.round(n).toLocaleString() },
    { id: 'k-fin', label: 'Total Illustrative Financing Requirement', value: totalFin, cls: '', fmt: fmtAEDShort },
    { id: 'k-partners', label: 'Potential Partners', value: PARTNER_DATA.length, cls: '', fmt: n => Math.round(n).toLocaleString() },
    { id: 'k-priority', label: 'Priority Partners', value: priority, cls: 'amber', bar: priority / PARTNER_DATA.length, barColor: 'var(--amber)', fmt: n => Math.round(n).toLocaleString() },
  ];

  document.getElementById('kpi-row').innerHTML = kpis.map(k => `
    <div class="kpi">
      <div class="label">${k.label}</div>
      <div class="value ${k.cls}" id="${k.id}">0</div>
      ${k.bar !== undefined ? `<div class="kpi-bar-track"><div class="kpi-bar-fill" id="${k.id}-bar" style="background:${k.barColor}"></div></div>` : ''}
    </div>
  `).join('');

  kpis.forEach(k => {
    const el = document.getElementById(k.id);
    animateValue(el, k.value, { formatter: k.fmt });
    if (k.bar !== undefined) {
      requestAnimationFrame(() => {
        setTimeout(() => { document.getElementById(k.id + '-bar').style.width = (k.bar * 100) + '%'; }, 50);
      });
    }
  });
}

/* ---------------------------------------------------------------- spotlights */
function renderSpotlights() {
  const topSME = [...SME_DATA].sort((a,b) => b.Opportunity_Score - a.Opportunity_Score)[0];
  const topPartner = [...PARTNER_DATA].sort((a,b) => b.Partner_Score - a.Partner_Score)[0];

  const smeBrief = generateSMEBrief(topSME);
  const partnerBrief = generatePartnerBrief(topPartner);

  document.getElementById('spotlight-row').innerHTML = `
    <div class="spotlight" id="spotlight-sme">
      <div class="tag">TOP-RANKED SME OPPORTUNITY</div>
      <div class="spotlight-top">
        ${scoreRingHTML(topSME.Opportunity_Score, 'var(--emerald)')}
        <div>
          <div class="id">${topSME.SME_ID}</div>
          <div class="sub">${topSME.Industry} · ${topSME.Emirate} · ${topSME.Recommended_Product}</div>
        </div>
      </div>
      <p class="teaser">${smeBrief.financing_opportunity}</p>
      <div class="cta">View full AI Financing Brief →</div>
    </div>
    <div class="spotlight" id="spotlight-partner">
      <div class="tag">TOP-RANKED PARTNER OPPORTUNITY</div>
      <div class="spotlight-top">
        ${scoreRingHTML(topPartner.Partner_Score, 'var(--amber)')}
        <div>
          <div class="id">${topPartner.Partner_ID}</div>
          <div class="sub">${topPartner.Partner_Type} · ${topPartner.Industry_Focus} focus</div>
        </div>
      </div>
      <p class="teaser">${partnerBrief.financing_opportunity}</p>
      <div class="cta">View full AI Partner Brief →</div>
    </div>
  `;

  document.getElementById('spotlight-sme').addEventListener('click', () => openSMEBrief(topSME.SME_ID));
  document.getElementById('spotlight-partner').addEventListener('click', () => openPartnerBrief(topPartner.Partner_ID));
}
function renderOverviewCharts() {
  if (typeof Chart === 'undefined') return;
  // Opportunity by industry
  const industries = [...new Set(SME_DATA.map(d => d.Industry))];
  const avgByIndustry = industries.map(ind => {
    const rows = SME_DATA.filter(d => d.Industry === ind);
    return { ind, avg: rows.reduce((s,d)=>s+d.Opportunity_Score,0)/rows.length };
  }).sort((a,b) => b.avg - a.avg);

  new Chart(document.getElementById('chart-industry'), {
    type: 'bar',
    data: {
      labels: avgByIndustry.map(d => d.ind),
      datasets: [{ data: avgByIndustry.map(d => d.avg.toFixed(1)), backgroundColor: CHART_COLORS.emerald, borderRadius: 2, maxBarThickness: 22 }]
    },
    options: {
      indexAxis: 'y',
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: CHART_COLORS.inkLine }, title: { display: true, text: 'Avg. Opportunity Score' } },
        y: { grid: { display: false } }
      }
    }
  });

  // Product distribution
  const products = [...new Set(SME_DATA.map(d => d.Recommended_Product))];
  const prodCounts = products.map(p => SME_DATA.filter(d => d.Recommended_Product === p).length);
  new Chart(document.getElementById('chart-product'), {
    type: 'doughnut',
    data: {
      labels: products,
      datasets: [{ data: prodCounts, backgroundColor: [CHART_COLORS.emerald, CHART_COLORS.amber, CHART_COLORS.slate], borderWidth: 2, borderColor: '#fff' }]
    },
    options: { plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, padding: 12 } } }, cutout: '62%' }
  });

  // Segments
  const segCounts = SEGMENT_ORDER.map(s => SME_DATA.filter(d => d.Opportunity_Segment === s).length);
  new Chart(document.getElementById('chart-segments'), {
    type: 'bar',
    data: {
      labels: SEGMENT_ORDER.map(s => s.replace(' Opportunity','')),
      datasets: [{ data: segCounts, backgroundColor: SEGMENT_ORDER.map(s => SEGMENT_COLORS[s]), borderRadius: 2, maxBarThickness: 44 }]
    },
    options: {
      plugins: { legend: { display: false } },
      scales: { x: { grid: { display: false } }, y: { grid: { color: CHART_COLORS.inkLine } } }
    }
  });
}

/* ---------------------------------------------------------------- SME table */
let smeFiltered = [...SME_DATA];
let smePage = 0;
const SME_PAGE_SIZE = 25;
let smeSortKey = 'Opportunity_Score';
let smeSortDir = -1;

function populateSMEFilters() {
  const industries = [...new Set(SME_DATA.map(d => d.Industry))].sort();
  const emirates = [...new Set(SME_DATA.map(d => d.Emirate))].sort();
  const products = [...new Set(SME_DATA.map(d => d.Recommended_Product))].sort();

  const fill = (id, values) => {
    const el = document.getElementById(id);
    values.forEach(v => {
      const opt = document.createElement('option');
      opt.value = v; opt.textContent = v;
      el.appendChild(opt);
    });
  };
  fill('f-industry', industries);
  fill('f-emirate', emirates);
  fill('f-product', products);
  SEGMENT_ORDER.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s; opt.textContent = s;
    document.getElementById('f-segment').appendChild(opt);
  });
}

function applySMEFilters() {
  const search = document.getElementById('f-search').value.trim().toUpperCase();
  const industry = document.getElementById('f-industry').value;
  const emirate = document.getElementById('f-emirate').value;
  const segment = document.getElementById('f-segment').value;
  const product = document.getElementById('f-product').value;

  smeFiltered = SME_DATA.filter(d =>
    (!search || d.SME_ID.toUpperCase().includes(search)) &&
    (!industry || d.Industry === industry) &&
    (!emirate || d.Emirate === emirate) &&
    (!segment || d.Opportunity_Segment === segment) &&
    (!product || d.Recommended_Product === product)
  );
  smePage = 0;
  sortSME();
}

function sortSME() {
  smeFiltered.sort((a,b) => {
    const va = a[smeSortKey], vb = b[smeSortKey];
    if (typeof va === 'string') return va.localeCompare(vb) * smeSortDir;
    return (va - vb) * smeSortDir;
  });
  renderSMETable();
}

function renderSMETable() {
  document.getElementById('sme-count').textContent = `${smeFiltered.length.toLocaleString()} of ${SME_DATA.length.toLocaleString()} SMEs`;
  const start = smePage * SME_PAGE_SIZE;
  const pageRows = smeFiltered.slice(start, start + SME_PAGE_SIZE);

  document.getElementById('sme-tbody').innerHTML = pageRows.map(d => `
    <tr data-id="${d.SME_ID}">
      <td><b>${d.SME_ID}</b></td>
      <td>${d.Industry}</td>
      <td>${d.Emirate}</td>
      <td class="score-cell">${fmtAED(d.Monthly_Revenue)}</td>
      <td class="score-cell">${fmtPct(d.Revenue_Growth)}</td>
      <td class="score-cell">${d.Opportunity_Score} ${pillHTML(d.Opportunity_Segment.replace(' Opportunity',''), segClass(d.Opportunity_Segment))}</td>
      <td>${d.Recommended_Product}</td>
      <td>${pillHTML(d.Early_Warning_Status, statusClass(d.Early_Warning_Status))}</td>
    </tr>
  `).join('');

  document.querySelectorAll('#sme-tbody tr').forEach(tr => {
    tr.addEventListener('click', () => openSMEBrief(tr.dataset.id));
  });

  const totalPages = Math.max(1, Math.ceil(smeFiltered.length / SME_PAGE_SIZE));
  document.getElementById('sme-page-info').textContent = `Page ${smePage+1} of ${totalPages}`;
  document.getElementById('sme-prev').disabled = smePage === 0;
  document.getElementById('sme-next').disabled = smePage >= totalPages - 1;
}

document.querySelectorAll('#page-sme thead th').forEach(th => {
  th.addEventListener('click', () => {
    const key = th.dataset.sort;
    if (smeSortKey === key) smeSortDir *= -1; else { smeSortKey = key; smeSortDir = -1; }
    sortSME();
  });
});
document.getElementById('sme-prev').addEventListener('click', () => { if (smePage>0){smePage--; renderSMETable();} });
document.getElementById('sme-next').addEventListener('click', () => {
  const totalPages = Math.ceil(smeFiltered.length / SME_PAGE_SIZE);
  if (smePage < totalPages-1){smePage++; renderSMETable();}
});
['f-search','f-industry','f-emirate','f-segment','f-product'].forEach(id => {
  document.getElementById(id).addEventListener('input', applySMEFilters);
});

/* ---------------------------------------------------------------- Partner page */
let partnerFiltered = [...PARTNER_DATA];

function populatePartnerFilters() {
  const types = [...new Set(PARTNER_DATA.map(d => d.Partner_Type))].sort();
  const fill = (id, values) => {
    const el = document.getElementById(id);
    values.forEach(v => {
      const opt = document.createElement('option');
      opt.value = v; opt.textContent = v;
      el.appendChild(opt);
    });
  };
  fill('pf-type', types);
  ['Priority','Emerging','Monitor'].forEach(s => {
    const opt = document.createElement('option');
    opt.value = s; opt.textContent = s;
    document.getElementById('pf-segment').appendChild(opt);
  });
}

function applyPartnerFilters() {
  const type = document.getElementById('pf-type').value;
  const segment = document.getElementById('pf-segment').value;
  partnerFiltered = PARTNER_DATA.filter(d =>
    (!type || d.Partner_Type === type) && (!segment || d.Partner_Segment === segment)
  ).sort((a,b) => b.Partner_Score - a.Partner_Score);
  renderPartnerGrid();
}
document.getElementById('pf-type').addEventListener('input', applyPartnerFilters);
document.getElementById('pf-segment').addEventListener('input', applyPartnerFilters);

function renderPartnerGrid() {
  document.getElementById('partner-count').textContent = `${partnerFiltered.length} of ${PARTNER_DATA.length} partners`;
  document.getElementById('partner-grid').innerHTML = partnerFiltered.map(d => `
    <div class="partner-card" data-id="${d.Partner_ID}">
      <div class="top-row">
        <span class="pid">${d.Partner_ID}</span>
        ${pillHTML(d.Partner_Segment, segClass(d.Partner_Segment))}
      </div>
      <div class="card-body">
        ${scoreRingHTML(d.Partner_Score, `var(--${d.Partner_Segment === 'Priority' ? 'emerald' : d.Partner_Segment === 'Emerging' ? 'amber' : 'slate'})`)}
        <div>
          <div class="ptype">${d.Partner_Type}</div>
          <div style="font-size:12px;color:var(--text-600);margin-bottom:4px;">${d.Industry_Focus} focus</div>
          <div class="metrics">
            <div>Reach<b>${d.SME_Reach.toLocaleString()}</b></div>
            <div>Relevance<b>${d.Financing_Relevance}</b></div>
          </div>
        </div>
      </div>
    </div>
  `).join('');

  document.querySelectorAll('.partner-card').forEach(card => {
    card.addEventListener('click', () => openPartnerBrief(card.dataset.id));
  });
}

/* ---------------------------------------------------------------- scatter + partner segment donut */
function renderPartnerCharts() {
  if (typeof Chart === 'undefined') return;

  const reachValues = PARTNER_DATA.map(d => d.SME_Reach).sort((a,b)=>a-b);
  const relevanceValues = PARTNER_DATA.map(d => d.Financing_Relevance).sort((a,b)=>a-b);
  const medianReach = reachValues[Math.floor(reachValues.length/2)];
  const medianRelevance = relevanceValues[Math.floor(relevanceValues.length/2)];

  const quadrantPlugin = {
    id: 'quadrantBg',
    beforeDatasetsDraw(chart) {
      const { ctx, chartArea, scales } = chart;
      if (!chartArea) return;
      const xMid = scales.x.getPixelForValue(medianReach);
      const yMid = scales.y.getPixelForValue(medianRelevance);
      ctx.save();
      ctx.fillStyle = 'rgba(31,138,99,0.06)';
      ctx.fillRect(xMid, chartArea.top, chartArea.right - xMid, yMid - chartArea.top);
      ctx.fillStyle = 'rgba(201,138,44,0.06)';
      ctx.fillRect(chartArea.left, chartArea.top, xMid - chartArea.left, yMid - chartArea.top);
      ctx.fillStyle = 'rgba(91,107,120,0.05)';
      ctx.fillRect(xMid, yMid, chartArea.right - xMid, chartArea.bottom - yMid);
      ctx.fillStyle = 'rgba(199,194,175,0.10)';
      ctx.fillRect(chartArea.left, yMid, xMid - chartArea.left, chartArea.bottom - yMid);
      ctx.strokeStyle = 'rgba(90,100,95,0.15)';
      ctx.setLineDash([3,3]);
      ctx.beginPath(); ctx.moveTo(xMid, chartArea.top); ctx.lineTo(xMid, chartArea.bottom); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(chartArea.left, yMid); ctx.lineTo(chartArea.right, yMid); ctx.stroke();
      ctx.restore();
    }
  };

  const segColors = PARTNER_DATA.map(d => PARTNER_SEG_COLORS[d.Partner_Segment]);
  new Chart(document.getElementById('chart-scatter'), {
    type: 'bubble',
    data: {
      datasets: [{
        data: PARTNER_DATA.map(d => ({ x: d.SME_Reach, y: d.Financing_Relevance, r: 4 + d.Partner_Score/6, id: d.Partner_ID })),
        backgroundColor: segColors.map(c => c + 'B3'),
        borderColor: segColors,
        borderWidth: 1,
      }]
    },
    plugins: [quadrantPlugin],
    options: {
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => {
              const p = PARTNER_DATA.find(d => d.Partner_ID === ctx.raw.id);
              return `${p.Partner_ID} · ${p.Partner_Type} · Score ${p.Partner_Score}`;
            }
          }
        }
      },
      scales: {
        x: { type: 'logarithmic', title: { display: true, text: 'SME Reach (log scale)' }, grid: { color: CHART_COLORS.inkLine } },
        y: { title: { display: true, text: 'Financing Relevance' }, grid: { color: CHART_COLORS.inkLine } }
      },
      onClick: (evt, elements) => {
        if (elements.length) {
          const idx = elements[0].index;
          openPartnerBrief(PARTNER_DATA[idx].Partner_ID);
        }
      }
    }
  });

  const segs = ['Priority','Emerging','Monitor'];
  const counts = segs.map(s => PARTNER_DATA.filter(d => d.Partner_Segment === s).length);
  new Chart(document.getElementById('chart-partner-segments'), {
    type: 'doughnut',
    data: { labels: segs, datasets: [{ data: counts, backgroundColor: segs.map(s => PARTNER_SEG_COLORS[s]), borderWidth: 2, borderColor: '#fff' }] },
    options: { plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, padding: 12 } } }, cutout: '62%' }
  });
}

/* ---------------------------------------------------------------- AI brief generation (client-side) */
function generateSMEBrief(row) {
  const growthDesc = row.Revenue_Growth > 0.03 ? 'growing' : (row.Revenue_Growth < -0.03 ? 'contracting' : 'broadly flat');
  const volDesc = row.Revenue_Volatility < 0.3 ? 'stable' : 'variable';

  const business_profile = `${row.SME_ID} is a ${row.Business_Age}-year-old ${row.Industry} business based in ${row.Emirate}, generating approximately ${fmtAED(row.Monthly_Revenue)} in monthly revenue with ${volDesc} revenue patterns and revenue that is currently ${growthDesc} (${fmtPct(row.Revenue_Growth)} growth).`;

  const financing_opportunity = `The business scores ${row.Opportunity_Score}/100 on the Financing Opportunity Score, placing it in the '${row.Opportunity_Segment}' segment, with an estimated illustrative financing requirement of ${fmtAED(row.Financing_Requirement)}.`;

  const recommended_product = `${row.Recommended_Product}. ${row.Recommendation_Reason}`;

  const drivers = [];
  if (row.Receivable_Days > 45) drivers.push(`elevated receivable days (${row.Receivable_Days} days)`);
  if (row.Revenue_Growth > 0.1) drivers.push(`strong revenue growth (${fmtPct(row.Revenue_Growth)})`);
  if (row.Transaction_Volume > 150) drivers.push(`healthy transaction activity (${row.Transaction_Volume} transactions/month)`);
  if (row.Cash_Buffer < 20) drivers.push(`thin cash buffer (${row.Cash_Buffer} days)`);
  if (!drivers.length) drivers.push('a moderate, well-balanced financial profile');
  const key_drivers = drivers.join('; ').replace(/^./, c => c.toUpperCase()) + '.';

  let potential_concern;
  if (row.Early_Warning_Status === 'Attention Required') {
    potential_concern = 'Multiple early-warning indicators are flagged (declining revenue, elevated receivables, thin cash buffer, or weak repayment history) — this SME warrants closer review before any financing offer is extended.';
  } else if (row.Early_Warning_Status === 'Monitor') {
    potential_concern = 'One or two early-warning signals are present; not disqualifying, but worth monitoring alongside the financing conversation.';
  } else {
    potential_concern = 'No material early-warning signals are present at this time.';
  }

  const suggested_next_action = `Prioritise outreach with a tailored ${row.Recommended_Product} offer` +
    (row.Early_Warning_Status !== 'Stable' ? ', paired with a light-touch financial review given the flagged concerns.' : ' and fast-track given the clean risk profile.');

  return { business_profile, financing_opportunity, recommended_product, key_drivers, potential_concern, suggested_next_action };
}

function generatePartnerBrief(row) {
  const partner_profile = `${row.Partner_ID} is a ${row.Partner_Type} with a primary focus on the ${row.Industry_Focus} sector, reaching an estimated ${row.SME_Reach.toLocaleString()} SMEs and processing roughly ${fmtAED(row.Transaction_Volume)} in transaction volume per month.`;

  const sme_exposure = `With ${row.SME_Reach.toLocaleString()} SMEs in its network and a digital maturity score of ${row.Digital_Maturity}/100, this partner offers ${row.SME_Reach > 2000 ? 'substantial' : 'moderate'} reach into CredibleX's target segment.`;

  const financing_opportunity = `Financing relevance is scored at ${row.Financing_Relevance}/100, and the partner's overall Partner Opportunity Score is ${row.Partner_Score}/100 ('${row.Partner_Segment}').`;

  let potential_fit;
  if (row.Partner_Segment === 'Priority') potential_fit = 'Strong candidate for an embedded-finance integration where CredibleX financing products are offered at the point of transaction or invoicing.';
  else if (row.Partner_Segment === 'Emerging') potential_fit = 'Reasonable candidate worth developing further, with fit likely to improve as digital integration and transaction volume mature.';
  else potential_fit = 'Lower near-term fit; better suited to periodic monitoring than active pursuit.';

  const scalesFast = row.Growth_Rate > 0.15 && row.Integration_Complexity === 'Low';
  const why_it_matters = `Growth rate of ${fmtPct(row.Growth_Rate)} and ${row.Integration_Complexity.toLowerCase()} integration complexity mean this partnership could scale ${scalesFast ? 'quickly' : 'steadily'} if pursued.`;

  const suggested_bd_angle = `Approach with an embedded-financing pilot tailored to ${row.Industry_Focus} SMEs in the partner's network, emphasising ${row.Integration_Complexity === 'Low' ? 'quick technical integration' : 'a phased integration roadmap'}.`;

  return { partner_profile, sme_exposure, financing_opportunity, potential_fit, why_it_matters, suggested_bd_angle };
}

/* ---------------------------------------------------------------- modal */
const modalBackdrop = document.getElementById('modal-backdrop');
document.getElementById('modal-close').addEventListener('click', closeModal);
modalBackdrop.addEventListener('click', e => { if (e.target === modalBackdrop) closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
function closeModal() { modalBackdrop.classList.remove('open'); }

function openSMEBrief(smeId) {
  const row = SME_DATA.find(d => d.SME_ID === smeId);
  const brief = generateSMEBrief(row);
  const ringColor = row.Opportunity_Segment === 'High Opportunity' ? 'var(--emerald)' : row.Opportunity_Segment === 'Emerging Opportunity' ? 'var(--amber)' : 'var(--slate)';

  document.getElementById('modal-eyebrow').textContent = 'AI FINANCING BRIEF';
  document.getElementById('modal-title').textContent = row.SME_ID;
  document.getElementById('modal-body').innerHTML = `
    <div class="brief-stats">
      <div style="display:flex;align-items:center;gap:12px;">
        ${scoreRingHTML(row.Opportunity_Score, ringColor)}
        <div><div style="font-size:12px;color:var(--text-600);">Opportunity Score</div><div style="font-size:12px;color:var(--text-600);">${row.Opportunity_Segment}</div></div>
      </div>
      <div>Product<b>${row.Recommended_Product}</b></div>
      <div>Status<b>${row.Early_Warning_Status}</b></div>
    </div>
    ${briefBlock('Business Profile', brief.business_profile)}
    ${briefBlock('Financing Opportunity', brief.financing_opportunity)}
    ${briefBlock('Recommended Product', brief.recommended_product)}
    ${briefBlock('Key Drivers', brief.key_drivers)}
    ${briefBlock('Potential Concern', brief.potential_concern)}
    ${briefBlock('Suggested Next Action', brief.suggested_next_action)}
  `;
  modalBackdrop.classList.add('open');
}

function openPartnerBrief(partnerId) {
  const row = PARTNER_DATA.find(d => d.Partner_ID === partnerId);
  const brief = generatePartnerBrief(row);
  const ringColor = row.Partner_Segment === 'Priority' ? 'var(--emerald)' : row.Partner_Segment === 'Emerging' ? 'var(--amber)' : 'var(--slate)';

  document.getElementById('modal-eyebrow').textContent = 'AI PARTNER BRIEF';
  document.getElementById('modal-title').textContent = row.Partner_ID;
  document.getElementById('modal-body').innerHTML = `
    <div class="brief-stats">
      <div style="display:flex;align-items:center;gap:12px;">
        ${scoreRingHTML(row.Partner_Score, ringColor)}
        <div><div style="font-size:12px;color:var(--text-600);">Partner Score</div><div style="font-size:12px;color:var(--text-600);">${row.Partner_Segment}</div></div>
      </div>
      <div>SME Reach<b>${row.SME_Reach.toLocaleString()}</b></div>
      <div>Type<b>${row.Partner_Type}</b></div>
    </div>
    ${briefBlock('Partner Profile', brief.partner_profile)}
    ${briefBlock('SME Exposure', brief.sme_exposure)}
    ${briefBlock('Financing Opportunity', brief.financing_opportunity)}
    ${briefBlock('Potential CredibleX Fit', brief.potential_fit)}
    ${briefBlock('Why It Matters', brief.why_it_matters)}
    ${briefBlock('Suggested Business Development Angle', brief.suggested_bd_angle)}
  `;
  modalBackdrop.classList.add('open');
}

function briefBlock(label, value) {
  return `<div class="brief-block"><div class="k">${label.toUpperCase()}</div><div class="v">${value}</div></div>`;
}

/* ---------------------------------------------------------------- AI Insights page */
function renderExecutiveSummary() {
  const highSMEs = SME_DATA.filter(d => d.Opportunity_Segment === 'High Opportunity');
  const industryCounts = {};
  highSMEs.forEach(d => industryCounts[d.Industry] = (industryCounts[d.Industry]||0)+1);
  const topIndustry = Object.entries(industryCounts).sort((a,b)=>b[1]-a[1])[0][0];

  const productCounts = {};
  SME_DATA.forEach(d => productCounts[d.Recommended_Product] = (productCounts[d.Recommended_Product]||0)+1);
  const topProduct = Object.entries(productCounts).sort((a,b)=>b[1]-a[1])[0][0];

  const pctHigh = (highSMEs.length / SME_DATA.length * 100).toFixed(1);
  const pctAttention = (SME_DATA.filter(d => d.Early_Warning_Status === 'Attention Required').length / SME_DATA.length * 100).toFixed(1);

  const priorityPartners = PARTNER_DATA.filter(d => d.Partner_Segment === 'Priority');
  const partnerTypeCounts = {};
  priorityPartners.forEach(d => partnerTypeCounts[d.Partner_Type] = (partnerTypeCounts[d.Partner_Type]||0)+1);
  const topPartnerType = Object.entries(partnerTypeCounts).sort((a,b)=>b[1]-a[1])[0]?.[0] || 'various';

  document.getElementById('insight-portfolio').textContent =
    `${pctHigh}% of analysed SMEs fall into the High-Opportunity segment, with ${topIndustry} the most represented industry among them — indicating where embedded-finance demand is currently concentrated.`;
  document.getElementById('insight-product').textContent =
    `${topProduct} is the most frequently recommended product across the portfolio, suggesting working-capital timing mismatches are the dominant financing need among the SMEs analysed.`;
  document.getElementById('insight-partner').textContent =
    `${priorityPartners.length} partners are classified as Priority, led by ${topPartnerType} players — these represent the strongest near-term candidates for embedded-finance distribution.`;
  document.getElementById('insight-warning').textContent =
    `${pctAttention}% of SMEs are flagged as 'Attention Required' on the early-warning framework and should be reviewed before financing outreach, even where their opportunity score looks attractive.`;
}

/* ---------------------------------------------------------------- init */
function safeCall(fn, label) {
  try { fn(); } catch (e) { console.error(`Dashboard init step failed (${label}):`, e); }
}

function init() {
  safeCall(renderKPIs, 'renderKPIs');
  safeCall(renderSpotlights, 'renderSpotlights');
  safeCall(renderOverviewCharts, 'renderOverviewCharts');
  safeCall(populateSMEFilters, 'populateSMEFilters');
  safeCall(applySMEFilters, 'applySMEFilters');
  safeCall(populatePartnerFilters, 'populatePartnerFilters');
  safeCall(applyPartnerFilters, 'applyPartnerFilters');
  safeCall(renderPartnerCharts, 'renderPartnerCharts');
  safeCall(renderExecutiveSummary, 'renderExecutiveSummary');
}
init();
