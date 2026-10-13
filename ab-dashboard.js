document.addEventListener("DOMContentLoaded", function () {

  // =====================================================
  // SUPABASE
  // =====================================================

  const SUPABASE_URL =
    "https://zxyplulobmwosnrkrokm.supabase.co";

  const SUPABASE_KEY =
    "sb_publishable_xSorPWS-XlGHAT7qx2KR5A_cytmsihD";


  // =====================================================
  // DASHBOARD SETTINGS
  // =====================================================

  const REFRESH_INTERVAL = 15000;
  const MAX_VARIANT_NAME_LENGTH = 40;


  // =====================================================
  // SIDEBAR SETTINGS
  // =====================================================

  const SIDEBAR_STATE_KEY =
    "ab_dashboard_sidebar_state";

  const SIDEBAR_COLLAPSED_WIDTH =
    "76px";

  const SIDEBAR_EXPANDED_WIDTH =
    "220px";


  // =====================================================
  // CHART STATE
  // =====================================================

  let currentChartMetric =
    "visitors";

  let currentDateRange =
    30;

  let currentChartData =
    [];

  let latestExperimentResults =
    [];


  // =====================================================
  // GENERAL HELPERS
  // =====================================================

  function getField(card, field) {
    return card.querySelector(
      '[data-ab-field="' + field + '"]'
    );
  }


  function setText(card, field, value) {
    const element = getField(card, field);

    if (element) {
      element.textContent = value;
    }
  }


  function getListField(card, field) {
    return card.querySelector(
      '[data-list-field="' + field + '"]'
    );
  }


  function setListText(card, field, value) {
    const element = getListField(card, field);

    if (element) {
      element.textContent = value;
    }
  }


  function getOverviewField(field) {
    return document.querySelector(
      '[data-overview-field="' + field + '"]'
    );
  }


  function setOverviewText(field, value) {
    const element = getOverviewField(field);

    if (element) {
      element.textContent = value;
    }
  }


  function getSiteField(row, field) {
    return row.querySelector(
      '[data-site-field="' + field + '"]'
    );
  }


  function setSiteText(row, field, value) {
    const element = getSiteField(row, field);

    if (element) {
      element.textContent = value;
    }
  }


  function getSiteDisplayName(siteId) {
    const names = {
      flytwerx: "FlytWERX",
      bidwerx: "BidWERX",
      "vista-techwerx": "Vista TechWERX"
    };

    return names[siteId] || siteId;
  }


  function formatDateForSQL(date) {
    const year = date.getFullYear();

    const month = String(
      date.getMonth() + 1
    ).padStart(2, "0");

    const day = String(
      date.getDate()
    ).padStart(2, "0");

    return year + "-" + month + "-" + day;
  }


  function formatChartDate(dateString) {
    const parts = dateString.split("-");

    if (parts.length !== 3) {
      return dateString;
    }

    const date = new Date(
      Number(parts[0]),
      Number(parts[1]) - 1,
      Number(parts[2])
    );

    return date.toLocaleDateString(
      "en-US",
      {
        month: "short",
        day: "numeric"
      }
    );
  }


  // =====================================================
  // DASHBOARD VIEW SWITCHING
  // =====================================================

  function setupDashboardViews() {
    const views =
      document.querySelectorAll(
        "[data-dashboard-view]"
      );

    const openButtons =
      document.querySelectorAll(
        "[data-dashboard-open]"
      );


    function updateNavActiveState(viewName) {
      let activeSection = viewName;

      // Experiment detail belongs to Experiments.
      if (viewName === "experiment-detail") {
        activeSection = "experiments";
      }


      document
        .querySelectorAll(
          ".sidebar-link[data-dashboard-open]"
        )
        .forEach(function (link) {

          const target =
            link.getAttribute(
              "data-dashboard-open"
            );

          if (target === activeSection) {
            link.classList.add(
              "is-active"
            );

            link.setAttribute(
              "aria-current",
              "page"
            );
          } else {
            link.classList.remove(
              "is-active"
            );

            link.removeAttribute(
              "aria-current"
            );
          }

        });
    }


    function showView(viewName) {
      views.forEach(function (view) {

        const currentName =
          view.getAttribute(
            "data-dashboard-view"
          );

        view.style.display =
          currentName === viewName
            ? "block"
            : "none";

      });


      updateNavActiveState(
        viewName
      );


      window.scrollTo({
        top: 0,
        behavior: "smooth"
      });
    }


    openButtons.forEach(function (button) {

      button.addEventListener(
        "click",
        function (event) {

          event.preventDefault();

          const destination =
            button.getAttribute(
              "data-dashboard-open"
            );

          if (!destination) {
            return;
          }

          showView(destination);

        }
      );

    });


    // Default dashboard view
    showView("overview");


    window.ABDashboardShowView =
      showView;
  }


  // =====================================================
  // SIDEBAR
  // =====================================================

  function setupSidebar() {
    const sidebar =
      document.querySelector(
        '[data-sidebar="true"]'
      );

    const toggle =
      document.querySelector(
        '[data-sidebar-toggle="true"]'
      );

    if (!sidebar || !toggle) {
      return;
    }


    const labels =
      sidebar.querySelectorAll(
        '[data-sidebar-label="true"]'
      );

    const toggleLabel =
      sidebar.querySelector(
        '[data-sidebar-toggle-label="true"]'
      );

    const toggleIcon =
      sidebar.querySelector(
        '[data-sidebar-toggle-icon="true"]'
      );

    const links =
      sidebar.querySelectorAll(
        ".sidebar-link"
      );


    let savedState = null;

    try {
      savedState =
        localStorage.getItem(
          SIDEBAR_STATE_KEY
        );
    } catch (error) {}


    // Collapsed by default.
    let isExpanded =
      savedState === "expanded";


    sidebar.style.overflow =
      "hidden";

    sidebar.style.transition =
      "width 300ms ease-in-out, min-width 300ms ease-in-out";


    if (toggleIcon) {
      toggleIcon.style.transition =
        "transform 300ms ease-in-out";
    }


    labels.forEach(function (label) {
      label.style.transition =
        "opacity 200ms ease, transform 200ms ease";
    });


    if (toggleLabel) {
      toggleLabel.style.transition =
        "opacity 200ms ease, transform 200ms ease";
    }


    function showLabels() {
      labels.forEach(function (label) {
        label.style.display = "block";
        label.style.opacity = "0";
        label.style.transform =
          "translateX(-6px)";

        requestAnimationFrame(function () {
          requestAnimationFrame(function () {
            label.style.opacity = "1";
            label.style.transform =
              "translateX(0)";
          });
        });
      });


      if (toggleLabel) {
        toggleLabel.style.display =
          "block";

        toggleLabel.style.opacity =
          "0";

        toggleLabel.style.transform =
          "translateX(-6px)";

        requestAnimationFrame(function () {
          requestAnimationFrame(function () {
            toggleLabel.style.opacity =
              "1";

            toggleLabel.style.transform =
              "translateX(0)";
          });
        });
      }
    }


    function hideLabels(immediate) {
      labels.forEach(function (label) {

        if (immediate) {
          label.style.display =
            "none";

          label.style.opacity =
            "0";

          return;
        }

        label.style.opacity =
          "0";

        label.style.transform =
          "translateX(-6px)";

        setTimeout(function () {
          if (!isExpanded) {
            label.style.display =
              "none";
          }
        }, 200);

      });


      if (toggleLabel) {
        if (immediate) {
          toggleLabel.style.display =
            "none";

          toggleLabel.style.opacity =
            "0";
        } else {
          toggleLabel.style.opacity =
            "0";

          toggleLabel.style.transform =
            "translateX(-6px)";

          setTimeout(function () {
            if (!isExpanded) {
              toggleLabel.style.display =
                "none";
            }
          }, 200);
        }
      }
    }


    function applySidebarState(initialLoad) {
      if (isExpanded) {
        sidebar.style.width =
          SIDEBAR_EXPANDED_WIDTH;

        sidebar.style.minWidth =
          SIDEBAR_EXPANDED_WIDTH;


        links.forEach(function (link) {
          link.style.justifyContent =
            "flex-start";

          link.style.gap =
            "10px";
        });


        toggle.style.justifyContent =
          "flex-start";

        toggle.style.gap =
          "10px";


        if (toggleIcon) {
          toggleIcon.style.transform =
            "rotate(0deg)";
        }


        showLabels();
      } else {
        hideLabels(initialLoad);

        sidebar.style.width =
          SIDEBAR_COLLAPSED_WIDTH;

        sidebar.style.minWidth =
          SIDEBAR_COLLAPSED_WIDTH;


        links.forEach(function (link) {
          link.style.justifyContent =
            "center";

          link.style.gap =
            "0px";
        });


        toggle.style.justifyContent =
          "center";

        toggle.style.gap =
          "0px";


        if (toggleIcon) {
          toggleIcon.style.transform =
            "rotate(180deg)";
        }
      }


      toggle.setAttribute(
        "aria-expanded",
        isExpanded
          ? "true"
          : "false"
      );
    }


    toggle.addEventListener(
      "click",
      function (event) {

        event.preventDefault();

        isExpanded =
          !isExpanded;

        applySidebarState(false);

        try {
          localStorage.setItem(
            SIDEBAR_STATE_KEY,
            isExpanded
              ? "expanded"
              : "collapsed"
          );
        } catch (error) {}

      }
    );


    applySidebarState(true);
  }


  // =====================================================
  // STATISTICS HELPERS
  // =====================================================

  function normalCDF(x) {
    const t =
      1 /
      (
        1 +
        0.2316419 *
        Math.abs(x)
      );

    const d =
      0.3989423 *
      Math.exp(
        (-x * x) / 2
      );

    let probability =
      d *
      t *
      (
        0.3193815 +
        t *
        (
          -0.3565638 +
          t *
          (
            1.781478 +
            t *
            (
              -1.821256 +
              t *
              1.330274
            )
          )
        )
      );

    if (x > 0) {
      probability =
        1 - probability;
    }

    return probability;
  }


  function formatStartedDate(dateString) {
    if (!dateString) {
      return "Not Started";
    }

    const date =
      new Date(dateString);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return "Not Started";
    }

    return date.toLocaleDateString(
      "en-US",
      {
        month: "short",
        day: "numeric",
        year: "numeric"
      }
    );
  }


  function getRunningDuration(dateString) {
    if (!dateString) {
      return "Not Running";
    }

    const startDate =
      new Date(dateString);

    if (
      Number.isNaN(
        startDate.getTime()
      )
    ) {
      return "Not Running";
    }

    const millisecondsPerDay =
      1000 *
      60 *
      60 *
      24;

    let days =
      Math.floor(
        (
          Date.now() -
          startDate.getTime()
        ) /
        millisecondsPerDay
      ) +
      1;

    if (days < 1) {
      days = 1;
    }

    return days === 1
      ? "1 Day Running"
      : days + " Days Running";
  }


  function getStatus(
    confidence,
    totalVisitors
  ) {
    if (totalVisitors < 100) {
      return "Too Early";
    }

    if (confidence < 95) {
      return "Inconclusive";
    }

    if (confidence < 98) {
      return "Likely Winner";
    }

    return "Winner";
  }


  // =====================================================
  // SUPABASE REQUESTS
  // =====================================================

  async function getExperimentData(
    siteId,
    experimentId
  ) {
    const response =
      await fetch(
        SUPABASE_URL +
        "/rest/v1/rpc/get_ab_experiment_summary",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            "apikey":
              SUPABASE_KEY
          },

          body:
            JSON.stringify({
              p_site_id:
                siteId,

              p_experiment_id:
                experimentId
            }),

          cache:
            "no-store"
        }
      );

    if (!response.ok) {
      throw new Error(
        "Supabase experiment summary request failed."
      );
    }

    return await response.json();
  }


  async function getExperimentTimeseries(
    siteId,
    experimentId,
    startDate,
    endDate
  ) {
    const response =
      await fetch(
        SUPABASE_URL +
        "/rest/v1/rpc/get_ab_experiment_timeseries",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            "apikey":
              SUPABASE_KEY
          },

          body:
            JSON.stringify({
              p_site_id:
                siteId,

              p_experiment_id:
                experimentId,

              p_start_date:
                startDate,

              p_end_date:
                endDate
            }),

          cache:
            "no-store"
        }
      );

    if (!response.ok) {
      throw new Error(
        "Supabase time-series request failed."
      );
    }

    return await response.json();
  }


  async function saveVariantName(
    siteId,
    experimentId,
    variant,
    variantName
  ) {
    const response =
      await fetch(
        SUPABASE_URL +
        "/rest/v1/rpc/set_ab_variant_name",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            "apikey":
              SUPABASE_KEY
          },

          body:
            JSON.stringify({
              p_site_id:
                siteId,

              p_experiment_id:
                experimentId,

              p_variant:
                variant,

              p_variant_name:
                variantName
            })
        }
      );

    if (!response.ok) {
      throw new Error(
        "Variant name save failed."
      );
    }
  }


  // =====================================================
  // NORMALIZE EXPERIMENT DATA
  // =====================================================

  function summarizeExperiment(rows) {
    let aVisitors = 0;
    let bVisitors = 0;

    let aConversions = 0;
    let bConversions = 0;

    let aName = "Variant A";
    let bName = "Variant B";

    let startedAt = null;


    rows.forEach(function (row) {

      if (
        !startedAt &&
        row.started_at
      ) {
        startedAt =
          row.started_at;
      }


      if (row.variant === "A") {
        aVisitors =
          Number(
            row.visitors || 0
          );

        aConversions =
          Number(
            row.conversions || 0
          );

        aName =
          row.variant_name ||
          "Variant A";
      }


      if (row.variant === "B") {
        bVisitors =
          Number(
            row.visitors || 0
          );

        bConversions =
          Number(
            row.conversions || 0
          );

        bName =
          row.variant_name ||
          "Variant B";
      }

    });


    const totalVisitors =
      aVisitors +
      bVisitors;

    const totalConversions =
      aConversions +
      bConversions;

    const aRate =
      aVisitors > 0
        ? aConversions /
          aVisitors
        : 0;

    const bRate =
      bVisitors > 0
        ? bConversions /
          bVisitors
        : 0;

    const overallRate =
      totalVisitors > 0
        ? totalConversions /
          totalVisitors
        : 0;

    let leader = null;

    if (aRate > bRate) {
      leader = "A";
    } else if (bRate > aRate) {
      leader = "B";
    }


    return {
      aVisitors,
      bVisitors,

      aConversions,
      bConversions,

      totalVisitors,
      totalConversions,

      aRate,
      bRate,

      overallRate,

      leader,

      aName,
      bName,

      startedAt
    };
  }


  // =====================================================
  // EXPERIMENT LIST CARDS
  // =====================================================

  async function loadExperimentListCard(card) {
    const siteId =
      card.getAttribute(
        "data-site-id"
      );

    const experimentId =
      card.getAttribute(
        "data-experiment-id"
      );

    const goalName =
      card.getAttribute(
        "data-goal-name"
      ) ||
      "Not Set";


    if (
      !siteId ||
      !experimentId
    ) {
      return null;
    }


    try {
      const rows =
        await getExperimentData(
          siteId,
          experimentId
        );

      const data =
        summarizeExperiment(
          rows
        );


      setListText(
        card,
        "site-name",
        getSiteDisplayName(
          siteId
        )
      );


      setListText(
        card,
        "started-date",
        "Started " +
        formatStartedDate(
          data.startedAt
        )
      );


      setListText(
        card,
        "duration",
        getRunningDuration(
          data.startedAt
        )
      );


      setListText(
        card,
        "goal",
        "Goal: " +
        goalName
      );


      setListText(
        card,
        "visitors",
        data.totalVisitors
          .toLocaleString()
      );


      setListText(
        card,
        "conversions",
        data.totalConversions
          .toLocaleString()
      );


      let leadingText = "—";

      if (data.leader === "A") {
        leadingText =
          data.aName;
      }

      if (data.leader === "B") {
        leadingText =
          data.bName;
      }


      setListText(
        card,
        "leading",
        leadingText
      );


      return {
        card,
        siteId,
        experimentId,
        goalName,
        data
      };

    } catch (error) {

      console.error(
        "Experiment list error:",
        experimentId,
        error
      );

      return null;
    }
  }


  // =====================================================
  // VARIANT NAME EDITING
  // =====================================================

  function startVariantNameEdit(button) {
    const card =
      button.closest(
        "[data-site-id][data-experiment-id]"
      );

    if (!card) {
      return;
    }


    const siteId =
      card.getAttribute(
        "data-site-id"
      );

    const experimentId =
      card.getAttribute(
        "data-experiment-id"
      );

    const variant =
      button.getAttribute(
        "data-ab-variant"
      );


    if (
      variant !== "A" &&
      variant !== "B"
    ) {
      return;
    }


    const nameElement =
      card.querySelector(
        '[data-ab-variant-name="' +
        variant +
        '"]'
      );

    if (!nameElement) {
      return;
    }


    if (
      nameElement.getAttribute(
        "data-editing"
      ) === "true"
    ) {
      return;
    }


    const originalName =
      nameElement.textContent
        .trim();


    nameElement.setAttribute(
      "data-editing",
      "true"
    );


    const input =
      document.createElement(
        "input"
      );


    input.type = "text";
    input.value = originalName;

    input.maxLength =
      MAX_VARIANT_NAME_LENGTH;


    input.setAttribute(
      "aria-label",
      "Edit Variant " +
      variant +
      " name"
    );


    const computed =
      getComputedStyle(
        nameElement
      );


    input.style.fontFamily =
      computed.fontFamily;

    input.style.fontSize =
      computed.fontSize;

    input.style.fontWeight =
      computed.fontWeight;

    input.style.lineHeight =
      computed.lineHeight;

    input.style.color =
      computed.color;

    input.style.minWidth =
      "120px";

    input.style.maxWidth =
      "260px";

    input.style.padding =
      "2px 0 4px 0";

    input.style.border =
      "none";

    input.style.borderBottom =
      "1px solid #f0f2f3";

    input.style.background =
      "transparent";

    input.style.outline =
      "none";


    nameElement.style.display =
      "none";


    nameElement.parentNode
      .insertBefore(
        input,
        nameElement.nextSibling
      );


    let finished = false;


    async function finishEdit(save) {
      if (finished) {
        return;
      }

      finished = true;

      const newName =
        input.value.trim();

      input.remove();

      nameElement.style.display =
        "";

      nameElement.removeAttribute(
        "data-editing"
      );


      if (
        !save ||
        !newName ||
        newName === originalName
      ) {
        return;
      }


      nameElement.textContent =
        newName;


      try {
        await saveVariantName(
          siteId,
          experimentId,
          variant,
          newName
        );

        loadDashboard();

      } catch (error) {

        console.error(
          error
        );

        nameElement.textContent =
          originalName;
      }
    }


    input.addEventListener(
      "keydown",
      function (event) {

        if (
          event.key === "Enter"
        ) {
          event.preventDefault();

          finishEdit(true);
        }


        if (
          event.key === "Escape"
        ) {
          event.preventDefault();

          finishEdit(false);
        }

      }
    );


    input.addEventListener(
      "blur",
      function () {
        finishEdit(true);
      }
    );


    input.focus();
    input.select();
  }


  function setupVariantNameEditing() {
    document
      .querySelectorAll(
        '[data-ab-action="edit-variant-name"]'
      )
      .forEach(function (button) {

        button.addEventListener(
          "click",
          function (event) {

            event.preventDefault();
            event.stopPropagation();

            startVariantNameEdit(
              button
            );

          }
        );

      });
  }


  // =====================================================
  // EXPERIMENT DETAIL CARD
  // =====================================================

  async function loadExperimentCard(card) {
    const siteId =
      card.getAttribute(
        "data-site-id"
      );

    const experimentId =
      card.getAttribute(
        "data-experiment-id"
      );

    const goalName =
      card.getAttribute(
        "data-goal-name"
      ) ||
      "Not Set";


    if (
      !siteId ||
      !experimentId
    ) {
      return;
    }


    try {
      const rows =
        await getExperimentData(
          siteId,
          experimentId
        );

      const data =
        summarizeExperiment(
          rows
        );


      const aNameElement =
        card.querySelector(
          '[data-ab-variant-name="A"]'
        );

      const bNameElement =
        card.querySelector(
          '[data-ab-variant-name="B"]'
        );


      if (
        aNameElement &&
        aNameElement.getAttribute(
          "data-editing"
        ) !== "true"
      ) {
        aNameElement.textContent =
          data.aName;
      }


      if (
        bNameElement &&
        bNameElement.getAttribute(
          "data-editing"
        ) !== "true"
      ) {
        bNameElement.textContent =
          data.bName;
      }


      // -----------------------------------------
      // METADATA
      // -----------------------------------------

      setText(
        card,
        "started-date",
        formatStartedDate(
          data.startedAt
        )
      );


      setText(
        card,
        "duration",
        getRunningDuration(
          data.startedAt
        )
      );


      setText(
        card,
        "goal-name",
        goalName
      );


      // -----------------------------------------
      // VARIANT A
      // -----------------------------------------

      setText(
        card,
        "a-visitors",
        data.aVisitors
          .toLocaleString()
      );


      setText(
        card,
        "a-conversions",
        data.aConversions
          .toLocaleString()
      );


      setText(
        card,
        "a-rate",
        (
          data.aRate *
          100
        ).toFixed(2) +
        "%"
      );


      setText(
        card,
        "a-bounce-rate",
        "—"
      );


      // -----------------------------------------
      // VARIANT B
      // -----------------------------------------

      setText(
        card,
        "b-visitors",
        data.bVisitors
          .toLocaleString()
      );


      setText(
        card,
        "b-conversions",
        data.bConversions
          .toLocaleString()
      );


      setText(
        card,
        "b-rate",
        (
          data.bRate *
          100
        ).toFixed(2) +
        "%"
      );


      setText(
        card,
        "b-bounce-rate",
        "—"
      );


      // -----------------------------------------
      // TRAFFIC SPLIT
      // -----------------------------------------

      let aTraffic = 50;
      let bTraffic = 50;


      if (
        data.totalVisitors > 0
      ) {
        aTraffic =
          (
            data.aVisitors /
            data.totalVisitors
          ) *
          100;

        bTraffic =
          (
            data.bVisitors /
            data.totalVisitors
          ) *
          100;
      }


      setText(
        card,
        "traffic-a",
        "A " +
        aTraffic.toFixed(1) +
        "%"
      );


      setText(
        card,
        "traffic-b",
        "B " +
        bTraffic.toFixed(1) +
        "%"
      );


      const aBar =
        getField(
          card,
          "traffic-a-bar"
        );

      const bBar =
        getField(
          card,
          "traffic-b-bar"
        );


      if (aBar) {
        aBar.style.width =
          aTraffic +
          "%";
      }


      if (bBar) {
        bBar.style.width =
          bTraffic +
          "%";
      }


      // -----------------------------------------
      // LEADER / LIFT
      // -----------------------------------------

      let leaderRate = 0;
      let otherRate = 0;
      let leaderName = null;


      if (
        data.leader === "A"
      ) {
        leaderRate =
          data.aRate;

        otherRate =
          data.bRate;

        leaderName =
          data.aName;
      }


      if (
        data.leader === "B"
      ) {
        leaderRate =
          data.bRate;

        otherRate =
          data.aRate;

        leaderName =
          data.bName;
      }


      let lift = 0;


      if (
        leaderName &&
        otherRate > 0
      ) {
        lift =
          (
            (
              leaderRate -
              otherRate
            ) /
            otherRate
          ) *
          100;
      }


      if (!leaderName) {
        setText(
          card,
          "result",
          "Variants are currently tied"
        );
      }

      else if (
        leaderRate > 0 &&
        otherRate === 0
      ) {
        setText(
          card,
          "result",
          leaderName +
          " is currently leading"
        );
      }

      else {
        setText(
          card,
          "result",
          leaderName +
          " is performing " +
          lift.toFixed(1) +
          "% better"
        );
      }


      // -----------------------------------------
      // CONFIDENCE
      // -----------------------------------------

      let confidence = 50;


      if (
        data.aVisitors > 0 &&
        data.bVisitors > 0
      ) {
        const pooledRate =
          (
            data.aConversions +
            data.bConversions
          ) /
          (
            data.aVisitors +
            data.bVisitors
          );


        const standardError =
          Math.sqrt(
            pooledRate *
            (
              1 -
              pooledRate
            ) *
            (
              1 /
              data.aVisitors +
              1 /
              data.bVisitors
            )
          );


        if (
          standardError > 0
        ) {
          const difference =
            Math.abs(
              data.bRate -
              data.aRate
            );


          confidence =
            normalCDF(
              difference /
              standardError
            ) *
            100;
        }
      }


      confidence =
        Math.min(
          99.9,
          Math.max(
            50,
            confidence
          )
        );


      setText(
        card,
        "confidence",
        confidence.toFixed(1) +
        "%"
      );


      const confidenceBar =
        getField(
          card,
          "confidence-bar"
        );


      if (
        confidenceBar
      ) {
        confidenceBar.style.width =
          confidence +
          "%";
      }


      const status =
        getStatus(
          confidence,
          data.totalVisitors
        );


      setText(
        card,
        "status",
        status
      );


      if (leaderName) {
        setText(
          card,
          "confidence-description",
          "There is currently a " +
          confidence.toFixed(1) +
          "% probability that " +
          leaderName +
          " is outperforming the other variant."
        );
      } else {
        setText(
          card,
          "confidence-description",
          "Neither variant is currently outperforming the other."
        );
      }

    } catch (error) {

      console.error(
        "Experiment detail error:",
        experimentId,
        error
      );

    }
  }


  // =====================================================
  // OVERVIEW
  // =====================================================

  function getExperimentTitle(
    card,
    experimentId
  ) {
    const titleElement =
      card.querySelector(
        '[data-list-field="title"]'
      );


    if (
      titleElement &&
      titleElement.textContent
        .trim()
    ) {
      return titleElement
        .textContent
        .trim();
    }


    return experimentId;
  }


  function updateOverview(
    experimentResults
  ) {
    const validResults =
      experimentResults.filter(
        function (item) {
          return item !== null;
        }
      );


    // -----------------------------------------
    // OVERALL TOTALS
    // -----------------------------------------

    let totalVisitors = 0;
    let totalConversions = 0;


    validResults.forEach(
      function (result) {
        totalVisitors +=
          result.data
            .totalVisitors;

        totalConversions +=
          result.data
            .totalConversions;
      }
    );


    const overallRate =
      totalVisitors > 0
        ? totalConversions /
          totalVisitors
        : 0;


    setOverviewText(
      "visitors",
      totalVisitors
        .toLocaleString()
    );


    setOverviewText(
      "conversions",
      totalConversions
        .toLocaleString()
    );


    setOverviewText(
      "conversion-rate",
      (
        overallRate *
        100
      ).toFixed(2) +
      "%"
    );


    setOverviewText(
      "bounce-rate",
      "—"
    );


    // -----------------------------------------
    // EXPERIMENT COUNTS
    // -----------------------------------------

    const totalTests =
      validResults.length;

    const activeTests =
      totalTests;

    const completedTests =
      0;


    setOverviewText(
      "active-tests",
      activeTests
        .toLocaleString()
    );


    setOverviewText(
      "completed-tests",
      completedTests
        .toLocaleString()
    );


    setOverviewText(
      "total-tests",
      totalTests
        .toLocaleString()
    );


    // -----------------------------------------
    // TOP PERFORMING EXPERIMENT
    // -----------------------------------------

    let topExperiment =
      null;


    validResults.forEach(
      function (result) {

        if (
          !topExperiment ||
          result.data
            .overallRate >
          topExperiment.data
            .overallRate
        ) {
          topExperiment =
            result;
        }

      }
    );


    if (topExperiment) {
      const title =
        getExperimentTitle(
          topExperiment.card,
          topExperiment
            .experimentId
        );


      setOverviewText(
        "top-experiment-name",
        title
      );


      setOverviewText(
        "top-experiment-rate",
        (
          topExperiment.data
            .overallRate *
          100
        ).toFixed(2) +
        "% conversion rate"
      );


      const topLink =
        document.querySelector(
          '[data-overview-field="top-experiment-name"]'
        )
        ?.closest(
          ".overview-top-experiment"
        )
        ?.querySelector(
          '[data-experiment-target]'
        );


      if (topLink) {
        topLink.setAttribute(
          "data-experiment-target",
          topExperiment
            .experimentId
        );
      }

    } else {

      setOverviewText(
        "top-experiment-name",
        "—"
      );


      setOverviewText(
        "top-experiment-rate",
        "—"
      );

    }


    // -----------------------------------------
    // SITE PERFORMANCE
    // -----------------------------------------

    const siteTotals = {};


    validResults.forEach(
      function (result) {

        if (
          !siteTotals[
            result.siteId
          ]
        ) {
          siteTotals[
            result.siteId
          ] = {
            visitors: 0,
            conversions: 0
          };
        }


        siteTotals[
          result.siteId
        ].visitors +=
          result.data
            .totalVisitors;


        siteTotals[
          result.siteId
        ].conversions +=
          result.data
            .totalConversions;

      }
    );


    document
      .querySelectorAll(
        ".overview-site-row[data-site-id]"
      )
      .forEach(function (row) {

        const siteId =
          row.getAttribute(
            "data-site-id"
          );


        const totals =
          siteTotals[
            siteId
          ] ||
          {
            visitors: 0,
            conversions: 0
          };


        const rate =
          totals.visitors > 0
            ? totals
                .conversions /
              totals
                .visitors
            : 0;


        setSiteText(
          row,
          "name",
          getSiteDisplayName(
            siteId
          )
        );


        setSiteText(
          row,
          "visitors",
          totals.visitors
            .toLocaleString()
        );


        setSiteText(
          row,
          "conversions",
          totals.conversions
            .toLocaleString()
        );


        setSiteText(
          row,
          "conversion-rate",
          (
            rate *
            100
          ).toFixed(2) +
          "%"
        );

      });
  }


  // =====================================================
  // CHART HELPERS
  // =====================================================

  function niceMaximum(
    value,
    metric
  ) {
    if (
      !Number.isFinite(value) ||
      value <= 0
    ) {
      return 4;
    }


    if (
      metric ===
      "conversion-rate"
    ) {
      if (value <= 4) {
        return 4;
      }

      if (value <= 10) {
        return 10;
      }

      if (value <= 20) {
        return 20;
      }

      if (value <= 50) {
        return 50;
      }

      return (
        Math.ceil(
          value /
          25
        ) *
        25
      );
    }


    const roughStep =
      value / 4;


    const magnitude =
      Math.pow(
        10,
        Math.floor(
          Math.log10(
            roughStep
          )
        )
      );


    const normalized =
      roughStep /
      magnitude;


    let niceStep;


    if (
      normalized <= 1
    ) {
      niceStep = 1;
    }

    else if (
      normalized <= 2
    ) {
      niceStep = 2;
    }

    else if (
      normalized <= 5
    ) {
      niceStep = 5;
    }

    else {
      niceStep = 10;
    }


    niceStep *=
      magnitude;


    return niceStep *
      4;
  }


  function getChartMetricValue(row) {
    if (
      currentChartMetric ===
      "conversions"
    ) {
      return Number(
        row.conversions ||
        0
      );
    }


    if (
      currentChartMetric ===
      "conversion-rate"
    ) {
      return Number(
        row.conversion_rate ||
        0
      );
    }


    return Number(
      row.visitors ||
      0
    );
  }


  function getChartColor() {
    const activeTab =
      document.querySelector(
        ".overview-chart-tab.is-active"
      );


    if (!activeTab) {
      return "#6f4cff";
    }


    const styles =
      getComputedStyle(
        activeTab
      );


    const background =
      styles.backgroundColor;


    if (
      background &&
      background !==
      "rgba(0, 0, 0, 0)" &&
      background !==
      "transparent"
    ) {
      return background;
    }


    return styles.color ||
      "#6f4cff";
  }


  // =====================================================
  // CHART AXES
  // =====================================================

  function updateYAxis(chartData) {
    const values =
      chartData.map(
        function (row) {
          return getChartMetricValue(
            row
          );
        }
      );


    const highest =
      values.length
        ? Math.max(
            ...values
          )
        : 0;


    const maximum =
      niceMaximum(
        highest,
        currentChartMetric
      );


    const labels =
      document.querySelectorAll(
        "[data-chart-y-label]"
      );


    labels.forEach(function (label) {

      const position =
        Number(
          label.getAttribute(
            "data-chart-y-label"
          )
        );


      const multiplier =
        (
          5 -
          position
        ) /
        4;


      const value =
        maximum *
        multiplier;


      if (
        currentChartMetric ===
        "conversion-rate"
      ) {
        label.textContent =
          (
            value % 1 === 0
              ? value.toFixed(0)
              : value.toFixed(1)
          ) +
          "%";
      } else {
        label.textContent =
          Math.round(
            value
          ).toLocaleString();
      }

    });


    return maximum;
  }


  function updateXAxis(chartData) {
    const labels =
      document.querySelectorAll(
        "[data-chart-x-label]"
      );


    if (
      chartData.length === 0
    ) {
      labels.forEach(
        function (label) {
          label.textContent =
            "—";
        }
      );

      return;
    }


    const lastIndex =
      chartData.length -
      1;


    const indices = [
      0,

      Math.round(
        lastIndex /
        3
      ),

      Math.round(
        (
          lastIndex *
          2
        ) /
        3
      ),

      lastIndex
    ];


    labels.forEach(function (label) {

      const position =
        Number(
          label.getAttribute(
            "data-chart-x-label"
          )
        ) -
        1;


      const row =
        chartData[
          indices[position]
        ];


      label.textContent =
        row
          ? formatChartDate(
              row.day
            )
          : "—";

    });
  }


  // =====================================================
  // SVG CHART
  // =====================================================

  function drawChart(chartData) {
    const chartElement =
      document.querySelector(
        '[data-chart-line="true"]'
      );


    if (!chartElement) {
      console.warn(
        "Chart line embed not found."
      );

      return;
    }


    const placeholder =
      document.querySelector(
        ".overview-chart-placeholder-text"
      );


    updateXAxis(
      chartData
    );


    const maximum =
      updateYAxis(
        chartData
      );


    if (
      chartData.length === 0
    ) {
      chartElement.innerHTML =
        "";

      if (placeholder) {
        placeholder.style.display =
          "";
      }

      return;
    }


    if (placeholder) {
      placeholder.style.display =
        "none";
    }


    const width = 1000;
    const height = 240;

    const sidePadding = 8;
    const topPadding = 8;
    const bottomPadding = 8;


    const usableWidth =
      width -
      sidePadding *
      2;


    const usableHeight =
      height -
      topPadding -
      bottomPadding;


    const values =
      chartData.map(
        function (row) {
          return getChartMetricValue(
            row
          );
        }
      );


    const points =
      values.map(
        function (
          value,
          index
        ) {

          const x =
            chartData.length ===
            1
              ? width / 2
              : sidePadding +
                (
                  index /
                  (
                    chartData.length -
                    1
                  )
                ) *
                usableWidth;


          const safeMaximum =
            maximum > 0
              ? maximum
              : 1;


          const ratio =
            Math.min(
              1,
              Math.max(
                0,
                value /
                safeMaximum
              )
            );


          const y =
            topPadding +
            (
              1 -
              ratio
            ) *
            usableHeight;


          return {
            x,
            y,
            value
          };

        }
      );


    let pathData = "";


    points.forEach(
      function (
        point,
        index
      ) {

        pathData +=
          (
            index === 0
              ? "M "
              : " L "
          ) +
          point.x.toFixed(2) +
          " " +
          point.y.toFixed(2);

      }
    );


    const chartColor =
      getChartColor();


    let dots = "";


    if (
      points.length <= 31
    ) {
      dots =
        points.map(
          function (point) {
            return (
              '<circle ' +
              'cx="' +
              point.x.toFixed(2) +
              '" ' +
              'cy="' +
              point.y.toFixed(2) +
              '" ' +
              'r="4" ' +
              'fill="#ffffff" ' +
              'stroke="' +
              chartColor +
              '" ' +
              'stroke-width="2" ' +
              'vector-effect="non-scaling-stroke" />'
            );
          }
        ).join("");
    }


    chartElement.innerHTML =
      '<svg ' +
      'viewBox="0 0 ' +
      width +
      " " +
      height +
      '" ' +
      'preserveAspectRatio="none" ' +
      'width="100%" ' +
      'height="100%" ' +
      'aria-hidden="true">' +

      '<path ' +
      'd="' +
      pathData +
      '" ' +
      'fill="none" ' +
      'stroke="' +
      chartColor +
      '" ' +
      'stroke-width="3" ' +
      'stroke-linecap="round" ' +
      'stroke-linejoin="round" ' +
      'vector-effect="non-scaling-stroke" />' +

      dots +

      "</svg>";
  }


  // =====================================================
  // CHART DATA
  // =====================================================

  function getChartDateRange(
    experimentResults
  ) {
    const endDate =
      new Date();


    let startDate =
      new Date(
        endDate
      );


    if (
      currentDateRange ===
      "all"
    ) {
      const startedDates =
        experimentResults
          .map(function (result) {

            if (
              !result ||
              !result.data ||
              !result.data
                .startedAt
            ) {
              return null;
            }


            const date =
              new Date(
                result.data
                  .startedAt
              );


            return Number.isNaN(
              date.getTime()
            )
              ? null
              : date;

          })
          .filter(Boolean);


      if (
        startedDates.length
      ) {
        startDate =
          new Date(
            Math.min(
              ...startedDates.map(
                function (date) {
                  return date.getTime();
                }
              )
            )
          );
      } else {
        startDate.setDate(
          endDate.getDate() -
          29
        );
      }
    } else {
      const days =
        Number(
          currentDateRange
        ) || 30;


      startDate.setDate(
        endDate.getDate() -
        (
          days -
          1
        )
      );
    }


    return {
      start:
        formatDateForSQL(
          startDate
        ),

      end:
        formatDateForSQL(
          endDate
        )
    };
  }


  async function refreshChart(
    experimentResults
  ) {
    const validResults =
      experimentResults.filter(
        function (result) {
          return result !==
            null;
        }
      );


    if (
      validResults.length ===
      0
    ) {
      currentChartData = [];

      drawChart(
        currentChartData
      );

      return;
    }


    const range =
      getChartDateRange(
        validResults
      );


    try {
      const requests =
        validResults.map(
          function (result) {
            return getExperimentTimeseries(
              result.siteId,
              result.experimentId,
              range.start,
              range.end
            );
          }
        );


      const resultSets =
        await Promise.all(
          requests
        );


      const combined =
        new Map();


      resultSets.forEach(
        function (rows) {

          rows.forEach(
            function (row) {

              if (
                !combined.has(
                  row.day
                )
              ) {
                combined.set(
                  row.day,
                  {
                    day:
                      row.day,

                    visitors:
                      0,

                    conversions:
                      0,

                    conversion_rate:
                      0
                  }
                );
              }


              const day =
                combined.get(
                  row.day
                );


              day.visitors +=
                Number(
                  row.visitors ||
                  0
                );


              day.conversions +=
                Number(
                  row.conversions ||
                  0
                );

            }
          );

        }
      );


      currentChartData =
        Array.from(
          combined.values()
        )
          .sort(
            function (
              a,
              b
            ) {
              return a.day
                .localeCompare(
                  b.day
                );
            }
          )
          .map(
            function (row) {

              row.conversion_rate =
                row.visitors > 0
                  ? (
                      row
                        .conversions /
                      row
                        .visitors
                    ) *
                    100
                  : 0;


              return row;
            }
          );


      drawChart(
        currentChartData
      );

    } catch (error) {

      console.error(
        "Chart data error:",
        error
      );

    }
  }


  // =====================================================
  // CHART METRIC TABS
  // =====================================================

  function setupChartTabs() {
    const tabs =
      document.querySelectorAll(
        "[data-chart-metric]"
      );


    tabs.forEach(function (tab) {

      tab.addEventListener(
        "click",
        function (event) {

          event.preventDefault();


          const metric =
            tab.getAttribute(
              "data-chart-metric"
            );


          if (!metric) {
            return;
          }


          currentChartMetric =
            metric;


          tabs.forEach(
            function (otherTab) {
              otherTab.classList
                .remove(
                  "is-active"
                );
            }
          );


          tab.classList.add(
            "is-active"
          );


          drawChart(
            currentChartData
          );

        }
      );

    });
  }


  // =====================================================
  // DATE DROPDOWN
  // =====================================================

  function updateDateFilterLabel(
    filter,
    text
  ) {
    const explicitLabel =
      filter.querySelector(
        "[data-date-filter-label]"
      );


    if (explicitLabel) {
      explicitLabel.textContent =
        text;

      return;
    }


    const toggle =
      filter.querySelector(
        ".w-dropdown-toggle"
      );


    if (!toggle) {
      return;
    }


    const textNode =
      Array.from(
        toggle.childNodes
      ).find(
        function (node) {
          return (
            node.nodeType ===
              Node.TEXT_NODE &&
            node.nodeValue.trim()
          );
        }
      );


    if (textNode) {
      textNode.nodeValue =
        text +
        " ";

      return;
    }


    const child =
      Array.from(
        toggle.children
      ).find(
        function (element) {
          return !element.classList
            .contains(
              "w-icon-dropdown-toggle"
            );
        }
      );


    if (child) {
      child.textContent =
        text;
    }
  }


  function setupDateFilter() {
    const filter =
      document.querySelector(
        '[data-overview-date-filter="true"]'
      );


    if (!filter) {
      return;
    }


    const options =
      filter.querySelectorAll(
        "[data-date-range]"
      );


    options.forEach(
      function (option) {

        option.addEventListener(
          "click",
          function (event) {

            event.preventDefault();


            const rawRange =
              option.getAttribute(
                "data-date-range"
              );


            currentDateRange =
              rawRange === "all"
                ? "all"
                : Number(
                    rawRange
                  );


            updateDateFilterLabel(
              filter,
              option.textContent
                .trim()
            );


            refreshChart(
              latestExperimentResults
            );


            // Close regular Webflow dropdown.
            const toggle =
              filter.querySelector(
                ".w-dropdown-toggle"
              );


            const list =
              filter.querySelector(
                ".w-dropdown-list"
              );


            if (toggle) {
              toggle.setAttribute(
                "aria-expanded",
                "false"
              );
            }


            if (list) {
              list.classList.remove(
                "w--open"
              );
            }


            filter.classList.remove(
              "w--open"
            );

          }
        );

      }
    );
  }


  // =====================================================
  // DASHBOARD LOAD
  // =====================================================

  async function loadDashboard() {
    const detailCards =
      document.querySelectorAll(
        '[data-ab-detail-card="true"]'
      );


    const listCards =
      document.querySelectorAll(
        ".experiment-list-card[data-site-id][data-experiment-id]"
      );


    const listJobs = [];


    listCards.forEach(
      function (card) {

        listJobs.push(
          loadExperimentListCard(
            card
          )
        );

      }
    );


    const experimentResults =
      await Promise.all(
        listJobs
      );


    latestExperimentResults =
      experimentResults;


    updateOverview(
      experimentResults
    );


    await refreshChart(
      experimentResults
    );


    const detailJobs = [];


    detailCards.forEach(
      function (card) {

        detailJobs.push(
          loadExperimentCard(
            card
          )
        );

      }
    );


    await Promise.all(
      detailJobs
    );
  }


  // =====================================================
  // INITIALIZE
  // =====================================================

  setupSidebar();

  setupDashboardViews();

  setupVariantNameEditing();

  setupChartTabs();

  setupDateFilter();

  loadDashboard();


  // =====================================================
  // AUTO REFRESH
  // =====================================================

  setInterval(
    loadDashboard,
    REFRESH_INTERVAL
  );

});
