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
  let experimentRegistry = [];
  let selectedDetailExperiment = null;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  function setByAttr(root, attr, key, value) {
    const el = root.querySelector(`[${attr}="${key}"]`);
    if (el) el.textContent = value;
  }

  function siteName(siteId) {
    return ({
      flytwerx: "FlytWERX",
      bidwerx: "BidWERX",
      "vista-techwerx": "Vista TechWERX"
    })[siteId] || siteId;
  }

  function testTypeName(value) {
    return ({
      ab: "A/B Test",
      multivariate: "Multivariate Test",
      "url-split": "URL Split Test"
    })[value] || value || "—";
  }

  function conversionTypeName(value) {
    return ({
      "button-click": "Button Click",
      "scroll-depth": "Scroll Depth",
      "page-view": "Page View",
      "time-on-page": "Time on Page"
    })[value] || value || "—";
  }

  function titleCaseStatus(value) {
    if (!value) return "Draft";
    return value.charAt(0).toUpperCase() + value.slice(1);
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

  function experimentDateLabel(experiment) {
    if (experiment.status === "draft") {
      return `Created ${formatStartedDate(experiment.created_at)}`;
    }
    const date = experiment.started_at || experiment.created_at;
    return `Started ${formatStartedDate(date)}`;
  }

  function experimentDurationLabel(experiment) {
    if (experiment.status === "draft") return "Not Started";
    if (experiment.status === "paused") return "Paused";
    if (experiment.status === "completed") return "Completed";
    if (experiment.status === "archived") return "Archived";
    return runningDuration(experiment.started_at || experiment.created_at);
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
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`${name} failed (${response.status}): ${text}`);
    }
    return await response.json();
  }

  async function getExperimentRegistry() {
    const fields = [
      "id",
      "site_id",
      "experiment_id",
      "experiment_name",
      "description",
      "test_type",
      "goal_name",
      "goal_event",
      "conversion_type",
      "variant_a_name",
      "variant_b_name",
      "traffic_a",
      "traffic_b",
      "status",
      "created_at",
      "started_at",
      "completed_at"
    ].join(",");

    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/ab_experiments?select=${encodeURIComponent(fields)}&order=created_at.desc`,
      {
        headers: { apikey: SUPABASE_KEY },
        cache: "no-store"
      }
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`ab_experiments request failed (${response.status}): ${text}`);
    }

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

  function summarizeExperiment(rows, experiment) {
    const out = {
      aVisitors: 0,
      bVisitors: 0,
      aConversions: 0,
      bConversions: 0,
      aName: experiment?.variant_a_name || "Variant A",
      bName: experiment?.variant_b_name || "Variant B",
      startedAt: experiment?.started_at || null
    };

    rows.forEach((row) => {
      if (!out.startedAt && row.started_at) out.startedAt = row.started_at;
      if (row.variant === "A") {
        out.aVisitors = Number(row.visitors || 0);
        out.aConversions = Number(row.conversions || 0);
        if (row.variant_name) out.aName = row.variant_name;
      }
      if (row.variant === "B") {
        out.bVisitors = Number(row.visitors || 0);
        out.bConversions = Number(row.conversions || 0);
        if (row.variant_name) out.bName = row.variant_name;
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

    document.addEventListener('click', async (event) => {
      const trigger = event.target.closest('[data-dashboard-open]');
      if (!trigger) return;
      const view = trigger.getAttribute('data-dashboard-open');
      if (!view) return;
      event.preventDefault();

      if (view === 'experiment-detail') {
        const experimentId = trigger.getAttribute('data-experiment-target');
        const siteId = trigger.getAttribute('data-site-id');
        const experiment = experimentRegistry.find((item) =>
          item.experiment_id === experimentId && (!siteId || item.site_id === siteId)
        );

        if (experiment) {
          selectedDetailExperiment = experiment;
          activate('experiment-detail');
          await loadSelectedDetail();
          window.scrollTo({ top: 0, behavior: 'smooth' });
          return;
        }
      }

      activate(view);
      window.scrollTo({ top: 0, behavior: 'smooth' });
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
    try {
      expanded = localStorage.getItem(SIDEBAR_STATE_KEY) === 'expanded';
    } catch (_) {}

    function apply() {
      const width = expanded ? SIDEBAR_EXPANDED_WIDTH : SIDEBAR_COLLAPSED_WIDTH;
      sidebar.style.width = width;
      sidebar.style.minWidth = width;
      labels.forEach((el) => { el.style.display = expanded ? 'block' : 'none'; });
      if (toggleLabel) toggleLabel.style.display = expanded ? 'block' : 'none';
      links.forEach((el) => {
        el.style.justifyContent = expanded ? 'flex-start' : 'center';
        el.style.gap = expanded ? '10px' : '0px';
      });
      toggle.style.justifyContent = expanded ? 'flex-start' : 'center';
      if (toggleIcon) toggleIcon.style.transform = expanded ? 'rotate(0deg)' : 'rotate(180deg)';
      toggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    }

    toggle.addEventListener('click', (event) => {
      event.preventDefault();
      expanded = !expanded;
      apply();
      try {
        localStorage.setItem(SIDEBAR_STATE_KEY, expanded ? 'expanded' : 'collapsed');
      } catch (_) {}
    });

    apply();
  }

  function setStatusBadge(card, status) {
    const statusText = $('[data-list-field="status"]', card);
    const badge = $('[data-status-badge="true"]', card) || (statusText ? statusText.closest('.status-badge') : $('.status-badge', card));
    const normalized = ['draft', 'active', 'paused', 'completed', 'archived'].includes(status)
      ? status
      : 'draft';

    if (statusText) statusText.textContent = titleCaseStatus(normalized);
    if (!badge) return;

    ['is-draft', 'is-active', 'is-paused', 'is-completed', 'is-archived'].forEach((className) => {
      badge.classList.remove(className);
    });
    badge.classList.add(`is-${normalized}`);
  }

  function buildExperimentCards(experiments) {
    const list = $('[data-experiment-list="true"]');
    const template = $('[data-experiment-template="true"]');
    if (!list || !template) {
      console.error('Dynamic experiment list is missing its list wrapper or template card.');
      return [];
    }

    $$('.experiment-list-card[data-generated-experiment="true"]', list).forEach((card) => card.remove());
    template.style.display = 'none';

    const cards = [];

    experiments.forEach((experiment) => {
      const card = template.cloneNode(true);
      card.removeAttribute('data-experiment-template');
      card.setAttribute('data-generated-experiment', 'true');
      card.setAttribute('data-site-id', experiment.site_id);
      card.setAttribute('data-experiment-id', experiment.experiment_id);
      card.setAttribute('data-goal-name', experiment.goal_name || 'Not Set');
      card.style.display = '';

      setByAttr(card, 'data-list-field', 'title', experiment.experiment_name || experiment.experiment_id);
      setByAttr(card, 'data-list-field', 'site-name', siteName(experiment.site_id));
      setByAttr(card, 'data-list-field', 'test-type', testTypeName(experiment.test_type));
      setByAttr(card, 'data-list-field', 'started-date', experimentDateLabel(experiment));
      setByAttr(card, 'data-list-field', 'duration', experimentDurationLabel(experiment));
      setByAttr(card, 'data-list-field', 'goal', `Goal: ${experiment.goal_name || 'Not Set'}`);
      setByAttr(card, 'data-list-field', 'visitors', '0');
      setByAttr(card, 'data-list-field', 'conversions', '0');
      setByAttr(card, 'data-list-field', 'leading', '—');
      setStatusBadge(card, experiment.status || 'draft');

      const action = $('[data-dashboard-open="experiment-detail"]', card);
      if (action) {
        action.setAttribute('data-experiment-target', experiment.experiment_id);
        action.setAttribute('data-site-id', experiment.site_id);
      }

      list.appendChild(card);
      cards.push(card);
    });

    return cards;
  }

  async function loadListCard(card, experiment) {
    const siteId = experiment.site_id;
    const experimentId = experiment.experiment_id;

    try {
      const rows = await getExperimentData(siteId, experimentId);
      const data = summarizeExperiment(rows, experiment);

      setByAttr(card, 'data-list-field', 'visitors', data.totalVisitors.toLocaleString());
      setByAttr(card, 'data-list-field', 'conversions', data.totalConversions.toLocaleString());
      setByAttr(
        card,
        'data-list-field',
        'leading',
        data.leader === 'A' ? data.aName : data.leader === 'B' ? data.bName : '—'
      );

      return {
        card,
        siteId,
        experimentId,
        goalName: experiment.goal_name || 'Not Set',
        experiment,
        data
      };
    } catch (error) {
      console.error('Experiment list error:', experimentId, error);
      const data = summarizeExperiment([], experiment);
      return {
        card,
        siteId,
        experimentId,
        goalName: experiment.goal_name || 'Not Set',
        experiment,
        data
      };
    }
  }

  function setupVariantEditing() {
    document.addEventListener('click', (event) => {
      const button = event.target.closest('[data-ab-action="edit-variant-name"]');
      if (!button) return;

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
        if (e.key === 'Enter') {
          e.preventDefault();
          finish(true);
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          finish(false);
        }
      });
      input.addEventListener('blur', () => finish(true));
      input.focus();
      input.select();
    });
  }

  function normalCDF(x) {
    const t = 1 / (1 + 0.2316419 * Math.abs(x));
    const d = 0.3989423 * Math.exp((-x * x) / 2);
    let p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
    if (x > 0) p = 1 - p;
    return p;
  }

  function setDetailStatusBadge(card, status) {
    const normalized = ['draft', 'active', 'paused', 'completed', 'archived'].includes(status)
      ? status
      : 'draft';

    const badge = $('[data-detail-status-badge="true"]', card);
    const text = $('[data-detail-field="status"]', card);

    if (text) text.textContent = titleCaseStatus(normalized);
    if (!badge) return;

    ['is-draft', 'is-active', 'is-paused', 'is-completed', 'is-archived'].forEach((className) => {
      badge.classList.remove(className);
    });
    badge.classList.add(`is-${normalized}`);
  }

  function populateDetailConfiguration(card, experiment) {
    setByAttr(card, 'data-detail-field', 'experiment-name', experiment.experiment_name || experiment.experiment_id);
    setByAttr(card, 'data-detail-field', 'site-name', siteName(experiment.site_id));
    setByAttr(card, 'data-detail-field', 'test-type', testTypeName(experiment.test_type));
    setByAttr(card, 'data-detail-field', 'conversion-type', conversionTypeName(experiment.conversion_type));
    setByAttr(card, 'data-detail-field', 'goal-name', `Goal: ${experiment.goal_name || 'Not Set'}`);

    const startedLabel = experiment.status === 'draft'
      ? 'Not Started'
      : `Started ${formatStartedDate(experiment.started_at || experiment.created_at)}`;
    setByAttr(card, 'data-detail-field', 'started-date', startedLabel);
    setByAttr(card, 'data-detail-field', 'duration', experimentDurationLabel(experiment));
    setDetailStatusBadge(card, experiment.status || 'draft');

    card.setAttribute('data-site-id', experiment.site_id);
    card.setAttribute('data-experiment-id', experiment.experiment_id);
    card.setAttribute('data-goal-name', experiment.goal_name || 'Not Set');
  }

  async function loadDetailCard(card, experiment) {
    if (!card || !experiment) return;

    const siteId = experiment.site_id;
    const experimentId = experiment.experiment_id;
    populateDetailConfiguration(card, experiment);

    try {
      const [summaryRows, bounceRows] = await Promise.all([
        getExperimentData(siteId, experimentId),
        getBounceData(siteId, experimentId)
      ]);

      const data = summarizeExperiment(summaryRows, experiment);
      const bounce = summarizeBounce(bounceRows);

      const aName = $('[data-ab-variant-name="A"]', card);
      const bName = $('[data-ab-variant-name="B"]', card);
      if (aName && aName.dataset.editing !== 'true') aName.textContent = experiment.variant_a_name || data.aName;
      if (bName && bName.dataset.editing !== 'true') bName.textContent = experiment.variant_b_name || data.bName;

      setByAttr(card, 'data-ab-field', 'a-visitors', data.aVisitors.toLocaleString());
      setByAttr(card, 'data-ab-field', 'a-conversions', data.aConversions.toLocaleString());
      setByAttr(card, 'data-ab-field', 'a-rate', `${(data.aRate * 100).toFixed(2)}%`);
      setByAttr(card, 'data-ab-field', 'a-bounce-rate', bounce.A.visitors ? `${bounce.A.rate.toFixed(2)}%` : '—');
      setByAttr(card, 'data-ab-field', 'b-visitors', data.bVisitors.toLocaleString());
      setByAttr(card, 'data-ab-field', 'b-conversions', data.bConversions.toLocaleString());
      setByAttr(card, 'data-ab-field', 'b-rate', `${(data.bRate * 100).toFixed(2)}%`);
      setByAttr(card, 'data-ab-field', 'b-bounce-rate', bounce.B.visitors ? `${bounce.B.rate.toFixed(2)}%` : '—');

      const aTraffic = data.totalVisitors
        ? (data.aVisitors / data.totalVisitors) * 100
        : Number(experiment.traffic_a ?? 50);

      const bTraffic = data.totalVisitors
        ? (data.bVisitors / data.totalVisitors) * 100
        : Number(experiment.traffic_b ?? (100 - aTraffic));

      setByAttr(card, 'data-ab-field', 'traffic-a', `A ${aTraffic.toFixed(1)}%`);
      setByAttr(card, 'data-ab-field', 'traffic-b', `B ${bTraffic.toFixed(1)}%`);
      const aBar = $('[data-ab-field="traffic-a-bar"]', card);
      const bBar = $('[data-ab-field="traffic-b-bar"]', card);
      if (aBar) aBar.style.width = `${aTraffic}%`;
      if (bBar) bBar.style.width = `${bTraffic}%`;

      if (experiment.status === 'draft' || data.totalVisitors === 0) {
        setByAttr(card, 'data-ab-field', 'result', experiment.status === 'draft' ? 'Test has not started' : 'No results yet');
        setByAttr(card, 'data-ab-field', 'confidence', '—');
        setByAttr(card, 'data-ab-field', 'status', experiment.status === 'draft' ? 'Draft' : 'Too Early');
        setByAttr(
          card,
          'data-ab-field',
          'confidence-description',
          experiment.status === 'draft'
            ? 'Launch this test to begin collecting performance data.'
            : 'More visitor and conversion data is needed before a result can be calculated.'
        );
        const confidenceBar = $('[data-ab-field="confidence-bar"]', card);
        if (confidenceBar) confidenceBar.style.width = '0%';
        return;
      }

      let leaderName = null;
      let leaderRate = 0;
      let otherRate = 0;
      if (data.leader === 'A') {
        leaderName = experiment.variant_a_name || data.aName;
        leaderRate = data.aRate;
        otherRate = data.bRate;
      }
      if (data.leader === 'B') {
        leaderName = experiment.variant_b_name || data.bName;
        leaderRate = data.bRate;
        otherRate = data.aRate;
      }

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

      const resultStatus = data.totalVisitors < 100
        ? 'Too Early'
        : confidence < 95
          ? 'Inconclusive'
          : confidence < 98
            ? 'Likely Winner'
            : 'Winner';
      setByAttr(card, 'data-ab-field', 'status', resultStatus);
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

  async function loadSelectedDetail() {
    const card = $('[data-ab-detail-card="true"]');
    if (!card || !selectedDetailExperiment) return;
    await loadDetailCard(card, selectedDetailExperiment);
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

    const activeTests = experimentRegistry.filter((item) => item.status === 'active').length;
    const completedTests = experimentRegistry.filter((item) => item.status === 'completed').length;
    setOverview('active-tests', activeTests.toLocaleString());
    setOverview('completed-tests', completedTests.toLocaleString());
    setOverview('total-tests', experimentRegistry.length.toLocaleString());

    const measurable = valid.filter((item) => item.data.totalVisitors > 0);
    let top = null;
    measurable.forEach((item) => {
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
    xLabels.forEach((label, index) => {
      const row = data[indices[index]];
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

    const path = points.map((point, index) => `${index ? 'L' : 'M'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' ');
    const chartColor = '#6f4cff';
    const circles = points.map((point, index) =>
      `<circle data-chart-node="${index}" cx="${point.x.toFixed(2)}" cy="${point.y.toFixed(2)}" r="4" fill="#ffffff" stroke="${chartColor}" stroke-width="2" vector-effect="non-scaling-stroke" style="cursor:pointer;transition:r 120ms ease" />`
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
        .map((result) => result && result.data && result.data.startedAt ? new Date(result.data.startedAt) : null)
        .filter((date) => date && !Number.isNaN(date.getTime()));
      if (starts.length) start = new Date(Math.min.apply(null, starts.map((date) => date.getTime())));
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
      const sets = await Promise.all(valid.map((result) =>
        getTimeseries(result.siteId, result.experimentId, range.start, range.end)
      ));
      const combined = new Map();

      sets.forEach((rows) => {
        rows.forEach((row) => {
          if (!combined.has(row.day)) {
            combined.set(row.day, { day: row.day, visitors: 0, conversions: 0, conversion_rate: 0 });
          }
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
      tab.addEventListener('click', (event) => {
        event.preventDefault();
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
      option.addEventListener('click', (event) => {
        event.preventDefault();
        const raw = option.getAttribute('data-date-range');
        currentDateRange = raw === 'all' ? 'all' : Number(raw);
        const explicit = $('[data-date-filter-label]', filter);
        if (explicit) explicit.textContent = option.textContent.trim();
        refreshChart(latestExperimentResults);
      });
    });
  }

  async function loadDashboard() {
    try {
      experimentRegistry = await getExperimentRegistry();
      const cards = buildExperimentCards(experimentRegistry);
      const results = await Promise.all(
        experimentRegistry.map((experiment, index) => loadListCard(cards[index], experiment))
      );

      latestExperimentResults = results;

      await Promise.all([
        updateOverview(results),
        refreshChart(results)
      ]);

      if (selectedDetailExperiment) {
        const refreshed = experimentRegistry.find((item) =>
          item.site_id === selectedDetailExperiment.site_id &&
          item.experiment_id === selectedDetailExperiment.experiment_id
        );
        if (refreshed) selectedDetailExperiment = refreshed;
        await loadSelectedDetail();
      }
    } catch (error) {
      console.error('Dashboard load error:', error);
    }
  }

  window.ABDashboardReload = loadDashboard;
  window.ABDashboardOpenExperiment = async function (siteId, experimentId) {
    const experiment = experimentRegistry.find((item) =>
      item.site_id === siteId && item.experiment_id === experimentId
    );
    if (!experiment) return false;
    selectedDetailExperiment = experiment;
    if (typeof window.ABDashboardShowView === 'function') {
      window.ABDashboardShowView('experiment-detail');
    }
    await loadSelectedDetail();
    return true;
  };

  setupSidebar();
  setupViews();
  setupVariantEditing();
  setupChartTabs();
  setupDateFilter();
  loadDashboard();
  setInterval(loadDashboard, REFRESH_INTERVAL);
});
