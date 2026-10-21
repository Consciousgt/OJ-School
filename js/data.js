/**
 * OJ SCHOOLS - Complete Core Data Architecture & Ledger Engine
 * Academic Session: 2026/2027
 * 
 * 4 Distinct Sections:
 * 1. Primary Section
 * 2. Junior Secondary
 * 3. Senior Secondary
 * 4. Tutorial Section
 * 
 * Key Principles:
 * - Expected Term School Fee per learner
 * - Automatic Priority Deduction: Arrears cleared first before term fee
 * - Multi-section expense ledger & P&L breakdown
 * - Flexible currency formatting with decimal kobo & comma grouping
 * - Resilient LocalStorage persistence + cloud sync bridge
 */

// ─── School Sections & Class Definitions ──────────────────────────────────
const SCHOOL_SECTIONS = {
  primary: {
    id: "primary",
    name: "Primary Section",
    icon: "fas fa-child",
    badgeClass: "badge-section-primary",
    color: "#059669",
    classes: [
      "Creche / Day Care",
      "Kindergarten",
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
  // Fallbacks if class name is formatted slightly differently
  const lower = className.toLowerCase();
  if (lower.includes("creche") || lower.includes("nursery") || lower.includes("basic") || lower.includes("primary") || lower.includes("kindergarten")) {
    return SCHOOL_SECTIONS.primary;
  }
  if (lower.includes("jss") || lower.includes("junior")) {
    return SCHOOL_SECTIONS.junior;
  }
  if (lower.includes("sss") || lower.includes("senior")) {
    return SCHOOL_SECTIONS.senior;
  }
  if (lower.includes("tutorial") || lower.includes("jamb") || lower.includes("utme") || lower.includes("gce") || lower.includes("prep")) {
    return SCHOOL_SECTIONS.tutorial;
  }
  return null;
}

// ─── Expense Accounts (Sectional P&L) ──────────────────────────────────
const EXPENSE_ACCOUNTS = [
  { id: "general",  name: "General / Central Operations", icon: "fas fa-building-columns", color: "#0a192f" },
  { id: "primary",  name: "Primary Section Account",      icon: "fas fa-child",            color: "#059669" },
  { id: "junior",   name: "Junior Secondary Account",     icon: "fas fa-school",           color: "#2563eb" },
  { id: "senior",   name: "Senior Secondary Account",     icon: "fas fa-graduation-cap",   color: "#7c3aed" },
  { id: "tutorial", name: "Tutorial Section Account",     icon: "fas fa-book-open-reader", color: "#ea580c" }
];
if (typeof window !== "undefined") {
  window.SCHOOL_SECTIONS = SCHOOL_SECTIONS;
  window.ALL_CLASSES = ALL_CLASSES;
  window.EXPENSE_ACCOUNTS = EXPENSE_ACCOUNTS;
  window.getSectionByClass = getSectionByClass;
}

// ─── Default Configuration & Clean State ────────────────────────────────
const DEFAULT_DATA = {
  config: {
    schoolName: "OJ SCHOOLS",
    motto: "Knowledge, Diligence & Distinction",
    address: "OJ Schools Educational Complex, Lagos / Ogun State, Nigeria",
    contactEmail: "info@oj-schools.firebaseapp.com",
    phone: "08031234567",
    adminContact: "08031234567",
    currentSession: "2026/2027",
    currentTerm: "1st Term",
    currency: "₦"
  },

  classes: ALL_CLASSES,

  feeCategories: [
    { id: "school_fees",       name: "School Fees / Tuition (Termly)",      hasMeta: false },
    { id: "tutorial_fee",      name: "Tutorial Tuition & Coaching Fee",     hasMeta: false, forSection: "tutorial" },
    { id: "daycare_fee",       name: "Day Care / Creche Monthly Care Fee",  hasMeta: true,  forSection: "primary" },
    { id: "uniform",           name: "School Uniform & Sportswear",         hasMeta: false },
    { id: "textbooks",         name: "Textbooks & Learning Modules",        hasMeta: true,  metaType: "textbook" },
    { id: "exercise_books",    name: "Customized Exercise Books Pack",      hasMeta: true,  metaType: "exercise_books" },
    { id: "ict_cbt_levy",      name: "ICT & CBT Computer Lab Levy",         hasMeta: false },
    { id: "pta_development",   name: "PTA & School Development Levy",       hasMeta: false },
    { id: "bece_fee",          name: "BECE Junior WAEC Exam & Lesson Fee",  hasMeta: false, forClass: "JSS 3" },
    { id: "waec_fee",          name: "WAEC Examination Fee",                hasMeta: false, forClass: "SSS 3" },
    { id: "neco_fee",          name: "NECO Examination Fee",                hasMeta: false, forClass: "SSS 3" },
    { id: "jamb_cbt_drill",    name: "JAMB / UTME Registration & CBT Mock", hasMeta: false, forSection: "tutorial" },
    { id: "science_practical", name: "Science Practical & Laboratory Levy", hasMeta: false },
    { id: "extension_lessons", name: "Special Extension & Revision Lessons",hasMeta: false },
    { id: "other_special_fee", name: "Other Special / Miscellaneous Fee",   hasMeta: true }
  ],

  students: [],
  payments: [],
  expenses: [],
  auditLogs: [
    {
      id: "LOG-INIT",
      timestamp: Date.now(),
      date: new Date().toLocaleString("en-GB"),
      action: "SYSTEM_INITIALIZE",
      user: "System",
      details: "OJ Schools Academic Bursary & Record Management Database initialized."
    }
  ]
};

// ─── LocalStorage & Persistence Engine ──────────────────────────────────
class OJSchoolsDB {
  static KEY = "OJ_SCHOOLS_DB_V1_LIVE";

  static init() {
    if (!localStorage.getItem(this.KEY)) {
      localStorage.setItem(this.KEY, JSON.stringify(DEFAULT_DATA));
    }
  }

  static get() {
    this.init();
    try {
      const data = JSON.parse(localStorage.getItem(this.KEY));
      if (!data.students) data.students = [];
      if (!data.payments) data.payments = [];
      if (!data.expenses) data.expenses = [];
      if (!data.auditLogs) data.auditLogs = [];
      if (!data.config) data.config = DEFAULT_DATA.config;
      data.classes = ALL_CLASSES;

      // Anti-orphan guard: remove payments for non-existent students
      const validStudentIds = new Set(data.students.map(s => s.id));
      const hasOrphans = data.payments.some(p => p.studentId && !validStudentIds.has(p.studentId));
      if (hasOrphans) {
        data.payments = data.payments.filter(p => !p.studentId || validStudentIds.has(p.studentId));
        this.save(data, false);
      }

      return data;
    } catch (e) {
      console.error("Error reading OJ Schools database, resetting to default:", e);
      localStorage.setItem(this.KEY, JSON.stringify(DEFAULT_DATA));
      return JSON.parse(JSON.stringify(DEFAULT_DATA));
    }
  }

  static save(data, triggerCloudSync = true) {
    localStorage.setItem(this.KEY, JSON.stringify(data));
    if (triggerCloudSync && window.OJSchoolsFirebase && typeof window.OJSchoolsFirebase.syncWithCloud === "function") {
      window.OJSchoolsFirebase.syncWithCloud();
    }
  }

  // ─── Config ───
  static getConfig() {
    return this.get().config;
  }

  static updateConfig(partialConfig) {
    const data = this.get();
    data.config = { ...data.config, ...partialConfig };
    this.save(data);
    this.logAction("CONFIG_UPDATE", "System", "Updated school configuration profile.");
    return data.config;
  }

  // ─── Learners / Students ───
  static getStudents() {
    return this.get().students;
  }

  static getStudentById(id) {
    return this.getStudents().find(s => s.id === id) || null;
  }

  static saveStudent(studentData) {
    const data = this.get();
    const existingIndex = data.students.findIndex(s => s.id === studentData.id);

    // Compute or sanitize expected fees & arrears
    studentData.termFee = Number(studentData.termFee) || 0;
    studentData.arrears = Number(studentData.arrears) || 0;
    if (!studentData.status) studentData.status = "Active";
    if (!studentData.enrolledDate) studentData.enrolledDate = new Date().toISOString().split("T")[0];
    if (!studentData.section) {
      const sec = getSectionByClass(studentData.currentClass);
      studentData.section = sec ? sec.id : "primary";
    }

    if (existingIndex >= 0) {
      data.students[existingIndex] = { ...data.students[existingIndex], ...studentData };
      this.logAction("UPDATE_STUDENT", "Admin", `Updated student record for ${studentData.firstName} ${studentData.lastName} (${studentData.regNo})`);
    } else {
      if (!studentData.id) studentData.id = "STU-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 5).toUpperCase();
      data.students.push(studentData);
      this.logAction("ENROLL_STUDENT", "Admin", `Enrolled new student ${studentData.firstName} ${studentData.lastName} into ${studentData.currentClass}`);
    }

    this.save(data);
    return studentData;
  }

  static deleteStudent(studentId) {
    const data = this.get();
    const stu = data.students.find(s => s.id === studentId);
    if (!stu) return false;

    // Record pending deletions for cloud sync
    if (!data._deleted) data._deleted = {};
    if (!data._deleted.students) data._deleted.students = [];
    if (!data._deleted.payments) data._deleted.payments = [];
    data._deleted.students.push(studentId);

    // Remove associated payments
    const associatedPayments = data.payments.filter(p => p.studentId === studentId);
    associatedPayments.forEach(p => data._deleted.payments.push(p.id));

    data.students = data.students.filter(s => s.id !== studentId);
    data.payments = data.payments.filter(p => p.studentId !== studentId);

    this.logAction("DELETE_STUDENT", "Admin", `Deleted learner ${stu.firstName} ${stu.lastName} (${stu.regNo}) and purged ${associatedPayments.length} payment records.`);
    this.save(data);
    return true;
  }

  // ─── Financial Arithmetic: Arrears First Priority Deduction ───
  static getStudentBalance(studentId) {
    const student = this.getStudentById(studentId);
    if (!student) return null;

    const termFee = Number(student.termFee) || 0;
    const openingArrears = Number(student.arrears) || 0;

    // Gather all payments for this student
    const studentPayments = this.get().payments.filter(p => p.studentId === studentId);

    let totalPaid = 0;
    let arrearsPaid = 0;
    let termFeePaid = 0;
    let otherFeesPaid = 0;

    studentPayments.forEach(p => {
      const amount = Number(p.amount) || 0;
      totalPaid += amount;
      
      const arrDed = Number(p.arrearsDeducted) || 0;
      const termPaid = Number(p.termFeePaid) || 0;
      const otherPaid = Number(p.otherFeesPaid) || 0;

      arrearsPaid += arrDed;
      termFeePaid += termPaid;
      otherFeesPaid += otherPaid;
    });

    // Balances
    const arrearsRemaining = Math.max(0, openingArrears - arrearsPaid);
    const termFeeRemaining = Math.max(0, termFee - termFeePaid);
    const totalOutstanding = arrearsRemaining + termFeeRemaining;
    const isCleared = totalOutstanding <= 0 || student.clearanceStatus === "Cleared";

    return {
      student,
      termFee,
      openingArrears,
      arrearsPaid,
      arrearsRemaining,
      termFeePaid,
      termFeeRemaining,
      otherFeesPaid,
      totalPaid,
      totalOutstanding,
      isCleared
    };
  }

  // ─── Payments & Arrears Priority Engine ───
  static getPayments() {
    return this.get().payments;
  }

  static savePayment(paymentData) {
    const data = this.get();
    const student = data.students.find(s => s.id === paymentData.studentId);
    if (!student) throw new Error("Learner not found for this payment.");

    const totalAmount = Number(paymentData.amount) || 0;
    if (totalAmount <= 0) throw new Error("Payment amount must be greater than zero.");

    // Arrears Priority Allocation:
    // Determine how much arrears remains before this payment
    const currentBalance = this.getStudentBalance(student.id);
    const remainingArrearsBeforeThis = currentBalance ? currentBalance.arrearsRemaining : 0;
    const remainingTermFeeBeforeThis = currentBalance ? currentBalance.termFeeRemaining : 0;

    let arrearsDeducted = 0;
    let termFeePaid = 0;
    let otherFeesPaid = 0;

    // Check if user specifically categorized line items
    if (Array.isArray(paymentData.items) && paymentData.items.length > 0) {
      paymentData.items.forEach(item => {
        const itemAmt = Number(item.amount) || 0;
        if (item.id === "arrears" || item.category === "arrears") {
          arrearsDeducted += itemAmt;
        } else if (item.id === "school_fees" || item.category === "school_fees" || item.id === "tutorial_fee") {
          termFeePaid += itemAmt;
        } else {
          otherFeesPaid += itemAmt;
        }
      });
    } else {
      // Automatic Priority Rule: Deduct outstanding arrears first!
      if (remainingArrearsBeforeThis > 0) {
        arrearsDeducted = Math.min(totalAmount, remainingArrearsBeforeThis);
      }
      const leftover = totalAmount - arrearsDeducted;
      if (leftover > 0) {
        termFeePaid = leftover;
      }
    }

    if (!paymentData.id) {
      paymentData.id = "PAY-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 5).toUpperCase();
    }
    if (!paymentData.receiptNumber) {
      paymentData.receiptNumber = "OJS-" + new Date().getFullYear() + "-" + Math.floor(100000 + Math.random() * 900000);
    }
    if (!paymentData.date) {
      paymentData.date = new Date().toISOString().split("T")[0];
    }

    paymentData.arrearsDeducted = arrearsDeducted;
    paymentData.termFeePaid = termFeePaid;
    paymentData.otherFeesPaid = otherFeesPaid;
    paymentData.studentName = `${student.firstName} ${student.lastName}`;
    paymentData.studentClass = student.currentClass;
    paymentData.studentRegNo = student.regNo;
    paymentData.section = student.section || (getSectionByClass(student.currentClass) ? getSectionByClass(student.currentClass).id : "primary");

    data.payments.unshift(paymentData);

    this.logAction(
      "RECORD_PAYMENT",
      paymentData.recordedBy || "Bursar",
      `Logged payment of ₦${totalAmount.toLocaleString()} for ${student.firstName} ${student.lastName} (${paymentData.receiptNumber})`
    );

    this.save(data);
    return paymentData;
  }

  static deletePayment(paymentId) {
    const data = this.get();
    const payment = data.payments.find(p => p.id === paymentId);
    if (!payment) return false;

    if (!data._deleted) data._deleted = {};
    if (!data._deleted.payments) data._deleted.payments = [];
    data._deleted.payments.push(paymentId);

    data.payments = data.payments.filter(p => p.id !== paymentId);

    this.logAction("DELETE_PAYMENT", "Admin", `Voided payment receipt #${payment.receiptNumber} (₦${Number(payment.amount).toLocaleString()})`);
    this.save(data);
    return true;
  }

  // ─── School Expenses Ledger ───
  static getExpenses() {
    return this.get().expenses;
  }

  static saveExpense(expenseData) {
    const data = this.get();
    if (!expenseData.id) {
      expenseData.id = "EXP-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 5).toUpperCase();
    }
    if (!expenseData.date) {
      expenseData.date = new Date().toISOString().split("T")[0];
    }
    expenseData.amount = Number(expenseData.amount) || 0;
    if (!expenseData.account) expenseData.account = "general";
    if (!expenseData.period) expenseData.period = "monthly";

    const idx = data.expenses.findIndex(e => e.id === expenseData.id);
    if (idx >= 0) {
      data.expenses[idx] = { ...data.expenses[idx], ...expenseData };
      this.logAction("UPDATE_EXPENSE", "Bursar", `Updated expense: ${expenseData.title} (₦${expenseData.amount.toLocaleString()})`);
    } else {
      data.expenses.unshift(expenseData);
      this.logAction("LOG_EXPENSE", "Bursar", `Logged expense: ${expenseData.title} under ${expenseData.account} (₦${expenseData.amount.toLocaleString()})`);
    }

    this.save(data);
    return expenseData;
  }

  static deleteExpense(expenseId) {
    const data = this.get();
    const exp = data.expenses.find(e => e.id === expenseId);
    if (!exp) return false;

    if (!data._deleted) data._deleted = {};
    if (!data._deleted.expenses) data._deleted.expenses = [];
    data._deleted.expenses.push(expenseId);

    data.expenses = data.expenses.filter(e => e.id !== expenseId);
    this.logAction("DELETE_EXPENSE", "Admin", `Removed expense: ${exp.title} (₦${Number(exp.amount).toLocaleString()})`);
    this.save(data);
    return true;
  }

  // ─── Examination Clearance System ───
  static toggleClearanceStatus(studentId, forceStatus = null) {
    const data = this.get();
    const stu = data.students.find(s => s.id === studentId);
    if (!stu) return null;

    if (forceStatus) {
      stu.clearanceStatus = forceStatus;
    } else {
      stu.clearanceStatus = stu.clearanceStatus === "Cleared" ? "Pending" : "Cleared";
    }

    this.logAction("TOGGLE_CLEARANCE", "Admin", `Updated examination clearance for ${stu.firstName} ${stu.lastName} to ${stu.clearanceStatus}`);
    this.save(data);
    return stu;
  }

  // ─── Comprehensive Financial Statistics & P&L Calculation ───
  static getFinancialSummary(filterSection = "all") {
    const data = this.get();
    const students = data.students;
    const payments = data.payments;
    const expenses = data.expenses;

    // Filter by section if requested
    const filteredStudents = filterSection === "all" ? students : students.filter(s => (s.section || (getSectionByClass(s.currentClass) ? getSectionByClass(s.currentClass).id : "primary")) === filterSection);
    const filteredPayments = filterSection === "all" ? payments : payments.filter(p => p.section === filterSection);
    const filteredExpenses = filterSection === "all" ? expenses : expenses.filter(e => e.account === filterSection || e.account === "general");

    let totalRevenue = 0;
    let totalTermFeesPaid = 0;
    let totalArrearsRecovered = 0;
    let totalOtherFeesPaid = 0;

    filteredPayments.forEach(p => {
      const amt = Number(p.amount) || 0;
      totalRevenue += amt;
      totalArrearsRecovered += Number(p.arrearsDeducted) || 0;
      totalTermFeesPaid += Number(p.termFeePaid) || 0;
      totalOtherFeesPaid += Number(p.otherFeesPaid) || 0;
    });

    let totalExpenses = 0;
    filteredExpenses.forEach(e => {
      totalExpenses += Number(e.amount) || 0;
    });

    let totalOutstandingArrears = 0;
    let totalUnpaidTermFees = 0;
    let totalDebtorsCount = 0;

    filteredStudents.forEach(stu => {
      const bal = this.getStudentBalance(stu.id);
      if (bal) {
        totalOutstandingArrears += bal.arrearsRemaining;
        totalUnpaidTermFees += bal.termFeeRemaining;
        if (bal.totalOutstanding > 0) totalDebtorsCount++;
      }
    });

    const netProfit = totalRevenue - totalExpenses;
    const totalOutstandingDebt = totalOutstandingArrears + totalUnpaidTermFees;

    return {
      totalStudents: filteredStudents.length,
      totalRevenue,
      totalExpenses,
      netProfit,
      totalTermFeesPaid,
      totalArrearsRecovered,
      totalOtherFeesPaid,
      totalOutstandingArrears,
      totalUnpaidTermFees,
      totalOutstandingDebt,
      totalDebtorsCount
    };
  }

  // ─── Section Breakdown (P&L for All 4 Sections + Central) ───
  static getSectionBreakdown() {
    const sections = ["primary", "junior", "senior", "tutorial"];
    const breakdown = {};

    sections.forEach(secId => {
      const secDef = SCHOOL_SECTIONS[secId];
      const summary = this.getFinancialSummary(secId);
      breakdown[secId] = {
        name: secDef.name,
        color: secDef.color,
        icon: secDef.icon,
        ...summary
      };
    });

    // Central expenses
    const centralExpenses = this.getExpenses()
      .filter(e => e.account === "general")
      .reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);

    return { sections: breakdown, centralExpenses };
  }

  // ─── Audit Logs ───
  static getAuditLogs() {
    return this.get().auditLogs;
  }

  static logAction(action, user, details) {
    const data = this.get();
    if (!data.auditLogs) data.auditLogs = [];
    const logEntry = {
      id: "LOG-" + Date.now().toString(36).toUpperCase(),
      timestamp: Date.now(),
      date: new Date().toLocaleString("en-GB"),
      action,
      user: user || "System",
      details
    };
    data.auditLogs.unshift(logEntry);
    if (data.auditLogs.length > 500) data.auditLogs.pop(); // keep latest 500
    localStorage.setItem(this.KEY, JSON.stringify(data));
  }
}

if (typeof window !== "undefined") {
  window.OJSchoolsDB = OJSchoolsDB;
}
