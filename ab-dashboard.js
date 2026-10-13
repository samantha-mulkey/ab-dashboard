document.addEventListener("DOMContentLoaded", function () {
  const SUPABASE_URL = "https://zxyplulobmwosnrkrokm.supabase.co";
  const SUPABASE_KEY = "sb_publishable_xSorPWS-XlGHAT7qx2KR5A_cytmsihD";
  const REFRESH_INTERVAL = 15000;
  const MAX_VARIANT_NAME_LENGTH = 40;
  const SIDEBAR_STATE_KEY = "ab_dashboard_sidebar_state";
  const SIDEBAR_COLLAPSED_WIDTH = "76px";
  const SIDEBAR_EXPANDED_WIDTH = "220px";

  let currentChartMetric = "visitors";
  let currentDateRange = 30;
  let currentChartData = [];
  let latestExperimentResults = [];

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  function setByAttr(root, attr, key, value) {
    const el = root.querySelector(`[${attr}="${key}"]`);
    if (el) el.textContent = value;
  }

  function siteName(siteId) {
    return ({ flytwerx: "FlytWERX", bidwerx: "BidWERX", "vista-techwerx": "Vista TechWERX" })[siteId] || siteId;
  }

  function formatStartedDate(value) {
    if (!value) return "Not Started";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "Not Started";
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  function runningDuration(value) {
    if (!value) return "Not Running";
    const start = new Date(value);
    if (Number.isNaN(start.getTime())) return "Not Running";
    const days = Math.max(1, Math.floor((Date.now() - start.getTime()) / 86400000) + 1);
    return days === 1 ? "1 Day Running" : `${days} Days Running`;
  }

  function formatSQLDate(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function formatChartDate(value) {
    const parts = String(value || "").split("-");
    if (parts.length !== 3) return value || "—";
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  async function rpc(name, payload) {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY },
      body: JSON.stringify(payload),
      cache: "no-store"
    });
    if (!response.ok) throw new Error(`${name} failed (${response.status})`);
    return await response.json();
  }

  const getExperimentData = (siteId, experimentId) => rpc("get_ab_experiment_summary", {
    p_site_id: siteId,
    p_experiment_id: experimentId
  });

  const getBounceData = (siteId, experimentId) => rpc("get_ab_experiment_bounce_summary", {
    p_site_id: siteId,
    p_experiment_id: experimentId
  });

  const getTimeseries = (siteId, experimentId, startDate, endDate) => rpc("get_ab_experiment_timeseries", {
    p_site_id: siteId,
    p_experiment_id: experimentId,
    p_start_date: startDate,
    p_end_date: endDate
  });

  const saveVariantName = (siteId, experimentId, variant, variantName) => rpc("set_ab_variant_name", {
    p_site_id: siteId,
    p_experiment_id: experimentId,
    p_variant: variant,
    p_variant_name: variantName
  });

  function summarizeExperiment(rows) {
    const out = {
      aVisitors: 0, bVisitors: 0,
      aConversions: 0, bConversions: 0,
      aName: "Variant A", bName: "Variant B",
      startedAt: null
    };

    rows.forEach((row) => {
      if (!out.startedAt && row.started_at) out.startedAt = row.started_at;
      if (row.variant === "A") {
        out.aVisitors = Number(row.visitors || 0);
        out.aConversions = Number(row.conversions || 0);
        out.aName = row.variant_name || "Variant A";
      }
      if (row.variant === "B") {
        out.bVisitors = Number(row.visitors || 0);
        out.bConversions = Number(row.conversions || 0);
        out.bName = row.variant_name || "Variant B";
      }
    });

    out.totalVisitors = out.aVisitors + out.bVisitors;
    out.totalConversions = out.aConversions + out.bConversions;
    out.aRate = out.aVisitors ? out.aConversions / out.aVisitors : 0;
    out.bRate = out.bVisitors ? out.bConversions / out.bVisitors : 0;
    out.overallRate = out.totalVisitors ? out.totalConversions / out.totalVisitors : 0;
    out.leader = out.aRate > out.bRate ? "A" : out.bRate > out.aRate ? "B" : null;
    return out;
  }

  function summarizeBounce(rows) {
    const out = {
      A: { visitors: 0, engaged: 0, bounced: 0, rate: 0 },
      B: { visitors: 0, engaged: 0, bounced: 0, rate: 0 }
    };

    rows.forEach((row) => {
      if (!out[row.variant]) return;
      out[row.variant] = {
        visitors: Number(row.visitors || 0),
        engaged: Number(row.engaged_visitors || 0),
        bounced: Number(row.bounced_visitors || 0),
        rate: Number(row.bounce_rate || 0)
      };
    });

    out.totalVisitors = out.A.visitors + out.B.visitors;
    out.totalBounced = out.A.bounced + out.B.bounced;
    out.overallRate = out.totalVisitors ? (out.totalBounced / out.totalVisitors) * 100 : 0;
    return out;
  }

  function setupViews() {
    function activate(viewName) {
      $$('[data-dashboard-view]').forEach((view) => {
        view.style.display = view.getAttribute('data-dashboard-view') === viewName ? 'block' : 'none';
      });

      const navTarget = viewName === 'experiment-detail' ? 'experiments' : viewName;
      $$('.sidebar-link[data-dashboard-open]').forEach((link) => {
        const active = link.getAttribute('data-dashboard-open') === navTarget;
        link.classList.toggle('is-active', active);
        if (active) link.setAttribute('aria-current', 'page');
        else link.removeAttribute('aria-current');
      });
    }

    $$('[data-dashboard-open]').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        const view = el.getAttribute('data-dashboard-open');
        if (view) activate(view);
      });
    });

    window.ABDashboardShowView = activate;
    activate('overview');
  }

  function setupSidebar() {
    const sidebar = $('[data-sidebar="true"]');
    const toggle = $('[data-sidebar-toggle="true"]');
    if (!sidebar || !toggle) return;

    const labels = $$('[data-sidebar-label="true"]', sidebar);
    const toggleLabel = $('[data-sidebar-toggle-label="true"]', sidebar);
    const toggleIcon = $('[data-sidebar-toggle-icon="true"]', sidebar);
    const links = $$('.sidebar-link', sidebar);

    let expanded = false;
    try { expanded = localStorage.getItem(SIDEBAR_STATE_KEY) === 'expanded'; } catch (_) {}

    function apply() {
      const width = expanded ? SIDEBAR_EXPANDED_WIDTH : SIDEBAR_COLLAPSED_WIDTH;
      sidebar.style.width = width;
      sidebar.style.minWidth = width;
      labels.forEach((el) => { el.style.display = expanded ? '' : 'none'; });
      if (toggleLabel) toggleLabel.style.display = expanded ? '' : 'none';
      links.forEach((el) => {
        el.style.justifyContent = expanded ? 'flex-start' : 'center';
        el.style.gap = expanded ? '10px' : '0px';
      });
      toggle.style.justifyContent = expanded ? 'flex-start' : 'center';
      if (toggleIcon) toggleIcon.style.transform = expanded ? 'rotate(0deg)' : 'rotate(180deg)';
      toggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    }

    toggle.addEventListener('click', (e) => {
      e.preventDefault();
      expanded = !expanded;
      apply();
      try { localStorage.setItem(SIDEBAR_STATE_KEY, expanded ? 'expanded' : 'collapsed'); } catch (_) {}
    });

    apply();
  }

  async function loadListCard(card) {
    const siteId = card.getAttribute('data-site-id');
    const experimentId = card.getAttribute('data-experiment-id');
    const goalName = card.getAttribute('data-goal-name') || 'Not Set';
    if (!siteId || !experimentId) return null;

    try {
      const data = summarizeExperiment(await getExperimentData(siteId, experimentId));
      setByAttr(card, 'data-list-field', 'site-name', siteName(siteId));
      setByAttr(card, 'data-list-field', 'started-date', `Started ${formatStartedDate(data.startedAt)}`);
      setByAttr(card, 'data-list-field', 'duration', runningDuration(data.startedAt));
      setByAttr(card, 'data-list-field', 'goal', `Goal: ${goalName}`);
      setByAttr(card, 'data-list-field', 'visitors', data.totalVisitors.toLocaleString());
      setByAttr(card, 'data-list-field', 'conversions', data.totalConversions.toLocaleString());
      setByAttr(card, 'data-list-field', 'leading', data.leader === 'A' ? data.aName : data.leader === 'B' ? data.bName : '—');
      return { card, siteId, experimentId, goalName, data };
    } catch (error) {
      console.error('Experiment list error:', experimentId, error);
      return null;
    }
  }

  function setupVariantEditing() {
    $$('[data-ab-action="edit-variant-name"]').forEach((button) => {
      button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();

        const card = button.closest('[data-site-id][data-experiment-id]');
        if (!card) return;

        const siteId = card.getAttribute('data-site-id');
        const experimentId = card.getAttribute('data-experiment-id');
        const variant = button.getAttribute('data-ab-variant');
        if (!['A', 'B'].includes(variant)) return;

        const text = $(`[data-ab-variant-name="${variant}"]`, card);
        if (!text || text.dataset.editing === 'true') return;

        const original = text.textContent.trim();
        text.dataset.editing = 'true';
        text.style.display = 'none';

        const input = document.createElement('input');
        input.type = 'text';
        input.value = original;
        input.maxLength = MAX_VARIANT_NAME_LENGTH;
        input.setAttribute('aria-label', `Edit Variant ${variant} name`);
        input.style.minWidth = '120px';
        input.style.maxWidth = '260px';
        input.style.padding = '2px 0 4px';
        input.style.border = 'none';
        input.style.borderBottom = '1px solid #f0f2f3';
        input.style.background = 'transparent';
        input.style.outline = 'none';
        text.parentNode.insertBefore(input, text.nextSibling);

        let done = false;
        async function finish(save) {
          if (done) return;
          done = true;
          const next = input.value.trim();
          input.remove();
          text.style.display = '';
          delete text.dataset.editing;
          if (!save || !next || next === original) return;

          text.textContent = next;
          try {
            await saveVariantName(siteId, experimentId, variant, next);
            await loadDashboard();
          } catch (error) {
            console.error(error);
            text.textContent = original;
          }
        }

        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') { e.preventDefault(); finish(true); }
          if (e.key === 'Escape') { e.preventDefault(); finish(false); }
        });
        input.addEventListener('blur', () => finish(true));
        input.focus();
        input.select();
      });
    });
  }

  function normalCDF(x) {
    const t = 1 / (1 + 0.2316419 * Math.abs(x));
    const d = 0.3989423 * Math.exp((-x * x) / 2);
    let p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
    if (x > 0) p = 1 - p;
    return p;
  }

  async function loadDetailCard(card) {
    const siteId = card.getAttribute('data-site-id');
    const experimentId = card.getAttribute('data-experiment-id');
    const goalName = card.getAttribute('data-goal-name') || 'Not Set';
    if (!siteId || !experimentId) return;

    try {
      const [summaryRows, bounceRows] = await Promise.all([
        getExperimentData(siteId, experimentId),
        getBounceData(siteId, experimentId)
      ]);

      const data = summarizeExperiment(summaryRows);
      const bounce = summarizeBounce(bounceRows);

      const aName = $('[data-ab-variant-name="A"]', card);
      const bName = $('[data-ab-variant-name="B"]', card);
      if (aName && aName.dataset.editing !== 'true') aName.textContent = data.aName;
      if (bName && bName.dataset.editing !== 'true') bName.textContent = data.bName;

      setByAttr(card, 'data-ab-field', 'started-date', formatStartedDate(data.startedAt));
      setByAttr(card, 'data-ab-field', 'duration', runningDuration(data.startedAt));
      setByAttr(card, 'data-ab-field', 'goal-name', goalName);
      setByAttr(card, 'data-ab-field', 'a-visitors', data.aVisitors.toLocaleString());
      setByAttr(card, 'data-ab-field', 'a-conversions', data.aConversions.toLocaleString());
      setByAttr(card, 'data-ab-field', 'a-rate', `${(data.aRate * 100).toFixed(2)}%`);
      setByAttr(card, 'data-ab-field', 'a-bounce-rate', bounce.A.visitors ? `${bounce.A.rate.toFixed(2)}%` : '—');
      setByAttr(card, 'data-ab-field', 'b-visitors', data.bVisitors.toLocaleString());
      setByAttr(card, 'data-ab-field', 'b-conversions', data.bConversions.toLocaleString());
      setByAttr(card, 'data-ab-field', 'b-rate', `${(data.bRate * 100).toFixed(2)}%`);
      setByAttr(card, 'data-ab-field', 'b-bounce-rate', bounce.B.visitors ? `${bounce.B.rate.toFixed(2)}%` : '—');

      const aTraffic = data.totalVisitors ? (data.aVisitors / data.totalVisitors) * 100 : 50;
      const bTraffic = data.totalVisitors ? (data.bVisitors / data.totalVisitors) * 100 : 50;
      setByAttr(card, 'data-ab-field', 'traffic-a', `A ${aTraffic.toFixed(1)}%`);
      setByAttr(card, 'data-ab-field', 'traffic-b', `B ${bTraffic.toFixed(1)}%`);
      const aBar = $('[data-ab-field="traffic-a-bar"]', card);
      const bBar = $('[data-ab-field="traffic-b-bar"]', card);
      if (aBar) aBar.style.width = `${aTraffic}%`;
      if (bBar) bBar.style.width = `${bTraffic}%`;

      let leaderName = null;
      let leaderRate = 0;
      let otherRate = 0;
      if (data.leader === 'A') { leaderName = data.aName; leaderRate = data.aRate; otherRate = data.bRate; }
      if (data.leader === 'B') { leaderName = data.bName; leaderRate = data.bRate; otherRate = data.aRate; }

      const resultText = !leaderName
        ? 'Variants are currently tied'
        : otherRate === 0
          ? `${leaderName} is currently leading`
          : `${leaderName} is performing ${(((leaderRate - otherRate) / otherRate) * 100).toFixed(1)}% better`;
      setByAttr(card, 'data-ab-field', 'result', resultText);

      let confidence = 50;
      if (data.aVisitors > 0 && data.bVisitors > 0) {
        const pooled = (data.aConversions + data.bConversions) / (data.aVisitors + data.bVisitors);
        const se = Math.sqrt(pooled * (1 - pooled) * (1 / data.aVisitors + 1 / data.bVisitors));
        if (se > 0) confidence = normalCDF(Math.abs(data.bRate - data.aRate) / se) * 100;
      }
      confidence = Math.min(99.9, Math.max(50, confidence));
      setByAttr(card, 'data-ab-field', 'confidence', `${confidence.toFixed(1)}%`);
      const confidenceBar = $('[data-ab-field="confidence-bar"]', card);
      if (confidenceBar) confidenceBar.style.width = `${confidence}%`;

      const status = data.totalVisitors < 100 ? 'Too Early' : confidence < 95 ? 'Inconclusive' : confidence < 98 ? 'Likely Winner' : 'Winner';
      setByAttr(card, 'data-ab-field', 'status', status);
      setByAttr(
        card,
        'data-ab-field',
        'confidence-description',
        leaderName
          ? `There is currently a ${confidence.toFixed(1)}% probability that ${leaderName} is outperforming the other variant.`
          : 'Neither variant is currently outperforming the other.'
      );
    } catch (error) {
      console.error('Experiment detail error:', experimentId, error);
    }
  }

  async function updateOverview(results) {
    const valid = results.filter(Boolean);
    const totalVisitors = valid.reduce((sum, item) => sum + item.data.totalVisitors, 0);
    const totalConversions = valid.reduce((sum, item) => sum + item.data.totalConversions, 0);
    const conversionRate = totalVisitors ? (totalConversions / totalVisitors) * 100 : 0;

    const setOverview = (key, value) => {
      const el = $(`[data-overview-field="${key}"]`);
      if (el) el.textContent = value;
    };

    setOverview('visitors', totalVisitors.toLocaleString());
    setOverview('conversions', totalConversions.toLocaleString());
    setOverview('conversion-rate', `${conversionRate.toFixed(2)}%`);

    try {
      const bounceSets = await Promise.all(valid.map((item) => getBounceData(item.siteId, item.experimentId)));
      let visitors = 0;
      let bounced = 0;
      bounceSets.forEach((rows) => {
        const b = summarizeBounce(rows);
        visitors += b.totalVisitors;
        bounced += b.totalBounced;
      });
      setOverview('bounce-rate', visitors ? `${((bounced / visitors) * 100).toFixed(2)}%` : '—');
    } catch (error) {
      console.error('Overview bounce rate error:', error);
      setOverview('bounce-rate', '—');
    }

    setOverview('active-tests', valid.length.toLocaleString());
    setOverview('completed-tests', '0');
    setOverview('total-tests', valid.length.toLocaleString());

    let top = null;
    valid.forEach((item) => {
      if (!top || item.data.overallRate > top.data.overallRate) top = item;
    });

    if (top) {
      const title = $('[data-list-field="title"]', top.card);
      setOverview('top-experiment-name', title && title.textContent.trim() ? title.textContent.trim() : top.experimentId);
      setOverview('top-experiment-rate', `${(top.data.overallRate * 100).toFixed(2)}% conversion rate`);
    } else {
      setOverview('top-experiment-name', '—');
      setOverview('top-experiment-rate', '—');
    }

    const siteTotals = {};
    valid.forEach((item) => {
      if (!siteTotals[item.siteId]) siteTotals[item.siteId] = { visitors: 0, conversions: 0 };
      siteTotals[item.siteId].visitors += item.data.totalVisitors;
      siteTotals[item.siteId].conversions += item.data.totalConversions;
    });

    $$('.overview-site-row[data-site-id]').forEach((row) => {
      const siteId = row.getAttribute('data-site-id');
      const totals = siteTotals[siteId] || { visitors: 0, conversions: 0 };
      const rate = totals.visitors ? (totals.conversions / totals.visitors) * 100 : 0;
      setByAttr(row, 'data-site-field', 'name', siteName(siteId));
      setByAttr(row, 'data-site-field', 'visitors', totals.visitors.toLocaleString());
      setByAttr(row, 'data-site-field', 'conversions', totals.conversions.toLocaleString());
      setByAttr(row, 'data-site-field', 'conversion-rate', `${rate.toFixed(2)}%`);
    });
  }

  function metricValue(row) {
    if (currentChartMetric === 'conversions') return Number(row.conversions || 0);
    if (currentChartMetric === 'conversion-rate') return Number(row.conversion_rate || 0);
    return Number(row.visitors || 0);
  }

  function metricLabel(value) {
    return currentChartMetric === 'conversion-rate'
      ? `${Number(value).toFixed(2)}%`
      : Number(value).toLocaleString();
  }

  function niceMax(value) {
    if (!Number.isFinite(value) || value <= 0) return 4;
    if (currentChartMetric === 'conversion-rate') {
      if (value <= 4) return 4;
      if (value <= 10) return 10;
      if (value <= 20) return 20;
      if (value <= 50) return 50;
      return Math.ceil(value / 25) * 25;
    }
    const step = value / 4;
    const magnitude = Math.pow(10, Math.floor(Math.log10(step)));
    const n = step / magnitude;
    const niceStep = (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * magnitude;
    return niceStep * 4;
  }

  function updateAxes(data) {
    const values = data.map(metricValue);
    const max = niceMax(values.length ? Math.max.apply(null, values) : 0);

    $$('[data-chart-y-label]').forEach((label) => {
      const pos = Number(label.getAttribute('data-chart-y-label'));
      const value = max * ((5 - pos) / 4);
      label.textContent = currentChartMetric === 'conversion-rate'
        ? `${value % 1 === 0 ? value.toFixed(0) : value.toFixed(1)}%`
        : Math.round(value).toLocaleString();
    });

    const xLabels = $$('[data-chart-x-label]');
    if (!data.length) {
      xLabels.forEach((label) => { label.textContent = '—'; });
      return max;
    }

    const last = data.length - 1;
    const indices = [0, Math.round(last / 3), Math.round((last * 2) / 3), last];
    xLabels.forEach((label, i) => {
      const row = data[indices[i]];
      label.textContent = row ? formatChartDate(row.day) : '—';
    });

    return max;
  }

  function tooltipEls() {
    return {
      tooltip: $('[data-chart-tooltip="true"]'),
      value: $('[data-chart-tooltip-value="true"]'),
      date: $('[data-chart-tooltip-date="true"]'),
      guide: $('[data-chart-hover-line="true"]'),
      plot: $('.overview-chart-plot')
    };
  }

  function hideTooltip() {
    const els = tooltipEls();
    if (els.tooltip) els.tooltip.style.display = 'none';
    if (els.guide) els.guide.style.display = 'none';
    $$('[data-chart-node]').forEach((node) => node.setAttribute('r', '4'));
  }

  function showTooltip(node, point) {
    const els = tooltipEls();
    if (!els.tooltip || !els.plot) return;

    if (els.value) els.value.textContent = metricLabel(point.value);
    if (els.date) els.date.textContent = formatChartDate(point.row.day);

    const nodeRect = node.getBoundingClientRect();
    const plotRect = els.plot.getBoundingClientRect();
    const x = nodeRect.left - plotRect.left + nodeRect.width / 2;
    const y = nodeRect.top - plotRect.top + nodeRect.height / 2;

    els.tooltip.style.display = 'block';
    els.tooltip.style.left = `${x}px`;
    els.tooltip.style.top = `${y}px`;
    els.tooltip.style.transform = 'translate(-50%, calc(-100% - 12px))';

    if (els.guide) {
      els.guide.style.display = 'block';
      els.guide.style.left = `${x}px`;
    }

    node.setAttribute('r', '6');
  }

  function drawChart(data) {
    const host = $('[data-chart-line="true"]');
    if (!host) return;

    hideTooltip();
    const max = updateAxes(data);
    if (!data.length) {
      host.innerHTML = '';
      return;
    }

    const width = 1000;
    const height = 240;
    const padX = 12;
    const padY = 12;
    const usableWidth = width - padX * 2;
    const usableHeight = height - padY * 2;

    const points = data.map((row, index) => {
      const value = metricValue(row);
      const x = data.length === 1 ? width / 2 : padX + (index / (data.length - 1)) * usableWidth;
      const ratio = Math.min(1, Math.max(0, value / (max || 1)));
      const y = padY + (1 - ratio) * usableHeight;
      return { row, value, x, y };
    });

    const path = points.map((p, i) => `${i ? 'L' : 'M'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ');
    const chartColor = '#6f4cff';
    const circles = points.map((p, i) =>
      `<circle data-chart-node="${i}" cx="${p.x.toFixed(2)}" cy="${p.y.toFixed(2)}" r="4" fill="#ffffff" stroke="${chartColor}" stroke-width="2" vector-effect="non-scaling-stroke" style="cursor:pointer;transition:r 120ms ease" />`
    ).join('');

    host.innerHTML = `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" width="100%" height="100%"><path d="${path}" fill="none" stroke="${chartColor}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" />${circles}</svg>`;

    $$('[data-chart-node]', host).forEach((node) => {
      const point = points[Number(node.getAttribute('data-chart-node'))];
      node.addEventListener('mouseenter', () => showTooltip(node, point));
      node.addEventListener('mouseleave', hideTooltip);
    });
  }

  function chartRange(results) {
    const end = new Date();
    let start = new Date(end);

    if (currentDateRange === 'all') {
      const starts = results
        .map((r) => r && r.data && r.data.startedAt ? new Date(r.data.startedAt) : null)
        .filter((d) => d && !Number.isNaN(d.getTime()));
      if (starts.length) start = new Date(Math.min.apply(null, starts.map((d) => d.getTime())));
      else start.setDate(end.getDate() - 29);
    } else {
      const days = Number(currentDateRange) || 30;
      start.setDate(end.getDate() - (days - 1));
    }

    return { start: formatSQLDate(start), end: formatSQLDate(end) };
  }

  async function refreshChart(results) {
    const valid = results.filter(Boolean);
    if (!valid.length) {
      currentChartData = [];
      drawChart(currentChartData);
      return;
    }

    const range = chartRange(valid);
    try {
      const sets = await Promise.all(valid.map((r) => getTimeseries(r.siteId, r.experimentId, range.start, range.end)));
      const combined = new Map();

      sets.forEach((rows) => {
        rows.forEach((row) => {
          if (!combined.has(row.day)) combined.set(row.day, { day: row.day, visitors: 0, conversions: 0, conversion_rate: 0 });
          const day = combined.get(row.day);
          day.visitors += Number(row.visitors || 0);
          day.conversions += Number(row.conversions || 0);
        });
      });

      currentChartData = Array.from(combined.values())
        .sort((a, b) => a.day.localeCompare(b.day))
        .map((row) => {
          row.conversion_rate = row.visitors ? (row.conversions / row.visitors) * 100 : 0;
          return row;
        });

      drawChart(currentChartData);
    } catch (error) {
      console.error('Chart data error:', error);
    }
  }

  function setupChartTabs() {
    $$('[data-chart-metric]').forEach((tab) => {
      tab.addEventListener('click', (e) => {
        e.preventDefault();
        const metric = tab.getAttribute('data-chart-metric');
        if (!metric) return;
        currentChartMetric = metric;
        $$('[data-chart-metric]').forEach((item) => item.classList.remove('is-active'));
        tab.classList.add('is-active');
        drawChart(currentChartData);
      });
    });
  }

  function setupDateFilter() {
    const filter = $('[data-overview-date-filter="true"]');
    if (!filter) return;

    $$('[data-date-range]', filter).forEach((option) => {
      option.addEventListener('click', (e) => {
        e.preventDefault();
        const raw = option.getAttribute('data-date-range');
        currentDateRange = raw === 'all' ? 'all' : Number(raw);

        const explicit = $('[data-date-filter-label]', filter);
        if (explicit) explicit.textContent = option.textContent.trim();

        refreshChart(latestExperimentResults);
      });
    });
  }

  async function loadDashboard() {
    const listCards = $$('.experiment-list-card[data-site-id][data-experiment-id]');
    const results = await Promise.all(listCards.map(loadListCard));
    latestExperimentResults = results;

    await Promise.all([
      updateOverview(results),
      refreshChart(results)
    ]);

    const detailCards = $$('[data-ab-detail-card="true"]');
    await Promise.all(detailCards.map(loadDetailCard));
  }

  setupSidebar();
  setupViews();
  setupVariantEditing();
  setupChartTabs();
  setupDateFilter();
  loadDashboard();
  setInterval(loadDashboard, REFRESH_INTERVAL);
});
