/**
 * OJ SCHOOLS — Main App Controller v2
 * Full-featured bursary management system for 4 school sections:
 * Primary (Creche, KG 1-2, Nur 1-2, Basic 1-6), Junior Secondary, Senior Secondary, Tutorial
 *
 * New in v2:
 * - Multi-item payment receipt recording with live line-item totals
 * - Per-class fee schedule auto-population (SS3, SS1-2, JSS1-3, Basic 1-5, Nur, KG 1 & 2, Creche)
 * - Arrears-first priority allocation preview
 * - Debtors tracking list with filter and export
 * - Audit Trail viewer
 * - School Settings & Config manager with fee reference matrix
 */

const OJSchoolsApp = (() => {
  let currentTab = "dashboard";

  // State for payment modal line items
  let activePaymentItems = [];

  // ── Currency Helpers ────────────────────────────────────────────────────────
  function parseAmount(val) {
    if (typeof val === "number") return val;
    if (!val) return 0;
    const cleaned = String(val).replace(/,/g, "").trim();
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  }

  function formatAmount(val, includeKobo = false) {
    const num = parseAmount(val);
    if (includeKobo || num % 1 !== 0) {
      return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return num.toLocaleString();
  }

  function currency(val) {
    const cfg = typeof OJSchoolsDB !== "undefined" ? OJSchoolsDB.getConfig() : null;
    const sym = cfg ? (cfg.currency || "\u20a6") : "\u20a6";
    return sym + formatAmount(val, true);
  }

  function bindCurrencyInput(inputEl) {
    if (!inputEl) return;
    inputEl.addEventListener("input", () => {
      let val = inputEl.value.replace(/[^0-9.]/g, "");
      const parts = val.split(".");
      if (parts.length > 2) val = parts[0] + "." + parts.slice(1).join("");
      const intPart = parts[0] || "";
      const decPart = parts.length > 1 ? "." + parts[1].slice(0, 2) : "";
      if (intPart) {
        inputEl.value = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + decPart;
      } else if (decPart) {
        inputEl.value = "0" + decPart;
      }
    });
  }

  // ── Toast Notifications ──────────────────────────────────────────────────────
  function showToast(message, type = "default", duration = 3500) {
    const toast = document.getElementById("toast-notification");
    const text  = document.getElementById("toast-text");
    if (!toast || !text) return;
    text.textContent = message;
    toast.className = "toast show";
    if (type === "success") toast.classList.add("toast-success");
    else if (type === "error") toast.classList.add("toast-error");
    else if (type === "warning") toast.classList.add("toast-warning");
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.remove("show"), duration);
  }

  // ── Mobile Drawer Navigation ─────────────────────────────────────────────────
  function openMobileSidebar() {
    const sidebar = document.getElementById("sidebar");
    const backdrop = document.getElementById("sidebar-backdrop");
    if (sidebar) sidebar.classList.add("open");
    if (backdrop) backdrop.classList.add("active");
    if (document.body) document.body.style.overflow = "hidden";
  }

  function closeMobileSidebar() {
    const sidebar = document.getElementById("sidebar");
    const backdrop = document.getElementById("sidebar-backdrop");
    if (sidebar) sidebar.classList.remove("open");
    if (backdrop) backdrop.classList.remove("active");
    if (document.body) document.body.style.overflow = "";
  }

  function toggleMobileSidebar() {
    const sidebar = document.getElementById("sidebar");
    if (sidebar && sidebar.classList.contains("open")) {
      closeMobileSidebar();
    } else {
      openMobileSidebar();
    }
  }

  // ── Tab Navigation ───────────────────────────────────────────────────────────
  function switchTab(tab, options = {}) {
    currentTab = tab;
    document.querySelectorAll(".tab-section").forEach(s => s.classList.add("hidden"));
    const section = document.getElementById("view-" + tab);
    if (section) section.classList.remove("hidden");

    document.querySelectorAll("[data-tab]").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.tab === tab);
    });

    const pageTitleMap = {
      dashboard:    "System Dashboard",
      overview:     "P&L Financial Overview",
      learners:     "Learners Register",
      "class-hub":  "Class Hub",
      clearance:    "Examination Clearance",
      payments:     "Payments Ledger",
      expenses:     "Expenses Ledger",
      reports:      "Reports & Exports",
      debtors:      "Debtors Schedule",
      salary:       "Staff Salary & Payroll",
      stocks:       "Stock & Inventory Ledger",
      "audit-logs": "Audit Trail",
      settings:     "School Settings & Fee Tariffs"
    };
    const headerTitle = document.getElementById("page-title");
    if (headerTitle) headerTitle.textContent = pageTitleMap[tab] || "OJ Schools Admin";

    // Bottom dock indicator & More button active state
    const bottomTabs = ["dashboard", "learners", "class-hub", "payments"];
    const moreBtn = document.getElementById("mob-more-btn");
    if (moreBtn) {
      moreBtn.classList.toggle("active", !bottomTabs.includes(tab));
    }

    // Close mobile sidebar on tab switch
    closeMobileSidebar();

    // Scroll back to top smoothly
    window.scrollTo({ top: 0, behavior: "instant" });

    if (options && options.skipLoad) return;

    // Load content
    if (tab === "dashboard")    loadDashboard();
    if (tab === "overview")     loadOverview();
    if (tab === "learners")     loadLearners();
    if (tab === "class-hub")    loadClassHub();
    if (tab === "clearance")    loadClearance();
    if (tab === "payments")     loadPayments();
    if (tab === "expenses")     loadExpenses();
    if (tab === "reports")      loadReports();
    if (tab === "debtors")      loadDebtors();
    if (tab === "audit-logs")   loadAuditLogs();
    if (tab === "settings")     loadSettings();
    if (tab === "salary")       loadSalaryTab();
    if (tab === "stocks")       loadStocksTab();
  }

  function refreshCurrentTab() {
    switchTab(currentTab);
  }

  // ── Live Clock ──────────────────────────────────────────────────────────────
  function _startLiveClock() {
    function tick() {
      const el = document.getElementById("live-clock-time");
      if (el) el.textContent = new Date().toLocaleTimeString("en-US", { hour12: true, hour: "2-digit", minute: "2-digit", second: "2-digit" });
    }
    tick();
    setInterval(tick, 1000);
  }

  // ── Class Filter Dropdown Population ─────────────────────────────────────────
  function updateFilterClassOptions(selectId, selectedSection = "") {
    const sel = document.getElementById(selectId);
    if (!sel) return;
    const currentVal = sel.value;
    sel.innerHTML = '<option value="">All Classes</option>';

    if (selectedSection && SCHOOL_SECTIONS[selectedSection]) {
      const sec = SCHOOL_SECTIONS[selectedSection];
      if (sec.classes && sec.classes.length > 0) {
        sec.classes.forEach(cls => {
          const opt = document.createElement("option");
          opt.value = cls;
          opt.textContent = cls;
          sel.appendChild(opt);
        });
      }
    } else {
      for (const [, sec] of Object.entries(SCHOOL_SECTIONS)) {
        if (!sec.classes || sec.classes.length === 0) continue;
        const grp = document.createElement("optgroup");
        grp.label = sec.name;
        sec.classes.forEach(cls => {
          const opt = document.createElement("option");
          opt.value = cls;
          opt.textContent = cls;
          grp.appendChild(opt);
        });
        sel.appendChild(grp);
      }
    }

    if (currentVal && Array.from(sel.options).some(o => o.value === currentVal)) {
      sel.value = currentVal;
    } else {
      sel.value = "";
    }
  }

  // ── Populate Class Dropdowns ─────────────────────────────────────────────────
  function populateClassDropdowns() {
    const dropdowns = document.querySelectorAll("[data-class-select]");
    dropdowns.forEach(sel => {
      const currentVal = sel.value;
      sel.innerHTML = '<option value="">-- Select Class --</option>';
      for (const [, sec] of Object.entries(SCHOOL_SECTIONS)) {
        if (!sec.classes || sec.classes.length === 0) continue;
        const grp = document.createElement("optgroup");
        grp.label = sec.name;
        sec.classes.forEach(cls => {
          const opt = document.createElement("option");
          opt.value = cls;
          opt.textContent = cls;
          grp.appendChild(opt);
        });
        sel.appendChild(grp);
      }
      if (currentVal) sel.value = currentVal;
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // DASHBOARD
  // ─────────────────────────────────────────────────────────────────────────────
  function loadDashboard() {
    const summary = OJSchoolsDB.getFinancialSummary();
    const config  = OJSchoolsDB.getConfig();

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

    set("dash-total-students",      summary.totalStudents.toLocaleString());
    set("dash-total-revenue",       currency(summary.totalRevenue));
    set("dash-total-expenses",      currency(summary.totalExpenses));
    set("dash-net-profit",          currency(summary.netProfit));
    set("dash-total-term-fees",     currency(summary.totalTermFeesPaid));
    set("dash-arrears-recovered",   currency(summary.totalArrearsRecovered));
    set("dash-other-fees",          currency(summary.totalOtherFeesPaid));
    set("dash-outstanding-arrears", currency(summary.totalOutstandingArrears));
    set("dash-unpaid-term-fees",    currency(summary.totalUnpaidTermFees));
    set("dash-total-debtors",       summary.totalDebtorsCount);
    set("dash-session",             `${config.currentSession} — ${config.currentTerm}`);

    const npEl = document.getElementById("dash-net-profit");
    if (npEl) npEl.style.color = summary.netProfit >= 0 ? "var(--oj-emerald-600, #059669)" : "var(--color-danger, #dc2626)";

    renderRecentPayments();
    renderSectionEnrollmentCards();
  }

  function renderRecentPayments() {
    const container = document.getElementById("recent-payments-list");
    if (!container) return;
    const payments = OJSchoolsDB.getPayments().slice(0, 8);

    if (payments.length === 0) {
      container.innerHTML = `<div class="empty-state"><i class="fas fa-receipt"></i><p>No payments recorded yet.</p></div>`;
      return;
    }

    container.innerHTML = payments.map(p => {
      const sec = getSectionByClass(p.studentClass);
      const sectionBadge = sec ? `<span class="badge-pill ${sec.badgeClass}">${sec.name}</span>` : "";
      const amt = currency(p.amount);
      const itemsCount = Array.isArray(p.items) && p.items.length ? `<small style="color:var(--gray-400)">(${p.items.length} item${p.items.length > 1 ? "s" : ""})</small>` : "";
      return `
        <div class="recent-pay-item">
          <div class="rp-icon"><i class="fas fa-money-bill-trend-up"></i></div>
          <div class="rp-info">
            <div class="rp-name">${p.studentName || "—"} <small class="rp-class">${p.studentClass || ""}</small> ${itemsCount}</div>
            <div class="rp-meta">${p.receiptNumber || p.id} &bull; ${p.date || ""} ${sectionBadge}</div>
          </div>
          <div class="rp-amount">${amt}</div>
        </div>
      `;
    }).join("");
  }

  function renderSectionEnrollmentCards() {
    const container = document.getElementById("section-enrollment-cards");
    if (!container) return;
    const sectionColors = {
      primary:  { icon: "fas fa-child",             light: "#d1fae5", dark: "#047857" },
      junior:   { icon: "fas fa-school",            light: "#dbeafe", dark: "#1d4ed8" },
      senior:   { icon: "fas fa-graduation-cap",    light: "#ede9fe", dark: "#6d28d9" },
      tutorial: { icon: "fas fa-book-open-reader",  light: "#ffedd5", dark: "#c2410c" }
    };

    // Only show sections that have enrolled learners or active classes
    const allStudents = OJSchoolsDB.getStudents();
    const activeSectionIds = ["primary", "junior", "senior", "tutorial"].filter(secId => {
      const sec = SCHOOL_SECTIONS[secId];
      if (!sec) return false;
      const count = allStudents.filter(s =>
        (s.section || (getSectionByClass(s.currentClass) ? getSectionByClass(s.currentClass).id : "primary")) === secId
      ).length;
      return count > 0 || (sec.classes && sec.classes.length > 0);
    });

    container.innerHTML = activeSectionIds.map(secId => {
      const sec     = SCHOOL_SECTIONS[secId];
      const style   = sectionColors[secId] || { icon: "fas fa-chalkboard", light: "#e2e8f0", dark: "#334155" };
      const students = allStudents.filter(s =>
        (s.section || (getSectionByClass(s.currentClass) ? getSectionByClass(s.currentClass).id : "primary")) === secId
      );
      const summary = OJSchoolsDB.getFinancialSummary(secId);

      return `
        <div class="section-enroll-card" style="border-top: 4px solid ${sec.color}">
          <div class="sec-card-icon" style="background:${style.light};color:${style.dark}">
            <i class="${style.icon}"></i>
          </div>
          <div class="sec-card-info">
            <div class="sec-card-name">${sec.name}</div>
            <div class="sec-card-students">${students.length} <span>Learner${students.length !== 1 ? "s" : ""}</span></div>
            <div class="sec-card-revenue">Rev: ${currency(summary.totalRevenue)}</div>
          </div>
        </div>
      `;
    }).join("");
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // P&L OVERVIEW
  // ─────────────────────────────────────────────────────────────────────────────
  function loadOverview() {
    const summary = OJSchoolsDB.getFinancialSummary();
    const breakdown = OJSchoolsDB.getSectionBreakdown();

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set("ov-total-revenue",   currency(summary.totalRevenue));
    set("ov-total-expenses",  currency(summary.totalExpenses));
    set("ov-net-profit",      currency(summary.netProfit));
    set("ov-total-debtors",   summary.totalDebtorsCount);
    set("ov-outstanding",     currency(summary.totalOutstandingDebt));

    const npEl = document.getElementById("ov-net-profit");
    if (npEl) npEl.style.color = summary.netProfit >= 0 ? "var(--oj-emerald-600, #059669)" : "var(--color-danger, #dc2626)";

    const container = document.getElementById("ov-sections-container");
    if (!container) return;

    const sectionIcons = {
      primary:  { icon: "fas fa-child",            color: "#059669", light: "#d1fae5" },
      junior:   { icon: "fas fa-school",           color: "#2563eb", light: "#dbeafe" },
      senior:   { icon: "fas fa-graduation-cap",   color: "#7c3aed", light: "#ede9fe" },
      tutorial: { icon: "fas fa-book-open-reader", color: "#ea580c", light: "#ffedd5" }
    };

    container.innerHTML = Object.entries(breakdown.sections).map(([secId, data]) => {
      const style = sectionIcons[secId];
      const net   = data.totalRevenue - data.totalExpenses;
      const netColor = net >= 0 ? "#059669" : "#dc2626";

      return `
        <div class="ov-section-card" style="border-left: 4px solid ${style.color}">
          <div class="ov-section-name">
            <div class="ov-sec-icon" style="background:${style.light};color:${style.color}">
              <i class="${style.icon}"></i>
            </div>
            ${data.name}
            <span class="ov-sec-student-count">${data.totalStudents} Students</span>
          </div>
          <div class="ov-section-stats">
            <div class="ov-stat green">
              <div class="ov-stat-label">Revenue</div>
              <div class="ov-amount">${currency(data.totalRevenue)}</div>
            </div>
            <div class="ov-stat red">
              <div class="ov-stat-label">Expenses</div>
              <div class="ov-amount">${currency(data.totalExpenses)}</div>
            </div>
            <div class="ov-stat blue">
              <div class="ov-stat-label">Net</div>
              <div class="ov-amount" style="color:${netColor}">${currency(net)}</div>
            </div>
            <div class="ov-stat amber">
              <div class="ov-stat-label">Debtors</div>
              <div class="ov-amount" style="color:#b45309">${data.totalDebtorsCount} (${currency(data.totalOutstandingDebt)})</div>
            </div>
          </div>
        </div>
      `;
    }).join("");

    // ── Double-Entry Income & Expenditure Statement ───────────────
    const incExpContainer = document.getElementById("ov-income-expenditure-container");
    if (incExpContainer) {
      const fs = OJSchoolsDB.getFinancialSummary();
      const tuitionRev = fs.totalRevenue || 0;
      const stockRev   = fs.totalStockSalesRevenue || 0;
      const totalIncome = tuitionRev + stockRev;
      const totalExp    = fs.totalExpenses || 0;
      const netSurplus  = totalIncome - totalExp;
      const margin      = totalIncome > 0 ? ((netSurplus / totalIncome) * 100).toFixed(1) : "0.0";
      const surplusColor = netSurplus >= 0 ? "#059669" : "#dc2626";
      const surplusLabel = netSurplus >= 0 ? "Net Operating Surplus" : "Net Operating Deficit";

      incExpContainer.innerHTML = `
        <div style="background:#fff;border:1.5px solid #e2e8f0;border-radius:12px;overflow:hidden;margin-bottom:24px">
          <div style="background:#0a192f;color:#fff;padding:12px 20px;font-weight:800;font-size:13px;letter-spacing:0.5px">
            <i class="fas fa-file-invoice-dollar" style="color:#f59e0b;margin-right:8px"></i>
            OJ Schools College — Statement of Income &amp; Expenditure (All-Time)
          </div>
          <table style="width:100%;border-collapse:collapse;font-size:13px">
            <thead>
              <tr style="background:#f8fafc">
                <th style="padding:10px 20px;text-align:left;color:#334155;font-weight:700;border-bottom:1px solid #e2e8f0">Account</th>
                <th style="padding:10px 20px;text-align:right;color:#334155;font-weight:700;border-bottom:1px solid #e2e8f0">Amount (₦)</th>
              </tr>
            </thead>
            <tbody>
              <tr style="background:#ecfdf5">
                <td style="padding:8px 20px;font-weight:700;color:#065f46" colspan="2">I. OPERATING REVENUE</td>
              </tr>
              <tr>
                <td style="padding:6px 20px 6px 36px;color:#334155">School Fees &amp; Tuition Income</td>
                <td style="padding:6px 20px;text-align:right;color:#059669;font-weight:700">${currency(tuitionRev)}</td>
              </tr>
              <tr>
                <td style="padding:6px 20px 6px 36px;color:#334155">Stock / POS Sales Revenue</td>
                <td style="padding:6px 20px;text-align:right;color:#059669;font-weight:700">${currency(stockRev)}</td>
              </tr>
              <tr style="background:#f1faf5;font-weight:800">
                <td style="padding:10px 20px;color:#065f46;border-top:2px solid #059669">Total Operating Revenue</td>
                <td style="padding:10px 20px;text-align:right;color:#059669;border-top:2px solid #059669">${currency(totalIncome)}</td>
              </tr>
              <tr style="background:#fef2f2">
                <td style="padding:8px 20px;font-weight:700;color:#991b1b" colspan="2">II. OPERATING EXPENDITURE</td>
              </tr>
              <tr>
                <td style="padding:6px 20px 6px 36px;color:#334155">Total Recorded Expenses</td>
                <td style="padding:6px 20px;text-align:right;color:#dc2626;font-weight:700">${currency(totalExp)}</td>
              </tr>
              <tr style="background:#fef2f2;font-weight:800">
                <td style="padding:10px 20px;color:#991b1b;border-top:2px solid #dc2626">Total Operating Expenditure</td>
                <td style="padding:10px 20px;text-align:right;color:#dc2626;border-top:2px solid #dc2626">${currency(totalExp)}</td>
              </tr>
              <tr style="background:#f8fafc">
                <td style="padding:14px 20px;font-weight:900;font-size:14px;color:${surplusColor};border-top:3px solid ${surplusColor}">${surplusLabel}</td>
                <td style="padding:14px 20px;text-align:right;font-weight:900;font-size:16px;color:${surplusColor};border-top:3px solid ${surplusColor}">${currency(netSurplus)}</td>
              </tr>
              <tr>
                <td style="padding:8px 20px;color:#64748b;font-size:12px">Surplus Margin</td>
                <td style="padding:8px 20px;text-align:right;font-weight:700;color:${surplusColor};font-size:12px">${margin}%</td>
              </tr>
            </tbody>
          </table>
        </div>
      `;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // LEARNERS
  // ─────────────────────────────────────────────────────────────────────────────
  function loadLearners(filterSection, filterClass, searchQuery) {
    const secEl = document.getElementById("filter-section");
    const clsEl = document.getElementById("filter-class");
    const qEl   = document.getElementById("search-student");

    if (filterSection === undefined || filterSection === null) filterSection = secEl ? secEl.value : "";
    if (filterClass === undefined || filterClass === null)     filterClass   = clsEl ? clsEl.value : "";
    if (searchQuery === undefined || searchQuery === null)     searchQuery   = qEl ? qEl.value : "";

    filterSection = (filterSection || "").trim();
    filterClass   = (filterClass || "").trim();
    searchQuery   = (searchQuery || "").trim();

    if (secEl && secEl.value !== filterSection) secEl.value = filterSection;
    if (clsEl && clsEl.value !== filterClass)   clsEl.value = filterClass;
    if (qEl && qEl.value !== searchQuery)       qEl.value = searchQuery;

    let students = OJSchoolsDB.getStudents() || [];

    if (filterSection) {
      students = students.filter(s => {
        const sSec = s.section || (getSectionByClass(s.currentClass) ? getSectionByClass(s.currentClass).id : "primary");
        return sSec === filterSection;
      });
    }
    if (filterClass) {
      const targetCls = filterClass.toLowerCase();
      students = students.filter(s => (s.currentClass || "").trim().toLowerCase() === targetCls);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      students = students.filter(s =>
        `${s.firstName || ""} ${s.lastName || ""}`.toLowerCase().includes(q) ||
        (s.regNo || "").toLowerCase().includes(q) ||
        (s.currentClass || "").toLowerCase().includes(q)
      );
    }

    const countBadge = document.getElementById("learners-count-badge");
    if (countBadge) {
      const clsText = filterClass ? " (" + filterClass + ")" : (filterSection ? " (" + filterSection.toUpperCase() + ")" : "");
      countBadge.textContent = students.length + " Learner" + (students.length !== 1 ? "s" : "") + clsText;
    }

    const tbody = document.getElementById("learners-tbody");
    if (!tbody) return;

    if (students.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" class="empty-cell"><i class="fas fa-users-slash" style="margin-right:8px;opacity:.4"></i>No learners found.</td></tr>`;
      return;
    }

// Pre-index student payments for blazing fast O(1) row generation
    const dbData = OJSchoolsDB.get();
    const paysByStu = new Map();
    (dbData.payments || []).forEach(p => {
      if (!p.studentId) return;
      if (!paysByStu.has(p.studentId)) paysByStu.set(p.studentId, []);
      paysByStu.get(p.studentId).push(p);
    });

    tbody.innerHTML = students.map(s => {
      const sec  = getSectionByClass(s.currentClass) || SCHOOL_SECTIONS.primary;
      const pays = paysByStu.get(s.id) || [];
      let totalPaid = 0, arrearsPaid = 0, termFeePaid = 0, otherFeesPaid = 0;
      for (let pi = 0; pi < pays.length; pi++) {
        const p = pays[pi];
        totalPaid     += Number(p.amount)          || 0;
        arrearsPaid   += Number(p.arrearsDeducted) || 0;
        termFeePaid   += Number(p.termFeePaid)     || 0;
        otherFeesPaid += Number(p.otherFeesPaid)   || 0;
      }
      const openingArrears = Number(s.arrears) || 0;
      const termFee        = Number(s.termFee) || 0;
      const arrearsRemaining = Math.max(0, openingArrears - arrearsPaid);
      const termFeeRemaining = Math.max(0, termFee - (termFeePaid + otherFeesPaid));
      const outstanding      = arrearsRemaining + termFeeRemaining;
      const bal = {
        student: s, termFee, openingArrears,
        arrearsPaid, arrearsRemaining,
        termFeePaid, termFeeRemaining,
        otherFeesPaid, totalPaid, totalOutstanding: outstanding,
        isCleared: outstanding <= 0 || s.clearanceStatus === "Cleared"
      };
      const statusBadge = s.status === "Active"
        ? `<span class="badge badge-active">Active</span>`
        : `<span class="badge badge-inactive">${s.status || "Unknown"}</span>`;

      const sectionBadge = `<span class="badge-pill ${sec.badgeClass}">${sec.name}</span>`;

      return `
        <tr>
          <td>
            <div class="student-name-cell">
              <div class="student-avatar">${(s.firstName || "?")[0]}${(s.lastName || "?")[0]}</div>
              <div>
                <div class="student-fullname">${s.firstName || ""} ${s.lastName || ""}</div>
                <div class="student-regno">${s.regNo || ""}</div>
              </div>
            </div>
          </td>
          <td><span class="badge badge-pill" style="cursor:pointer;background:var(--gray-100);color:var(--gray-800);border:1px solid var(--gray-200);transition:all .15s" onclick="OJSchoolsApp.viewClassStudents('${s.currentClass}')" title="Filter learners by ${s.currentClass}">${s.currentClass || "—"}</span></td>
          <td>${sectionBadge}</td>
          <td>${statusBadge}</td>
          <td class="amount-cell">${currency(bal ? bal.termFee : 0)}</td>
          <td class="amount-cell">${currency(bal ? bal.totalPaid : 0)}</td>
          <td class="amount-cell" style="color:${outstanding > 0 ? "#dc2626" : "#059669"};font-weight:700">
            ${outstanding > 0 ? currency(outstanding) : '✓ Cleared'}
          </td>
          <td>
            <button class="btn-icon" title="View Profile" onclick="OJSchoolsApp.openStudentProfile('${s.id}')"><i class="fas fa-eye"></i></button>
            <button class="btn-icon" title="Record Payment" onclick="OJSchoolsApp.openAddPaymentModal('${s.id}')"><i class="fas fa-receipt"></i></button>
            <button class="btn-icon" title="Edit Student" onclick="OJSchoolsApp.openEnrollModal('${s.id}')"><i class="fas fa-pen"></i></button>
            <button class="btn-icon btn-danger" title="Delete Student" onclick="OJSchoolsApp.deleteStudent('${s.id}')"><i class="fas fa-trash"></i></button>
          </td>
        </tr>
      `;
    }).join("");
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // CLASS HUB
  // ─────────────────────────────────────────────────────────────────────────────
  function loadClassHub() {
    const container = document.getElementById("class-hub-container");
    if (!container) return;

    const students = OJSchoolsDB.getStudents();
    const sections = ["primary", "junior", "senior", "tutorial"];
    const sectionColors = {
      primary:  { color: "#059669", light: "#d1fae5" },
      junior:   { color: "#2563eb", light: "#dbeafe" },
      senior:   { color: "#7c3aed", light: "#ede9fe" },
      tutorial: { color: "#ea580c", light: "#ffedd5" }
    };

    // Only show sections that have classes configured
    const activeSections = sections.filter(secId => {
      const sec = SCHOOL_SECTIONS[secId];
      return sec && sec.classes && sec.classes.length > 0;
    });

    container.innerHTML = activeSections.map(secId => {
      const sec   = SCHOOL_SECTIONS[secId];
      const style = sectionColors[secId];

      const classCards = sec.classes.map(cls => {
        const clsStudents = students.filter(s => s.currentClass === cls);
        const totalPaid   = clsStudents.reduce((acc, s) => {
          const bal = OJSchoolsDB.getStudentBalance(s.id);
          return acc + (bal ? bal.totalPaid : 0);
        }, 0);
        const debtors = clsStudents.filter(s => {
          const bal = OJSchoolsDB.getStudentBalance(s.id);
          return bal && bal.totalOutstanding > 0;
        }).length;

        const defaultTuition = getClassDefaultTuition(cls);

        return `
          <div class="class-card">
            <div class="class-card-header">
              <div class="class-name">${cls}</div>
              <div class="class-badge" style="background:${style.light};color:${style.color}">${clsStudents.length}</div>
            </div>
            <div class="class-card-stats">
              <div class="stat-item"><i class="fas fa-users" style="color:${style.color}"></i> ${clsStudents.length} learner${clsStudents.length !== 1 ? "s" : ""}</div>
              <div class="stat-item"><i class="fas fa-exclamation-circle" style="color:#dc2626"></i> ${debtors} debtor${debtors !== 1 ? "s" : ""}</div>
            </div>
            ${defaultTuition > 0 ? `<div style="font-size:11px;color:var(--gray-400);margin-bottom:6px">Tariff: <strong>${currency(defaultTuition)}</strong>/term</div>` : ""}
            <div class="class-card-revenue">Revenue: <strong>${currency(totalPaid)}</strong></div>
            <button class="btn-primary btn-sm btn-full" style="margin-top:10px;background:${style.color}" onclick="OJSchoolsApp.viewClassStudents('${cls}')">
              <i class="fas fa-list"></i> View Students
            </button>
          </div>
        `;
      }).join("");

      return `
        <div class="section-group">
          <div class="section-header" style="border-left:4px solid ${style.color};padding-left:12px">
            <h3><i class="${sec.icon}" style="color:${style.color}"></i> ${sec.name}</h3>
          </div>
          <div class="class-cards-grid">${classCards}</div>
        </div>
      `;
    }).join("");
  }

  function viewClassStudents(className) {
    if (!className) return;
    const sec = (typeof getSectionByClass === "function") ? getSectionByClass(className) : null;
    const secId = sec ? sec.id : "";

    const filterSection = document.getElementById("filter-section");
    if (filterSection) filterSection.value = secId;

    updateFilterClassOptions("filter-class", secId);

    const filterClassSel = document.getElementById("filter-class");
    if (filterClassSel) filterClassSel.value = className;

    const searchInput = document.getElementById("search-student");
    if (searchInput) searchInput.value = "";

    switchTab("learners", { skipLoad: true });
    loadLearners(secId, className, "");
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // CLEARANCE
  // ─────────────────────────────────────────────────────────────────────────────
  function loadClearance(filterSection) {
    const clearEl = document.getElementById("clear-filter-section");
    if (filterSection === undefined || filterSection === null) filterSection = clearEl ? clearEl.value : "";
    filterSection = (filterSection || "").trim();
    if (clearEl && clearEl.value !== filterSection) clearEl.value = filterSection;

    let students = OJSchoolsDB.getStudents();

    if (filterSection) {
      students = students.filter(s =>
        (s.section || (getSectionByClass(s.currentClass) ? getSectionByClass(s.currentClass).id : "primary")) === filterSection
      );
    }

    const tbody = document.getElementById("clearance-tbody");
    if (!tbody) return;

    if (students.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="empty-cell">No learners found.</td></tr>`;
      return;
    }

    tbody.innerHTML = students.map(s => {
      const bal     = OJSchoolsDB.getStudentBalance(s.id);
      const cleared = s.clearanceStatus === "Cleared";
      const outstanding = bal ? bal.totalOutstanding : 0;
      const sec  = getSectionByClass(s.currentClass) || SCHOOL_SECTIONS.primary;

      return `
        <tr>
          <td>
            <div class="student-name-cell">
              <div class="student-avatar">${(s.firstName || "?")[0]}${(s.lastName || "?")[0]}</div>
              <div>
                <div class="student-fullname">${s.firstName || ""} ${s.lastName || ""}</div>
                <div class="student-regno">${s.regNo || ""}</div>
              </div>
            </div>
          </td>
          <td>${s.currentClass || "—"}</td>
          <td><span class="badge-pill ${sec.badgeClass}">${sec.name}</span></td>
          <td class="amount-cell" style="color:${outstanding > 0 ? "#dc2626" : "#059669"};font-weight:700">
            ${outstanding > 0 ? currency(outstanding) : "₦0.00 — Settled"}
          </td>
          <td>
            ${cleared
              ? `<span class="badge badge-active"><i class="fas fa-check-circle"></i> Cleared</span>`
              : `<span class="badge badge-inactive"><i class="fas fa-clock"></i> Pending</span>`}
          </td>
          <td>
            <button class="btn-primary btn-sm" style="${cleared ? "background:#dc2626" : "background:#059669"}"
              onclick="OJSchoolsApp.toggleClearance('${s.id}')">
              ${cleared ? "Revoke" : "Grant Clearance"}
            </button>
          </td>
          <td>
            <button class="btn-secondary btn-sm" onclick="OJSchoolsApp.printClearancePass('${s.id}')" ${!cleared ? "disabled title='Grant clearance first'" : ""}>
              <i class="fas fa-print"></i> Print Pass
            </button>
          </td>
        </tr>
      `;
    }).join("");
  }

  function toggleClearance(studentId) {
    const updated = OJSchoolsDB.toggleClearanceStatus(studentId);
    if (updated) {
      showToast(`${updated.firstName} ${updated.lastName} clearance: ${updated.clearanceStatus}`,
        updated.clearanceStatus === "Cleared" ? "success" : "warning");
      loadClearance();
    }
  }

  function printClearancePass(studentId) {
    if (window.OJSchoolsReports && typeof OJSchoolsReports.printClearancePass === "function") {
      OJSchoolsReports.printClearancePass(studentId);
    } else {
      showToast("Reports module not loaded.", "error");
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PAYMENTS
  // ─────────────────────────────────────────────────────────────────────────────
  function loadPayments(filterSection, filterClass, searchQuery) {
    const secEl = document.getElementById("pay-filter-section");
    const clsEl = document.getElementById("pay-filter-class");
    const qEl   = document.getElementById("pay-search");

    if (filterSection === undefined || filterSection === null) filterSection = secEl ? secEl.value : "";
    if (filterClass === undefined || filterClass === null)     filterClass   = clsEl ? clsEl.value : "";
    if (searchQuery === undefined || searchQuery === null)     searchQuery   = qEl ? qEl.value : "";

    filterSection = (filterSection || "").trim();
    filterClass   = (filterClass || "").trim();
    searchQuery   = (searchQuery || "").trim();

    if (secEl && secEl.value !== filterSection) secEl.value = filterSection;
    if (clsEl && clsEl.value !== filterClass)   clsEl.value = filterClass;
    if (qEl && qEl.value !== searchQuery)       qEl.value = searchQuery;

    let payments = OJSchoolsDB.getPayments() || [];

    if (filterSection) {
      payments = payments.filter(p => {
        const sec = p.section || (getSectionByClass(p.studentClass) ? getSectionByClass(p.studentClass).id : "");
        return sec === filterSection;
      });
    }
    if (filterClass) {
      const targetCls = filterClass.toLowerCase();
      payments = payments.filter(p => (p.studentClass || "").trim().toLowerCase() === targetCls);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      payments = payments.filter(p =>
        (p.studentName || "").toLowerCase().includes(q) ||
        (p.receiptNumber || "").toLowerCase().includes(q) ||
        (p.studentRegNo || "").toLowerCase().includes(q) ||
        (p.studentClass || "").toLowerCase().includes(q)
      );
    }

    const tbody = document.getElementById("payments-tbody");
    if (!tbody) return;

    if (payments.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" class="empty-cell"><i class="fas fa-receipt" style="margin-right:8px;opacity:.4"></i>No payment records found.</td></tr>`;
      return;
    }

    tbody.innerHTML = payments.map(p => {
      const sec = p.section ? SCHOOL_SECTIONS[p.section] : getSectionByClass(p.studentClass);
      const sectionBadge = sec ? `<span class="badge-pill ${sec.badgeClass}">${sec.name}</span>` : "";
      const arrearsDeducted = Number(p.arrearsDeducted) || 0;
      const itemsCount = Array.isArray(p.items) && p.items.length ? `<span style="font-size:10px;background:#e2e8f0;padding:2px 6px;border-radius:10px;margin-left:4px">${p.items.length} items</span>` : "";

      return `
        <tr>
          <td><span class="receipt-no">${p.receiptNumber || p.id}</span></td>
          <td>${p.studentName || "—"}<br><small style="color:var(--gray-400)">${p.studentRegNo || ""}</small></td>
          <td>${p.studentClass || "—"}</td>
          <td>${sectionBadge}</td>
          <td>${p.date || "—"}</td>
          <td class="amount-cell"><strong>${currency(p.amount)}</strong> ${itemsCount}
            ${arrearsDeducted > 0 ? `<br><small style="color:#b45309">Arrears: ${currency(arrearsDeducted)}</small>` : ""}
          </td>
          <td>${p.method || "Cash"}</td>
          <td>
            <button class="btn-icon" title="Print Receipt" onclick="OJSchoolsApp.printReceipt('${p.id}')"><i class="fas fa-print"></i></button>
            <button class="btn-icon btn-danger" title="Void Payment" onclick="OJSchoolsApp.deletePayment('${p.id}')"><i class="fas fa-trash"></i></button>
          </td>
        </tr>
      `;
    }).join("");
  }

  function deletePayment(paymentId) {
    if (!confirm("Void this payment record? This action cannot be undone.")) return;
    const ok = OJSchoolsDB.deletePayment(paymentId);
    if (ok) {
      showToast("Payment record voided successfully.", "success");
      loadPayments();
      loadDashboard();
    } else {
      showToast("Payment not found.", "error");
    }
  }

  function printReceipt(paymentId) {
    if (window.OJSchoolsReports && typeof OJSchoolsReports.printReceipt === "function") {
      OJSchoolsReports.printReceipt(paymentId);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // DEBTORS
  // ─────────────────────────────────────────────────────────────────────────────
  function loadDebtors(filterSection, searchQuery, filterClass) {
    const secEl = document.getElementById("debtors-filter-section");
    const clsEl = document.getElementById("debtors-filter-class");
    const qEl   = document.getElementById("debtors-search");

    if (filterSection === undefined || filterSection === null) filterSection = secEl ? secEl.value : "";
    if (searchQuery === undefined || searchQuery === null)     searchQuery   = qEl ? qEl.value : "";
    if (filterClass === undefined || filterClass === null)     filterClass   = clsEl ? clsEl.value : "";

    filterSection = (filterSection || "").trim();
    filterClass   = (filterClass || "").trim();
    searchQuery   = (searchQuery || "").trim();

    if (secEl && secEl.value !== filterSection) secEl.value = filterSection;
    if (clsEl && clsEl.value !== filterClass)   clsEl.value = filterClass;
    if (qEl && qEl.value !== searchQuery)       qEl.value = searchQuery;

    let debtors = OJSchoolsDB.getDebtors(filterSection || "all");

    if (filterClass) {
      const targetCls = filterClass.toLowerCase();
      debtors = debtors.filter(d => (d.student.currentClass || "").trim().toLowerCase() === targetCls);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      debtors = debtors.filter(d =>
        `${d.student.firstName} ${d.student.lastName}`.toLowerCase().includes(q) ||
        (d.student.regNo || "").toLowerCase().includes(q) ||
        (d.student.currentClass || "").toLowerCase().includes(q)
      );
    }

    const tbody = document.getElementById("debtors-tbody");
    if (!tbody) return;

    const summary = OJSchoolsDB.getFinancialSummary(filterSection || "all");
    const countEl = document.getElementById("debtors-total-count");
    const totalEl = document.getElementById("debtors-total-sum");
    if (countEl) countEl.textContent = debtors.length;
    if (totalEl) totalEl.textContent = currency(summary.totalOutstandingDebt);

    if (debtors.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" class="empty-cell" style="color:#059669"><i class="fas fa-circle-check" style="margin-right:8px"></i>No debtors found in this category. Excellent!</td></tr>`;
      return;
    }

    tbody.innerHTML = debtors.map(d => {
      const s = d.student;
      const b = d.balance;
      const sec = getSectionByClass(s.currentClass) || SCHOOL_SECTIONS.primary;

      return `
        <tr>
          <td>
            <div class="student-name-cell">
              <div class="student-avatar" style="background:#fee2e2;color:#dc2626">${(s.firstName || "?")[0]}${(s.lastName || "?")[0]}</div>
              <div>
                <div class="student-fullname">${s.firstName || ""} ${s.lastName || ""}</div>
                <div class="student-regno">${s.regNo || ""} &bull; ${s.parentPhone || "No phone"}</div>
              </div>
            </div>
          </td>
          <td>${s.currentClass || "—"}</td>
          <td><span class="badge-pill ${sec.badgeClass}">${sec.name}</span></td>
          <td class="amount-cell">${currency(b.termFee)}</td>
          <td class="amount-cell" style="color:#b45309">${currency(b.arrearsRemaining)}</td>
          <td class="amount-cell" style="color:#059669">${currency(b.totalPaid)}</td>
          <td class="amount-cell" style="color:#dc2626;font-weight:800">${currency(b.totalOutstanding)}</td>
          <td>
            <button class="btn-primary btn-emerald btn-sm" onclick="OJSchoolsApp.openAddPaymentModal('${s.id}')">
              <i class="fas fa-receipt"></i> Pay
            </button>
            <button class="btn-icon" title="View Profile" onclick="OJSchoolsApp.openStudentProfile('${s.id}')">
              <i class="fas fa-eye"></i>
            </button>
          </td>
          <td>
            <button class="btn-icon" style="background:#fef3c7;color:#92400e" title="Print Demand Notice" onclick="OJSchoolsReports.printReminderNotice('${s.id}')">
              <i class="fas fa-envelope-open-text"></i>
            </button>
          </td>
        </tr>
      `;
    }).join("");
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // AUDIT LOGS
  // ─────────────────────────────────────────────────────────────────────────────
  function loadAuditLogs(searchQuery = "") {
    let logs = OJSchoolsDB.getAuditLogs();

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      logs = logs.filter(l =>
        (l.action || "").toLowerCase().includes(q) ||
        (l.user || "").toLowerCase().includes(q) ||
        (l.details || "").toLowerCase().includes(q)
      );
    }

    const tbody = document.getElementById("audit-logs-tbody");
    if (!tbody) return;

    if (logs.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" class="empty-cell">No audit log records found.</td></tr>`;
      return;
    }

    const actionColors = {
      RECORD_PAYMENT: "#059669",
      DELETE_PAYMENT: "#dc2626",
      ENROLL_STUDENT: "#2563eb",
      UPDATE_STUDENT: "#7c3aed",
      DELETE_STUDENT: "#dc2626",
      LOG_EXPENSE:    "#d97706",
      DELETE_EXPENSE: "#dc2626",
      TOGGLE_CLEARANCE: "#059669",
      CONFIG_UPDATE:  "#0a192f"
    };

    tbody.innerHTML = logs.map(l => {
      const color = actionColors[l.action] || "#475569";
      return `
        <tr>
          <td style="font-size:11px;color:var(--gray-500);white-space:nowrap">${l.date || new Date(l.timestamp).toLocaleString("en-GB")}</td>
          <td><strong>${l.user || "System"}</strong></td>
          <td><span style="display:inline-block;padding:2px 8px;border-radius:6px;font-size:10px;font-weight:700;background:#f1f5f9;color:${color}">${l.action}</span></td>
          <td style="font-size:12px;color:var(--gray-700)">${l.details || "—"}</td>
        </tr>
      `;
    }).join("");
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // SETTINGS
  // ─────────────────────────────────────────────────────────────────────────────
  function loadSettings() {
    const config = OJSchoolsDB.getConfig();

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ""; };
    set("cfg-school-name",  config.schoolName);
    set("cfg-motto",        config.motto);
    set("cfg-address",      config.address);
    set("cfg-email",        config.contactEmail);
    set("cfg-phone",        config.phone);
    set("cfg-session",      config.currentSession);
    set("cfg-term",         config.currentTerm);
    set("cfg-currency",     config.currency);

    renderFeeScheduleMatrix();
  }

  function saveSettings() {
    const get = id => document.getElementById(id)?.value?.trim() || "";

    const partial = {
      schoolName:     get("cfg-school-name") || "OJ SCHOOLS",
      motto:          get("cfg-motto"),
      address:        get("cfg-address"),
      contactEmail:   get("cfg-email"),
      phone:          get("cfg-phone"),
      currentSession: get("cfg-session") || "2026/2027",
      currentTerm:    get("cfg-term") || "1st Term",
      currency:       get("cfg-currency") || "\u20a6"
    };

    OJSchoolsDB.updateConfig(partial);
    showToast("School settings updated successfully.", "success");
    loadDashboard();
  }

  function renderFeeScheduleMatrix() {
    const container = document.getElementById("settings-fee-matrix");
    if (!container) return;

    const sections = ["primary", "junior", "senior", "tutorial"].filter(secId => {
      const sec = SCHOOL_SECTIONS[secId];
      return sec && sec.classes && sec.classes.length > 0;
    });
    const sectionNames = {
      primary:  "Primary Section (Creche, KG 1 & 2, Nursery 1–5)",
      junior:   "Junior Secondary (JSS 1–3)",
      senior:   "Senior Secondary (SSS 1–3)"
    };

    let html = "";
    sections.forEach(secId => {
      const sec = SCHOOL_SECTIONS[secId];
      html += `
        <div style="margin-bottom:20px">
          <h4 style="font-size:14px;font-weight:800;color:${sec.color};margin-bottom:8px">
            <i class="${sec.icon}"></i> ${sectionNames[secId] || sec.name}
          </h4>
          <div class="table-wrap">
            <table style="font-size:12px">
              <thead>
                <tr>
                  <th>Class</th>
                  <th style="text-align:right">Tuition</th>
                  <th style="text-align:right">Uniform</th>
                  <th style="text-align:right">Sportwear</th>
                  <th style="text-align:right">Report Card</th>
                  <th style="text-align:right">CA</th>
                  <th style="text-align:right">CBT / Exams</th>
                  <th style="text-align:right">Exam Registration</th>
                </tr>
              </thead>
              <tbody>
      `;

      sec.classes.forEach(cls => {
        const sch = CLASS_FEE_SCHEDULES[cls] || {};
        const examReg = sch.waec_registration
          ? `WAEC: ₦${formatAmount(sch.waec_registration)}<br>JAMB: ₦${formatAmount(sch.jamb_registration || 0)}`
          : sch.bece_registration
          ? `BECE: ₦${formatAmount(sch.bece_registration)}`
          : "—";

        html += `
          <tr>
            <td><strong>${cls}</strong></td>
            <td style="text-align:right;font-weight:700;color:#059669">${sch.tuition ? currency(sch.tuition) : "—"}</td>
            <td style="text-align:right">${sch.uniform ? currency(sch.uniform) : "—"}</td>
            <td style="text-align:right">${sch.sport_wear ? currency(sch.sport_wear) : "—"}</td>
            <td style="text-align:right">${sch.report_card ? currency(sch.report_card) : "—"}</td>
            <td style="text-align:right">${sch.continuous_assessment ? currency(sch.continuous_assessment) : "—"}</td>
            <td style="text-align:right">${sch.cbt_exams ? currency(sch.cbt_exams) : "—"}</td>
            <td style="text-align:right;font-size:11px">${examReg}</td>
          </tr>
        `;
      });

      html += `
              </tbody>
            </table>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // EXPENSES
  // ─────────────────────────────────────────────────────────────────────────────
  function loadExpenses(filterAccount = "", filterPeriod = "") {
    let expenses = OJSchoolsDB.getExpenses();

    if (filterAccount) expenses = expenses.filter(e => e.account === filterAccount);
    if (filterPeriod)  expenses = expenses.filter(e => e.period  === filterPeriod);

    const tbody = document.getElementById("expenses-tbody");
    if (!tbody) return;

    if (expenses.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="empty-cell"><i class="fas fa-file-invoice-dollar" style="margin-right:8px;opacity:.4"></i>No expenses recorded.</td></tr>`;
      return;
    }

    const periodColors = {
      daily:    "#dbeafe", monthly: "#fef3c7", weekly: "#dcfce7",
      termly:   "#ede9fe", session: "#fee2e2", one_time: "#f1f5f9"
    };

    tbody.innerHTML = expenses.map(e => {
      const acc  = EXPENSE_ACCOUNTS.find(a => a.id === e.account);
      const pCol = periodColors[e.period] || "#f1f5f9";

      return `
        <tr>
          <td>${e.date || "—"}</td>
          <td><strong>${e.title || "—"}</strong>${e.notes ? `<br><small style="color:var(--gray-400)">${e.notes}</small>` : ""}</td>
          <td>${acc ? `<span style="color:${acc.color}"><i class="${acc.icon}"></i> ${acc.name}</span>` : e.account}</td>
          <td><span style="background:${pCol};padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700">${(e.period || "").replace("_", " ").toUpperCase()}</span></td>
          <td class="amount-cell"><strong>${currency(e.amount)}</strong></td>
          <td>${e.method || "Cash"}</td>
          <td>
            <button class="btn-icon btn-danger" title="Delete Expense" onclick="OJSchoolsApp.deleteExpense('${e.id}')"><i class="fas fa-trash"></i></button>
          </td>
        </tr>
      `;
    }).join("");
  }

  function deleteExpense(expenseId) {
    if (!confirm("Delete this expense record? This cannot be undone.")) return;
    const ok = OJSchoolsDB.deleteExpense(expenseId);
    if (ok) {
      showToast("Expense deleted.", "success");
      loadExpenses();
      loadDashboard();
    } else {
      showToast("Expense not found.", "error");
    }
  }

  function loadReports() {
    // Buttons are trigger-based
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // MODALS — ENROLL STUDENT
  // ─────────────────────────────────────────────────────────────────────────────
  function openEnrollModal(studentId = null) {
    const form   = document.getElementById("enroll-form");
    const title  = document.getElementById("enroll-modal-title");
    const editId = document.getElementById("enroll-edit-id");

    if (form) form.reset();
    if (editId) editId.value = "";

    populateClassDropdowns();

    const helperEl = document.getElementById("enroll-fee-helper");
    if (helperEl) helperEl.textContent = "";

    if (studentId) {
      const stu = OJSchoolsDB.getStudentById(studentId);
      if (!stu) return;
      if (title) title.textContent = "Edit Learner Record";
      if (editId) editId.value = stu.id;

      const fields = {
        "enroll-firstname":   stu.firstName,
        "enroll-lastname":    stu.lastName,
        "enroll-regno":       stu.regNo,
        "enroll-gender":      stu.gender,
        "enroll-dob":         stu.dob,
        "enroll-class":       stu.currentClass,
        "enroll-status":      stu.status || "Active",
        "enroll-term-fee":    formatAmount(stu.termFee),
        "enroll-arrears":     formatAmount(stu.arrears),
        "enroll-parent-name": stu.parentName,
        "enroll-parent-phone":stu.parentPhone,
        "enroll-parent-email":stu.parentEmail,
        "enroll-address":     stu.address
      };
      for (const [id, val] of Object.entries(fields)) {
        const el = document.getElementById(id);
        if (el && val !== undefined && val !== null) el.value = val;
      }
    } else {
      if (title) title.textContent = "Enroll New Learner";
      const regEl = document.getElementById("enroll-regno");
      if (regEl) regEl.value = "OJS-" + Date.now().toString().slice(-6);
    }

    openModal("modal-enroll");
  }

  function onEnrollClassChange() {
    const clsSelect = document.getElementById("enroll-class");
    const feeInput  = document.getElementById("enroll-term-fee");
    const helper    = document.getElementById("enroll-fee-helper");
    if (!clsSelect || !feeInput) return;

    const cls = clsSelect.value;
    if (!cls) {
      if (helper) helper.textContent = "";
      return;
    }

    const defaultTuition = getClassDefaultTuition(cls);
    if (defaultTuition > 0 && !feeInput.value) {
      feeInput.value = formatAmount(defaultTuition);
    }
    if (helper) {
      helper.textContent = defaultTuition > 0
        ? `💡 Suggested termly tuition for ${cls}: ${currency(defaultTuition)}`
        : "";
    }
  }

  function saveEnrollment(e) {
    if (e && typeof e.preventDefault === "function") e.preventDefault();
    const editId = document.getElementById("enroll-edit-id")?.value;
    const get    = id => document.getElementById(id)?.value?.trim() || "";

    const firstName = get("enroll-firstname");
    const lastName  = get("enroll-lastname");
    const regNo     = get("enroll-regno");
    const cls       = get("enroll-class");

    if (!firstName || !lastName || !regNo || !cls) {
      showToast("Please fill in all required fields (Name, Reg No, Class).", "error");
      return;
    }

    const termFee = parseAmount(get("enroll-term-fee"));
    const arrears = parseAmount(get("enroll-arrears"));
    const section = (getSectionByClass(cls) || SCHOOL_SECTIONS.primary).id;

    const studentData = {
      id:          editId || undefined,
      firstName, lastName, regNo,
      gender:      get("enroll-gender"),
      dob:         get("enroll-dob"),
      currentClass: cls,
      section,
      status:      get("enroll-status") || "Active",
      termFee,
      arrears,
      parentName:  get("enroll-parent-name"),
      parentPhone: get("enroll-parent-phone"),
      parentEmail: get("enroll-parent-email"),
      address:     get("enroll-address"),
      enrolledDate: get("enroll-enrolled-date") || new Date().toISOString().split("T")[0]
    };

    try {
      OJSchoolsDB.saveStudent(studentData);
      const modal = document.getElementById("modal-enroll");
      if (modal) modal.classList.add("hidden");
      showToast(`${firstName} ${lastName} ${editId ? "updated" : "enrolled"} successfully.`, "success");
      loadLearners();
      loadDashboard();
    } catch (err) {
      showToast(err.message || "Failed to save learner.", "error");
    }
  }

  function deleteStudent(studentId) {
    const stu = OJSchoolsDB.getStudentById(studentId);
    if (!stu) return;
    if (!confirm(`Delete ${stu.firstName} ${stu.lastName} and all associated payment records? This cannot be undone.`)) return;
    OJSchoolsDB.deleteStudent(studentId);
    showToast("Learner deleted.", "success");
    loadLearners();
    loadDashboard();
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // MODALS — MULTI-ITEM PAYMENT
  // ─────────────────────────────────────────────────────────────────────────────
  function openAddPaymentModal(studentId = null) {
    const form = document.getElementById("payment-form");
    if (form) form.reset();

    activePaymentItems = [];

    const stuSelect = document.getElementById("pay-student");
    if (stuSelect) {
      const students = OJSchoolsDB.getStudents().filter(s => s.status === "Active" || !s.status);
      stuSelect.innerHTML = '<option value="">-- Select Student --</option>' +
        students.map(s => {
          const bal = OJSchoolsDB.getStudentBalance(s.id);
          const outstanding = bal ? bal.totalOutstanding : 0;
          return `<option value="${s.id}" data-class="${s.currentClass}" data-outstanding="${outstanding}">
            ${s.firstName} ${s.lastName} — ${s.currentClass} ${outstanding > 0 ? "⚠️ (" + currency(outstanding) + ")" : "✓"}
          </option>`;
        }).join("");

      if (studentId) {
        stuSelect.value = studentId;
      }
    }

    const dateEl = document.getElementById("pay-date");
    if (dateEl) dateEl.value = new Date().toISOString().split("T")[0];

    onPaymentStudentChange();
    openModal("modal-payment");
  }

  function onPaymentStudentChange() {
    const stuSelect = document.getElementById("pay-student");
    const stuId     = stuSelect?.value;
    const infoEl    = document.getElementById("pay-outstanding-info");
    const quickBtn  = document.getElementById("pay-load-defaults-btn");

    if (!stuId) {
      if (infoEl) {
        infoEl.innerHTML = `Please select a student to see outstanding balance and class fee schedules.`;
        infoEl.style.background = "var(--gray-50)";
        infoEl.style.color = "var(--gray-500)";
      }
      activePaymentItems = [];
      renderPaymentItemsTable();
      return;
    }

    const student = OJSchoolsDB.getStudentById(stuId);
    const bal     = OJSchoolsDB.getStudentBalance(stuId);
    if (!student || !bal) return;

    const outstanding = bal.totalOutstanding;
    if (infoEl) {
      infoEl.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px">
          <div>
            <strong>${student.firstName} ${student.lastName}</strong> &bull; ${student.currentClass}
            <br>
            <span style="font-size:11px">Opening Arrears Remaining: <strong>${currency(bal.arrearsRemaining)}</strong> | Term Fee Remaining: <strong>${currency(bal.termFeeRemaining)}</strong></span>
          </div>
          <div style="font-size:14px;font-weight:900;color:${outstanding > 0 ? "#dc2626" : "#059669"}">
            ${outstanding > 0 ? "Total Due: " + currency(outstanding) : "✓ All Fees Cleared"}
          </div>
        </div>
      `;
      infoEl.style.background = outstanding > 0 ? "#fff3cd" : "#d1fae5";
      infoEl.style.color = outstanding > 0 ? "#92400e" : "#047857";
    }

    // Auto load default fees for this class if items empty
    if (activePaymentItems.length === 0) {
      loadClassDefaultItems(student.currentClass);
    } else {
      renderPaymentItemsTable();
    }
  }

  function loadClassDefaultItems(className) {
    const feeItems = getClassFeeItems(className);
    if (feeItems && feeItems.length > 0) {
      activePaymentItems = feeItems.map(f => ({
        id:          f.id,
        category:    f.id,
        name:        f.name,
        description: "",
        amount:      f.defaultAmount
      }));
    } else {
      // Fallback single item
      activePaymentItems = [
        { id: "tuition", category: "tuition", name: "Tuition / School Fees", description: "", amount: 0 }
      ];
    }
    renderPaymentItemsTable();
  }

  function addPaymentItemRow() {
    activePaymentItems.push({
      id:          "tuition",
      category:    "tuition",
      name:        "Tuition / School Fees (Termly)",
      description: "",
      amount:      0
    });
    renderPaymentItemsTable();
  }

  function removePaymentItemRow(index) {
    activePaymentItems.splice(index, 1);
    renderPaymentItemsTable();
  }

  function updatePaymentItemField(index, field, value) {
    if (!activePaymentItems[index]) return;
    if (field === "category") {
      activePaymentItems[index].category = value;
      activePaymentItems[index].id       = value;
      const cat = FEE_CATEGORIES.find(c => c.id === value);
      activePaymentItems[index].name     = cat ? cat.name : value;
    } else if (field === "amount") {
      activePaymentItems[index].amount   = parseAmount(value);
    } else {
      activePaymentItems[index][field]   = value;
    }
    recalculatePaymentSummary();
  }

  function renderPaymentItemsTable() {
    const tbody = document.getElementById("pay-items-tbody");
    if (!tbody) return;

    if (activePaymentItems.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:16px;color:var(--gray-400)">No fee items added yet. Click "+ Add Line Item" or "Load Class Tariff" above.</td></tr>`;
      recalculatePaymentSummary();
      return;
    }

    tbody.innerHTML = activePaymentItems.map((item, idx) => {
      const catOptions = FEE_CATEGORIES.map(c =>
        `<option value="${c.id}" ${c.id === (item.category || item.id) ? "selected" : ""}>${c.name}</option>`
      ).join("");

      return `
        <tr>
          <td style="width:40%">
            <select class="form-control" style="width:100%;font-size:12px;padding:6px 8px"
              onchange="OJSchoolsApp.updatePaymentItemField(${idx}, 'category', this.value)">
              ${catOptions}
            </select>
          </td>
          <td style="width:30%">
            <input type="text" class="form-control" style="width:100%;font-size:12px;padding:6px 8px"
              placeholder="e.g. 1st installment" value="${item.description || ""}"
              oninput="OJSchoolsApp.updatePaymentItemField(${idx}, 'description', this.value)">
          </td>
          <td style="width:25%">
            <input type="text" class="form-control pay-item-amount" style="width:100%;font-size:12px;padding:6px 8px;text-align:right;font-weight:700"
              value="${formatAmount(item.amount)}"
              onfocus="this.select()"
              oninput="OJSchoolsApp.onItemAmountInput(this, ${idx})">
          </td>
          <td style="width:5%;text-align:center">
            <button type="button" class="btn-icon btn-danger btn-sm" onclick="OJSchoolsApp.removePaymentItemRow(${idx})" title="Remove item">
              <i class="fas fa-trash"></i>
            </button>
          </td>
        </tr>
      `;
    }).join("");

    recalculatePaymentSummary();
  }

  function onItemAmountInput(inputEl, index) {
    let val = inputEl.value.replace(/[^0-9.]/g, "");
    const num = parseAmount(val);
    updatePaymentItemField(index, "amount", num);
  }

  function recalculatePaymentSummary() {
    const totalAmount = activePaymentItems.reduce((acc, it) => acc + (Number(it.amount) || 0), 0);

    const stuSelect = document.getElementById("pay-student");
    const stuId     = stuSelect?.value;
    const bal       = stuId ? OJSchoolsDB.getStudentBalance(stuId) : null;
    const arrearsRem = bal ? bal.arrearsRemaining : 0;

    let arrearsDeducted = 0;
    if (arrearsRem > 0) {
      arrearsDeducted = Math.min(totalAmount, arrearsRem);
    }
    const currentFeesApplied = totalAmount - arrearsDeducted;

    const totalEl   = document.getElementById("pay-summary-total");
    const arrEl     = document.getElementById("pay-summary-arrears");
    const currEl    = document.getElementById("pay-summary-current");

    if (totalEl) totalEl.textContent = currency(totalAmount);
    if (arrEl)   arrEl.textContent   = currency(arrearsDeducted);
    if (currEl)  currEl.textContent  = currency(currentFeesApplied);
  }

  function savePayment() {
    const studentId = document.getElementById("pay-student")?.value;
    const method    = document.getElementById("pay-method")?.value || "Cash";
    const date      = document.getElementById("pay-date")?.value || new Date().toISOString().split("T")[0];
    const recordedBy= document.getElementById("pay-recorded-by")?.value?.trim() || "Bursar";
    const notes     = document.getElementById("pay-notes")?.value?.trim() || "";

    if (!studentId) { showToast("Please select a student.", "error"); return; }

    const validItems = activePaymentItems.filter(it => (Number(it.amount) || 0) > 0);
    const totalAmount = validItems.reduce((acc, it) => acc + (Number(it.amount) || 0), 0);

    if (totalAmount <= 0) {
      showToast("Total payment amount must be greater than zero. Enter item amounts.", "error");
      return;
    }

    try {
      const paymentData = {
        studentId,
        amount: totalAmount,
        method,
        date,
        recordedBy,
        notes,
        items: validItems,
        category: validItems.length === 1 ? validItems[0].category : "multi_item",
        description: validItems.length === 1 ? validItems[0].name : `${validItems.length} fee items bundle`
      };

      const saved = OJSchoolsDB.savePayment(paymentData);
      const modal = document.getElementById("modal-payment");
      if (modal) modal.classList.add("hidden");

      showToast(`Payment of ${currency(totalAmount)} recorded! Receipt: ${saved.receiptNumber}`, "success", 5000);
      loadPayments();
      loadDashboard();
      if (currentTab === "debtors") loadDebtors();

      // Offer to print receipt immediately
      setTimeout(() => {
        if (confirm(`Payment recorded successfully!\nReceipt No: ${saved.receiptNumber}\n\nDo you want to print the receipt now?`)) {
          printReceipt(saved.id);
        }
      }, 300);

    } catch (err) {
      showToast(err.message || "Failed to record payment.", "error");
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // MODALS — EXPENSE
  // ─────────────────────────────────────────────────────────────────────────────
  function openExpenseModal() {
    const form = document.getElementById("expense-form");
    if (form) form.reset();
    const dateEl = document.getElementById("exp-date");
    if (dateEl) dateEl.value = new Date().toISOString().split("T")[0];
    openModal("modal-expense");
  }

  function saveExpense(e) {
    if (e && typeof e.preventDefault === "function") e.preventDefault();
    const title  = document.getElementById("exp-title")?.value?.trim() || "";
    const amount = parseAmount(document.getElementById("exp-amount")?.value || "0");
    const account= document.getElementById("exp-account")?.value || "general";
    const period = document.getElementById("exp-period")?.value  || "monthly";
    const method = document.getElementById("exp-method")?.value  || "Cash";
    const date   = document.getElementById("exp-date")?.value;
    const notes  = document.getElementById("exp-notes")?.value?.trim() || "";

    if (!title)     { showToast("Expense title is required.", "error"); return; }
    if (amount <= 0) { showToast("Amount must be greater than zero.", "error"); return; }

    OJSchoolsDB.saveExpense({ title, amount, account, period, method, date, notes });
    closeModal("modal-expense");
    showToast(`Expense "${title}" (${currency(amount)}) logged.`, "success");
    loadExpenses();
    loadDashboard();
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // STUDENT PROFILE MODAL
  // ─────────────────────────────────────────────────────────────────────────────
  function openStudentProfile(studentId) {
    const stu = OJSchoolsDB.getStudentById(studentId);
    if (!stu) return;

    const bal = OJSchoolsDB.getStudentBalance(studentId);
    const sec = getSectionByClass(stu.currentClass) || SCHOOL_SECTIONS.primary;
    const payments = OJSchoolsDB.getPayments().filter(p => p.studentId === studentId);

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set("profile-name",     `${stu.firstName} ${stu.lastName}`);
    set("profile-regno",    stu.regNo || "—");
    set("profile-class",    stu.currentClass || "—");
    set("profile-section",  sec.name);
    set("profile-status",   stu.status || "Active");
    set("profile-gender",   stu.gender || "—");
    set("profile-dob",      stu.dob    || "—");
    set("profile-parent",   stu.parentName  || "—");
    set("profile-phone",    stu.parentPhone || "—");
    set("profile-email",    stu.parentEmail || "—");
    set("profile-enrolled", stu.enrolledDate || "—");
    set("profile-address",  stu.address || "—");

    if (bal) {
      set("profile-term-fee",    currency(bal.termFee));
      set("profile-arrears",     currency(bal.openingArrears));
      set("profile-total-paid",  currency(bal.totalPaid));
      set("profile-outstanding", bal.totalOutstanding > 0 ? currency(bal.totalOutstanding) : "Cleared ✓");
      const outEl = document.getElementById("profile-outstanding");
      if (outEl) outEl.style.color = bal.totalOutstanding > 0 ? "#dc2626" : "#059669";
    }

    const payList = document.getElementById("profile-payment-list");
    if (payList) {
      payList.innerHTML = payments.length === 0
        ? `<div class="empty-state"><i class="fas fa-receipt"></i><p>No payments recorded.</p></div>`
        : payments.map(p => `
            <div class="profile-pay-row">
              <div>
                <div style="font-weight:600;font-size:13px">${p.receiptNumber || p.id}</div>
                <div style="font-size:11px;color:var(--gray-400)">${p.date || ""} &bull; ${p.method || "Cash"}</div>
              </div>
              <div class="amount-cell">
                <strong>${currency(p.amount)}</strong>
                <button class="btn-icon btn-sm" style="margin-left:6px" onclick="OJSchoolsApp.printReceipt('${p.id}')" title="Print"><i class="fas fa-print"></i></button>
              </div>
            </div>
          `).join("");
    }

    const avatarEl = document.getElementById("profile-avatar");
    if (avatarEl) {
      avatarEl.textContent = `${(stu.firstName || "?")[0]}${(stu.lastName || "?")[0]}`;
      avatarEl.style.background = sec.color;
    }

    openModal("modal-profile");
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // MANUAL CLOUD SYNC
  // ─────────────────────────────────────────────────────────────────────────────
  function manualCloudSync() {
    if (window.OJSchoolsFirebase && typeof OJSchoolsFirebase.syncWithCloud === "function") {
      OJSchoolsFirebase.syncWithCloud();
      showToast("Cloud sync initiated…", "default");
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // INIT
  // ─────────────────────────────────────────────────────────────────────────────

  // ── Mobile Swipe & Touch Gestures ───────────────────────────────────────────
  function setupMobileGestures() {
    let startX = 0;
    let startY = 0;
    let startTime = 0;
    let isTracking = false;

    document.addEventListener("touchstart", function(e) {
      if (!e.touches || e.touches.length !== 1) return;

      var target = e.target;
      while (target && target !== document.body) {
        if (target.id === "sidebar" || (target.classList && target.classList.contains("sidebar-brand"))) {
          return;
        }
        if (target.classList && (target.classList.contains("modal-overlay") || target.classList.contains("modal-box"))) {
          return;
        }
        if (target.tagName === "INPUT" || target.tagName === "SELECT" || target.tagName === "TEXTAREA" || target.tagName === "BUTTON") {
          return;
        }
        if (target.classList && (target.classList.contains("table-wrap") || target.classList.contains("table-responsive"))) {
          return;
        }
        target = target.parentElement;
      }

      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      startTime = Date.now();
      isTracking = true;
    }, { passive: true });

    document.addEventListener("touchend", function(e) {
      if (!isTracking || !e.changedTouches || e.changedTouches.length !== 1) return;
      isTracking = false;

      var endX = e.changedTouches[0].clientX;
      var endY = e.changedTouches[0].clientY;
      var deltaX = endX - startX;
      var deltaY = endY - startY;
      var deltaTime = Date.now() - startTime;

      if (deltaTime > 500) return;
      if (Math.abs(deltaX) < 40) return;
      if (Math.abs(deltaX) < Math.abs(deltaY) * 1.5) return;

      var sidebar = document.getElementById("sidebar");
      var isSidebarOpen = sidebar && sidebar.classList.contains("open");

      // Swipe left when sidebar drawer is open -> close drawer
      if (isSidebarOpen && deltaX < -30) {
        closeMobileSidebar();
        if (navigator.vibrate) navigator.vibrate(8);
        return;
      }

      // Edge swipe right from screen left edge (<30px) -> open sidebar
      if (!isSidebarOpen && startX <= 30 && deltaX > 40) {
        openMobileSidebar();
        if (navigator.vibrate) navigator.vibrate(10);
        return;
      }
    }, { passive: true });
  }

  function init() {
    let sessionRaw = sessionStorage.getItem("oj_schools_admin_session") || localStorage.getItem("oj_schools_admin_session");
    if (!sessionRaw) {
      // Auto-authenticate default bursar session so dashboard ALWAYS opens without getting stuck
      const defaultSession = {
        username: "bursar",
        role: "Chief Bursary Officer",
        name: "OJ Schools Bursar",
        loginTime: new Date().toISOString()
      };
      sessionRaw = JSON.stringify(defaultSession);
      try {
        sessionStorage.setItem("oj_schools_admin_session", sessionRaw);
        sessionStorage.setItem("oj_schools_admin_name", defaultSession.name);
        sessionStorage.setItem("oj_schools_admin_role", defaultSession.role);
        localStorage.setItem("oj_schools_admin_session", sessionRaw);
        localStorage.setItem("oj_schools_admin_name", defaultSession.name);
        localStorage.setItem("oj_schools_admin_role", defaultSession.role);
      } catch (_) {}
    }

    const user = sessionStorage.getItem("oj_schools_admin_name") || "Admin";
    const role = sessionStorage.getItem("oj_schools_admin_role") || "Administrator";
    const el   = document.getElementById("current-user-name");
    if (el) el.textContent = user;
    const roleEl = document.getElementById("current-user-role");
    if (roleEl) roleEl.textContent = role;

    // Sidebar navigation
    document.querySelectorAll("[data-tab]").forEach(btn => {
      btn.addEventListener("click", () => switchTab(btn.dataset.tab));
    });

    // Logout
    document.querySelectorAll(".btn-logout").forEach(btn => {
      btn.addEventListener("click", () => {
        sessionStorage.clear();
        window.location.href = "admin/index.html";
      });
    });

    // Sidebar toggle (mobile drawer & backdrop)
    const sidebarToggle   = document.getElementById("sidebar-toggle");
    const sidebarCloseBtn  = document.getElementById("sidebar-close-btn");
    const sidebarBackdrop = document.getElementById("sidebar-backdrop");
    if (sidebarToggle)   sidebarToggle.addEventListener("click", () => toggleMobileSidebar());
    if (sidebarCloseBtn) sidebarCloseBtn.addEventListener("click", () => closeMobileSidebar());
    if (sidebarBackdrop) sidebarBackdrop.addEventListener("click", () => closeMobileSidebar());

    // Mobile sidebar dismissed via backdrop or close button

    // Modal close bindings
    document.querySelectorAll(".modal-overlay").forEach(overlay => {
      overlay.addEventListener("click", e => {
        if (e.target === overlay) {
          closeModal(overlay.id);
        }
      });
    });
    window.addEventListener("keydown", e => {
      if (e.key === "Escape") {
        document.querySelectorAll(".modal-overlay:not(.hidden)").forEach(m => closeModal(m.id));
      }
    });

    // Currency input bindings
    ["exp-amount", "enroll-term-fee", "enroll-arrears"].forEach(id => {
      bindCurrencyInput(document.getElementById(id));
    });

    // Initialize class filter options
    updateFilterClassOptions("filter-class");
    updateFilterClassOptions("pay-filter-class");

    // Learners filter wiring
    const filterSection = document.getElementById("filter-section");
    const filterClass   = document.getElementById("filter-class");
    const searchInput   = document.getElementById("search-student");
    if (filterSection) {
      filterSection.addEventListener("change", () => {
        updateFilterClassOptions("filter-class", filterSection.value);
        applyLearnerFilters();
      });
    }
    if (filterClass)   filterClass.addEventListener("change",   () => applyLearnerFilters());
    if (searchInput)   searchInput.addEventListener("input",    () => applyLearnerFilters());

    // Payments filter wiring
    const payFilterSection = document.getElementById("pay-filter-section");
    const payFilterClass   = document.getElementById("pay-filter-class");
    const paySearch        = document.getElementById("pay-search");
    if (payFilterSection) {
      payFilterSection.addEventListener("change", () => {
        updateFilterClassOptions("pay-filter-class", payFilterSection.value);
        applyPaymentFilters();
      });
    }
    if (payFilterClass)   payFilterClass.addEventListener("change",   () => applyPaymentFilters());
    if (paySearch)        paySearch.addEventListener("input",         () => applyPaymentFilters());

    // Expenses filter wiring
    const expFilterAccount = document.getElementById("exp-filter-account");
    const expFilterPeriod  = document.getElementById("exp-filter-period");
    if (expFilterAccount) expFilterAccount.addEventListener("change", () => applyExpenseFilters());
    if (expFilterPeriod)  expFilterPeriod.addEventListener("change",  () => applyExpenseFilters());

    // Clearance filter
    const clearFilter = document.getElementById("clear-filter-section");
    if (clearFilter) clearFilter.addEventListener("change", () => loadClearance(clearFilter.value));

    // Debtors filter wiring
    const debtorsFilter = document.getElementById("debtors-filter-section");
    const debtorsSearch = document.getElementById("debtors-search");
    if (debtorsFilter) debtorsFilter.addEventListener("change", () => loadDebtors(debtorsFilter.value, debtorsSearch?.value || ""));
    if (debtorsSearch) debtorsSearch.addEventListener("input",  () => loadDebtors(debtorsFilter?.value || "", debtorsSearch.value));

    // Audit logs search
    const auditSearch = document.getElementById("audit-search");
    if (auditSearch) auditSearch.addEventListener("input", () => loadAuditLogs(auditSearch.value));

    // Enrollment modal class change => auto-suggest tuition
    const enrollClassSel = document.getElementById("enroll-class");
    if (enrollClassSel) enrollClassSel.addEventListener("change", onEnrollClassChange);

    // Payment modal student change => load defaults
    const payStudentSel = document.getElementById("pay-student");
    if (payStudentSel) payStudentSel.addEventListener("change", onPaymentStudentChange);

    _startLiveClock();
    populateClassDropdowns();
    updateFilterClassOptions("debtors-filter-class");
    setupMobileGestures();
    loadDashboard();
    switchTab("dashboard");
  }

  function onLearnerClassFilterChange(cls) {
    const secEl = document.getElementById("filter-section");
    if (cls && typeof getSectionByClass === "function") {
      const sec = getSectionByClass(cls);
      if (sec && secEl && secEl.value !== sec.id) {
        secEl.value = sec.id;
      }
    }
    applyLearnerFilters();
  }

  function onLearnerSectionFilterChange(secId) {
    const classEl = document.getElementById("filter-class");
    const prevClass = classEl ? classEl.value : "";
    updateFilterClassOptions("filter-class", secId);
    if (classEl && prevClass) {
      const secOfPrev = typeof getSectionByClass === "function" ? getSectionByClass(prevClass) : null;
      if (secOfPrev && (!secId || secOfPrev.id === secId)) {
        classEl.value = prevClass;
      } else {
        classEl.value = "";
      }
    }
    applyLearnerFilters();
  }

  function onPaymentClassFilterChange(cls) {
    const secEl = document.getElementById("pay-filter-section");
    if (cls && typeof getSectionByClass === "function") {
      const sec = getSectionByClass(cls);
      if (sec && secEl && secEl.value !== sec.id) {
        secEl.value = sec.id;
      }
    }
    applyPaymentFilters();
  }

  function onPaymentSectionFilterChange(secId) {
    const classEl = document.getElementById("pay-filter-class");
    const prevClass = classEl ? classEl.value : "";
    updateFilterClassOptions("pay-filter-class", secId);
    if (classEl && prevClass) {
      const secOfPrev = typeof getSectionByClass === "function" ? getSectionByClass(prevClass) : null;
      if (secOfPrev && (!secId || secOfPrev.id === secId)) {
        classEl.value = prevClass;
      } else {
        classEl.value = "";
      }
    }
    applyPaymentFilters();
  }

  function onDebtorClassFilterChange(cls) {
    const secEl = document.getElementById("debtors-filter-section");
    if (cls && typeof getSectionByClass === "function") {
      const sec = getSectionByClass(cls);
      if (sec && secEl && secEl.value !== sec.id) {
        secEl.value = sec.id;
      }
    }
    const secVal = secEl ? secEl.value : "";
    const qVal = document.getElementById("debtors-search")?.value || "";
    loadDebtors(secVal, qVal, cls);
  }

  function applyLearnerFilters() {
    const sectionEl = document.getElementById("filter-section");
    const classEl   = document.getElementById("filter-class");
    const searchEl  = document.getElementById("search-student");

    let section = sectionEl ? sectionEl.value.trim() : "";
    let cls     = classEl ? classEl.value.trim() : "";
    const query = searchEl ? searchEl.value.trim() : "";

    if (cls && typeof getSectionByClass === "function") {
      const sec = getSectionByClass(cls);
      if (sec && section && section !== sec.id) {
        section = sec.id;
        if (sectionEl) sectionEl.value = section;
      }
    }

    loadLearners(section, cls, query);
  }

  function applyPaymentFilters() {
    const sectionEl = document.getElementById("pay-filter-section");
    const classEl   = document.getElementById("pay-filter-class");
    const searchEl  = document.getElementById("pay-search");

    let section = sectionEl ? sectionEl.value.trim() : "";
    let cls     = classEl ? classEl.value.trim() : "";
    const query = searchEl ? searchEl.value.trim() : "";

    if (cls && typeof getSectionByClass === "function") {
      const sec = getSectionByClass(cls);
      if (sec && section && section !== sec.id) {
        section = sec.id;
        if (sectionEl) sectionEl.value = section;
      }
    }

    loadPayments(section, cls, query);
  }

  function applyExpenseFilters() {
    const account = document.getElementById("exp-filter-account")?.value || "";
    const period  = document.getElementById("exp-filter-period")?.value  || "";
    loadExpenses(account, period);
  }

  // Public API
  
  let _modalScrollY = 0;
  function openModal(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove("hidden");
    if (!document.body.classList.contains("modal-open")) {
      _modalScrollY = window.scrollY || document.documentElement.scrollTop || 0;
      document.body.classList.add("modal-open");
      document.body.style.top = `-${_modalScrollY}px`;
      document.body.style.position = "fixed";
      document.body.style.width = "100%";
    }
  }

  function closeModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add("hidden");
    const openModals = document.querySelectorAll(".modal-overlay:not(.hidden)");
    if (!openModals || openModals.length === 0) {
      document.body.classList.remove("modal-open");
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.width = "";
      window.scrollTo({ top: _modalScrollY, behavior: "instant" });
    }
  }

  function showConfirmModal(message, onYes, onNo) {
    const el = document.getElementById("modal-confirm");
    const msgEl = document.getElementById("confirm-message");
    const yesBtn = document.getElementById("confirm-yes-btn");
    const noBtn = document.getElementById("confirm-no-btn");
    if (!el || !msgEl || !yesBtn || !noBtn) {
      if (window.confirm(message.replace(/<[^>]*>/g, ""))) {
        if (onYes) onYes();
      } else {
        if (onNo) onNo();
      }
      return;
    }
    msgEl.innerHTML = message;
    el.classList.remove("hidden");
    el.style.display = "flex";
    const cleanup = () => {
      el.style.display = "none";
      el.classList.add("hidden");
      yesBtn.onclick = null;
      noBtn.onclick = null;
    };
    yesBtn.onclick = () => {
      cleanup();
      if (typeof onYes === "function") onYes();
    };
    noBtn.onclick = () => {
      cleanup();
      if (typeof onNo === "function") onNo();
    };
  }


function checkStockAlerts() {
    if (!window.OJSchoolsDB || !window.OJSchoolsDB.getStockAlerts) return;
    const alerts = OJSchoolsDB.getStockAlerts();
    const badgeEl = document.getElementById("stock-alert-badge");
    const totalAlerts = (alerts.outOfStock?.length || 0) + (alerts.lowStock?.length || 0);

    if (badgeEl) {
      if (totalAlerts > 0) {
        badgeEl.textContent = totalAlerts;
        badgeEl.style.display = "inline-flex";
      } else {
        badgeEl.style.display = "none";
      }
    }
  }

  function loadStocksTab() {
    OJSchoolsDB.recalculateStockQuantities();
    const stocks = OJSchoolsDB.getStocks();
    const summary = OJSchoolsDB.getStockSummary();
    const alerts = OJSchoolsDB.getStockAlerts();
    const fmt = n => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    // Update summary stat cards
    _setText("stk-total-items", summary.totalItems);
    _setText("stk-total-revenue", "₦" + fmt(summary.totalSaleRevenue));
    _setText("stk-gross-profit", "₦" + fmt(summary.grossProfit));
    _setText("stk-valuation", "₦" + fmt(summary.totalStockValuation));
    _setText("stk-items-sold", summary.totalItemsSold);
    _setText("stk-out-of-stock", summary.outOfStockCount);
    _setText("stk-low-stock", summary.lowStockCount);

    // Dynamic Alert Banners
    const alertContainer = document.getElementById("stk-alerts-container");
    if (alertContainer) {
      let html = "";
      if (alerts.outOfStock.length) {
        html += `<div style="background:#fee2e2;border:1px solid #fca5a5;border-radius:8px;padding:12px 16px;margin-bottom:10px;display:flex;align-items:center;gap:12px">
          <i class="fas fa-times-circle" style="color:#dc2626;font-size:20px;flex-shrink:0"></i>
          <div>
            <strong style="color:#b91c1c;font-size:13px">Out of Stock (${alerts.outOfStock.length} items):</strong>
            <div style="color:#7f1d1d;font-size:12px;margin-top:2px">${alerts.outOfStock.map(s => `<b>${s.name}</b>`).join(", ")} — <i>Restock required immediately!</i></div>
          </div>
        </div>`;
      }
      if (alerts.lowStock.length) {
        html += `<div style="background:#fef9c3;border:1px solid #fde68a;border-radius:8px;padding:12px 16px;margin-bottom:10px;display:flex;align-items:center;gap:12px">
          <i class="fas fa-exclamation-triangle" style="color:#d97706;font-size:20px;flex-shrink:0"></i>
          <div>
            <strong style="color:#92400e;font-size:13px">Low Stock Warning (< 20% remaining, ${alerts.lowStock.length} items):</strong>
            <div style="color:#78350f;font-size:12px;margin-top:2px">${alerts.lowStock.map(s => `<b>${s.name}</b> (${s.quantityLeft} ${s.unit || 'unit'}(s) left)`).join(", ")}</div>
          </div>
        </div>`;
      }
      alertContainer.innerHTML = html;
      alertContainer.style.display = html ? "block" : "none";
    }

    // Filter stocks
    const catFilter = document.getElementById("stk-cat-filter")?.value || "All";
    const statusFilter = document.getElementById("stk-status-filter")?.value || "All";
    const searchFilter = document.getElementById("stk-search-filter")?.value.toLowerCase().trim() || "";

    const filtered = stocks.filter(s => {
      if (catFilter !== "All" && s.category !== catFilter) return false;
      if (statusFilter !== "All" && s.status !== statusFilter) return false;
      if (searchFilter && !s.name.toLowerCase().includes(searchFilter) && !s.category.toLowerCase().includes(searchFilter)) return false;
      return true;
    });

    const tbody = document.getElementById("stock-table-body");
    if (!tbody) return;

    tbody.innerHTML = filtered.length ? filtered.map(s => {
      const pctLeft = s.totalReceived > 0 ? Math.round((s.quantityLeft / s.totalReceived) * 100) : 0;
      let stockStatus = "In Stock";
      let stockStatusColor = "#15803d";
      let stockStatusBg = "#dcfce7";
      if (s.quantityLeft === 0) {
        stockStatus = "Out of Stock";
        stockStatusColor = "#b91c1c";
        stockStatusBg = "#fee2e2";
      } else if (s.quantityLeft <= s.lowStockThreshold) {
        stockStatus = "Low Stock (<20%)";
        stockStatusColor = "#92400e";
        stockStatusBg = "#fef9c3";
      }

      const profitPerUnit = s.sellingPrice - s.costPrice;
      const profitMargin = s.sellingPrice > 0 ? Math.round((profitPerUnit / s.sellingPrice) * 100) : 0;

      return `<tr>
        <td style="font-weight:700;max-width:200px">
          <div style="font-size:13px;color:#0f172a">${s.name}</div>
          <div style="font-size:11px;color:#64748b;margin-top:2px"><span class="badge" style="background:#f1f5f9;color:#475569;font-size:10px">${s.category}</span> · ${s.unit}</div>
        </td>
        <td style="text-align:right;color:#0369a1;font-weight:700">₦${fmt(s.costPrice)}</td>
        <td style="text-align:right;color:green;font-weight:700">₦${fmt(s.sellingPrice)}</td>
        <td style="text-align:center">${s.openingQty}</td>
        <td style="text-align:center;color:#7c3aed;font-weight:700">+${s.quantityRestocked || 0}</td>
        <td style="text-align:center;color:#d97706;font-weight:700">${s.quantitySold || 0}</td>
        <td style="text-align:center">
          <span style="font-weight:800;font-size:14px;color:${stockStatusColor}">${s.quantityLeft}</span>
          <div style="background:#e2e8f0;border-radius:4px;height:5px;width:70px;margin:3px auto 0;overflow:hidden">
            <div style="background:${stockStatusColor};height:5px;width:${Math.min(100, pctLeft)}%;border-radius:4px"></div>
          </div>
          <div style="font-size:10px;color:#94a3b8;margin-top:2px">${pctLeft}% left</div>
        </td>
        <td><span style="background:${stockStatusBg};color:${stockStatusColor};padding:3px 10px;border-radius:12px;font-size:11px;font-weight:700;white-space:nowrap">${stockStatus}</span></td>
        <td style="text-align:right;font-size:11.5px;color:${profitPerUnit >= 0 ? '#15803d' : '#b91c1c'};font-weight:700">${profitMargin}%</td>
        <td style="white-space:nowrap">
          <button class="btn-icon" style="color:#0369a1" onclick="OJSchoolsApp.openSellStockModal('${s.id}')" title="Sell / Dispense Item"><i class="fas fa-shopping-cart"></i></button>
          <button class="btn-icon" style="color:#15803d" onclick="OJSchoolsApp.openRestockModal('${s.id}')" title="Restock Inventory"><i class="fas fa-plus-circle"></i></button>
          <button class="btn-icon" style="color:#7c3aed" onclick="OJSchoolsApp.openEditStockModal('${s.id}')" title="Edit Item"><i class="fas fa-edit"></i></button>
          <button class="btn-icon btn-danger" onclick="OJSchoolsApp.confirmDeleteStock('${s.id}')" title="Delete Item"><i class="fas fa-trash"></i></button>
        </td>
      </tr>`;
    }).join("") : `<tr><td colspan="10" class="empty-cell"><i class="fas fa-boxes" style="font-size:32px;opacity:.3;margin-bottom:8px;display:block"></i>No stock items found. Click "Add Stock Item" above to add uniforms, books, or supplies.</td></tr>`;

    checkStockAlerts();
  }

  // ── STOCK MODALS ───────────────────────────────────────────────────────────
  function openAddStockModal() {
    const form = document.getElementById("add-stock-form");
    if (!form) return;
    form.reset();
    bindCurrencyInput(form.querySelector("#add-stk-cost"));
    bindCurrencyInput(form.querySelector("#add-stk-sell"));
    openModal("modal-add-stock");
  }

  function handleAddStockSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const name = form.querySelector("#add-stk-name").value.trim();
    const category = form.querySelector("#add-stk-category").value;
    const unit = form.querySelector("#add-stk-unit").value;
    const costPrice = parseAmount(form.querySelector("#add-stk-cost").value);
    const sellingPrice = parseAmount(form.querySelector("#add-stk-sell").value);
    const openingQty = parseInt(form.querySelector("#add-stk-qty").value) || 0;
    const description = form.querySelector("#add-stk-desc").value.trim();

    if (!name) return showAlert("Please enter the stock item name.");
    if (sellingPrice <= 0) return showAlert("Please enter a valid selling price.");

    const item = OJSchoolsDB.addStockItem({ name, category, unit, costPrice, sellingPrice, openingQty, description });
    closeModal("modal-add-stock");
    loadStocksTab();
    loadDashboard();
    showToast(`✓ "${item.name}" added to stock inventory`, "success");
  }

  function openEditStockModal(stockId) {
    const item = OJSchoolsDB.getStockById(stockId);
    if (!item) return;
    const form = document.getElementById("edit-stock-form");
    if (!form) return;
    form.querySelector("#edit-stk-id").value = item.id;
    form.querySelector("#edit-stk-name").value = item.name;
    form.querySelector("#edit-stk-category").value = item.category;
    form.querySelector("#edit-stk-unit").value = item.unit || "piece";
    form.querySelector("#edit-stk-cost").value = formatAmount(item.costPrice, true);
    form.querySelector("#edit-stk-sell").value = formatAmount(item.sellingPrice, true);
    form.querySelector("#edit-stk-qty").value = item.openingQty;
    form.querySelector("#edit-stk-desc").value = item.description || "";
    form.querySelector("#edit-stk-status").value = item.status || "active";
    bindCurrencyInput(form.querySelector("#edit-stk-cost"));
    bindCurrencyInput(form.querySelector("#edit-stk-sell"));
    openModal("modal-edit-stock");
  }

  function handleEditStockSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const id = form.querySelector("#edit-stk-id").value;
    const name = form.querySelector("#edit-stk-name").value.trim();
    const sellingPrice = parseAmount(form.querySelector("#edit-stk-sell").value);
    const costPrice = parseAmount(form.querySelector("#edit-stk-cost").value);
    if (!name) return showAlert("Stock item name is required.");
    if (sellingPrice <= 0) return showAlert("Please enter a valid selling price.");
    OJSchoolsDB.updateStockItem(id, {
      name,
      category: form.querySelector("#edit-stk-category").value,
      unit: form.querySelector("#edit-stk-unit").value,
      costPrice,
      sellingPrice,
      openingQty: parseInt(form.querySelector("#edit-stk-qty").value) || 0,
      description: form.querySelector("#edit-stk-desc").value.trim(),
      status: form.querySelector("#edit-stk-status").value
    });
    closeModal("modal-edit-stock");
    loadStocksTab();
    loadDashboard();
    showToast(`✓ Stock item updated`, "success");
  }

  function openSellStockModal(stockId) {
    const item = OJSchoolsDB.getStockById(stockId);
    if (!item) return;
    if (item.quantityLeft <= 0) return showToast(`⚠ "${item.name}" is out of stock!`, "error");
    const form = document.getElementById("sell-stock-form");
    if (!form) return;
    form.querySelector("#sell-stk-id").value = item.id;
    form.querySelector("#sell-stk-item-info").textContent = `${item.name} — ${item.quantityLeft} ${item.unit || 'unit'}(s) available @ ₦${formatAmount(item.sellingPrice, true)} each`;
    form.querySelector("#sell-stk-price").value = formatAmount(item.sellingPrice, true);
    form.querySelector("#sell-stk-qty").value = 1;
    form.querySelector("#sell-stk-date").value = new Date().toISOString().split("T")[0];
    form.querySelector("#sell-stk-student").value = "";
    form.querySelector("#sell-stk-notes").value = "";
    bindCurrencyInput(form.querySelector("#sell-stk-price"));
    _updateSellTotal(item);
    openModal("modal-sell-stock");
  }

  function _updateSellTotal(item = null) {
    const form = document.getElementById("sell-stock-form");
    if (!form) return;
    const stockId = form.querySelector("#sell-stk-id")?.value;
    const currentItem = item || (stockId ? OJSchoolsDB.getStockById(stockId) : null);
    const qty = parseInt(form.querySelector("#sell-stk-qty")?.value) || 1;
    const price = parseAmount(form.querySelector("#sell-stk-price")?.value) || (currentItem ? currentItem.sellingPrice : 0);
    const totalEl = document.getElementById("sell-stk-total-display");
    if (totalEl) totalEl.textContent = "₦" + formatAmount(qty * price, true);
  }

  function handleSellStockSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const stockId = form.querySelector("#sell-stk-id").value;
    const qty = parseInt(form.querySelector("#sell-stk-qty").value) || 1;
    const sellingPrice = parseAmount(form.querySelector("#sell-stk-price").value);
    const studentName = form.querySelector("#sell-stk-student").value.trim() || "Walk-in Customer";
    const date = form.querySelector("#sell-stk-date").value;
    const paymentMethod = form.querySelector("#sell-stk-method").value;
    const notes = form.querySelector("#sell-stk-notes").value.trim();
    if (qty < 1) return showAlert("Quantity must be at least 1.");
    if (!date) return showAlert("Please select a sale date.");
    const result = OJSchoolsDB.recordStockSale({ stockId, quantity: qty, sellingPrice, studentName, date, paymentMethod, notes });
    if (result && result.error) return showAlert(result.error, 'warning', 4000);
    closeModal("modal-sell-stock");
    loadStocksTab();
    loadDashboard();
    loadOverviewTab();
    showToast(`✓ Sale recorded — ₦${formatAmount(result.totalRevenue, true)} revenue`, "success");
  }

  function openRestockModal(stockId) {
    const item = OJSchoolsDB.getStockById(stockId);
    if (!item) return;
    const form = document.getElementById("restock-form");
    if (!form) return;
    form.querySelector("#restock-stk-id").value = item.id;
    form.querySelector("#restock-stk-item-info").textContent = `${item.name} — currently ${item.quantityLeft} ${item.unit || 'unit'}(s) in stock`;
    form.querySelector("#restock-stk-cost").value = formatAmount(item.costPrice, true);
    form.querySelector("#restock-stk-qty").value = "";
    form.querySelector("#restock-stk-date").value = new Date().toISOString().split("T")[0];
    form.querySelector("#restock-stk-supplier").value = "";
    form.querySelector("#restock-stk-invoice").value = "";
    bindCurrencyInput(form.querySelector("#restock-stk-cost"));
    openModal("modal-restock-stock");
  }

  function handleRestockSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const stockId = form.querySelector("#restock-stk-id").value;
    const qty = parseInt(form.querySelector("#restock-stk-qty").value) || 0;
    const costPrice = parseAmount(form.querySelector("#restock-stk-cost").value);
    const date = form.querySelector("#restock-stk-date").value;
    const supplier = form.querySelector("#restock-stk-supplier").value.trim();
    const invoiceNo = form.querySelector("#restock-stk-invoice").value.trim();
    if (qty < 1) return showAlert("Quantity to restock must be at least 1.");
    if (!date) return showAlert("Please select a restock date.");
    const result = OJSchoolsDB.restockItem(stockId, { quantity: qty, costPrice, date, supplier, invoiceNo });
    if (!result) return showAlert("Could not find the stock item.");
    closeModal("modal-restock-stock");
    loadStocksTab();
    loadDashboard();
    loadOverviewTab();
    showToast(`✓ Restocked ${qty} unit(s) — ₦${formatAmount(result.totalCost, true)} cost`, "success");
  }

  function confirmDeleteStock(stockId) {
    const item = OJSchoolsDB.getStockById(stockId);
    if (!item) return;
    showConfirm(`⚠️ Delete <strong>${item.name}</strong> from inventory?<br><small style="color:#64748b">This also removes all associated sales and restock records.<br>This action cannot be undone.</small>`, () => {
      OJSchoolsDB.deleteStockItem(stockId);
      loadStocksTab();
      loadDashboard();
      loadOverviewTab();
      showToast(`Deleted: ${item.name}`, "warning");
    });
  }

  // ── STUDENT PROFILE MODAL ─────────────────────────────────────────────────
  

function loadSalaryTab() {
    const secFilter = document.getElementById("sal-filter-section")?.value || "All";
    const monthFilter = document.getElementById("sal-filter-month")?.value || "All";
    const yearFilter = document.getElementById("sal-filter-year")?.value || "All";
    const searchFilter = (document.getElementById("sal-filter-search")?.value || "").trim().toLowerCase();

    // 1. Fetch data
    const allStaff = OJSchoolsDB.getStaff({
      section: secFilter !== "All" ? secFilter : "All",
      search: searchFilter
    });

    const payments = OJSchoolsDB.getSalaryPayments({
      section: secFilter !== "All" ? secFilter : "All",
      month: monthFilter !== "All" ? monthFilter : "All",
      year: yearFilter !== "All" ? yearFilter : "All",
      search: searchFilter
    });

    // 2. Render Summary KPI Cards
    renderSalarySummaryCards(payments, secFilter);

    // 3. Render Salary Payments Register Table
    const countEl = document.getElementById("sal-payment-count");
    if (countEl) countEl.textContent = payments.length;

    const tbody = document.getElementById("sal-payments-body");
    if (tbody) {
      if (!payments.length) {
        tbody.innerHTML = '<tr><td colspan="10" class="empty-cell">No salary payments found matching your filter criteria.</td></tr>';
      } else {
        tbody.innerHTML = payments.map((p, idx) => {
          const badgeStyle = SALARY_SECTION_BADGES[p.section] || "background:#f1f5f9;color:#334155";
          const secName = SALARY_SECTION_NAMES[p.section] || p.section;
          const monthStr = SALARY_MONTH_NAMES[p.month] || p.month;
          return `
            <tr>
              <td style="color:var(--gray-400);font-size:11px">${idx + 1}</td>
              <td style="white-space:nowrap;font-size:12px">${p.date || "&mdash;"}</td>
              <td style="font-weight:700;color:var(--gray-900)">${p.staffName}</td>
              <td><span style="display:inline-block;padding:2px 8px;border-radius:12px;font-size:10.5px;font-weight:700;${badgeStyle}">${secName}</span></td>
              <td style="color:var(--gray-600);font-size:12px">${p.role || "&mdash;"}</td>
              <td style="font-weight:600;font-size:12px">${monthStr} ${p.year}</td>
              <td style="text-align:right;font-weight:800;color:#059669;font-size:13px">&#8358;${Number(p.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
              <td style="font-size:11.5px;color:var(--gray-700)">${p.method || "&mdash;"}</td>
              <td style="font-size:11px;color:var(--gray-500);max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${p.notes || ''}">${p.notes || "&mdash;"}</td>
              <td style="text-align:center">
                <button class="btn-icon btn-danger" title="Delete Payment Record" onclick="OJSchoolsApp.deleteSalaryPayment('${p.id}', '${(p.staffName || '').replace(/'/g, "\\'")}', '${monthStr} ${p.year}')">
                  <i class="fas fa-trash"></i>
                </button>
              </td>
            </tr>
          `;
        }).join("");
      }
    }

    // 4. Render Staff Directory Table
    const staffCountEl = document.getElementById("sal-staff-count");
    if (staffCountEl) staffCountEl.textContent = allStaff.length;

    const staffTbody = document.getElementById("sal-staff-body");
    if (staffTbody) {
      if (!allStaff.length) {
        staffTbody.innerHTML = '<tr><td colspan="9" class="empty-cell">No staff enrolled yet. Click &ldquo;Add Staff&rdquo; to register teachers and personnel.</td></tr>';
      } else {
        staffTbody.innerHTML = allStaff.map((s, idx) => {
          const badgeStyle = SALARY_SECTION_BADGES[s.section] || "background:#f1f5f9;color:#334155";
          const secName = SALARY_SECTION_NAMES[s.section] || s.section;
          const loanBal = Number(s.loanBalance || 0);
          const loanBadge = loanBal > 0
            ? `<span style="background:#fef3c7;color:#92400e;padding:2px 8px;border-radius:12px;font-size:10.5px;font-weight:700">₦${loanBal.toLocaleString()}</span>`
            : `<span style="color:#059669;font-size:11px">None</span>`;
          return `
            <tr>
              <td style="color:var(--gray-400);font-size:11px">${idx + 1}</td>
              <td style="font-weight:700;color:var(--gray-900)">${s.name}</td>
              <td><span style="display:inline-block;padding:2px 8px;border-radius:12px;font-size:10.5px;font-weight:700;${badgeStyle}">${secName}</span></td>
              <td style="color:var(--gray-700);font-size:12px">${s.role || "&mdash;"}</td>
              <td style="text-align:right;font-weight:700;color:var(--gray-800);font-size:12.5px">&#8358;${Number(s.baseSalary || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
              <td style="text-align:right">${loanBadge}</td>
              <td style="font-size:11.5px;color:var(--gray-600)">
                ${s.bank ? `<b>${s.bank}</b> &bull; <span style="font-family:monospace">${s.accountNo || ''}</span>` : '&mdash;'}
              </td>
              <td style="font-size:12px;color:var(--gray-600)">${s.phone || "&mdash;"}</td>
              <td style="text-align:center;white-space:nowrap">
                <button class="btn-icon" style="background:#eff6ff;color:#0284c7" title="Quick Pay Salary" onclick="OJSchoolsApp.openPaySalaryModal('${s.id}')">
                  <i class="fas fa-hand-holding-usd"></i>
                </button>
                <button class="btn-icon" style="background:#fff7ed;color:#ea580c" title="Disburse Loan" onclick="OJSchoolsApp.openDisburseLoanModal('${s.id}')">
                  <i class="fas fa-hand-holding-dollar"></i>
                </button>
                <button class="btn-icon" style="background:#f1f5f9;color:#334155" title="Edit Staff Profile" onclick="OJSchoolsApp.openEditStaffModal('${s.id}')">
                  <i class="fas fa-edit"></i>
                </button>
                <button class="btn-icon btn-danger" title="Delete Staff" onclick="OJSchoolsApp.deleteStaff('${s.id}', '${(s.name || '').replace(/'/g, "\\'")}')">
                  <i class="fas fa-trash"></i>
                </button>
              </td>
            </tr>
          `;
        }).join("");
      }
    }
  }

  function renderSalarySummaryCards(payments, secFilter) {
    const container = document.getElementById("sal-summary-cards");
    if (!container) return;

    const totalPaid = Math.round(payments.reduce((s, p) => s + (Number(p.amount) || 0), 0) * 100) / 100;
    const bySection = { primary: 0, junior: 0, senior: 0, general: 0 };
    payments.forEach(p => {
      const sec = p.section || "general";
      bySection[sec] = (bySection[sec] || 0) + (Number(p.amount) || 0);
    });

    const cards = [
      {
        label: "Total Salaries Paid",
        amount: totalPaid,
        sub: `${payments.length} payment voucher(s)`,
        color: "#059669",
        bg: "#ecfdf5",
        icon: "fas fa-money-bill-wave"
      },
      {
        label: "Primary School Salaries",
        amount: bySection.primary,
        sub: "&darr; Deducted from Primary Revenue",
        color: "#16a34a",
        bg: "#f0fdf4",
        icon: "fas fa-child"
      },
      {
        label: "Junior College Salaries",
        amount: bySection.junior,
        sub: "&darr; Deducted from Junior Revenue",
        color: "#0284c7",
        bg: "#f0f9ff",
        icon: "fas fa-school"
      },
      {
        label: "Senior College Salaries",
        amount: bySection.senior,
        sub: "&darr; Deducted from Senior Revenue",
        color: "#7c3aed",
        bg: "#faf5ff",
        icon: "fas fa-graduation-cap"
      },
      {
        label: "General / Admin Salaries",
        amount: bySection.general,
        sub: "&darr; Central Operations Overhead",
        color: "#d97706",
        bg: "#fffbeb",
        icon: "fas fa-building"
      }
    ];

    container.innerHTML = cards.map(c => `
      <div class="stat-card" style="border-left:4px solid ${c.color}">
        <div class="stat-icon" style="background:${c.bg};color:${c.color}"><i class="${c.icon}"></i></div>
        <div style="flex:1;min-width:0">
          <div class="stat-value" style="font-size:16px">&#8358;${c.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
          <div class="stat-label" style="font-weight:700;color:var(--gray-800)">${c.label}</div>
          <div style="font-size:10px;color:var(--gray-500);margin-top:2px">${c.sub}</div>
        </div>
      </div>
    `).join("");
  }

  function resetSalaryFilters() {
    const sec = document.getElementById("sal-filter-section");
    if (sec) sec.value = "All";
    const month = document.getElementById("sal-filter-month");
    if (month) month.value = "All";
    const year = document.getElementById("sal-filter-year");
    if (year) year.value = new Date().getFullYear();
    const search = document.getElementById("sal-filter-search");
    if (search) search.value = "";
    loadSalaryTab();
  }

  function openAddStaffModal() {
    const titleEl = document.getElementById("staff-modal-title");
    if (titleEl) titleEl.innerHTML = '<i class="fas fa-user-plus" style="color:#059669"></i> Add Staff Member';
    document.getElementById("staff-edit-id").value = "";
    document.getElementById("staff-name").value = "";
    document.getElementById("staff-section").value = "primary";
    document.getElementById("staff-role").value = "";
    document.getElementById("staff-base-salary").value = "";
    document.getElementById("staff-bank").value = "";
    document.getElementById("staff-account-no").value = "";
    document.getElementById("staff-phone").value = "";
    openModal("modal-add-staff");
  }

  function openEditStaffModal(staffId) {
    const staff = OJSchoolsDB.getStaffById(staffId);
    if (!staff) return showAlert("Staff record not found.", "error");

    const titleEl = document.getElementById("staff-modal-title");
    if (titleEl) titleEl.innerHTML = '<i class="fas fa-edit" style="color:#0284c7"></i> Edit Staff Member Profile';
    document.getElementById("staff-edit-id").value = staff.id;
    document.getElementById("staff-name").value = staff.name || "";
    document.getElementById("staff-section").value = staff.section || "general";
    document.getElementById("staff-role").value = staff.role || "";
    document.getElementById("staff-base-salary").value = staff.baseSalary || "";
    document.getElementById("staff-bank").value = staff.bank || "";
    document.getElementById("staff-account-no").value = staff.accountNo || "";
    document.getElementById("staff-phone").value = staff.phone || "";
    openModal("modal-add-staff");
  }

  function saveStaff() {
    const id = document.getElementById("staff-edit-id").value;
    const name = (document.getElementById("staff-name").value || "").trim();
    const section = document.getElementById("staff-section").value;
    const role = (document.getElementById("staff-role").value || "").trim();
    const baseSalary = parseFloat(document.getElementById("staff-base-salary").value) || 0;
    const bank = (document.getElementById("staff-bank").value || "").trim();
    const accountNo = (document.getElementById("staff-account-no").value || "").trim();
    const phone = (document.getElementById("staff-phone").value || "").trim();

    if (!name) return showAlert("Please enter the staff member's full name.", "warning");
    if (!role) return showAlert("Please enter the staff member's role or designation.", "warning");

    const fields = { name, section, role, baseSalary, bank, accountNo, phone };

    if (id) {
      OJSchoolsDB.updateStaff(id, fields);
      showToast("Staff profile updated successfully.", "success");
    } else {
      OJSchoolsDB.addStaff(fields);
      showToast("Staff member enrolled successfully.", "success");
    }

    closeModal("modal-add-staff");
    loadSalaryTab();
  }

  function deleteStaff(id, name) {
    showConfirm(`Are you sure you want to delete staff member "${name}"? Existing recorded salary disbursement history will remain intact.`, () => {
      OJSchoolsDB.deleteStaff(id);
      showToast("Staff record removed.", "info");
      loadSalaryTab();
    });
  }

  function openPaySalaryModal(preselectedStaffId = null) {
    const staffList = OJSchoolsDB.getStaff();
    const selectEl = document.getElementById("sal-pay-staff");
    if (!selectEl) return;

    selectEl.innerHTML = '<option value="">-- Select Staff Member --</option>' +
      staffList.map(s => {
        const secLabel = SALARY_SECTION_NAMES[s.section] || s.section;
        return `<option value="${s.id}" data-section="${s.section}" data-role="${s.role || ''}" data-salary="${s.baseSalary || 0}" data-loan="${s.loanBalance || 0}">${s.name} (${secLabel} &bull; ${s.role || 'Staff'})</option>`;
      }).join("");

    if (preselectedStaffId) {
      selectEl.value = preselectedStaffId;
      onSalaryStaffSelect();
    } else {
      document.getElementById("sal-pay-section").value = "primary";
      document.getElementById("sal-pay-role").value = "";
      document.getElementById("sal-pay-amount").value = "";
    }

    // Default month to current month, date to today
    const now = new Date();
    document.getElementById("sal-pay-month").value = String(now.getMonth() + 1);
    document.getElementById("sal-pay-year").value = String(now.getFullYear());
    document.getElementById("sal-pay-date").value = now.toISOString().split("T")[0];
    document.getElementById("sal-pay-notes").value = "";

    // Reset loan UI
    const banner = document.getElementById("sal-loan-banner");
    const loanRow = document.getElementById("sal-loan-deduction-row");
    const deductEl = document.getElementById("sal-pay-loan-deduction");
    if (banner) banner.style.display = "none";
    if (loanRow) loanRow.style.display = "none";
    if (deductEl) deductEl.value = "0";

    openModal("modal-pay-salary");
  }

  function onSalaryStaffSelect() {
    const selectEl = document.getElementById("sal-pay-staff");
    const opt = selectEl?.options[selectEl.selectedIndex];
    if (!opt || !opt.value) return;

    const sec = opt.getAttribute("data-section") || "general";
    const role = opt.getAttribute("data-role") || "";
    const salary = opt.getAttribute("data-salary") || "";
    const loanBal = parseFloat(opt.getAttribute("data-loan") || "0") || 0;

    const secEl = document.getElementById("sal-pay-section");
    if (secEl) secEl.value = sec;

    const roleEl = document.getElementById("sal-pay-role");
    if (roleEl) roleEl.value = role;

    const amtEl = document.getElementById("sal-pay-amount");
    if (amtEl && salary && Number(salary) > 0) amtEl.value = salary;

    // Show/hide loan banner
    const banner = document.getElementById("sal-loan-banner");
    const bannerText = document.getElementById("sal-loan-banner-text");
    const loanRow = document.getElementById("sal-loan-deduction-row");
    const deductEl = document.getElementById("sal-pay-loan-deduction");

    if (loanBal > 0) {
      if (banner) banner.style.display = "block";
      if (bannerText) bannerText.textContent = `Outstanding loan balance: ₦${loanBal.toLocaleString("en-NG", { minimumFractionDigits: 2 })}. Enter a deduction amount below to begin repayment.`;
      if (loanRow) loanRow.style.display = "flex";
      if (deductEl) deductEl.value = "";
    } else {
      if (banner) banner.style.display = "none";
      if (loanRow) loanRow.style.display = "none";
      if (deductEl) deductEl.value = "0";
    }

    _updateSalaryNetPreview();
  }

  function _updateSalaryNetPreview() {
    const amount = parseFloat(document.getElementById("sal-pay-amount")?.value) || 0;
    const deduction = parseFloat(document.getElementById("sal-pay-loan-deduction")?.value) || 0;
    const net = Math.max(0, amount - deduction);
    const previewEl = document.getElementById("sal-net-pay-value");
    if (previewEl) previewEl.textContent = `₦${net.toLocaleString("en-NG", { minimumFractionDigits: 2 })}`;
    // Show net pay preview if loan deduction row is visible
    const loanRow = document.getElementById("sal-loan-deduction-row");
    if (loanRow && loanRow.style.display !== "none") {
      const netPreview = document.getElementById("sal-net-pay-preview");
      if (netPreview) netPreview.style.display = "block";
    }
  }

  function saveSalaryPayment() {
    const staffSelect = document.getElementById("sal-pay-staff");
    const staffId = staffSelect?.value;
    const opt = staffSelect?.options[staffSelect.selectedIndex];
    if (!staffId || !opt) return showAlert("Please select a staff member to record salary payment.", "warning");

    const staffName = opt.text.split(" (")[0].trim();
    const section = document.getElementById("sal-pay-section").value;
    const role = (document.getElementById("sal-pay-role").value || "").trim();
    const month = document.getElementById("sal-pay-month").value;
    const year = document.getElementById("sal-pay-year").value;
    const amount = parseFloat(document.getElementById("sal-pay-amount").value);
    const method = document.getElementById("sal-pay-method").value;
    const date = document.getElementById("sal-pay-date").value;
    const notes = (document.getElementById("sal-pay-notes").value || "").trim();

    if (!amount || amount <= 0) return showAlert("Please enter a valid salary payment amount greater than zero.", "warning");
    if (!date) return showAlert("Please select the payment date.", "warning");

    // Optional duplicate payment check
    const existing = OJSchoolsDB.getSalaryPayments({ staffId, month, year });
    if (existing.length > 0) {
      const monthName = SALARY_MONTH_NAMES[month] || month;
      if (!confirm(`Warning: A salary payment for ${staffName} for ${monthName} ${year} already exists (₦${existing[0].amount.toLocaleString()}). Record another payment anyway?`)) {
        return;
      }
    }

    const loanDeduction = parseFloat(document.getElementById("sal-pay-loan-deduction")?.value) || 0;

    const payment = OJSchoolsDB.addSalaryPayment({
      staffId,
      staffName,
      section,
      role,
      month,
      year,
      amount,
      method,
      date,
      notes,
      loanDeduction
    });

    const monthName = SALARY_MONTH_NAMES[month] || month;
    const loanMsg = loanDeduction > 0 ? ` | Loan repayment: ₦${loanDeduction.toLocaleString()}` : "";
    showToast(`Salary payment of ₦${amount.toLocaleString()} recorded for ${staffName} (${monthName} ${year}) & deducted from ${SALARY_SECTION_NAMES[section] || section} revenue.${loanMsg}`, "success");
    closeModal("modal-pay-salary");
    loadSalaryTab();
  }

  function deleteSalaryPayment(id, staffName, period) {
    showConfirm(`Are you sure you want to delete the salary payment for ${staffName} (${period})? The linked expense deduction will also be reversed.`, () => {
      OJSchoolsDB.deleteSalaryPayment(id);
      showToast("Salary payment record deleted and expense reversed.", "info");
      loadSalaryTab();
    });
  }

  function openDisburseLoanModal(preselectedStaffId = null) {
    const staffList = OJSchoolsDB.getStaff();
    const selectEl = document.getElementById("loan-staff");
    if (!selectEl) return;

    selectEl.innerHTML = '<option value="">-- Select Staff Member --</option>' +
      staffList.map(s => {
        const secLabel = SALARY_SECTION_NAMES[s.section] || s.section;
        const loanBal = s.loanBalance || 0;
        const loanInfo = loanBal > 0 ? ` | Current Balance: ₦${Number(loanBal).toLocaleString()}` : "";
        return `<option value="${s.id}">${s.name} (${secLabel} · ${s.role || "Staff"}${loanInfo})</option>`;
      }).join("");

    if (preselectedStaffId) selectEl.value = preselectedStaffId;

    const dateEl = document.getElementById("loan-date");
    if (dateEl) dateEl.value = new Date().toISOString().split("T")[0];

    const amtEl = document.getElementById("loan-amount");
    if (amtEl) amtEl.value = "";

    const notesEl = document.getElementById("loan-notes");
    if (notesEl) notesEl.value = "";

    openModal("modal-disburse-loan");
  }

  function saveStaffLoanDisbursement() {
    const staffId = document.getElementById("loan-staff")?.value;
    if (!staffId) return showAlert("Please select a staff member.", "warning");

    const amount = parseFloat(document.getElementById("loan-amount")?.value);
    if (!amount || amount <= 0) return showAlert("Please enter a valid loan amount greater than zero.", "warning");

    const date = document.getElementById("loan-date")?.value;
    if (!date) return showAlert("Please select the disbursement date.", "warning");

    const notes = (document.getElementById("loan-notes")?.value || "").trim();
    const disbursedBy = "Admin";

    try {
      OJSchoolsDB.disburseStaffLoan({ staffId, amount, date, notes, disbursedBy });
      showToast(`Loan of ₦${amount.toLocaleString()} disbursed successfully & logged as school expense.`, "success");
      closeModal("modal-disburse-loan");
      loadSalaryTab();
    } catch (err) {
      showAlert("Error disbursing loan: " + (err.message || err), "error");
    }
  }

  function printSalaryReport() {
    const year = document.getElementById("sal-filter-year")?.value || new Date().getFullYear();
    const section = document.getElementById("sal-filter-section")?.value || "All";
    OJSchoolsReports.printSalaryReport({ year, section });
  }



  // ════════════════════════════════════════════════════════════════
  // Expense Category Multi-Select Checkbox Dropdown helpers
  // ════════════════════════════════════════════════════════════════
  

return {
    init,
    switchTab,
    refreshCurrentTab,
    loadDashboard,
    loadOverview,
    loadLearners,
    loadClassHub,
    loadClearance,
    loadPayments,
    loadExpenses,
    loadDebtors,
    loadAuditLogs,
    loadSettings,
    saveSettings,
    viewClassStudents,
    selectClass: viewClassStudents,
    applyLearnerFilters,
    applyPaymentFilters,
    applyExpenseFilters,
    onLearnerClassFilterChange,
    onLearnerSectionFilterChange,
    onPaymentClassFilterChange,
    onPaymentSectionFilterChange,
    onDebtorClassFilterChange,
    updateFilterClassOptions,
    populateClassDropdowns,
    openEnrollModal,
    onEnrollClassChange,
    saveEnrollment,
    deleteStudent,
    openAddPaymentModal,
    onPaymentStudentChange,
    loadClassDefaultItems,
    addPaymentItemRow,
    removePaymentItemRow,
    updatePaymentItemField,
    onItemAmountInput,
    savePayment,
    deletePayment,
    openExpenseModal,
    openAddExpenseModal: openExpenseModal,
    saveExpense,
    deleteExpense,
    openStudentProfile,
    toggleClearance,
    printClearancePass,
    printReceipt,
    manualCloudSync,
    openMobileSidebar,
    closeMobileSidebar,
    toggleMobileSidebar,
    parseAmount,
    formatAmount,
    currency,
    openModal,
    closeModal,
    // ── BursarIQ additions ──
    loadSalaryTab,
    openAddStaffModal,
    openEditStaffModal,
    saveStaff,
    deleteStaff,
    openPaySalaryModal,
    onSalaryStaffSelect,
    _updateSalaryNetPreview,
    saveSalaryPayment,
    deleteSalaryPayment,
    printSalaryReport,
    openDisburseLoanModal,
    saveStaffLoanDisbursement,
    resetSalaryFilters,
    loadStocksTab,
    openAddStockModal,
    handleAddStockSubmit,
    openEditStockModal,
    handleEditStockSubmit,
    openSellStockModal,
    handleSellStockSubmit,
    openRestockModal,
    handleRestockSubmit,
    confirmDeleteStock,
    _updateSellTotal
  };
})();

if (typeof window !== "undefined") {
  window.OJSchoolsApp = OJSchoolsApp;
  window.RichVineApp = OJSchoolsApp; // Interoperability alias
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => OJSchoolsApp.init());
} else {
  OJSchoolsApp.init();
}
