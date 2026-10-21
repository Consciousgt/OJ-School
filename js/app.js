/**
 * OJ SCHOOLS — Main App Controller v1
 * Full-featured bursary management system for 4 school sections:
 * Primary, Junior Secondary, Senior Secondary, Tutorial
 */

const OJSchoolsApp = (() => {
  let currentTab = "dashboard";

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
    return "₦" + formatAmount(val, true);
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
  function showToast(message, type = "default", duration = 3000) {
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
      dashboard: "System Dashboard",
      overview:  "P&L Financial Overview",
      learners:  "Learners Register",
      "class-hub": "Class Hub",
      clearance: "Examination Clearance",
      payments:  "Payments Ledger",
      expenses:  "Expenses Ledger",
      reports:   "Reports & Exports"
    };
    const headerTitle = document.getElementById("page-title");
    if (headerTitle) headerTitle.textContent = pageTitleMap[tab] || "OJ Schools Admin";

    // Close mobile sidebar on tab switch
    const sidebar = document.getElementById("sidebar");
    if (sidebar && window.innerWidth < 768) sidebar.classList.remove("open");

    // Load content for each tab
    if (tab === "dashboard")   loadDashboard();
    if (tab === "overview")    loadOverview();
    if (tab === "learners")    loadLearners();
    if (tab === "class-hub")   loadClassHub();
    if (tab === "clearance")   loadClearance();
    if (tab === "payments")    loadPayments();
    if (tab === "expenses")    loadExpenses();
    if (tab === "reports")     loadReports();
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

  // ── Populate Dropdowns ───────────────────────────────────────────────────────
  function populateClassDropdowns() {
    const dropdowns = document.querySelectorAll("[data-class-select]");
    dropdowns.forEach(sel => {
      const currentVal = sel.value;
      sel.innerHTML = '<option value="">-- Select Class --</option>';
      for (const [secId, sec] of Object.entries(SCHOOL_SECTIONS)) {
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

    set("dash-total-students",     summary.totalStudents.toLocaleString());
    set("dash-total-revenue",      currency(summary.totalRevenue));
    set("dash-total-expenses",     currency(summary.totalExpenses));
    set("dash-net-profit",         currency(summary.netProfit));
    set("dash-total-term-fees",    currency(summary.totalTermFeesPaid));
    set("dash-arrears-recovered",  currency(summary.totalArrearsRecovered));
    set("dash-other-fees",         currency(summary.totalOtherFeesPaid));
    set("dash-outstanding-arrears",currency(summary.totalOutstandingArrears));
    set("dash-unpaid-term-fees",   currency(summary.totalUnpaidTermFees));
    set("dash-total-debtors",      summary.totalDebtorsCount);
    set("dash-session",            `${config.currentSession} — ${config.currentTerm}`);

    // Net profit color
    const npEl = document.getElementById("dash-net-profit");
    if (npEl) npEl.style.color = summary.netProfit >= 0 ? "var(--oj-emerald-600)" : "var(--color-danger)";

    // Recent payments
    renderRecentPayments();

    // Section enrollment cards
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
      return `
        <div class="recent-pay-item">
          <div class="rp-icon"><i class="fas fa-money-bill-trend-up"></i></div>
          <div class="rp-info">
            <div class="rp-name">${p.studentName || "—"} <small class="rp-class">${p.studentClass || ""}</small></div>
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
      primary:  { icon: "fas fa-child",             gradient: "from-emerald-600 to-emerald-500",  light: "#d1fae5", dark: "#047857" },
      junior:   { icon: "fas fa-school",             gradient: "from-blue-600 to-blue-500",        light: "#dbeafe", dark: "#1d4ed8" },
      senior:   { icon: "fas fa-graduation-cap",     gradient: "from-purple-600 to-purple-500",    light: "#ede9fe", dark: "#6d28d9" },
      tutorial: { icon: "fas fa-book-open-reader",   gradient: "from-orange-600 to-orange-500",    light: "#ffedd5", dark: "#c2410c" }
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
    if (npEl) npEl.style.color = summary.netProfit >= 0 ? "var(--oj-emerald-600)" : "var(--color-danger)";

    // Section breakdowns
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
              <div class="ov-amount" style="color:#b45309">${data.totalDebtorsCount}</div>
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
          <td class="amount-cell">${currency(bal ? bal.arrearsPaid + bal.termFeePaid : 0)}</td>
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
      const canClear = outstanding <= 0;
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

      return `
        <tr>
          <td><span class="receipt-no">${p.receiptNumber || p.id}</span></td>
          <td>${p.studentName || "—"}<br><small style="color:var(--oj-gray-400)">${p.studentRegNo || ""}</small></td>
          <td>${p.studentClass || "—"}</td>
          <td>${sectionBadge}</td>
          <td>${p.date || "—"}</td>
          <td class="amount-cell"><strong>${currency(p.amount)}</strong>
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
          <td><strong>${e.title || "—"}</strong>${e.notes ? `<br><small style="color:var(--oj-gray-400)">${e.notes}</small>` : ""}</td>
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

  // ─────────────────────────────────────────────────────────────────────────────
  // REPORTS
  // ─────────────────────────────────────────────────────────────────────────────
  function loadReports() {
    // Reports are trigger-based — UI renders buttons, no auto-load needed
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
    // Populate fee categories
    const catSel = document.getElementById("enroll-fee-cat");
    if (catSel) {
      catSel.innerHTML = OJSchoolsDB.get().feeCategories.map(f =>
        `<option value="${f.id}">${f.name}</option>`
      ).join("");
    }

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
      // Auto-generate reg number
      const regEl = document.getElementById("enroll-regno");
      if (regEl) regEl.value = "OJS-" + Date.now().toString().slice(-6);
    }

    modal.classList.remove("hidden");
  }

  function saveEnrollment() {
    const editId = document.getElementById("enroll-edit-id")?.value;
    const get    = id => document.getElementById(id)?.value?.trim() || "";

    const firstName = get("enroll-firstname");
    const lastName  = get("enroll-lastname");
    const regNo     = get("enroll-regno");
    const cls       = get("enroll-class");

    if (!firstName || !lastName || !regNo || !cls) {
      showToast("Please fill in all required fields.", "error");
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
    if (!confirm(`Delete ${stu.firstName} ${stu.lastName} and all associated payments? This cannot be undone.`)) return;
    OJSchoolsDB.deleteStudent(studentId);
    showToast("Learner deleted.", "success");
    loadLearners();
    loadDashboard();
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // MODALS — RECORD PAYMENT
  // ─────────────────────────────────────────────────────────────────────────────
  function openAddPaymentModal(studentId = null) {
    const modal = document.getElementById("modal-payment");
    if (!modal) return;

    const form = document.getElementById("payment-form");
    if (form) form.reset();

    const stuSelect = document.getElementById("pay-student");
    if (stuSelect) {
      const students = OJSchoolsDB.getStudents().filter(s => s.status === "Active" || !s.status);
      stuSelect.innerHTML = '<option value="">-- Select Student --</option>' +
        students.map(s => {
          const bal = OJSchoolsDB.getStudentBalance(s.id);
          const outstanding = bal ? bal.totalOutstanding : 0;
          return `<option value="${s.id}" data-outstanding="${outstanding}" data-name="${s.firstName} ${s.lastName}">${s.firstName} ${s.lastName} — ${s.currentClass} ${outstanding > 0 ? "⚠️ ₦" + formatAmount(outstanding) + " outstanding" : "✓"}</option>`;
        }).join("");
      if (studentId) stuSelect.value = studentId;
    }

    // Default date = today
    const dateEl = document.getElementById("pay-date");
    if (dateEl) dateEl.value = new Date().toISOString().split("T")[0];

    // Populate fee categories
    const catSel = document.getElementById("pay-fee-cat");
    if (catSel) {
      catSel.innerHTML = `
        <option value="school_fees">School Fees / Tuition</option>
        <option value="tutorial_fee">Tutorial Fee</option>
        <option value="uniform">Uniform & Sportswear</option>
        <option value="textbooks">Textbooks & Modules</option>
        <option value="exercise_books">Exercise Books</option>
        <option value="ict_cbt_levy">ICT / CBT Lab Levy</option>
        <option value="pta_development">PTA & Development Levy</option>
        <option value="bece_fee">BECE / Junior WAEC Fee</option>
        <option value="waec_fee">WAEC Exam Fee</option>
        <option value="neco_fee">NECO Exam Fee</option>
        <option value="jamb_cbt_drill">JAMB/UTME Mock & CBT</option>
        <option value="other_special_fee">Other / Miscellaneous</option>
      `;
    }

    // Update outstanding info when student changes
    if (stuSelect) {
      stuSelect.addEventListener("change", () => {
        const opt = stuSelect.options[stuSelect.selectedIndex];
        const outstanding = Number(opt?.dataset?.outstanding || 0);
        const infoEl = document.getElementById("pay-outstanding-info");
        if (infoEl) {
          infoEl.textContent = outstanding > 0
            ? `⚠️ Outstanding balance: ${currency(outstanding)} — Arrears will be deducted first.`
            : "✓ This learner has no outstanding balance.";
          infoEl.style.color = outstanding > 0 ? "#92400e" : "#047857";
          infoEl.style.background = outstanding > 0 ? "#fff3cd" : "#d1fae5";
        }
      });
    }

    modal.classList.remove("hidden");
  }

  function savePayment() {
    const studentId = document.getElementById("pay-student")?.value;
    const amount    = parseAmount(document.getElementById("pay-amount")?.value || "0");
    const method    = document.getElementById("pay-method")?.value || "Cash";
    const date      = document.getElementById("pay-date")?.value;
    const notes     = document.getElementById("pay-notes")?.value?.trim() || "";
    const category  = document.getElementById("pay-fee-cat")?.value || "school_fees";
    const recordedBy= document.getElementById("pay-recorded-by")?.value?.trim() || "Bursar";

    if (!studentId) { showToast("Please select a student.", "error"); return; }
    if (amount <= 0) { showToast("Amount must be greater than zero.", "error"); return; }

    try {
      const paymentData = {
        studentId,
        amount,
        method,
        date,
        notes,
        category,
        recordedBy,
        description: `${category.replace(/_/g, " ")} payment`
      };

      const saved = OJSchoolsDB.savePayment(paymentData);
      const modal = document.getElementById("modal-payment");
      if (modal) modal.classList.add("hidden");

      showToast(`Payment of ${currency(amount)} recorded! Receipt: ${saved.receiptNumber}`, "success", 5000);
      loadPayments();
      loadDashboard();
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

    if (!title)    { showToast("Expense title is required.", "error"); return; }
    if (amount <= 0){ showToast("Amount must be greater than zero.", "error"); return; }

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
    set("profile-name",    `${stu.firstName} ${stu.lastName}`);
    set("profile-regno",   stu.regNo || "—");
    set("profile-class",   stu.currentClass || "—");
    set("profile-section", sec.name);
    set("profile-status",  stu.status || "Active");
    set("profile-gender",  stu.gender || "—");
    set("profile-dob",     stu.dob    || "—");
    set("profile-parent",  stu.parentName  || "—");
    set("profile-phone",   stu.parentPhone || "—");
    set("profile-email",   stu.parentEmail || "—");
    set("profile-enrolled",stu.enrolledDate || "—");
    set("profile-address", stu.address || "—");

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
                <div style="font-size:11px;color:var(--oj-gray-400)">${p.date || ""} &bull; ${p.method || "Cash"}</div>
              </div>
              <div class="amount-cell"><strong>${currency(p.amount)}</strong></div>
            </div>
          `).join("");
    }

    // Avatar initials
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
    // Auth guard
    if (!sessionStorage.getItem("oj_schools_admin_session")) {
      window.location.href = "admin/index.html";
      return;
    }

    const user = sessionStorage.getItem("oj_schools_admin_name") || "Admin";
    const role = sessionStorage.getItem("oj_schools_admin_role") || "";
    const el = document.getElementById("current-user-name");
    if (el) el.textContent = user;
    const roleEl = document.getElementById("current-user-role");
    if (roleEl) roleEl.textContent = role;

    // Tab navigation
    document.querySelectorAll("[data-tab]").forEach(btn => {
      btn.addEventListener("click", () => switchTab(btn.dataset.tab));
    });

    // Logout buttons
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

    // Close sidebar on main content click (mobile)
    const mainEl = document.getElementById("main");
    if (mainEl && sidebar) {
      mainEl.addEventListener("click", () => {
        if (window.innerWidth < 768) sidebar.classList.remove("open");
      });
    }

    // Close modals on overlay click or Escape key
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

    // Currency input formatters
    ["pay-amount", "exp-amount", "enroll-term-fee", "enroll-arrears"].forEach(id => {
      bindCurrencyInput(document.getElementById(id));
    });

    // Filter wiring for learners tab
    const filterSection = document.getElementById("filter-section");
    const filterClass   = document.getElementById("filter-class");
    const searchInput   = document.getElementById("search-student");
    if (filterSection) filterSection.addEventListener("change", () => applyLearnerFilters());
    if (filterClass)   filterClass.addEventListener("change",   () => applyLearnerFilters());
    if (searchInput)   searchInput.addEventListener("input",    () => applyLearnerFilters());

    // Filter wiring for payments tab
    const payFilterSection = document.getElementById("pay-filter-section");
    const payFilterClass   = document.getElementById("pay-filter-class");
    const paySearch        = document.getElementById("pay-search");
    if (payFilterSection) payFilterSection.addEventListener("change", () => applyPaymentFilters());
    if (payFilterClass)   payFilterClass.addEventListener("change",   () => applyPaymentFilters());
    if (paySearch)        paySearch.addEventListener("input",         () => applyPaymentFilters());

    // Filter wiring for expenses tab
    const expFilterAccount = document.getElementById("exp-filter-account");
    const expFilterPeriod  = document.getElementById("exp-filter-period");
    if (expFilterAccount) expFilterAccount.addEventListener("change", () => applyExpenseFilters());
    if (expFilterPeriod)  expFilterPeriod.addEventListener("change",  () => applyExpenseFilters());

    // Clearance filter
    const clearFilter = document.getElementById("clear-filter-section");
    if (clearFilter) clearFilter.addEventListener("change", () => loadClearance(clearFilter.value));

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
    viewClassStudents,
    openEnrollModal,
    saveEnrollment,
    deleteStudent,
    openAddPaymentModal,
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
