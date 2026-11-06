/**
 * OJ SCHOOLS - Complete Core Data Architecture & Ledger Engine v2
 * Academic Session: 2026/2027
 *
 * 4 Distinct Sections:
 * 1. Primary Section  (Creche, KG 1, KG 2, Nursery 1-2, Basic 1-6)
 * 2. Junior Secondary (JSS 1-3, A/B streams)
 * 3. Senior Secondary (SSS 1-3, Science/Art/Commercial)
 * 4. Tutorial Section
 *
 * Key Principles:
 * - Per-class default fee schedules (auto-populated in payment modal)
 * - Arrears-First Priority Deduction on every payment
 * - Multi-item payment line items supported
 * - Multi-section expense ledger & P&L breakdown
 * - Settings: school name, term, session configurable from dashboard
 * - Resilient LocalStorage persistence + Firestore cloud sync bridge
 */

// ─── School Sections & Class Definitions ─────────────────────────────────────
// Only active classes with enrolled learners are maintained.
const SCHOOL_SECTIONS = {
  primary: {
    id: "primary",
    name: "Primary Section",
    icon: "fas fa-child",
    badgeClass: "badge-section-primary",
    color: "#059669",
    classes: [
      "Creche",
      "KG 1",
      "KG 2",
      "Nursery 1",
      "Nursery 2",
      "Basic 1",
      "Basic 2",
      "Basic 3",
      "Basic 4",
      "Basic 5"
    ]
  },
  junior: {
    id: "junior",
    name: "Junior Secondary",
    icon: "fas fa-school",
    badgeClass: "badge-section-junior",
    color: "#2563eb",
    classes: [
      "JSS 1",
      "JSS 2",
      "JSS 3"
    ]
  },
  senior: {
    id: "senior",
    name: "Senior Secondary",
    icon: "fas fa-graduation-cap",
    badgeClass: "badge-section-senior",
    color: "#7c3aed",
    classes: [
      "SSS 1",
      "SSS 2",
      "SSS 3"
    ]
  },
  tutorial: {
    id: "tutorial",
    name: "Tutorial Section",
    icon: "fas fa-book-open-reader",
    badgeClass: "badge-section-tutorial",
    color: "#ea580c",
    classes: []
  }
};

const ALL_CLASSES = [
  ...SCHOOL_SECTIONS.primary.classes,
  ...SCHOOL_SECTIONS.junior.classes,
  ...SCHOOL_SECTIONS.senior.classes
];

function getSectionByClass(className) {
  if (!className) return null;
  for (const [key, sec] of Object.entries(SCHOOL_SECTIONS)) {
    if (sec.classes.includes(className)) return sec;
  }
  const lower = className.toLowerCase();
  if (lower.includes("creche") || lower.includes("kg") || lower.includes("nursery") ||
      lower.includes("basic") || lower.includes("kindergarten") || lower.includes("primary")) {
    return SCHOOL_SECTIONS.primary;
  }
  if (lower.includes("jss") || lower.includes("junior")) return SCHOOL_SECTIONS.junior;
  if (lower.includes("sss") || lower.includes("senior"))  return SCHOOL_SECTIONS.senior;
  if (lower.includes("tutorial") || lower.includes("jamb") || lower.includes("utme") ||
      lower.includes("gce") || lower.includes("prep"))    return SCHOOL_SECTIONS.tutorial;
  return null;
}

// ─── Expense Accounts (Sectional P&L) ────────────────────────────────────────
const EXPENSE_ACCOUNTS = [
  { id: "general",  name: "General / Central Operations", icon: "fas fa-building-columns", color: "#0a192f" },
  { id: "primary",  name: "Primary Section Account",      icon: "fas fa-child",            color: "#059669" },
  { id: "junior",   name: "Junior Secondary Account",     icon: "fas fa-school",           color: "#2563eb" },
  { id: "senior",   name: "Senior Secondary Account",     icon: "fas fa-graduation-cap",   color: "#7c3aed" },
  { id: "tutorial", name: "Tutorial Section Account",     icon: "fas fa-book-open-reader", color: "#ea580c" }
];

// ─── Fee Categories Definition ────────────────────────────────────────────────
const FEE_CATEGORIES = [
  { id: "tuition",               name: "Tuition / School Fees (Termly)" },
  { id: "uniform",               name: "School Uniform" },
  { id: "sport_wear",            name: "Sport Wear" },
  { id: "report_card",           name: "Report Card" },
  { id: "continuous_assessment", name: "Continuous Assessment (CA)" },
  { id: "friday_wear",           name: "Friday Wear" },
  { id: "cbt_exams",             name: "CBT Exams (Per Term)" },
  { id: "bece_registration",     name: "BECE / Junior WAEC Registration" },
  { id: "waec_registration",     name: "WAEC Registration" },
  { id: "jamb_registration",     name: "JAMB Registration" },
  { id: "extra_lessons",         name: "Extra Lessons (3 Terms)" },
  { id: "daycare_fee",           name: "Day Care / Monthly Care Fee" },
  { id: "tutorial_fee",          name: "Tutorial Tuition & Coaching" },
  { id: "pta_development",       name: "PTA & School Development Levy" },
  { id: "other",                 name: "Other / Miscellaneous Fee" }
];

// ─── Per-Class Default Fee Schedules ─────────────────────────────────────────
// KG 1 and KG 2 are separate classes but pay the same fee amounts.
// 0 = fee category exists but amount entered manually (e.g. Friday Wear).
const CLASS_FEE_SCHEDULES = {
  // Creche, KG 1, KG 2 — same amounts
  "Creche": { tuition: 20000, uniform: 10000, sport_wear: 8000, report_card: 3000, friday_wear: 0 },
  "KG 1":   { tuition: 20000, uniform: 10000, sport_wear: 8000, report_card: 3000, friday_wear: 0 },
  "KG 2":   { tuition: 20000, uniform: 10000, sport_wear: 8000, report_card: 3000, friday_wear: 0 },

  "Nursery 1": { tuition: 21000, continuous_assessment: 3000, uniform: 10000, sport_wear: 8000, report_card: 3000, friday_wear: 0 },
  "Nursery 2": { tuition: 22000, continuous_assessment: 3000, uniform: 10000, sport_wear: 8000, report_card: 3000, friday_wear: 0 },

  "Basic 1": { tuition: 23000, continuous_assessment: 3000, uniform: 10000, sport_wear: 8000, report_card: 3000, friday_wear: 0 },
  "Basic 2": { tuition: 24000, continuous_assessment: 3000, uniform: 10000, sport_wear: 8000, report_card: 3000, friday_wear: 0 },
  "Basic 3": { tuition: 24000, continuous_assessment: 3000, uniform: 10000, sport_wear: 8000, report_card: 3000, friday_wear: 0 },
  "Basic 4": { tuition: 25000, continuous_assessment: 3000, uniform: 10000, sport_wear: 8000, report_card: 3000, friday_wear: 0 },
  "Basic 5": { tuition: 25000, bece_registration: 25000, continuous_assessment: 3000, uniform: 10000, sport_wear: 8000, report_card: 4000, friday_wear: 0 },

  "JSS 1": { tuition: 32000, continuous_assessment: 3000, uniform: 10000, sport_wear: 8000, report_card: 4000, cbt_exams: 3000, friday_wear: 0 },
  "JSS 2": { tuition: 32000, continuous_assessment: 3000, uniform: 10000, sport_wear: 8000, report_card: 4000, cbt_exams: 3000, friday_wear: 0 },
  "JSS 3": { tuition: 32000, bece_registration: 40000, continuous_assessment: 3000, uniform: 10000, sport_wear: 8000, report_card: 4000, cbt_exams: 3000, friday_wear: 0 },

  "SSS 1": { tuition: 37000, uniform: 12000, sport_wear: 7000, report_card: 4000, continuous_assessment: 3000, cbt_exams: 3000, friday_wear: 0 },
  "SSS 2": { tuition: 37000, uniform: 12000, sport_wear: 7000, report_card: 4000, continuous_assessment: 3000, cbt_exams: 3000, friday_wear: 0 },

  // SSS 3: Term 1 & 2 = 43,000; Term 3 = 21,500 (admin edits amount at runtime for term 3)
  "SSS 3": { tuition: 43000, waec_registration: 80000, jamb_registration: 40000, extra_lessons: 40000, sport_wear: 7000, friday_wear: 0 }
};

function getClassFeeSchedule(className) {
  if (!className) return {};
  if (CLASS_FEE_SCHEDULES[className]) return CLASS_FEE_SCHEDULES[className];
  for (const [k, v] of Object.entries(CLASS_FEE_SCHEDULES)) {
    if (className.startsWith(k) || k.startsWith(className)) return v;
  }
  return {};
}

function getClassFeeItems(className) {
  const schedule = getClassFeeSchedule(className);
  return Object.entries(schedule).map(([catId, defaultAmount]) => {
    const cat = FEE_CATEGORIES.find(c => c.id === catId);
    return {
      id: catId,
      name: cat ? cat.name : catId.replace(/_/g, " "),
      defaultAmount
    };
  });
}

function getClassDefaultTuition(className) {
  return (CLASS_FEE_SCHEDULES[className] || {}).tuition || 0;
}

if (typeof window !== "undefined") {
  window.SCHOOL_SECTIONS      = SCHOOL_SECTIONS;
  window.ALL_CLASSES          = ALL_CLASSES;
  window.EXPENSE_ACCOUNTS     = EXPENSE_ACCOUNTS;
  window.FEE_CATEGORIES       = FEE_CATEGORIES;
  window.CLASS_FEE_SCHEDULES  = CLASS_FEE_SCHEDULES;
  window.getSectionByClass    = getSectionByClass;
  window.getClassFeeSchedule  = getClassFeeSchedule;
  window.getClassFeeItems     = getClassFeeItems;
  window.getClassDefaultTuition = getClassDefaultTuition;
}

// ─── Default Configuration & Clean State ─────────────────────────────────────
const DEFAULT_DATA = {
  config: {
    schoolName:     "OJ SCHOOLS",
    motto:          "Knowledge, Diligence & Distinction",
    address:        "OJ Schools Educational Complex, Lagos / Ogun State, Nigeria",
    contactEmail:   "info@oj-schools.firebaseapp.com",
    phone:          "08031234567",
    adminContact:   "08031234567",
    currentSession: "2026/2027",
    currentTerm:    "1st Term",
    currency:       "\u20a6"
  },
  classes:       ALL_CLASSES,
  feeCategories: FEE_CATEGORIES,
  students:      typeof OFFICIAL_STUDENTS_DATA !== "undefined" ? OFFICIAL_STUDENTS_DATA : [],
  payments:      [],
  expenses:      [],
  staff:         [],
  salaries:      [],
  stocks:        [],
  stockSales:    [],
  stockRestocks: [],
  _pendingDeletes: [],
  _tombstones:   {},
  auditLogs: [{
    id:          "LOG-INIT",
    timestamp:   Date.now(),
    date:        new Date().toLocaleString("en-GB"),
    action:      "SYSTEM_INITIALIZE",
    entity:      "system",
    performedBy: "System",
    user:        "System",
    details:     "OJ Schools Bursary & Records Database v2 initialized."
  }]
};

// ─── LocalStorage & Persistence Engine ───────────────────────────────────────
class OJSchoolsDB {
  static KEY = "OJ_SCHOOLS_DB_V2_LIVE";
  static SEED_KEY = "OJ_STUDENTS_SEEDED_2026_V1";

  static init() {
    const raw = localStorage.getItem(this.KEY);
    if (!raw) {
      // Migrate from v1 key if present
      const old = localStorage.getItem("OJ_SCHOOLS_DB_V1_LIVE");
      if (old) {
        try {
          const parsed  = JSON.parse(old);
          const fresh   = JSON.parse(JSON.stringify(DEFAULT_DATA));
          fresh.students  = (parsed.students && parsed.students.length > 0)
            ? parsed.students
            : (typeof OFFICIAL_STUDENTS_DATA !== "undefined" ? OFFICIAL_STUDENTS_DATA : []);
          fresh.payments  = parsed.payments  || [];
          fresh.expenses  = parsed.expenses  || [];
          fresh.auditLogs = parsed.auditLogs || fresh.auditLogs;
          if (parsed.config) fresh.config = { ...fresh.config, ...parsed.config };
          localStorage.setItem(this.KEY, JSON.stringify(fresh));
          localStorage.removeItem("OJ_SCHOOLS_DB_V1_LIVE");
          localStorage.setItem(this.SEED_KEY, "true");
          return;
        } catch (e) {
          localStorage.setItem(this.KEY, JSON.stringify(DEFAULT_DATA));
          localStorage.setItem(this.SEED_KEY, "true");
          return;
        }
      } else {
        localStorage.setItem(this.KEY, JSON.stringify(DEFAULT_DATA));
        localStorage.setItem(this.SEED_KEY, "true");
        return;
      }
    }

    // Auto-seed existing localStorage if official roster not yet merged
    if (!localStorage.getItem(this.SEED_KEY) && typeof OFFICIAL_STUDENTS_DATA !== "undefined") {
      try {
        const data = JSON.parse(raw);
        if (!data.students || data.students.length === 0) {
          data.students = JSON.parse(JSON.stringify(OFFICIAL_STUDENTS_DATA));
        } else {
          const existingIds = new Set(data.students.map(s => s.id));
          const existingRegNos = new Set(data.students.map(s => (s.regNo || "").toUpperCase()));
          const existingNames = new Set(data.students.map(s => `${s.firstName} ${s.lastName}`.trim().toUpperCase()));
          for (const s of OFFICIAL_STUDENTS_DATA) {
            const fullName = `${s.firstName} ${s.lastName}`.trim().toUpperCase();
            if (!existingIds.has(s.id) && !existingRegNos.has(s.regNo.toUpperCase()) && !existingNames.has(fullName)) {
              data.students.push(s);
            }
          }
        }
        localStorage.setItem(this.KEY, JSON.stringify(data));
        localStorage.setItem(this.SEED_KEY, "true");
      } catch (_) {
        localStorage.setItem(this.SEED_KEY, "true");
      }
    }
  }

  static get() {
    this.init();
    try {
      const data = JSON.parse(localStorage.getItem(this.KEY));
      if (!data.students)   data.students   = [];
      if (!data.payments)   data.payments   = [];
      if (!data.expenses)   data.expenses   = [];
      if (!data.auditLogs)  data.auditLogs  = [];
      if (!data.config)     data.config     = DEFAULT_DATA.config;
      data.feeCategories = FEE_CATEGORIES;
      data.classes       = ALL_CLASSES;

      // Anti-orphan guard
      const validIds = new Set(data.students.map(s => s.id));
      if (data.payments.some(p => p.studentId && !validIds.has(p.studentId))) {
        data.payments = data.payments.filter(p => !p.studentId || validIds.has(p.studentId));
        this.save(data, false);
      }
      return data;
    } catch (e) {
      localStorage.setItem(this.KEY, JSON.stringify(DEFAULT_DATA));
      return JSON.parse(JSON.stringify(DEFAULT_DATA));
    }
  }

  static save(data, triggerCloudSync = true) {
    localStorage.setItem(this.KEY, JSON.stringify(data));
    if (triggerCloudSync && window.OJSchoolsFirebase &&
        typeof window.OJSchoolsFirebase.syncWithCloud === "function") {
      window.OJSchoolsFirebase.syncWithCloud();
    }
  }

  // ── Config ──
  static getConfig() { return this.get().config; }

  static updateConfig(partialConfig) {
    const data = this.get();
    data.config = { ...data.config, ...partialConfig };
    this.save(data);
    this.logAction("CONFIG_UPDATE", "Admin", "Updated school configuration.");
    return data.config;
  }

  // ── Students ──
  static getStudents()      { return this.get().students; }
  static getStudentById(id) { return this.getStudents().find(s => s.id === id) || null; }

  static saveStudent(studentData) {
    const data = this.get();
    const idx  = data.students.findIndex(s => s.id === studentData.id);

    studentData.termFee = Number(studentData.termFee) || 0;
    studentData.arrears = Number(studentData.arrears) || 0;
    if (!studentData.status)          studentData.status          = "Active";
    if (!studentData.clearanceStatus) studentData.clearanceStatus = "Pending";
    if (!studentData.enrolledDate)    studentData.enrolledDate    = new Date().toISOString().split("T")[0];
    if (!studentData.section) {
      const sec = getSectionByClass(studentData.currentClass);
      studentData.section = sec ? sec.id : "primary";
    }

    let action = "ENROLL_STUDENT";
    let details = "";
    if (idx >= 0) {
      data.students[idx] = { ...data.students[idx], ...studentData };
      action = "UPDATE_STUDENT";
      details = `Updated ${studentData.firstName} ${studentData.lastName} (${studentData.regNo})`;
    } else {
      if (!studentData.id) studentData.id = "STU-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2,6).toUpperCase();
      data.students.unshift(studentData);
      details = `Enrolled ${studentData.firstName} ${studentData.lastName} into ${studentData.currentClass}`;
    }

    if (!data.auditLogs) data.auditLogs = [];
    data.auditLogs.unshift({
      id:          "LOG-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2,5).toUpperCase(),
      timestamp:   Date.now(),
      date:        new Date().toLocaleString("en-GB"),
      action,
      entity:      "students",
      entityId:    studentData.id,
      performedBy: "Admin",
      user:        "Admin",
      details
    });
    if (data.auditLogs.length > 500) data.auditLogs.pop();

    this.save(data);
    return studentData;
  }

  static deleteStudent(studentId) {
    const data = this.get();
    const stu = (data.students || []).find(s => s.id === studentId);
    if (!stu) return false;

    if (!data._pendingDeletes) data._pendingDeletes = [];
    if (!data._tombstones) data._tombstones = {};

    const studentFullName = `${stu.firstName} ${stu.lastName}`.trim().toLowerCase();
    const regNo = (stu.regNo || "").trim().toLowerCase();

    // Gather and remove ALL payments belonging to this student
    const studentPayments = (data.payments || []).filter(p =>
      p.studentId === studentId ||
      (p.studentName && p.studentName.trim().toLowerCase() === studentFullName) ||
      (regNo && p.studentRegNo && p.studentRegNo.trim().toLowerCase() === regNo) ||
      (regNo && p.receiptNumber && p.receiptNumber.toLowerCase().includes(regNo)) ||
      (regNo && p.receiptNo && p.receiptNo.toLowerCase().includes(regNo))
    );
    const deletedPaymentIds = studentPayments.map(p => p.id);
    const deletedRevenue = studentPayments.reduce((s, p) => s + (Number(p.amount) || 0), 0);

    // Remove payments locally
    data.payments = (data.payments || []).filter(p => !deletedPaymentIds.includes(p.id) && p.studentId !== studentId);

    // Track pending deletes & tombstones for cloud backend
    deletedPaymentIds.forEach(pId => {
      data._pendingDeletes.push({ col: "payments", id: pId });
      data._tombstones[pId] = Date.now();
    });
    data._pendingDeletes.push({ col: "students", id: studentId });
    data._tombstones[studentId] = Date.now();

    // Remove student locally
    data.students = (data.students || []).filter(s => s.id !== studentId);

    const revenueNote = deletedRevenue > 0
      ? ` | ${deletedPaymentIds.length} payment(s) purged (₦${deletedRevenue.toLocaleString()})`
      : "";

    const log = this._buildLog(
      "STUDENT_DELETED",
      `Permanently deleted learner: ${stu.firstName} ${stu.lastName} (${stu.regNo || "N/A"})${revenueNote}`
    );
    if (!data.auditLogs) data.auditLogs = [];
    data.auditLogs.unshift(log);
    if (data.auditLogs.length > 500) data.auditLogs.pop();

    this.save(data);

    // Direct Firestore Cloud Backend Deletion
    const fb = (typeof window !== "undefined") ? (window.OJSchoolsFirebase || window.RichVineFirebase) : null;
    if (fb) {
      if (typeof fb.deleteStudent === "function") fb.deleteStudent(studentId);
      for (const pId of deletedPaymentIds) {
        if (typeof fb.deletePayment === "function") fb.deletePayment(pId);
      }
      if (typeof fb.saveLog === "function") fb.saveLog(log);
    }
    return true;
  }

  // ── Balance Calculation ──
  static getStudentBalance(studentId) {
    const student = this.getStudentById(studentId);
    if (!student) return null;

    const termFee        = Number(student.termFee) || 0;
    const openingArrears = Number(student.arrears) || 0;
    const pays           = this.get().payments.filter(p => p.studentId === studentId);

    let totalPaid = 0, arrearsPaid = 0, termFeePaid = 0, otherFeesPaid = 0;
    pays.forEach(p => {
      totalPaid     += Number(p.amount)          || 0;
      arrearsPaid   += Number(p.arrearsDeducted) || 0;
      termFeePaid   += Number(p.termFeePaid)     || 0;
      otherFeesPaid += Number(p.otherFeesPaid)   || 0;
    });

    const arrearsRemaining = Math.max(0, openingArrears - arrearsPaid);
    const termFeeRemaining = Math.max(0, termFee - termFeePaid);
    const totalOutstanding = arrearsRemaining + termFeeRemaining;

    return {
      student, termFee, openingArrears,
      arrearsPaid, arrearsRemaining,
      termFeePaid, termFeeRemaining,
      otherFeesPaid, totalPaid, totalOutstanding,
      isCleared: totalOutstanding <= 0 || student.clearanceStatus === "Cleared"
    };
  }

  // ── Payments ──
  static getPayments() { return this.get().payments; }

  static savePayment(paymentData) {
    const data    = this.get();
    const student = data.students.find(s => s.id === paymentData.studentId);
    if (!student) throw new Error("Learner not found for this payment.");

    const totalAmount = Number(paymentData.amount) || 0;
    if (totalAmount <= 0) throw new Error("Payment amount must be greater than zero.");

    const bal = this.getStudentBalance(student.id);
    const remainingArrears = bal ? bal.arrearsRemaining : 0;

    let arrearsDeducted = 0, termFeePaid = 0, otherFeesPaid = 0;

    if (Array.isArray(paymentData.items) && paymentData.items.length > 0) {
      paymentData.items.forEach(item => {
        const amt = Number(item.amount) || 0;
        if (item.id === "arrears" || item.category === "arrears") {
          arrearsDeducted += amt;
        } else if (["tuition","school_fees","tutorial_fee"].includes(item.id)) {
          termFeePaid += amt;
        } else {
          otherFeesPaid += amt;
        }
      });
    } else {
      // Automatic arrears-first
      if (remainingArrears > 0) arrearsDeducted = Math.min(totalAmount, remainingArrears);
      const leftover = totalAmount - arrearsDeducted;
      if (leftover > 0) termFeePaid = leftover;
    }

    if (!paymentData.id)            paymentData.id            = "PAY-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2,5).toUpperCase();
    if (!paymentData.receiptNumber) paymentData.receiptNumber = "OJS-" + new Date().getFullYear() + "-" + Math.floor(100000 + Math.random() * 900000);
    if (!paymentData.date)          paymentData.date          = new Date().toISOString().split("T")[0];

    paymentData.arrearsDeducted = arrearsDeducted;
    paymentData.termFeePaid     = termFeePaid;
    paymentData.otherFeesPaid   = otherFeesPaid;
    paymentData.studentName     = `${student.firstName} ${student.lastName}`;
    paymentData.studentClass    = student.currentClass;
    paymentData.studentRegNo    = student.regNo;
    paymentData.section         = student.section || (getSectionByClass(student.currentClass)||{id:"primary"}).id;

    data.payments.unshift(paymentData);
    this.logAction("RECORD_PAYMENT", paymentData.recordedBy || "Bursar",
      `\u20a6${totalAmount.toLocaleString()} for ${student.firstName} ${student.lastName} (${paymentData.receiptNumber})`);
    this.save(data);
    return paymentData;
  }

  static deletePayment(paymentId) {
    const data = this.get();
    const idx = (data.payments || []).findIndex(p => p.id === paymentId);
    if (idx === -1) return false;
    const payment = data.payments[idx];
    const studentId = payment.studentId;

    data.payments.splice(idx, 1);

    if (!data._pendingDeletes) data._pendingDeletes = [];
    if (!data._tombstones) data._tombstones = {};
    data._pendingDeletes.push({ col: "payments", id: paymentId });
    data._tombstones[paymentId] = Date.now();

    // Rebalance student balance
    if (typeof this.recalculateAllStudentBalances === "function") {
      this.recalculateAllStudentBalances(data);
    }

    const log = this._buildLog(
      "PAYMENT_DELETED",
      `Voided payment receipt #${payment.receiptNumber || payment.receiptNo || paymentId} for ${payment.studentName || "learner"}: ₦${Number(payment.amount || 0).toLocaleString()}`
    );
    if (!data.auditLogs) data.auditLogs = [];
    data.auditLogs.unshift(log);
    this.save(data);

    // Direct Firestore Cloud Backend Deletion
    const fb = (typeof window !== "undefined") ? (window.OJSchoolsFirebase || window.RichVineFirebase) : null;
    if (fb) {
      if (typeof fb.deletePayment === "function") fb.deletePayment(paymentId);
      const updatedStudent = (data.students || []).find(s => s.id === studentId);
      if (updatedStudent && typeof fb.saveStudent === "function") fb.saveStudent(updatedStudent);
      if (typeof fb.saveLog === "function") fb.saveLog(log);
    }
    return true;
  }

  // ── Expenses ──
  static getExpenses() { return this.get().expenses; }

  static saveExpense(expenseData) {
    const data = this.get();
    if (!expenseData.id)         expenseData.id         = "EXP-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2,5).toUpperCase();
    if (!expenseData.date)       expenseData.date       = new Date().toISOString().split("T")[0];
    if (!expenseData.account)    expenseData.account    = "general";
    if (!expenseData.section)    expenseData.section    = expenseData.account;
    if (!expenseData.category)   expenseData.category   = expenseData.title || "General";
    if (!expenseData.period)     expenseData.period     = "monthly";
    if (!expenseData.recordedBy) expenseData.recordedBy = "Bursar";
    expenseData.amount = Number(expenseData.amount) || 0;

    const idx = data.expenses.findIndex(e => e.id === expenseData.id);
    if (idx >= 0) {
      data.expenses[idx] = { ...data.expenses[idx], ...expenseData };
      this.logAction("UPDATE_EXPENSE","Bursar",`Updated expense: ${expenseData.title}`);
    } else {
      data.expenses.unshift(expenseData);
      this.logAction("LOG_EXPENSE","Bursar",`Logged: ${expenseData.title} (\u20a6${expenseData.amount.toLocaleString()}) under ${expenseData.account}`);
    }
    this.save(data);
    return expenseData;
  }

  static deleteExpense(expenseId) {
    const data = this.get();
    const exp = (data.expenses || []).find(e => e.id === expenseId);
    if (!exp) return false;

    data.expenses = (data.expenses || []).filter(e => e.id !== expenseId);

    if (!data._pendingDeletes) data._pendingDeletes = [];
    if (!data._tombstones) data._tombstones = {};
    data._pendingDeletes.push({ col: "expenses", id: expenseId });
    data._tombstones[expenseId] = Date.now();

    const log = this._buildLog(
      "EXPENSE_DELETED",
      `Deleted expense: ${exp.title || exp.description || "Expense"} — ₦${Number(exp.amount || 0).toLocaleString()} (${exp.category || exp.section || "General"})`
    );
    if (!data.auditLogs) data.auditLogs = [];
    data.auditLogs.unshift(log);
    this.save(data);

    // Direct Firestore Cloud Backend Deletion
    const fb = (typeof window !== "undefined") ? (window.OJSchoolsFirebase || window.RichVineFirebase) : null;
    if (fb) {
      if (typeof fb.deleteExpense === "function") fb.deleteExpense(expenseId);
      if (typeof fb.saveLog === "function") fb.saveLog(log);
    }
    return true;
  }

  // ── Clearance ──
  static toggleClearanceStatus(studentId, forceStatus = null) {
    const data = this.get();
    const stu  = data.students.find(s => s.id === studentId);
    if (!stu) return null;
    stu.clearanceStatus = forceStatus || (stu.clearanceStatus === "Cleared" ? "Pending" : "Cleared");
    this.logAction("TOGGLE_CLEARANCE","Admin",`${stu.firstName} ${stu.lastName} => ${stu.clearanceStatus}`);
    this.save(data);
    return stu;
  }

  // ── Debtors ──
  static getDebtors(filterSection = "all") {
    const students = this.getStudents();
    const filtered = filterSection === "all" ? students : students.filter(s =>
      (s.section || (getSectionByClass(s.currentClass)||{id:"primary"}).id) === filterSection
    );
    return filtered
      .map(s => ({ student: s, balance: this.getStudentBalance(s.id) }))
      .filter(({ balance }) => balance && balance.totalOutstanding > 0)
      .sort((a, b) => b.balance.totalOutstanding - a.balance.totalOutstanding);
  }

  // ── Financial Summary ──
  static getFinancialSummary(filterSection = "all") {
    const { students, payments, expenses } = this.get();

    const secOf = s => s.section || (getSectionByClass(s.currentClass)||{id:"primary"}).id;
    const filteredStudents = filterSection === "all" ? students : students.filter(s => secOf(s) === filterSection);
    const filteredPayments = filterSection === "all" ? payments : payments.filter(p => p.section === filterSection);
    const filteredExpenses = filterSection === "all" ? expenses : expenses.filter(e => e.account === filterSection || e.account === "general");

    let totalRevenue = 0, totalTermFeesPaid = 0, totalArrearsRecovered = 0, totalOtherFeesPaid = 0;
    filteredPayments.forEach(p => {
      totalRevenue          += Number(p.amount)          || 0;
      totalArrearsRecovered += Number(p.arrearsDeducted) || 0;
      totalTermFeesPaid     += Number(p.termFeePaid)     || 0;
      totalOtherFeesPaid    += Number(p.otherFeesPaid)   || 0;
    });

    let totalExpenses = 0;
    filteredExpenses.forEach(e => { totalExpenses += Number(e.amount) || 0; });

    let totalOutstandingArrears = 0, totalUnpaidTermFees = 0, totalDebtorsCount = 0;
    filteredStudents.forEach(stu => {
      const bal = this.getStudentBalance(stu.id);
      if (bal) {
        totalOutstandingArrears += bal.arrearsRemaining;
        totalUnpaidTermFees     += bal.termFeeRemaining;
        if (bal.totalOutstanding > 0) totalDebtorsCount++;
      }
    });

    return {
      totalStudents: filteredStudents.length,
      totalRevenue, totalExpenses,
      netProfit: totalRevenue - totalExpenses,
      totalTermFeesPaid, totalArrearsRecovered, totalOtherFeesPaid,
      totalOutstandingArrears, totalUnpaidTermFees,
      totalOutstandingDebt: totalOutstandingArrears + totalUnpaidTermFees,
      totalDebtorsCount
    };
  }

  static getSectionBreakdown() {
    const breakdown = {};
    ["primary","junior","senior","tutorial"].forEach(secId => {
      const secDef = SCHOOL_SECTIONS[secId];
      breakdown[secId] = { name: secDef.name, color: secDef.color, icon: secDef.icon, ...this.getFinancialSummary(secId) };
    });
    const centralExpenses = this.getExpenses().filter(e => e.account === "general").reduce((a, e) => a + (Number(e.amount)||0), 0);
    return { sections: breakdown, centralExpenses };
  }

  // ── Audit Logs ──
  static getAuditLogs() { return this.get().auditLogs; }

  static logAction(action, user, details) {
    const data = this.get();
    if (!data.auditLogs) data.auditLogs = [];
    data.auditLogs.unshift({
      id:          "LOG-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2,5).toUpperCase(),
      timestamp:   Date.now(),
      date:        new Date().toLocaleString("en-GB"),
      action,
      entity:      "system",
      performedBy: user || "System",
      user:        user || "System",
      details
    });
    if (data.auditLogs.length > 500) data.auditLogs.pop();
    this.save(data, false);
  }

  static _buildLog(action, details) {
    const authUser = (typeof window !== "undefined" && window.OJSchoolsAuth && window.OJSchoolsAuth.getUser)
      ? window.OJSchoolsAuth.getUser()
      : null;
    return {
      id: "LOG-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 6).toUpperCase(),
      timestamp: Date.now(),
      date: new Date().toLocaleString("en-GB"),
      action: action || "GENERAL_ACTION",
      entity: "system",
      performedBy: (authUser && authUser.name) ? authUser.name : "Admin",
      user: (authUser && authUser.name) ? authUser.name : "Admin",
      details: details || ""
    };
  }


  // ── Deduplication & Student Balance Rebalancing ──
  static cleanDuplicatePayments(db) {
    if (!db || !Array.isArray(db.payments)) return { removedCount: 0 };
    const seen = new Set();
    const initialLen = db.payments.length;
    const cleanList = [];
    for (const p of db.payments) {
      if (!p || !p.id) continue;
      const key = p.id;
      if (seen.has(key)) continue;
      seen.add(key);
      cleanList.push(p);
    }
    db.payments = cleanList;
    return { removedCount: initialLen - cleanList.length };
  }

  static recalculateAllStudentBalances(db) {
    if (!db || !Array.isArray(db.students)) return;
    const payments = Array.isArray(db.payments) ? db.payments : [];
    db.students.forEach(s => {
      const stuPayments = payments.filter(p => p.studentId === s.id);
      const totalPaid = stuPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
      const termFee = Number(s.termFee) || 0;
      const arrears = Number(s.arrears) || 0;
      const totalExpected = termFee + arrears;
      s.totalPaid = totalPaid;
      s.balance = Math.max(0, totalExpected - totalPaid);
      s.clearanceStatus = (s.balance === 0 && totalExpected > 0) ? "Cleared" : "Pending";
    });
  }

  // ── Staff Registry & Salary Payroll ──
  static getStaff(filter = {}) {
    const db = this.get();
    let staff = [...(db.staff || [])];
    if (filter.section && filter.section !== "All") {
      staff = staff.filter(s => s.section === filter.section);
    }
    if (filter.search) {
      const q = filter.search.toLowerCase();
      staff = staff.filter(s => (s.name && s.name.toLowerCase().includes(q)) || (s.role && s.role.toLowerCase().includes(q)));
    }
    return staff.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }

  static getStaffById(id) {
    const db = this.get();
    return (db.staff || []).find(s => s.id === id) || null;
  }

  static addStaff(fields) {
    const db = this.get();
    if (!db.staff) db.staff = [];
    const now = Date.now();
    const staff = {
      id: `STF-${now}-${Math.floor(Math.random() * 9999)}`,
      name: (fields.name || "").trim(),
      section: fields.section || "general",
      role: (fields.role || "").trim(),
      baseSalary: Math.round((Number(fields.baseSalary) || 0) * 100) / 100,
      bank: (fields.bank || "").trim(),
      accountNo: (fields.accountNo || "").trim(),
      phone: (fields.phone || "").trim(),
      createdAt: new Date().toISOString()
    };
    db.staff.push(staff);

    const log = this._buildLog("STAFF_ADDED", `Added staff: ${staff.name} (${staff.role} — ${staff.section})`);
    if (!db.auditLogs) db.auditLogs = [];
    db.auditLogs.unshift(log);
    this.save(db);

    const fb = (typeof window !== "undefined") ? (window.OJSchoolsFirebase || window.RichVineFirebase) : null;
    if (fb && typeof fb.saveStaff === "function") fb.saveStaff(staff);
    return staff;
  }

  static updateStaff(id, fields) {
    const db = this.get();
    const idx = (db.staff || []).findIndex(s => s.id === id);
    if (idx === -1) return null;

    db.staff[idx] = {
      ...db.staff[idx],
      name: (fields.name || db.staff[idx].name).trim(),
      section: fields.section || db.staff[idx].section,
      role: (fields.role || db.staff[idx].role).trim(),
      baseSalary: fields.baseSalary !== undefined ? Math.round(Number(fields.baseSalary) * 100) / 100 : db.staff[idx].baseSalary,
      bank: fields.bank !== undefined ? fields.bank.trim() : db.staff[idx].bank,
      accountNo: fields.accountNo !== undefined ? fields.accountNo.trim() : db.staff[idx].accountNo,
      phone: fields.phone !== undefined ? fields.phone.trim() : db.staff[idx].phone,
      updatedAt: new Date().toISOString()
    };

    const log = this._buildLog("STAFF_UPDATED", `Updated staff details: ${db.staff[idx].name}`);
    if (!db.auditLogs) db.auditLogs = [];
    db.auditLogs.unshift(log);
    this.save(db);

    const fb = (typeof window !== "undefined") ? (window.OJSchoolsFirebase || window.RichVineFirebase) : null;
    if (fb && typeof fb.saveStaff === "function") fb.saveStaff(db.staff[idx]);
    return db.staff[idx];
  }

  static deleteStaff(id) {
    const db = this.get();
    const stf = (db.staff || []).find(s => s.id === id);
    if (!stf) return false;
    db.staff = db.staff.filter(s => s.id !== id);

    if (!db._pendingDeletes) db._pendingDeletes = [];
    if (!db._tombstones) db._tombstones = {};
    db._pendingDeletes.push({ col: "staff", id });
    db._tombstones[id] = Date.now();

    const log = this._buildLog("STAFF_DELETED", `Deleted staff: ${stf.name} (${stf.section})`);
    if (!db.auditLogs) db.auditLogs = [];
    db.auditLogs.unshift(log);
    this.save(db);

    const fb = (typeof window !== "undefined") ? (window.OJSchoolsFirebase || window.RichVineFirebase) : null;
    if (fb && typeof fb.deleteStaff === "function") fb.deleteStaff(id);
    return true;
  }

  static getSalaryPayments(filter = {}) {
    const db = this.get();
    let salaries = [...(db.salaries || [])];

    if (filter.month && filter.month !== "All") {
      salaries = salaries.filter(s => String(s.month) === String(filter.month));
    }
    if (filter.year && filter.year !== "All") {
      salaries = salaries.filter(s => String(s.year) === String(filter.year));
    }
    if (filter.section && filter.section !== "All") {
      salaries = salaries.filter(s => s.section === filter.section);
    }
    if (filter.staffId) {
      salaries = salaries.filter(s => s.staffId === filter.staffId);
    }
    if (filter.search) {
      const q = filter.search.toLowerCase();
      salaries = salaries.filter(s =>
        (s.staffName && s.staffName.toLowerCase().includes(q)) ||
        (s.paymentRef && s.paymentRef.toLowerCase().includes(q))
      );
    }

    return salaries.sort((a, b) => new Date(b.paidAt || b.date) - new Date(a.paidAt || a.date));
  }

  static addSalaryPayment(fields) {
    const db = this.get();
    if (!db.salaries) db.salaries = [];
    if (!db.expenses) db.expenses = [];

    const now = Date.now();
    const staff = this.getStaffById(fields.staffId);
    const staffName = staff ? staff.name : (fields.staffName || "Staff Member");
    const section = staff ? staff.section : (fields.section || "general");
    const amount = Math.round((Number(fields.amount) || 0) * 100) / 100;
    const bonus = Math.round((Number(fields.bonus) || 0) * 100) / 100;
    const deductions = Math.round((Number(fields.deductions) || 0) * 100) / 100;
    const netAmount = Math.max(0, amount + bonus - deductions);
    const dateStr = fields.date || new Date().toISOString().split("T")[0];

    const monthNames = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const monthNum = Number(fields.month) || (new Date().getMonth() + 1);
    const monthName = monthNames[monthNum] || `Month ${monthNum}`;
    const year = Number(fields.year) || new Date().getFullYear();

    const paymentRef = fields.paymentRef || `SAL-${year}-${String(monthNum).padStart(2, "0")}-${Math.floor(Math.random() * 9000 + 1000)}`;

    // 1. Auto-generate corresponding Expense entry so P&L remains 100% accurate!
    const expenseId = `EXP-SAL-${now}-${Math.floor(Math.random() * 9999)}`;
    const expDesc = `Staff Salary: ${staffName} (${monthName} ${year})`;
    const expenseEntry = {
      id: expenseId,
      title: expDesc,
      description: expDesc,
      amount: netAmount,
      category: "Staff Salary",
      account: section,
      section: section,
      period: "monthly",
      date: dateStr,
      recordedBy: fields.paidBy || "Bursar",
      paymentMethod: fields.method || "Bank Transfer",
      salaryRef: paymentRef,
      createdAt: new Date().toISOString()
    };
    db.expenses.unshift(expenseEntry);

    // 2. Create Salary Ledger Record
    const salary = {
      id: `SAL-${now}-${Math.floor(Math.random() * 9999)}`,
      paymentRef,
      expenseId,
      staffId: fields.staffId || null,
      staffName,
      section,
      role: staff ? staff.role : "",
      month: monthNum,
      monthName,
      year,
      baseAmount: amount,
      bonus,
      deductions,
      amount: netAmount,
      method: fields.method || "Bank Transfer",
      bank: fields.bank || (staff ? staff.bank : ""),
      accountNo: fields.accountNo || (staff ? staff.accountNo : ""),
      notes: (fields.notes || "").trim(),
      paidBy: fields.paidBy || "Bursar",
      paidAt: new Date().toISOString(),
      date: dateStr
    };
    db.salaries.unshift(salary);

    const log = this._buildLog("SALARY_PAID", `Paid salary to ${staffName} for ${monthName} ${year}: ₦${netAmount.toLocaleString()}`);
    if (!db.auditLogs) db.auditLogs = [];
    db.auditLogs.unshift(log);
    this.save(db);

    const fb = (typeof window !== "undefined") ? (window.OJSchoolsFirebase || window.RichVineFirebase) : null;
    if (fb) {
      if (typeof fb.saveSalary === "function") fb.saveSalary(salary);
      if (typeof fb.saveExpense === "function") fb.saveExpense(expenseEntry);
    }
    return salary;
  }

  static deleteSalaryPayment(id) {
    const db = this.get();
    const sal = (db.salaries || []).find(s => s.id === id);
    if (!sal) return false;

    db.salaries = db.salaries.filter(s => s.id !== id);

    if (!db._pendingDeletes) db._pendingDeletes = [];
    if (!db._tombstones) db._tombstones = {};
    db._pendingDeletes.push({ col: "salaries", id });
    db._tombstones[id] = Date.now();

    // Also remove the linked expense record
    if (sal.expenseId) {
      db.expenses = (db.expenses || []).filter(e => e.id !== sal.expenseId);
      db._pendingDeletes.push({ col: "expenses", id: sal.expenseId });
      db._tombstones[sal.expenseId] = Date.now();
    }

    const log = this._buildLog("SALARY_DELETED", `Deleted salary payment: ${sal.staffName} (${sal.monthName} ${sal.year}) — ₦${Number(sal.amount).toLocaleString()}`);
    if (!db.auditLogs) db.auditLogs = [];
    db.auditLogs.unshift(log);
    this.save(db);

    const fb = (typeof window !== "undefined") ? (window.OJSchoolsFirebase || window.RichVineFirebase) : null;
    if (fb) {
      if (typeof fb.deleteSalary === "function") fb.deleteSalary(id);
      if (sal.expenseId && typeof fb.deleteExpense === "function") fb.deleteExpense(sal.expenseId);
    }
    return true;
  }

  static getSalarySummary(filter = {}) {
    const salaries = this.getSalaryPayments(filter);
    const totalPaid = salaries.reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const count = salaries.length;
    const staffList = this.getStaff(filter);
    const totalStaff = staffList.length;
    const totalPayrollBudget = staffList.reduce((s, st) => s + (Number(st.baseSalary) || 0), 0);

    return {
      totalPaid,
      count,
      totalStaff,
      totalPayrollBudget,
      coveragePercent: totalPayrollBudget > 0 ? Math.min(100, Math.round((totalPaid / totalPayrollBudget) * 100)) : 0
    };
  }

  // ── Inventory / Stocks Management Engine ──
  static getStocks(filter = {}) {
    const db = this.get();
    let stocks = [...(db.stocks || [])];
    if (filter.category && filter.category !== "All") {
      stocks = stocks.filter(s => s.category === filter.category);
    }
    if (filter.status && filter.status !== "All") {
      if (filter.status === "out") {
        stocks = stocks.filter(s => Number(s.quantity) <= 0);
      } else if (filter.status === "low") {
        stocks = stocks.filter(s => Number(s.quantity) > 0 && Number(s.quantity) <= Number(s.reorderLevel || 5));
      } else if (filter.status === "healthy") {
        stocks = stocks.filter(s => Number(s.quantity) > Number(s.reorderLevel || 5));
      }
    }
    if (filter.search) {
      const q = filter.search.toLowerCase();
      stocks = stocks.filter(s =>
        (s.name && s.name.toLowerCase().includes(q)) ||
        (s.sku && s.sku.toLowerCase().includes(q)) ||
        (s.category && s.category.toLowerCase().includes(q))
      );
    }
    return stocks.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }

  static getStockById(id) {
    const db = this.get();
    return (db.stocks || []).find(s => s.id === id) || null;
  }

  static recalculateStockQuantities(db) {
    if (!db || !Array.isArray(db.stocks)) return;
    const sales = Array.isArray(db.stockSales) ? db.stockSales : [];
    const restocks = Array.isArray(db.stockRestocks) ? db.stockRestocks : [];

    db.stocks.forEach(item => {
      const initial = Number(item.initialQuantity || item.initialQty) || 0;
      const totalRestocked = restocks.filter(r => r.stockId === item.id).reduce((sum, r) => sum + (Number(r.quantity) || 0), 0);
      const totalSold = sales.filter(s => s.stockId === item.id).reduce((sum, s) => sum + (Number(s.quantity) || 0), 0);
      item.quantity = Math.max(0, initial + totalRestocked - totalSold);
    });
  }

  static addStockItem(fields) {
    const db = this.get();
    if (!db.stocks) db.stocks = [];
    const now = Date.now();
    const qty = Math.max(0, parseInt(fields.quantity, 10) || 0);
    const item = {
      id: `STK-${now}-${Math.floor(Math.random() * 9999)}`,
      sku: (fields.sku || `SKU-${Math.floor(Math.random() * 90000 + 10000)}`).trim().toUpperCase(),
      name: (fields.name || "").trim(),
      category: fields.category || "General",
      unit: fields.unit || "pcs",
      initialQuantity: qty,
      quantity: qty,
      unitPrice: Math.round((Number(fields.unitPrice) || 0) * 100) / 100,
      costPrice: Math.round((Number(fields.costPrice) || 0) * 100) / 100,
      reorderLevel: parseInt(fields.reorderLevel, 10) || 5,
      supplier: (fields.supplier || "").trim(),
      description: (fields.description || "").trim(),
      createdAt: new Date().toISOString()
    };
    db.stocks.push(item);

    const log = this._buildLog("STOCK_ITEM_ADDED", `Added stock item: ${item.name} (${qty} ${item.unit} @ ₦${item.unitPrice})`);
    if (!db.auditLogs) db.auditLogs = [];
    db.auditLogs.unshift(log);
    this.save(db);

    const fb = (typeof window !== "undefined") ? (window.OJSchoolsFirebase || window.RichVineFirebase) : null;
    if (fb && typeof fb.saveStockItem === "function") fb.saveStockItem(item);
    return item;
  }

  static updateStockItem(id, fields) {
    const db = this.get();
    const idx = (db.stocks || []).findIndex(s => s.id === id);
    if (idx === -1) return null;

    db.stocks[idx] = {
      ...db.stocks[idx],
      name: (fields.name || db.stocks[idx].name).trim(),
      sku: fields.sku ? fields.sku.trim().toUpperCase() : db.stocks[idx].sku,
      category: fields.category || db.stocks[idx].category,
      unit: fields.unit || db.stocks[idx].unit,
      unitPrice: fields.unitPrice !== undefined ? Math.round(Number(fields.unitPrice) * 100) / 100 : db.stocks[idx].unitPrice,
      costPrice: fields.costPrice !== undefined ? Math.round(Number(fields.costPrice) * 100) / 100 : db.stocks[idx].costPrice,
      reorderLevel: fields.reorderLevel !== undefined ? parseInt(fields.reorderLevel, 10) : db.stocks[idx].reorderLevel,
      supplier: fields.supplier !== undefined ? fields.supplier.trim() : db.stocks[idx].supplier,
      description: fields.description !== undefined ? fields.description.trim() : db.stocks[idx].description,
      updatedAt: new Date().toISOString()
    };

    const log = this._buildLog("STOCK_ITEM_UPDATED", `Updated stock item: ${db.stocks[idx].name}`);
    if (!db.auditLogs) db.auditLogs = [];
    db.auditLogs.unshift(log);
    this.save(db);

    const fb = (typeof window !== "undefined") ? (window.OJSchoolsFirebase || window.RichVineFirebase) : null;
    if (fb && typeof fb.saveStockItem === "function") fb.saveStockItem(db.stocks[idx]);
    return db.stocks[idx];
  }

  static deleteStockItem(id) {
    const db = this.get();
    const item = (db.stocks || []).find(s => s.id === id);
    if (!item) return false;

    db.stocks = db.stocks.filter(s => s.id !== id);
    db.stockSales = (db.stockSales || []).filter(s => s.stockId !== id);
    db.stockRestocks = (db.stockRestocks || []).filter(r => r.stockId !== id);

    if (!db._pendingDeletes) db._pendingDeletes = [];
    if (!db._tombstones) db._tombstones = {};
    db._pendingDeletes.push({ col: "stocks", id });
    db._tombstones[id] = Date.now();

    const log = this._buildLog("STOCK_DELETED", `Deleted stock item: ${item.name}`);
    if (!db.auditLogs) db.auditLogs = [];
    db.auditLogs.unshift(log);
    this.save(db);

    const fb = (typeof window !== "undefined") ? (window.OJSchoolsFirebase || window.RichVineFirebase) : null;
    if (fb && typeof fb.deleteStockItem === "function") fb.deleteStockItem(id);
    return true;
  }

  static recordStockSale(fields) {
    const db = this.get();
    if (!db.stockSales) db.stockSales = [];
    const item = this.getStockById(fields.stockId);
    if (!item) return { success: false, error: "Stock item not found" };

    const qtySold = parseInt(fields.quantity, 10) || 0;
    if (qtySold <= 0) return { success: false, error: "Quantity must be greater than 0" };
    if (item.quantity < qtySold) return { success: false, error: `Insufficient stock (Available: ${item.quantity})` };

    const unitPrice = fields.unitPrice !== undefined ? Number(fields.unitPrice) : item.unitPrice;
    const totalAmount = Math.round(qtySold * unitPrice * 100) / 100;
    const now = Date.now();

    // 1. Deduct quantity
    item.quantity = Math.max(0, item.quantity - qtySold);

    // 2. Create Stock Sale Record
    const sale = {
      id: `SALE-${now}-${Math.floor(Math.random() * 9999)}`,
      stockId: item.id,
      stockName: item.name,
      category: item.category,
      quantity: qtySold,
      unitPrice,
      totalAmount,
      buyerName: (fields.buyerName || "Walk-in Buyer").trim(),
      buyerType: fields.buyerType || "Student",
      paymentMethod: fields.paymentMethod || "Cash",
      soldBy: fields.soldBy || "Bursar",
      date: fields.date || new Date().toISOString().split("T")[0],
      createdAt: new Date().toISOString()
    };
    db.stockSales.unshift(sale);

    const log = this._buildLog("STOCK_SALE", `Sold ${qtySold}x ${item.name} to ${sale.buyerName} (₦${totalAmount.toLocaleString()})`);
    if (!db.auditLogs) db.auditLogs = [];
    db.auditLogs.unshift(log);
    this.save(db);

    const fb = (typeof window !== "undefined") ? (window.OJSchoolsFirebase || window.RichVineFirebase) : null;
    if (fb) {
      if (typeof fb.saveStockItem === "function") fb.saveStockItem(item);
      if (typeof fb.saveStockSale === "function") fb.saveStockSale(sale);
    }
    return { success: true, sale, remaining: item.quantity };
  }

  static restockItem(fields) {
    const db = this.get();
    if (!db.stockRestocks) db.stockRestocks = [];
    const item = this.getStockById(fields.stockId);
    if (!item) return { success: false, error: "Stock item not found" };

    const qtyRestocked = parseInt(fields.quantity, 10) || 0;
    if (qtyRestocked <= 0) return { success: false, error: "Quantity must be greater than 0" };

    const costPrice = fields.costPrice !== undefined ? Number(fields.costPrice) : (item.costPrice || 0);
    const totalCost = Math.round(qtyRestocked * costPrice * 100) / 100;
    const now = Date.now();

    // 1. Add quantity
    item.quantity = (Number(item.quantity) || 0) + qtyRestocked;
    if (costPrice > 0) item.costPrice = costPrice;

    // 2. Create Restock Record
    const restock = {
      id: `RESTOCK-${now}-${Math.floor(Math.random() * 9999)}`,
      stockId: item.id,
      stockName: item.name,
      quantity: qtyRestocked,
      costPrice,
      totalCost,
      supplier: (fields.supplier || item.supplier || "Supplier").trim(),
      invoiceNo: (fields.invoiceNo || "").trim(),
      receivedBy: fields.receivedBy || "Bursar",
      date: fields.date || new Date().toISOString().split("T")[0],
      createdAt: new Date().toISOString()
    };
    db.stockRestocks.unshift(restock);

    const log = this._buildLog("STOCK_RESTOCK", `Restocked ${qtyRestocked}x ${item.name} (₦${totalCost.toLocaleString()})`);
    if (!db.auditLogs) db.auditLogs = [];
    db.auditLogs.unshift(log);
    this.save(db);

    const fb = (typeof window !== "undefined") ? (window.OJSchoolsFirebase || window.RichVineFirebase) : null;
    if (fb) {
      if (typeof fb.saveStockItem === "function") fb.saveStockItem(item);
      if (typeof fb.saveStockRestock === "function") fb.saveStockRestock(restock);
    }
    return { success: true, restock, totalQuantity: item.quantity };
  }

  static getStockSales(filter = {}) {
    const db = this.get();
    let sales = [...(db.stockSales || [])];
    if (filter.stockId) sales = sales.filter(s => s.stockId === filter.stockId);
    if (filter.search) {
      const q = filter.search.toLowerCase();
      sales = sales.filter(s => (s.stockName && s.stockName.toLowerCase().includes(q)) || (s.buyerName && s.buyerName.toLowerCase().includes(q)));
    }
    return sales.sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));
  }

  static getStockRestocks(filter = {}) {
    const db = this.get();
    let restocks = [...(db.stockRestocks || [])];
    if (filter.stockId) restocks = restocks.filter(r => r.stockId === filter.stockId);
    return restocks.sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));
  }

  static getStockAlerts() {
    const stocks = this.getStocks();
    const outOfStock = stocks.filter(s => Number(s.quantity) <= 0);
    const lowStock = stocks.filter(s => Number(s.quantity) > 0 && Number(s.quantity) <= Number(s.reorderLevel || 5));
    return {
      outOfStock,
      lowStock,
      totalAlerts: outOfStock.length + lowStock.length
    };
  }

  static getStockSummary() {
    const stocks = this.getStocks();
    const totalItems = stocks.length;
    const totalQuantity = stocks.reduce((sum, s) => sum + (Number(s.quantity) || 0), 0);
    const totalInventoryValue = stocks.reduce((sum, s) => sum + ((Number(s.quantity) || 0) * (Number(s.unitPrice) || 0)), 0);
    const alerts = this.getStockAlerts();

    return {
      totalItems,
      totalQuantity,
      totalInventoryValue,
      outOfStockCount: alerts.outOfStock.length,
      lowStockCount: alerts.lowStock.length
    };
  }

}

if (typeof window !== "undefined") {
  window.OJSchoolsDB = OJSchoolsDB;
  window.RichVineDB = OJSchoolsDB; // Interoperability alias

  
  
}

