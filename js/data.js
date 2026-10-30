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
      "Basic 5",
      "Basic 6"
    ]
  },
  junior: {
    id: "junior",
    name: "Junior Secondary",
    icon: "fas fa-school",
    badgeClass: "badge-section-junior",
    color: "#2563eb",
    classes: [
      "JSS 1A", "JSS 1B",
      "JSS 2A", "JSS 2B",
      "JSS 3A", "JSS 3B"
    ]
  },
  senior: {
    id: "senior",
    name: "Senior Secondary",
    icon: "fas fa-graduation-cap",
    badgeClass: "badge-section-senior",
    color: "#7c3aed",
    classes: [
      "SSS 1 Science", "SSS 1 Art", "SSS 1 Commercial",
      "SSS 2 Science", "SSS 2 Art", "SSS 2 Commercial",
      "SSS 3 Science", "SSS 3 Art", "SSS 3 Commercial"
    ]
  },
  tutorial: {
    id: "tutorial",
    name: "Tutorial Section",
    icon: "fas fa-book-open-reader",
    badgeClass: "badge-section-tutorial",
    color: "#ea580c",
    classes: [
      "WAEC & NECO Intensive Prep",
      "UTME / JAMB CBT Drill & Masterclass",
      "Post-UTME Screening Clinic",
      "GCE & Adult Education Cohort",
      "Weekend Accelerated Class",
      "Evening Secondary Tutoring"
    ]
  }
};

const ALL_CLASSES = [
  ...SCHOOL_SECTIONS.primary.classes,
  ...SCHOOL_SECTIONS.junior.classes,
  ...SCHOOL_SECTIONS.senior.classes,
  ...SCHOOL_SECTIONS.tutorial.classes
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
  "Basic 6": { tuition: 25000, continuous_assessment: 3000, uniform: 10000, sport_wear: 8000, report_card: 4000, friday_wear: 0 },

  "JSS 1A": { tuition: 32000, continuous_assessment: 3000, uniform: 10000, sport_wear: 8000, report_card: 4000, cbt_exams: 3000, friday_wear: 0 },
  "JSS 1B": { tuition: 32000, continuous_assessment: 3000, uniform: 10000, sport_wear: 8000, report_card: 4000, cbt_exams: 3000, friday_wear: 0 },
  "JSS 2A": { tuition: 32000, continuous_assessment: 3000, uniform: 10000, sport_wear: 8000, report_card: 4000, cbt_exams: 3000, friday_wear: 0 },
  "JSS 2B": { tuition: 32000, continuous_assessment: 3000, uniform: 10000, sport_wear: 8000, report_card: 4000, cbt_exams: 3000, friday_wear: 0 },
  "JSS 3A": { tuition: 32000, bece_registration: 40000, continuous_assessment: 3000, uniform: 10000, sport_wear: 8000, report_card: 4000, cbt_exams: 3000, friday_wear: 0 },
  "JSS 3B": { tuition: 32000, bece_registration: 40000, continuous_assessment: 3000, uniform: 10000, sport_wear: 8000, report_card: 4000, cbt_exams: 3000, friday_wear: 0 },

  "SSS 1 Science":    { tuition: 37000, uniform: 12000, sport_wear: 7000, report_card: 4000, continuous_assessment: 3000, cbt_exams: 3000, friday_wear: 0 },
  "SSS 1 Art":        { tuition: 37000, uniform: 12000, sport_wear: 7000, report_card: 4000, continuous_assessment: 3000, cbt_exams: 3000, friday_wear: 0 },
  "SSS 1 Commercial": { tuition: 37000, uniform: 12000, sport_wear: 7000, report_card: 4000, continuous_assessment: 3000, cbt_exams: 3000, friday_wear: 0 },
  "SSS 2 Science":    { tuition: 37000, uniform: 12000, sport_wear: 7000, report_card: 4000, continuous_assessment: 3000, cbt_exams: 3000, friday_wear: 0 },
  "SSS 2 Art":        { tuition: 37000, uniform: 12000, sport_wear: 7000, report_card: 4000, continuous_assessment: 3000, cbt_exams: 3000, friday_wear: 0 },
  "SSS 2 Commercial": { tuition: 37000, uniform: 12000, sport_wear: 7000, report_card: 4000, continuous_assessment: 3000, cbt_exams: 3000, friday_wear: 0 },

  // SSS 3: Term 1 & 2 = 43,000; Term 3 = 21,500 (admin edits amount at runtime for term 3)
  "SSS 3 Science":    { tuition: 43000, waec_registration: 80000, jamb_registration: 40000, extra_lessons: 40000, sport_wear: 7000, friday_wear: 0 },
  "SSS 3 Art":        { tuition: 43000, waec_registration: 80000, jamb_registration: 40000, extra_lessons: 40000, sport_wear: 7000, friday_wear: 0 },
  "SSS 3 Commercial": { tuition: 43000, waec_registration: 80000, jamb_registration: 40000, extra_lessons: 40000, sport_wear: 7000, friday_wear: 0 }
};

function getClassFeeSchedule(className) {
  return CLASS_FEE_SCHEDULES[className] || {};
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
  students:      [],
  payments:      [],
  expenses:      [],
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

  static init() {
    if (!localStorage.getItem(this.KEY)) {
      // Migrate from v1 key if present
      const old = localStorage.getItem("OJ_SCHOOLS_DB_V1_LIVE");
      if (old) {
        try {
          const parsed  = JSON.parse(old);
          const fresh   = JSON.parse(JSON.stringify(DEFAULT_DATA));
          fresh.students  = parsed.students  || [];
          fresh.payments  = parsed.payments  || [];
          fresh.expenses  = parsed.expenses  || [];
          fresh.auditLogs = parsed.auditLogs || fresh.auditLogs;
          if (parsed.config) fresh.config = { ...fresh.config, ...parsed.config };
          localStorage.setItem(this.KEY, JSON.stringify(fresh));
          localStorage.removeItem("OJ_SCHOOLS_DB_V1_LIVE");
        } catch (e) {
          localStorage.setItem(this.KEY, JSON.stringify(DEFAULT_DATA));
        }
      } else {
        localStorage.setItem(this.KEY, JSON.stringify(DEFAULT_DATA));
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
    const stu  = data.students.find(s => s.id === studentId);
    if (!stu) return false;

    if (!data._deleted)           data._deleted          = {};
    if (!data._deleted.students)  data._deleted.students = [];
    if (!data._deleted.payments)  data._deleted.payments = [];
    data._deleted.students.push(studentId);

    const assoc = data.payments.filter(p => p.studentId === studentId);
    assoc.forEach(p => data._deleted.payments.push(p.id));
    data.students = data.students.filter(s => s.id !== studentId);
    data.payments = data.payments.filter(p => p.studentId !== studentId);

    if (!data.auditLogs) data.auditLogs = [];
    data.auditLogs.unshift({
      id:          "LOG-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2,5).toUpperCase(),
      timestamp:   Date.now(),
      date:        new Date().toLocaleString("en-GB"),
      action:      "DELETE_STUDENT",
      entity:      "students",
      entityId:    studentId,
      performedBy: "Admin",
      user:        "Admin",
      details:     `Deleted ${stu.firstName} ${stu.lastName} + ${assoc.length} payment(s)`
    });
    if (data.auditLogs.length > 500) data.auditLogs.pop();

    this.save(data);
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
    const pay  = data.payments.find(p => p.id === paymentId);
    if (!pay) return false;
    if (!data._deleted)          data._deleted         = {};
    if (!data._deleted.payments) data._deleted.payments = [];
    data._deleted.payments.push(paymentId);
    data.payments = data.payments.filter(p => p.id !== paymentId);
    this.logAction("DELETE_PAYMENT","Admin",`Voided receipt #${pay.receiptNumber}`);
    this.save(data);
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
    const exp  = data.expenses.find(e => e.id === expenseId);
    if (!exp) return false;
    if (!data._deleted)          data._deleted         = {};
    if (!data._deleted.expenses) data._deleted.expenses = [];
    data._deleted.expenses.push(expenseId);
    data.expenses = data.expenses.filter(e => e.id !== expenseId);
    this.logAction("DELETE_EXPENSE","Admin",`Removed expense: ${exp.title}`);
    this.save(data);
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
}

if (typeof window !== "undefined") {
  window.OJSchoolsDB = OJSchoolsDB;
}
