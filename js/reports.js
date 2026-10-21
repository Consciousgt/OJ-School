/**
 * OJ SCHOOLS — Reports, Receipts & CSV Export Module v1
 * Handles: payment receipts, CSV exports, P&L reports, clearance passes
 */

const OJSchoolsReports = (() => {
  const currency   = "₦";
  const schoolName = "OJ SCHOOLS";
  const session    = "2026/2027";
  const address    = "OJ Schools Educational Complex, Lagos / Ogun State, Nigeria";
  const phone      = "08031234567";
  const email      = "info@oj-schools.firebaseapp.com";

  function fmt(n) {
    return Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function fmtDate(dateStr) {
    if (!dateStr) return "—";
    try {
      return new Date(dateStr).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
    } catch { return dateStr; }
  }

  // ── Print via Blob URL (popup-blocker-safe) ──────────────────────────────────
  function printHtmlDocument(html, title = "OJ Schools Document") {
    try {
      const blob   = new Blob([html], { type: "text/html;charset=utf-8" });
      const blobUrl = URL.createObjectURL(blob);
      const win    = window.open(blobUrl, "_blank");
      if (win) {
        win.focus();
        setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
        return;
      }
      URL.revokeObjectURL(blobUrl);
    } catch (e) {
      console.warn("Blob URL print failed:", e);
    }
    // Fallback: hidden iframe
    try {
      let iframe = document.getElementById("oj-print-frame");
      if (iframe) iframe.remove();
      iframe = document.createElement("iframe");
      iframe.id = "oj-print-frame";
      iframe.style.cssText = "position:fixed;width:1px;height:1px;border:none;left:-9999px;top:-9999px;opacity:0";
      document.body.appendChild(iframe);
      const doc = iframe.contentDocument || iframe.contentWindow.document;
      doc.open("text/html", "replace");
      doc.write(html);
      doc.close();
      setTimeout(() => {
        try { iframe.contentWindow.focus(); iframe.contentWindow.print(); }
        catch (err) { alert("Please allow popups to print."); }
      }, 500);
    } catch (e2) {
      alert("Print failed. Please allow popups for this site.");
    }
  }

  // ── Receipt Branding Styles ──────────────────────────────────────────────────
  const receiptCSS = `
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;600;700;800&display=swap');
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: 'Plus Jakarta Sans', sans-serif; background: #f8fafc; color: #0f172a; print-color-adjust: exact; }
      .receipt-page { max-width: 640px; margin: 40px auto; background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,.1); }
      .receipt-header { background: linear-gradient(135deg, #0a192f 0%, #0f2744 60%, #1e4a7a 100%); color: white; padding: 32px; display: flex; justify-content: space-between; align-items: flex-start; }
      .receipt-logo { width: 54px; height: 54px; border-radius: 14px; background: rgba(255,255,255,.15); display: flex; align-items: center; justify-content: center; font-size: 26px; font-weight: 900; color: #fbbf24; border: 2px solid rgba(255,255,255,.2); margin-bottom: 12px; }
      .receipt-school-name { font-size: 22px; font-weight: 900; letter-spacing: -0.5px; }
      .receipt-school-sub  { font-size: 11px; color: rgba(255,255,255,.7); letter-spacing: 1.5px; text-transform: uppercase; margin-top: 3px; }
      .receipt-school-addr { font-size: 10px; color: rgba(255,255,255,.55); margin-top: 8px; line-height: 1.5; }
      .receipt-badge-area  { text-align: right; }
      .receipt-badge       { background: #fbbf24; color: #0a192f; font-size: 11px; font-weight: 800; padding: 6px 14px; border-radius: 9999px; letter-spacing: 1px; text-transform: uppercase; display: inline-block; }
      .receipt-no-label    { font-size: 10px; color: rgba(255,255,255,.5); margin-top: 10px; text-transform: uppercase; letter-spacing: 1px; }
      .receipt-no-value    { font-size: 16px; font-weight: 800; color: #fff; }
      .receipt-body        { padding: 28px 32px; }
      .receipt-student-bar { display: flex; gap: 14px; align-items: center; background: #f8fafc; border-radius: 12px; padding: 16px 20px; margin-bottom: 20px; border: 1px solid #e2e8f0; }
      .receipt-avatar      { width: 48px; height: 48px; border-radius: 50%; background: linear-gradient(135deg, #0a192f, #1e4a7a); display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: 800; color: #fbbf24; flex-shrink: 0; }
      .receipt-student-name{ font-size: 16px; font-weight: 700; }
      .receipt-student-meta{ font-size: 12px; color: #64748b; margin-top: 2px; }
      .receipt-section-badge { display: inline-block; font-size: 10px; font-weight: 700; padding: 2px 10px; border-radius: 9999px; margin-top: 4px; }
      .section-primary  { background: #d1fae5; color: #047857; }
      .section-junior   { background: #dbeafe; color: #1d4ed8; }
      .section-senior   { background: #ede9fe; color: #6d28d9; }
      .section-tutorial { background: #ffedd5; color: #c2410c; }
      .receipt-divider  { border: none; border-top: 1px dashed #e2e8f0; margin: 18px 0; }
      .receipt-label    { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .8px; color: #94a3b8; margin-bottom: 12px; }
      .receipt-table    { width: 100%; border-collapse: collapse; font-size: 13px; }
      .receipt-table th { background: #f1f5f9; color: #475569; font-weight: 700; text-transform: uppercase; font-size: 10px; letter-spacing: .5px; padding: 8px 12px; text-align: left; }
      .receipt-table td { padding: 10px 12px; border-bottom: 1px solid #f1f5f9; color: #1e293b; }
      .receipt-table tr:last-child td { border-bottom: none; }
      .arrears-row td   { background: #fff7ed; color: #92400e; font-weight: 600; }
      .receipt-total-bar { display: flex; justify-content: space-between; align-items: center; background: linear-gradient(135deg, #0a192f, #1e4a7a); color: white; border-radius: 12px; padding: 16px 22px; margin-top: 20px; }
      .receipt-total-label { font-size: 13px; opacity: .8; }
      .receipt-total-amount { font-size: 26px; font-weight: 900; color: #fbbf24; }
      .balance-grid     { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 16px; }
      .balance-item     { background: #f8fafc; border-radius: 10px; padding: 12px 16px; border: 1px solid #e2e8f0; }
      .balance-item-label{ font-size: 10px; text-transform: uppercase; letter-spacing: .6px; color: #94a3b8; margin-bottom: 4px; }
      .balance-item-value{ font-size: 16px; font-weight: 800; }
      .receipt-footer   { background: #f8fafc; padding: 18px 32px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; }
      .receipt-footer-note { font-size: 10px; color: #94a3b8; max-width: 280px; line-height: 1.5; }
      .receipt-footer-stamp { text-align: right; }
      .stamp-label      { font-size: 10px; text-transform: uppercase; letter-spacing: .8px; color: #94a3b8; }
      .stamp-name       { font-size: 12px; font-weight: 700; color: #0a192f; margin-top: 4px; }
      @media print {
        body { background: white; }
        .receipt-page { box-shadow: none; border-radius: 0; margin: 0; max-width: 100%; }
        @page { size: A5 portrait; margin: 10mm; }
      }
    </style>
  `;

  // ── Print Payment Receipt ─────────────────────────────────────────────────────
  function printReceipt(paymentId) {
    const payment = OJSchoolsDB.getPayments().find(p => p.id === paymentId);
    if (!payment) return alert("Payment not found.");

    const student = OJSchoolsDB.getStudentById(payment.studentId);
    const bal     = student ? OJSchoolsDB.getStudentBalance(student.id) : null;

    const arrearsDeducted = Number(payment.arrearsDeducted) || 0;
    const termFeePaid     = Number(payment.termFeePaid)     || 0;
    const otherFeesPaid   = Number(payment.otherFeesPaid)   || 0;
    const totalPaid       = Number(payment.amount)          || 0;

    const sec = student ? getSectionByClass(student.currentClass) : null;
    const secName  = sec ? sec.name : "";
    const secClass = sec ? `section-${sec.id}` : "";
    const initials = student
      ? `${(student.firstName || "?")[0]}${(student.lastName || "?")[0]}`
      : "OJ";

    const arrearsRow = arrearsDeducted > 0 ? `
      <tr class="arrears-row">
        <td>Priority Arrears Deducted</td>
        <td style="text-align:right;font-weight:700">${currency}${fmt(arrearsDeducted)}</td>
      </tr>
    ` : "";

    const termFeeRow = termFeePaid > 0 ? `
      <tr>
        <td>${payment.category?.replace(/_/g, " ") || "School Fees / Tuition"}</td>
        <td style="text-align:right">${currency}${fmt(termFeePaid)}</td>
      </tr>
    ` : "";

    const otherRow = otherFeesPaid > 0 ? `
      <tr>
        <td>Other Fees</td>
        <td style="text-align:right">${currency}${fmt(otherFeesPaid)}</td>
      </tr>
    ` : "";

    const outstandingAfter = bal ? bal.totalOutstanding : 0;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>OJ Schools Receipt - ${payment.receiptNumber}</title>
  ${receiptCSS}
</head>
<body>
<div class="receipt-page">
  <div class="receipt-header">
    <div>
      <div class="receipt-logo">OJ</div>
      <div class="receipt-school-name">${schoolName}</div>
      <div class="receipt-school-sub">Established for Academic Excellence</div>
      <div class="receipt-school-addr">${address}<br>${phone} &bull; ${email}</div>
    </div>
    <div class="receipt-badge-area">
      <div class="receipt-badge">✓ Payment Receipt</div>
      <div style="margin-top:12px">
        <div class="receipt-no-label">Receipt No.</div>
        <div class="receipt-no-value">${payment.receiptNumber || payment.id}</div>
      </div>
      <div style="margin-top:8px">
        <div class="receipt-no-label">Session</div>
        <div style="font-size:12px;color:#fff;font-weight:600">${session}</div>
      </div>
      <div style="margin-top:8px">
        <div class="receipt-no-label">Date</div>
        <div style="font-size:12px;color:#fff;font-weight:600">${fmtDate(payment.date)}</div>
      </div>
    </div>
  </div>

  <div class="receipt-body">
    ${student ? `
    <div class="receipt-student-bar">
      <div class="receipt-avatar">${initials}</div>
      <div>
        <div class="receipt-student-name">${student.firstName} ${student.lastName}</div>
        <div class="receipt-student-meta">${student.regNo} &bull; ${student.currentClass}</div>
        <span class="receipt-section-badge ${secClass}">${secName}</span>
      </div>
    </div>` : ""}

    <div class="receipt-label">Payment Breakdown</div>
    <table class="receipt-table">
      <thead>
        <tr>
          <th>Fee Description</th>
          <th style="text-align:right">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${arrearsRow}
        ${termFeeRow}
        ${otherRow}
        ${(!termFeeRow && !arrearsRow && !otherRow) ? `
        <tr>
          <td>${payment.description || payment.category || "Payment"}</td>
          <td style="text-align:right">${currency}${fmt(totalPaid)}</td>
        </tr>` : ""}
      </tbody>
    </table>

    <div class="receipt-total-bar">
      <div>
        <div class="receipt-total-label">Total Amount Paid</div>
        <div style="font-size:11px;opacity:.6;margin-top:2px">${payment.method || "Cash"} &bull; ${fmtDate(payment.date)}</div>
      </div>
      <div class="receipt-total-amount">${currency}${fmt(totalPaid)}</div>
    </div>

    ${bal ? `
    <div class="balance-grid">
      <div class="balance-item">
        <div class="balance-item-label">Arrears Remaining</div>
        <div class="balance-item-value" style="color:${bal.arrearsRemaining > 0 ? "#dc2626" : "#059669"}">${currency}${fmt(bal.arrearsRemaining)}</div>
      </div>
      <div class="balance-item">
        <div class="balance-item-label">Term Fee Balance</div>
        <div class="balance-item-value" style="color:${bal.termFeeRemaining > 0 ? "#dc2626" : "#059669"}">${currency}${fmt(bal.termFeeRemaining)}</div>
      </div>
      <div class="balance-item" style="grid-column:1/-1">
        <div class="balance-item-label">Total Outstanding After This Payment</div>
        <div class="balance-item-value" style="color:${outstandingAfter > 0 ? "#dc2626" : "#059669"}">
          ${outstandingAfter > 0 ? currency + fmt(outstandingAfter) : "✓ FULLY CLEARED"}
        </div>
      </div>
    </div>` : ""}

    ${payment.notes ? `
    <div style="margin-top:16px;font-size:12px;color:#64748b;background:#f8fafc;padding:12px;border-radius:8px;border:1px solid #e2e8f0">
      <strong>Notes:</strong> ${payment.notes}
    </div>` : ""}
  </div>

  <div class="receipt-footer">
    <div class="receipt-footer-note">
      This is an official payment receipt issued by OJ Schools.
      Keep this receipt as proof of payment. For enquiries, contact the bursary office.
    </div>
    <div class="receipt-footer-stamp">
      <div class="stamp-label">Processed By</div>
      <div class="stamp-name">${payment.recordedBy || "Bursar"}</div>
      <div style="margin-top:6px;font-size:10px;color:#94a3b8">OJ Schools Bursary Dept.</div>
    </div>
  </div>
</div>

<div style="text-align:center;margin:24px 0;font-size:11px;color:#94a3b8">
  Printed on ${new Date().toLocaleString("en-GB")} &bull; OJ SCHOOLS Admin Portal
</div>
<script>window.onload = () => { window.print(); };<\/script>
</body>
</html>`;

    printHtmlDocument(html, `OJ Schools Receipt - ${payment.receiptNumber}`);
  }

  // ── Print Examination Clearance Pass ─────────────────────────────────────────
  function printClearancePass(studentId) {
    const stu = OJSchoolsDB.getStudentById(studentId);
    if (!stu) return alert("Student not found.");
    if (stu.clearanceStatus !== "Cleared") return alert("This learner has not been cleared.");

    const bal = OJSchoolsDB.getStudentBalance(studentId);
    const sec = getSectionByClass(stu.currentClass) || SCHOOL_SECTIONS.primary;
    const initials = `${(stu.firstName || "?")[0]}${(stu.lastName || "?")[0]}`;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>OJ Schools Clearance Pass - ${stu.firstName} ${stu.lastName}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Plus Jakarta Sans', sans-serif; background: #f8fafc; print-color-adjust: exact; }
    .pass-card { max-width: 480px; margin: 40px auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,.1); border: 2px solid #0a192f; }
    .pass-header { background: linear-gradient(135deg, #0a192f, #1e4a7a); color: white; padding: 24px 28px; display: flex; justify-content: space-between; align-items: center; }
    .pass-logo   { width: 48px; height: 48px; border-radius: 12px; background: rgba(255,255,255,.15); display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: 900; color: #fbbf24; }
    .pass-school-name { font-size: 18px; font-weight: 900; }
    .pass-school-sub  { font-size: 10px; color: rgba(255,255,255,.6); letter-spacing: 1px; text-transform: uppercase; }
    .pass-badge  { background: #059669; color: white; padding: 6px 14px; border-radius: 9999px; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: .5px; }
    .pass-body   { padding: 24px 28px; }
    .pass-title  { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; color: #94a3b8; margin-bottom: 16px; text-align: center; }
    .pass-avatar-row { display: flex; gap: 16px; align-items: center; background: #f8fafc; border-radius: 12px; padding: 16px 20px; margin-bottom: 18px; border: 1px solid #e2e8f0; }
    .pass-avatar { width: 56px; height: 56px; border-radius: 50%; background: linear-gradient(135deg, #0a192f, #1e4a7a); display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: 800; color: #fbbf24; flex-shrink: 0; }
    .pass-stu-name { font-size: 18px; font-weight: 800; }
    .pass-stu-meta { font-size: 12px; color: #64748b; margin-top: 2px; }
    .pass-info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 16px; }
    .pass-info-item { background: #f8fafc; border-radius: 8px; padding: 10px 14px; border: 1px solid #e2e8f0; }
    .pass-info-label{ font-size: 10px; text-transform: uppercase; letter-spacing: .5px; color: #94a3b8; margin-bottom: 3px; }
    .pass-info-value{ font-size: 13px; font-weight: 700; color: #0f172a; }
    .pass-cleared-bar { background: #d1fae5; border: 2px solid #059669; border-radius: 12px; padding: 14px 20px; text-align: center; }
    .pass-cleared-icon { font-size: 28px; color: #059669; }
    .pass-cleared-text { font-size: 15px; font-weight: 800; color: #047857; margin-top: 4px; }
    .pass-cleared-sub  { font-size: 11px; color: #059669; margin-top: 2px; }
    .pass-footer { background: #f8fafc; padding: 14px 28px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; font-size: 10px; color: #94a3b8; }
    @media print {
      body { background: white; }
      .pass-card { box-shadow: none; border-radius: 0; margin: 0; max-width: 100%; }
      @page { size: A5 portrait; margin: 10mm; }
    }
  </style>
</head>
<body>
<div class="pass-card">
  <div class="pass-header">
    <div style="display:flex;align-items:center;gap:12px">
      <div class="pass-logo">OJ</div>
      <div>
        <div class="pass-school-name">${schoolName}</div>
        <div class="pass-school-sub">Examination Clearance Pass</div>
      </div>
    </div>
    <div class="pass-badge">✓ Cleared</div>
  </div>

  <div class="pass-body">
    <div class="pass-title">Official Examination Clearance Pass — ${session}</div>

    <div class="pass-avatar-row">
      <div class="pass-avatar">${initials}</div>
      <div>
        <div class="pass-stu-name">${stu.firstName} ${stu.lastName}</div>
        <div class="pass-stu-meta">${stu.regNo} &bull; ${stu.currentClass}</div>
        <div class="pass-stu-meta" style="color:${sec.color}">${sec.name}</div>
      </div>
    </div>

    <div class="pass-info-grid">
      <div class="pass-info-item">
        <div class="pass-info-label">Class</div>
        <div class="pass-info-value">${stu.currentClass}</div>
      </div>
      <div class="pass-info-item">
        <div class="pass-info-label">School Section</div>
        <div class="pass-info-value">${sec.name}</div>
      </div>
      <div class="pass-info-item">
        <div class="pass-info-label">Session</div>
        <div class="pass-info-value">${session}</div>
      </div>
      <div class="pass-info-item">
        <div class="pass-info-label">Outstanding</div>
        <div class="pass-info-value" style="color:#059669">${bal && bal.totalOutstanding <= 0 ? "₦0.00 — Settled" : "₦" + bal.totalOutstanding.toLocaleString()}</div>
      </div>
    </div>

    <div class="pass-cleared-bar">
      <div class="pass-cleared-icon">✅</div>
      <div class="pass-cleared-text">EXAMINATION CLEARANCE GRANTED</div>
      <div class="pass-cleared-sub">This student is financially cleared to sit for examinations.</div>
    </div>
  </div>

  <div class="pass-footer">
    <span>${address}</span>
    <span>Issued: ${new Date().toLocaleDateString("en-GB")}</span>
  </div>
</div>
<script>window.onload = () => { window.print(); };<\/script>
</body>
</html>`;

    printHtmlDocument(html, `OJ Schools Clearance Pass - ${stu.firstName} ${stu.lastName}`);
  }

  // ── CSV Export: Learners ──────────────────────────────────────────────────────
  function exportLearnersCSV() {
    const students = OJSchoolsDB.getStudents();
    if (!students.length) return alert("No learners to export.");

    const headers = ["Reg No","First Name","Last Name","Gender","Class","Section","Status","Term Fee","Opening Arrears","Total Paid","Outstanding","Parent/Guardian","Phone","Email","Enrolled Date"];
    const rows    = students.map(s => {
      const bal = OJSchoolsDB.getStudentBalance(s.id);
      const sec = getSectionByClass(s.currentClass);
      return [
        s.regNo, s.firstName, s.lastName, s.gender, s.currentClass,
        sec ? sec.name : "—",
        s.status || "Active",
        bal ? bal.termFee : 0,
        bal ? bal.openingArrears : 0,
        bal ? bal.totalPaid : 0,
        bal ? bal.totalOutstanding : 0,
        s.parentName, s.parentPhone, s.parentEmail, s.enrolledDate
      ].map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",");
    });

    downloadCSV([headers.join(","), ...rows].join("\n"), "OJ_Schools_Learners_" + new Date().toISOString().split("T")[0] + ".csv");
  }

  // ── CSV Export: Payments ──────────────────────────────────────────────────────
  function exportPaymentsCSV(timeframe = "all") {
    let payments = OJSchoolsDB.getPayments();
    if (timeframe !== "all") {
      const range = getDateRange(timeframe);
      if (range.startDate) payments = payments.filter(p => p.date >= range.startDate);
    }
    if (!payments.length) return alert("No payment records to export.");

    const headers = ["Receipt No","Student Name","Reg No","Class","Section","Date","Amount","Arrears Deducted","Term Fee Paid","Other Fees","Payment Method","Recorded By","Notes"];
    const rows    = payments.map(p => [
      p.receiptNumber, p.studentName, p.studentRegNo, p.studentClass, p.section,
      p.date, p.amount, p.arrearsDeducted || 0, p.termFeePaid || 0, p.otherFeesPaid || 0,
      p.method, p.recordedBy, p.notes
    ].map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","));

    downloadCSV([headers.join(","), ...rows].join("\n"), "OJ_Schools_Payments_" + new Date().toISOString().split("T")[0] + ".csv");
  }

  // ── CSV Export: Expenses ──────────────────────────────────────────────────────
  function exportExpensesCSV() {
    const expenses = OJSchoolsDB.getExpenses();
    if (!expenses.length) return alert("No expenses to export.");

    const headers = ["Expense ID","Date","Title","Account","Period","Amount","Payment Method","Notes"];
    const rows    = expenses.map(e => [
      e.id, e.date, e.title, e.account, e.period, e.amount, e.method, e.notes
    ].map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","));

    downloadCSV([headers.join(","), ...rows].join("\n"), "OJ_Schools_Expenses_" + new Date().toISOString().split("T")[0] + ".csv");
  }

  // ── Print P&L Financial Statement ────────────────────────────────────────────
  function printPLStatement(timeframe = "all") {
    const summary   = OJSchoolsDB.getFinancialSummary();
    const breakdown = OJSchoolsDB.getSectionBreakdown();

    const sectionColors = {
      primary:  "#059669",
      junior:   "#2563eb",
      senior:   "#7c3aed",
      tutorial: "#ea580c"
    };

    const sectionsHTML = Object.entries(breakdown.sections).map(([id, data]) => {
      const color = sectionColors[id] || "#64748b";
      const net   = data.totalRevenue - data.totalExpenses;
      return `
        <tr>
          <td style="font-weight:700;color:${color}">${data.name}</td>
          <td style="text-align:right">${data.totalStudents}</td>
          <td style="text-align:right;color:#059669;font-weight:700">₦${fmt(data.totalRevenue)}</td>
          <td style="text-align:right;color:#dc2626;font-weight:700">₦${fmt(data.totalExpenses)}</td>
          <td style="text-align:right;font-weight:700;color:${net >= 0 ? "#059669" : "#dc2626"}">₦${fmt(net)}</td>
          <td style="text-align:right">${data.totalDebtorsCount}</td>
          <td style="text-align:right;color:#b45309;font-weight:600">₦${fmt(data.totalOutstandingDebt)}</td>
        </tr>
      `;
    }).join("");

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>OJ Schools - P&L Financial Statement</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Plus Jakarta Sans', sans-serif; background: #fff; color: #0f172a; padding: 32px; print-color-adjust: exact; }
    .report-header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #0a192f; padding-bottom: 20px; margin-bottom: 24px; }
    .report-school-name { font-size: 24px; font-weight: 900; color: #0a192f; }
    .report-school-sub  { font-size: 11px; color: #64748b; letter-spacing: 1px; text-transform: uppercase; margin-top: 4px; }
    .report-title-box   { text-align: right; }
    .report-title       { font-size: 16px; font-weight: 800; color: #0a192f; }
    .report-date        { font-size: 11px; color: #64748b; margin-top: 4px; }
    .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 24px; }
    .summary-card { border-radius: 10px; padding: 16px 20px; }
    .summary-card.revenue { background: #d1fae5; }
    .summary-card.expense { background: #fee2e2; }
    .summary-card.profit  { background: #f0f9ff; }
    .summary-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; color: #64748b; }
    .summary-value { font-size: 22px; font-weight: 900; margin-top: 4px; }
    .section-title { font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: .5px; color: #0a192f; margin-bottom: 12px; padding-top: 8px; border-top: 1px solid #e2e8f0; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th { background: #0a192f; color: white; padding: 8px 12px; text-align: left; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .4px; }
    td { padding: 10px 12px; border-bottom: 1px solid #f1f5f9; }
    tr:last-child td { border-bottom: none; }
    .footer { margin-top: 32px; font-size: 10px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 14px; }
    @media print { body { padding: 15mm; } @page { size: A4; margin: 15mm; } }
  </style>
</head>
<body>
  <div class="report-header">
    <div>
      <div class="report-school-name">${schoolName}</div>
      <div class="report-school-sub">${address}</div>
    </div>
    <div class="report-title-box">
      <div class="report-title">P&L Financial Statement</div>
      <div class="report-date">Academic Session: ${session} &bull; Generated: ${new Date().toLocaleString("en-GB")}</div>
    </div>
  </div>

  <div class="summary-grid">
    <div class="summary-card revenue">
      <div class="summary-label">Total Revenue</div>
      <div class="summary-value" style="color:#047857">₦${fmt(summary.totalRevenue)}</div>
    </div>
    <div class="summary-card expense">
      <div class="summary-label">Total Expenses</div>
      <div class="summary-value" style="color:#dc2626">₦${fmt(summary.totalExpenses)}</div>
    </div>
    <div class="summary-card profit">
      <div class="summary-label">Net Profit / Loss</div>
      <div class="summary-value" style="color:${summary.netProfit >= 0 ? "#047857" : "#dc2626"}">₦${fmt(summary.netProfit)}</div>
    </div>
  </div>

  <div class="section-title">Section-by-Section Breakdown</div>
  <table>
    <thead>
      <tr>
        <th>School Section</th>
        <th style="text-align:right">Students</th>
        <th style="text-align:right">Revenue</th>
        <th style="text-align:right">Expenses</th>
        <th style="text-align:right">Net</th>
        <th style="text-align:right">Debtors</th>
        <th style="text-align:right">Outstanding</th>
      </tr>
    </thead>
    <tbody>
      ${sectionsHTML}
    </tbody>
    <tfoot>
      <tr style="background:#f8fafc;font-weight:800">
        <td>TOTAL (All Sections)</td>
        <td style="text-align:right">${summary.totalStudents}</td>
        <td style="text-align:right;color:#059669">₦${fmt(summary.totalRevenue)}</td>
        <td style="text-align:right;color:#dc2626">₦${fmt(summary.totalExpenses)}</td>
        <td style="text-align:right;color:${summary.netProfit >= 0 ? "#059669" : "#dc2626"}">₦${fmt(summary.netProfit)}</td>
        <td style="text-align:right">${summary.totalDebtorsCount}</td>
        <td style="text-align:right;color:#b45309">₦${fmt(summary.totalOutstandingDebt)}</td>
      </tr>
    </tfoot>
  </table>

  <div class="footer">
    ${schoolName} &bull; ${address} &bull; ${phone}<br>
    Generated on ${new Date().toLocaleString("en-GB")} &bull; OJ Schools Admin Portal
  </div>
  <script>window.onload = () => { window.print(); };<\/script>
</body>
</html>`;

    printHtmlDocument(html, "OJ Schools P&L Statement");
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────
  function getDateRange(timeframe) {
    const now   = new Date();
    const today = now.toISOString().split("T")[0];
    let startDate = null;
    if (timeframe === "daily") {
      startDate = today;
    } else if (timeframe === "weekly") {
      const d = new Date(); d.setDate(d.getDate() - 6);
      startDate = d.toISOString().split("T")[0];
    } else if (timeframe === "monthly") {
      startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    } else if (timeframe === "termly" || timeframe === "session") {
      startDate = "2026-09-01";
    }
    return { startDate, endDate: today };
  }

  function downloadCSV(content, filename) {
    const BOM  = "\uFEFF";
    const blob = new Blob([BOM + content], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href  = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(link.href), 5000);
  }

  // Public API
  return {
    printReceipt,
    printClearancePass,
    exportLearnersCSV,
    exportPaymentsCSV,
    exportExpensesCSV,
    printPLStatement
  };
})();

if (typeof window !== "undefined") {
  window.OJSchoolsReports = OJSchoolsReports;
}
