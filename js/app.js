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

  // ── Tab Navigation ───────────────────────────────────────────────────────────
  function switchTab(tab) {
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
      "audit-logs": "Audit Trail",
      settings:     "School Settings & Fee Tariffs"
    };
    const headerTitle = document.getElementById("page-title");
    if (headerTitle) headerTitle.textContent = pageTitleMap[tab] || "OJ Schools Admin";

    // Close mobile sidebar on tab switch
    const sidebar = document.getElementById("sidebar");
    if (sidebar && window.innerWidth < 768) sidebar.classList.remove("open");

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

  // ── Populate Class Dropdowns ─────────────────────────────────────────────────
  function populateClassDropdowns() {
    const dropdowns = document.querySelectorAll("[data-class-select]");
    dropdowns.forEach(sel => {
      const currentVal = sel.value;
      sel.innerHTML = '<option value="">-- Select Class --</option>';
      for (const [, sec] of Object.entries(SCHOOL_SECTIONS)) {
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

    const sections = ["primary", "junior", "senior", "tutorial"];
    container.innerHTML = sections.map(secId => {
      const sec     = SCHOOL_SECTIONS[secId];
      const style   = sectionColors[secId];
      const students = OJSchoolsDB.getStudents().filter(s =>
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
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // LEARNERS
  // ─────────────────────────────────────────────────────────────────────────────
  function loadLearners(filterSection = "", filterClass = "", searchQuery = "") {
    let students = OJSchoolsDB.getStudents();

    if (filterSection) {
      students = students.filter(s =>
        (s.section || (getSectionByClass(s.currentClass) ? getSectionByClass(s.currentClass).id : "primary")) === filterSection
      );
    }
    if (filterClass) {
      students = students.filter(s => s.currentClass === filterClass);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      students = students.filter(s =>
        `${s.firstName} ${s.lastName}`.toLowerCase().includes(q) ||
        (s.regNo || "").toLowerCase().includes(q) ||
        (s.currentClass || "").toLowerCase().includes(q)
      );
    }

    const tbody = document.getElementById("learners-tbody");
    if (!tbody) return;

    if (students.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" class="empty-cell"><i class="fas fa-users-slash" style="margin-right:8px;opacity:.4"></i>No learners found.</td></tr>`;
      return;
    }

    tbody.innerHTML = students.map(s => {
      const sec  = getSectionByClass(s.currentClass) || SCHOOL_SECTIONS.primary;
      const bal  = OJSchoolsDB.getStudentBalance(s.id);
      const outstanding = bal ? bal.totalOutstanding : 0;
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
          <td>${s.currentClass || "—"}</td>
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

    container.innerHTML = sections.map(secId => {
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
    const filterClassSel = document.getElementById("filter-class");
    if (filterClassSel) filterClassSel.value = className;
    switchTab("learners");
    loadLearners("", className, "");
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // CLEARANCE
  // ─────────────────────────────────────────────────────────────────────────────
  function loadClearance(filterSection = "") {
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
  function loadPayments(filterSection = "", filterClass = "", searchQuery = "") {
    let payments = OJSchoolsDB.getPayments();

    if (filterSection) {
      payments = payments.filter(p => p.section === filterSection);
    }
    if (filterClass) {
      payments = payments.filter(p => p.studentClass === filterClass);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      payments = payments.filter(p =>
        (p.studentName || "").toLowerCase().includes(q) ||
        (p.receiptNumber || "").toLowerCase().includes(q) ||
        (p.studentRegNo || "").toLowerCase().includes(q)
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
  function loadDebtors(filterSection = "", searchQuery = "") {
    let debtors = OJSchoolsDB.getDebtors(filterSection || "all");

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
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
      tbody.innerHTML = `<tr><td colspan="8" class="empty-cell" style="color:#059669"><i class="fas fa-circle-check" style="margin-right:8px"></i>No debtors found in this category. Excellent!</td></tr>`;
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

    const sections = ["primary", "junior", "senior", "tutorial"];
    const sectionNames = {
      primary:  "Primary Section (Creche, KG 1 & 2, Nursery 1-2, Basic 1-6)",
      junior:   "Junior Secondary (JSS 1–3)",
      senior:   "Senior Secondary (SSS 1–3)",
      tutorial: "Tutorial Section"
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
    const modal = document.getElementById("modal-enroll");
    if (!modal) return;

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

    modal.classList.remove("hidden");
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

  function saveEnrollment() {
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
    const modal = document.getElementById("modal-payment");
    if (!modal) return;

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
    modal.classList.remove("hidden");
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
    const modal = document.getElementById("modal-expense");
    if (!modal) return;
    const form = document.getElementById("expense-form");
    if (form) form.reset();
    const dateEl = document.getElementById("exp-date");
    if (dateEl) dateEl.value = new Date().toISOString().split("T")[0];
    modal.classList.remove("hidden");
  }

  function saveExpense() {
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
    const modal = document.getElementById("modal-expense");
    if (modal) modal.classList.add("hidden");
    showToast(`Expense "${title}" (${currency(amount)}) logged.`, "success");
    loadExpenses();
    loadDashboard();
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // STUDENT PROFILE MODAL
  // ─────────────────────────────────────────────────────────────────────────────
  function openStudentProfile(studentId) {
    const modal = document.getElementById("modal-profile");
    if (!modal) return;

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

    modal.classList.remove("hidden");
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
  function init() {
    if (!sessionStorage.getItem("oj_schools_admin_session")) {
      window.location.href = "admin/index.html";
      return;
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

    // Sidebar toggle (mobile)
    const sidebarToggle = document.getElementById("sidebar-toggle");
    const sidebar       = document.getElementById("sidebar");
    if (sidebarToggle && sidebar) {
      sidebarToggle.addEventListener("click", () => sidebar.classList.toggle("open"));
    }

    const mainEl = document.getElementById("main");
    if (mainEl && sidebar) {
      mainEl.addEventListener("click", () => {
        if (window.innerWidth < 768) sidebar.classList.remove("open");
      });
    }

    // Modal close bindings
    document.querySelectorAll(".modal-overlay").forEach(overlay => {
      overlay.addEventListener("click", e => {
        if (e.target === overlay) overlay.classList.add("hidden");
      });
    });
    window.addEventListener("keydown", e => {
      if (e.key === "Escape") {
        document.querySelectorAll(".modal-overlay").forEach(m => m.classList.add("hidden"));
      }
    });

    // Currency input bindings
    ["exp-amount", "enroll-term-fee", "enroll-arrears"].forEach(id => {
      bindCurrencyInput(document.getElementById(id));
    });

    // Learners filter wiring
    const filterSection = document.getElementById("filter-section");
    const filterClass   = document.getElementById("filter-class");
    const searchInput   = document.getElementById("search-student");
    if (filterSection) filterSection.addEventListener("change", () => applyLearnerFilters());
    if (filterClass)   filterClass.addEventListener("change",   () => applyLearnerFilters());
    if (searchInput)   searchInput.addEventListener("input",    () => applyLearnerFilters());

    // Payments filter wiring
    const payFilterSection = document.getElementById("pay-filter-section");
    const payFilterClass   = document.getElementById("pay-filter-class");
    const paySearch        = document.getElementById("pay-search");
    if (payFilterSection) payFilterSection.addEventListener("change", () => applyPaymentFilters());
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
    loadDashboard();
    switchTab("dashboard");
  }

  function applyLearnerFilters() {
    const section = document.getElementById("filter-section")?.value || "";
    const cls     = document.getElementById("filter-class")?.value   || "";
    const query   = document.getElementById("search-student")?.value || "";
    loadLearners(section, cls, query);
  }

  function applyPaymentFilters() {
    const section = document.getElementById("pay-filter-section")?.value || "";
    const cls     = document.getElementById("pay-filter-class")?.value   || "";
    const query   = document.getElementById("pay-search")?.value         || "";
    loadPayments(section, cls, query);
  }

  function applyExpenseFilters() {
    const account = document.getElementById("exp-filter-account")?.value || "";
    const period  = document.getElementById("exp-filter-period")?.value  || "";
    loadExpenses(account, period);
  }

  // Public API
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
    saveExpense,
    deleteExpense,
    openStudentProfile,
    toggleClearance,
    printClearancePass,
    printReceipt,
    manualCloudSync,
    parseAmount,
    formatAmount,
    currency
  };
})();

if (typeof window !== "undefined") {
  window.OJSchoolsApp = OJSchoolsApp;
}

document.addEventListener("DOMContentLoaded", OJSchoolsApp.init);
