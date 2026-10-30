/**
 * OJ SCHOOLS — Reports, Receipts & CSV Export Module v2
 * Handles: multi-item payment receipts, CSV exports, P&L reports, clearance passes, debtors reports
 */

const OJSchoolsReports = (() => {
  function getCfg() {
    if (typeof OJSchoolsDB !== "undefined" && typeof OJSchoolsDB.getConfig === "function") {
      return OJSchoolsDB.getConfig();
    }
    return {
      schoolName:     "OJ SCHOOLS",
      motto:          "Knowledge, Diligence & Distinction",
      address:        "OJ Schools Educational Complex, Lagos / Ogun State, Nigeria",
      contactEmail:   "info@oj-schools.firebaseapp.com",
      phone:          "08031234567",
      currentSession: "2026/2027",
      currentTerm:    "1st Term",
      currency:       "\u20a6"
    };
  }

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
      body { font-family: 'Plus Jakarta Sans', sans-serif; background: #f8fafc; color: #0f172a; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
      .receipt-page { max-width: 640px; margin: 30px auto; background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,.1); border: 1px solid #e2e8f0; }
      .receipt-header { background: linear-gradient(135deg, #0a192f 0%, #0f2744 60%, #1e4a7a 100%); color: white; padding: 28px 32px; display: flex; justify-content: space-between; align-items: flex-start; }
      .receipt-logo { width: 50px; height: 50px; border-radius: 14px; background: rgba(255,255,255,.15); display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: 900; color: #fbbf24; border: 2px solid rgba(255,255,255,.2); margin-bottom: 10px; }
      .receipt-school-name { font-size: 22px; font-weight: 900; letter-spacing: -0.5px; }
      .receipt-school-sub  { font-size: 11px; color: rgba(255,255,255,.75); letter-spacing: 1px; text-transform: uppercase; margin-top: 3px; }
      .receipt-school-addr { font-size: 10px; color: rgba(255,255,255,.6); margin-top: 8px; line-height: 1.5; }
      .receipt-badge-area  { text-align: right; }
      .receipt-badge       { background: #fbbf24; color: #0a192f; font-size: 11px; font-weight: 800; padding: 6px 14px; border-radius: 9999px; letter-spacing: 1px; text-transform: uppercase; display: inline-block; }
      .receipt-no-label    { font-size: 10px; color: rgba(255,255,255,.6); margin-top: 10px; text-transform: uppercase; letter-spacing: 1px; }
      .receipt-no-value    { font-size: 16px; font-weight: 800; color: #fff; font-family: monospace; }
      .receipt-body        { padding: 26px 32px; }
      .receipt-student-bar { display: flex; gap: 14px; align-items: center; background: #f8fafc; border-radius: 12px; padding: 14px 18px; margin-bottom: 20px; border: 1px solid #e2e8f0; }
      .receipt-avatar      { width: 44px; height: 44px; border-radius: 50%; background: linear-gradient(135deg, #0a192f, #1e4a7a); display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: 800; color: #fbbf24; flex-shrink: 0; }
      .receipt-student-name{ font-size: 16px; font-weight: 700; color: #0f172a; }
      .receipt-student-meta{ font-size: 12px; color: #64748b; margin-top: 2px; }
      .receipt-section-badge { display: inline-block; font-size: 10px; font-weight: 700; padding: 2px 10px; border-radius: 9999px; margin-top: 4px; }
      .section-primary  { background: #d1fae5; color: #047857; }
      .section-junior   { background: #dbeafe; color: #1d4ed8; }
      .section-senior   { background: #ede9fe; color: #6d28d9; }
      .section-tutorial { background: #ffedd5; color: #c2410c; }
      .receipt-label    { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .8px; color: #64748b; margin-bottom: 10px; }
      .receipt-table    { width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 12px; }
      .receipt-table th { background: #f1f5f9; color: #475569; font-weight: 700; text-transform: uppercase; font-size: 10px; letter-spacing: .5px; padding: 8px 12px; text-align: left; }
      .receipt-table td { padding: 9px 12px; border-bottom: 1px solid #f1f5f9; color: #1e293b; }
      .receipt-table tr:last-child td { border-bottom: none; }
      .arrears-row td   { background: #fffbeb; color: #b45309; font-weight: 700; }
      .receipt-total-bar { display: flex; justify-content: space-between; align-items: center; background: linear-gradient(135deg, #0a192f, #1e4a7a); color: white; border-radius: 12px; padding: 14px 20px; margin-top: 14px; }
      .receipt-total-label { font-size: 12px; opacity: .85; }
      .receipt-total-amount { font-size: 24px; font-weight: 900; color: #fbbf24; }
      .balance-grid     { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 14px; }
      .balance-item     { background: #f8fafc; border-radius: 10px; padding: 10px 14px; border: 1px solid #e2e8f0; }
      .balance-item-label{ font-size: 10px; text-transform: uppercase; letter-spacing: .6px; color: #64748b; margin-bottom: 3px; font-weight: 700; }
      .balance-item-value{ font-size: 15px; font-weight: 800; }
      .receipt-footer   { background: #f8fafc; padding: 16px 32px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; }
      .receipt-footer-note { font-size: 10px; color: #64748b; max-width: 300px; line-height: 1.5; }
      .receipt-footer-stamp { text-align: right; }
      .stamp-label      { font-size: 10px; text-transform: uppercase; letter-spacing: .8px; color: #94a3b8; }
      .stamp-name       { font-size: 12px; font-weight: 700; color: #0a192f; margin-top: 4px; }
      @media print {
        body { background: white; }
        .receipt-page { box-shadow: none; border-radius: 0; margin: 0; max-width: 100%; border: none; }
        @page { size: A5 portrait; margin: 8mm; }
      }
    </style>
  `;

  // ── Print Payment Receipt (Multi-Item Aware) ──────────────────────────────────
  function printReceipt(paymentId) {
    const payment = OJSchoolsDB.getPayments().find(p => p.id === paymentId);
    if (!payment) return alert("Payment record not found.");

    const cfg     = getCfg();
    const student = OJSchoolsDB.getStudentById(payment.studentId);
    const bal     = student ? OJSchoolsDB.getStudentBalance(student.id) : null;

    const arrearsDeducted = Number(payment.arrearsDeducted) || 0;
    const termFeePaid     = Number(payment.termFeePaid)     || 0;
    const otherFeesPaid   = Number(payment.otherFeesPaid)   || 0;
    const totalPaid       = Number(payment.amount)          || 0;
    const currency        = cfg.currency || "\u20a6";

    const sec = student ? getSectionByClass(student.currentClass) : null;
    const secName  = sec ? sec.name : (payment.section || "");
    const secClass = sec ? `section-${sec.id}` : "";
    const initials = student
      ? `${(student.firstName || "?")[0]}${(student.lastName || "?")[0]}`
      : "OJ";

    let itemsTableRows = "";

    // If multi-item list exists on payment
    if (Array.isArray(payment.items) && payment.items.length > 0) {
      itemsTableRows = payment.items.map(it => `
        <tr>
          <td>
            <strong>${it.name || it.category?.replace(/_/g, " ") || it.id}</strong>
            ${it.description ? `<br><small style="color:#64748b">${it.description}</small>` : ""}
          </td>
          <td style="text-align:right;font-weight:600">${currency}${fmt(it.amount)}</td>
        </tr>
      `).join("");
    } else {
      // Single-item fallback
      if (arrearsDeducted > 0) {
        itemsTableRows += `
          <tr class="arrears-row">
            <td>⚠️ Priority Arrears Deducted</td>
            <td style="text-align:right;font-weight:700">${currency}${fmt(arrearsDeducted)}</td>
          </tr>
        `;
      }
      if (termFeePaid > 0) {
        itemsTableRows += `
          <tr>
            <td>${payment.category?.replace(/_/g, " ") || "School Fees / Tuition"}</td>
            <td style="text-align:right">${currency}${fmt(termFeePaid)}</td>
          </tr>
        `;
      }
      if (otherFeesPaid > 0) {
        itemsTableRows += `
          <tr>
            <td>Other Fees / Miscellaneous</td>
            <td style="text-align:right">${currency}${fmt(otherFeesPaid)}</td>
          </tr>
        `;
      }
      if (!itemsTableRows) {
        itemsTableRows = `
          <tr>
            <td>${payment.description || payment.category?.replace(/_/g, " ") || "Fee Payment"}</td>
            <td style="text-align:right;font-weight:700">${currency}${fmt(totalPaid)}</td>
          </tr>
        `;
      }
    }

    const outstandingAfter = bal ? bal.totalOutstanding : 0;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>OJ Schools Receipt - ${payment.receiptNumber}</title>
  ${receiptCSS}
</head>
<body>
<div class="receipt-page">
  <div class="receipt-header">
    <div>
      <div class="receipt-logo">OJ</div>
      <div class="receipt-school-name">${cfg.schoolName}</div>
      <div class="receipt-school-sub">${cfg.motto || "Knowledge, Diligence & Distinction"}</div>
      <div class="receipt-school-addr">${cfg.address}<br>${cfg.phone} &bull; ${cfg.contactEmail}</div>
    </div>
    <div class="receipt-badge-area">
      <div class="receipt-badge">✓ Official Receipt</div>
      <div style="margin-top:10px">
        <div class="receipt-no-label">Receipt No.</div>
        <div class="receipt-no-value">${payment.receiptNumber || payment.id}</div>
      </div>
      <div style="margin-top:6px">
        <div class="receipt-no-label">Session / Term</div>
        <div style="font-size:11px;color:#fff;font-weight:600">${cfg.currentSession} — ${cfg.currentTerm}</div>
      </div>
      <div style="margin-top:6px">
        <div class="receipt-no-label">Date</div>
        <div style="font-size:11px;color:#fff;font-weight:600">${fmtDate(payment.date)}</div>
      </div>
    </div>
  </div>

  <div class="receipt-body">
    ${student ? `
    <div class="receipt-student-bar">
      <div class="receipt-avatar">${initials}</div>
      <div>
        <div class="receipt-student-name">${student.firstName} ${student.lastName}</div>
        <div class="receipt-student-meta">Reg No: <strong>${student.regNo}</strong> &bull; Class: <strong>${student.currentClass}</strong></div>
        <span class="receipt-section-badge ${secClass}">${secName}</span>
      </div>
    </div>` : `
    <div class="receipt-student-bar">
      <div>
        <div class="receipt-student-name">${payment.studentName}</div>
        <div class="receipt-student-meta">Class: ${payment.studentClass || "—"} &bull; Reg: ${payment.studentRegNo || "—"}</div>
      </div>
    </div>`}

    <div class="receipt-label">Payment Breakdown</div>
    <table class="receipt-table">
      <thead>
        <tr>
          <th>Description</th>
          <th style="text-align:right">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${itemsTableRows}
      </tbody>
    </table>

    <div class="receipt-total-bar">
      <div>
        <div class="receipt-total-label">Total Amount Paid</div>
        <div style="font-size:11px;opacity:.75;margin-top:2px">${payment.method || "Cash"} &bull; ${fmtDate(payment.date)}</div>
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
        <div class="balance-item-label">Total Outstanding Balance</div>
        <div class="balance-item-value" style="color:${outstandingAfter > 0 ? "#dc2626" : "#059669"}">
          ${outstandingAfter > 0 ? currency + fmt(outstandingAfter) : "✓ FULLY SETTLED / NO OUTSTANDING"}
        </div>
      </div>
    </div>` : ""}

    ${payment.notes ? `
    <div style="margin-top:14px;font-size:12px;color:#64748b;background:#f8fafc;padding:10px 14px;border-radius:8px;border:1px solid #e2e8f0">
      <strong>Remarks:</strong> ${payment.notes}
    </div>` : ""}
  </div>

  <div class="receipt-footer">
    <div class="receipt-footer-note">
      This is an authentic computer-generated receipt from ${cfg.schoolName}. Please retain for record and examination clearance verification.
    </div>
    <div class="receipt-footer-stamp">
      <div class="stamp-label">Recorded By</div>
      <div class="stamp-name">${payment.recordedBy || "Bursar"}</div>
      <div style="margin-top:4px;font-size:10px;color:#94a3b8">Bursary Dept.</div>
    </div>
  </div>
</div>

<div style="text-align:center;margin:18px 0;font-size:11px;color:#94a3b8">
  Printed on ${new Date().toLocaleString("en-GB")} &bull; ${cfg.schoolName} Bursary System
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
    if (stu.clearanceStatus !== "Cleared") return alert("This learner has not been cleared yet. Outstanding balance must be settled or clearance granted by admin.");

    const cfg = getCfg();
    const bal = OJSchoolsDB.getStudentBalance(studentId);
    const sec = getSectionByClass(stu.currentClass) || SCHOOL_SECTIONS.primary;
    const initials = `${(stu.firstName || "?")[0]}${(stu.lastName || "?")[0]}`;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Clearance Pass - ${stu.firstName} ${stu.lastName}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800;900&family=Outfit:wght@700;800;900&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Plus Jakarta Sans', sans-serif; background: #f8fafc; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    .pass-card { max-width: 480px; margin: 40px auto; background: white; border-radius: 18px; overflow: hidden; box-shadow: 0 14px 40px rgba(0,0,0,.12); border: 2px solid #0a192f; }
    .pass-header { background: linear-gradient(135deg, #0a192f, #1e4a7a); color: white; padding: 22px 26px; display: flex; justify-content: space-between; align-items: center; }
    .pass-logo   { width: 44px; height: 44px; border-radius: 12px; background: rgba(255,255,255,.15); display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: 900; color: #fbbf24; font-family: 'Outfit'; }
    .pass-school-name { font-size: 18px; font-weight: 900; font-family: 'Outfit'; }
    .pass-school-sub  { font-size: 10px; color: rgba(255,255,255,.7); letter-spacing: 1px; text-transform: uppercase; }
    .pass-badge  { background: #059669; color: white; font-size: 10px; font-weight: 800; padding: 5px 12px; border-radius: 9999px; text-transform: uppercase; letter-spacing: .5px; }
    .pass-body   { padding: 24px 26px; }
    .pass-student-box { display: flex; align-items: center; gap: 14px; margin-bottom: 20px; background: #f8fafc; border-radius: 12px; padding: 14px 16px; border: 1px solid #e2e8f0; }
    .pass-avatar { width: 52px; height: 52px; border-radius: 50%; background: #0a192f; color: #fbbf24; display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: 900; font-family: 'Outfit'; flex-shrink: 0; }
    .pass-name   { font-size: 16px; font-weight: 800; color: #0f172a; }
    .pass-reg    { font-size: 12px; color: #64748b; font-weight: 600; margin-top: 2px; }
    .pass-info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 18px; }
    .pass-info-item { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 9px; padding: 9px 12px; }
    .pass-info-label { font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: 700; margin-bottom: 2px; }
    .pass-info-value { font-size: 13px; font-weight: 700; color: #0f172a; }
    .pass-cleared-bar { background: #ecfdf5; border: 2px solid #059669; border-radius: 12px; padding: 14px 16px; text-align: center; }
    .pass-cleared-icon { font-size: 24px; color: #059669; }
    .pass-cleared-text { font-size: 13px; font-weight: 900; color: #065f46; letter-spacing: .5px; margin-top: 4px; }
    .pass-cleared-sub  { font-size: 11px; color: #047857; margin-top: 2px; }
    .pass-footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 12px 26px; display: flex; justify-content: space-between; font-size: 10px; color: #64748b; }
    @media print {
      body { background: white; }
      .pass-card { box-shadow: none; margin: 0 auto; max-width: 100%; border: 1.5px solid #0a192f; }
      @page { size: A5 landscape; margin: 10mm; }
    }
  </style>
</head>
<body>
<div class="pass-card">
  <div class="pass-header">
    <div>
      <div class="pass-logo">OJ</div>
      <div class="pass-school-name">${cfg.schoolName}</div>
      <div class="pass-school-sub">Academic Clearance Pass</div>
    </div>
    <div class="pass-badge">✓ CLEARED</div>
  </div>

  <div class="pass-body">
    <div class="pass-student-box">
      <div class="pass-avatar">${initials}</div>
      <div>
        <div class="pass-name">${stu.firstName} ${stu.lastName}</div>
        <div class="pass-reg">Reg No: ${stu.regNo}</div>
      </div>
    </div>

    <div class="pass-info-grid">
      <div class="pass-info-item">
        <div class="pass-info-label">Class</div>
        <div class="pass-info-value">${stu.currentClass}</div>
      </div>
      <div class="pass-info-item">
        <div class="pass-info-label">Section</div>
        <div class="pass-info-value">${sec.name}</div>
      </div>
      <div class="pass-info-item">
        <div class="pass-info-label">Session / Term</div>
        <div class="pass-info-value">${cfg.currentSession} — ${cfg.currentTerm}</div>
      </div>
      <div class="pass-info-item">
        <div class="pass-info-label">Outstanding Balance</div>
        <div class="pass-info-value" style="color:#059669">${bal && bal.totalOutstanding <= 0 ? "₦0.00 — Settled" : "₦" + fmt(bal.totalOutstanding)}</div>
      </div>
    </div>

    <div class="pass-cleared-bar">
      <div class="pass-cleared-icon">✓</div>
      <div class="pass-cleared-text">EXAMINATION CLEARANCE CERTIFICATE</div>
      <div class="pass-cleared-sub">The above learner has fulfilled all financial obligations and is officially cleared for all term assessments.</div>
    </div>
  </div>

  <div class="pass-footer">
    <span>${cfg.address}</span>
    <span>Issued: ${new Date().toLocaleDateString("en-GB")}</span>
  </div>
</div>
<script>window.onload = () => { window.print(); };<\/script>
</body>
</html>`;

    printHtmlDocument(html, `Clearance Pass - ${stu.firstName} ${stu.lastName}`);
  }

  // ── Print Debtors Report ─────────────────────────────────────────────────────
  function printDebtorsReport(filterSection = "all") {
    const cfg     = getCfg();
    const debtors = OJSchoolsDB.getDebtors(filterSection);
    const summary = OJSchoolsDB.getFinancialSummary(filterSection);
    const curr    = cfg.currency || "\u20a6";

    const rows = debtors.map((d, i) => `
      <tr>
        <td>${i + 1}</td>
        <td><strong>${d.student.firstName} ${d.student.lastName}</strong></td>
        <td>${d.student.regNo}</td>
        <td>${d.student.currentClass}</td>
        <td>${d.student.parentPhone || "—"}</td>
        <td style="text-align:right">${curr}${fmt(d.balance.termFee)}</td>
        <td style="text-align:right;color:#b45309">${curr}${fmt(d.balance.arrearsRemaining)}</td>
        <td style="text-align:right;color:#059669">${curr}${fmt(d.balance.totalPaid)}</td>
        <td style="text-align:right;font-weight:800;color:#dc2626">${curr}${fmt(d.balance.totalOutstanding)}</td>
      </tr>
    `).join("");

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>OJ Schools — Debtors Schedule</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Plus Jakarta Sans', sans-serif; padding: 24px; color: #0f172a; }
    .header { border-bottom: 2px solid #0a192f; padding-bottom: 14px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-end; }
    .title { font-size: 20px; font-weight: 800; color: #0a192f; }
    .subtitle { font-size: 11px; color: #64748b; margin-top: 3px; }
    .summary-bar { display: flex; gap: 16px; background: #fff1f2; border: 1px solid #fecdd3; border-radius: 10px; padding: 12px 18px; margin-bottom: 18px; }
    .sum-item { flex: 1; }
    .sum-label { font-size: 10px; text-transform: uppercase; color: #9f1239; font-weight: 700; }
    .sum-val   { font-size: 16px; font-weight: 800; color: #e11d48; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th { background: #0a192f; color: white; padding: 8px 10px; text-align: left; font-size: 10px; text-transform: uppercase; }
    td { padding: 8px 10px; border-bottom: 1px solid #e2e8f0; }
    tr:nth-child(even) td { background: #f8fafc; }
    .footer { margin-top: 24px; font-size: 10px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 10px; }
    @media print {
      body { padding: 0; }
      @page { size: A4 landscape; margin: 8mm; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="title">${cfg.schoolName} — Outstanding Debtors Schedule</div>
      <div class="subtitle">Session: ${cfg.currentSession} &bull; Term: ${cfg.currentTerm} &bull; Filter: ${filterSection.toUpperCase()}</div>
    </div>
    <div style="text-align:right;font-size:11px;color:#64748b">
      Date: ${new Date().toLocaleDateString("en-GB")}
    </div>
  </div>

  <div class="summary-bar">
    <div class="sum-item">
      <div class="sum-label">Total Debtors</div>
      <div class="sum-val">${debtors.length} Learners</div>
    </div>
    <div class="sum-item">
      <div class="sum-label">Total Unrecovered Arrears</div>
      <div class="sum-val">${curr}${fmt(summary.totalOutstandingArrears)}</div>
    </div>
    <div class="sum-item">
      <div class="sum-label">Total Unpaid Term Fees</div>
      <div class="sum-val">${curr}${fmt(summary.totalUnpaidTermFees)}</div>
    </div>
    <div class="sum-item">
      <div class="sum-label">Grand Total Outstanding</div>
      <div class="sum-val">${curr}${fmt(summary.totalOutstandingDebt)}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Learner Name</th>
        <th>Reg No.</th>
        <th>Class</th>
        <th>Parent Phone</th>
        <th style="text-align:right">Term Fee</th>
        <th style="text-align:right">Arrears</th>
        <th style="text-align:right">Paid</th>
        <th style="text-align:right">Outstanding Balance</th>
      </tr>
    </thead>
    <tbody>
      ${rows || '<tr><td colspan="9" style="text-align:center;padding:20px;color:#059669;font-weight:700">✓ No outstanding debtors found!</td></tr>'}
    </tbody>
  </table>

  <div class="footer">
    ${cfg.schoolName} &bull; ${cfg.address} &bull; ${cfg.phone} &bull; Generated on ${new Date().toLocaleString("en-GB")}
  </div>
  <script>window.onload = () => { window.print(); };<\/script>
</body>
</html>`;

    printHtmlDocument(html, "Debtors Report");
  }

  // ── CSV Export: Debtors ──────────────────────────────────────────────────────
  function exportDebtorsCSV(filterSection = "all") {
    const debtors = OJSchoolsDB.getDebtors(filterSection);
    if (!debtors.length) return alert("No debtors found.");

    const headers = [
      "Reg No", "First Name", "Last Name", "Class", "Section",
      "Term Fee", "Arrears Remaining", "Total Paid", "Total Outstanding",
      "Parent Name", "Parent Phone"
    ];

    const rows = debtors.map(d => {
      const s = d.student;
      const b = d.balance;
      const sec = getSectionByClass(s.currentClass);
      return [
        s.regNo, s.firstName, s.lastName, s.currentClass, sec ? sec.name : "—",
        b.termFee, b.arrearsRemaining, b.totalPaid, b.totalOutstanding,
        s.parentName, s.parentPhone
      ].map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",");
    });

    downloadCSV([headers.join(","), ...rows].join("\n"), "OJ_Schools_Debtors_" + new Date().toISOString().split("T")[0] + ".csv");
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
  function exportPaymentsCSV() {
    let payments = OJSchoolsDB.getPayments();
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
  function printPLStatement() {
    const cfg       = getCfg();
    const summary   = OJSchoolsDB.getFinancialSummary();
    const breakdown = OJSchoolsDB.getSectionBreakdown();
    const curr      = cfg.currency || "\u20a6";

    const sectionColors = {
      primary:  "#059669",
      junior:   "#2563eb",
      senior:   "#7c3aed",
      tutorial: "#ea580c"
    };

    const sectionRows = Object.entries(breakdown.sections).map(([secId, d]) => {
      const net = d.totalRevenue - d.totalExpenses;
      const col = sectionColors[secId] || "#0a192f";
      return `
        <tr>
          <td><span style="display:inline-block;width:10px;height:10px;background:${col};border-radius:50%;margin-right:6px"></span><strong>${d.name}</strong></td>
          <td style="text-align:right">${d.totalStudents}</td>
          <td style="text-align:right;color:#059669">${curr}${fmt(d.totalRevenue)}</td>
          <td style="text-align:right;color:#dc2626">${curr}${fmt(d.totalExpenses)}</td>
          <td style="text-align:right;font-weight:700;color:${net >= 0 ? "#059669" : "#dc2626"}">${curr}${fmt(net)}</td>
          <td style="text-align:right">${d.totalDebtorsCount}</td>
          <td style="text-align:right;color:#b45309">${curr}${fmt(d.totalOutstandingDebt)}</td>
        </tr>
      `;
    }).join("");

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>P&L Statement - ${cfg.schoolName}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Plus Jakarta Sans', sans-serif; padding: 28px; color: #0f172a; }
    .header { border-bottom: 2px solid #0a192f; padding-bottom: 14px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-end; }
    .title { font-size: 22px; font-weight: 800; color: #0a192f; }
    .subtitle { font-size: 11px; color: #64748b; margin-top: 3px; }
    .cards-row { display: flex; gap: 14px; margin-bottom: 22px; }
    .card { flex: 1; border-radius: 12px; padding: 14px 18px; border: 1px solid #e2e8f0; text-align: center; background: #f8fafc; }
    .card-label { font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: 700; margin-bottom: 4px; }
    .card-val { font-size: 20px; font-weight: 900; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 14px; }
    th { background: #0a192f; color: white; padding: 10px 12px; text-align: left; font-size: 10px; text-transform: uppercase; }
    td { padding: 10px 12px; border-bottom: 1px solid #e2e8f0; }
    tfoot td { font-weight: 800; background: #f1f5f9; border-top: 2px solid #0a192f; }
    .footer { margin-top: 28px; font-size: 10px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 12px; }
    @media print {
      body { padding: 0; }
      @page { size: A4 landscape; margin: 8mm; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="title">${cfg.schoolName} — Profit & Loss Statement</div>
      <div class="subtitle">Academic Session: ${cfg.currentSession} &bull; Term: ${cfg.currentTerm}</div>
    </div>
    <div style="text-align:right;font-size:11px;color:#64748b">
      Generated: ${new Date().toLocaleDateString("en-GB")}
    </div>
  </div>

  <div class="cards-row">
    <div class="card" style="border-top:3px solid #059669">
      <div class="card-label">Total Revenue</div>
      <div class="card-val" style="color:#059669">${curr}${fmt(summary.totalRevenue)}</div>
    </div>
    <div class="card" style="border-top:3px solid #dc2626">
      <div class="card-label">Total Expenses</div>
      <div class="card-val" style="color:#dc2626">${curr}${fmt(summary.totalExpenses)}</div>
    </div>
    <div class="card" style="border-top:3px solid #2563eb">
      <div class="card-label">Net Profit / Loss</div>
      <div class="card-val" style="color:${summary.netProfit >= 0 ? "#059669" : "#dc2626"}">${curr}${fmt(summary.netProfit)}</div>
    </div>
    <div class="card" style="border-top:3px solid #d97706">
      <div class="card-label">Debtors Outstanding</div>
      <div class="card-val" style="color:#d97706">${curr}${fmt(summary.totalOutstandingDebt)}</div>
    </div>
  </div>

  <h4 style="font-size:14px;font-weight:800;margin-top:16px;margin-bottom:8px">Sectional Ledger Breakdown</h4>
  <table>
    <thead>
      <tr>
        <th>Section</th>
        <th style="text-align:right">Students</th>
        <th style="text-align:right">Revenue</th>
        <th style="text-align:right">Expenses</th>
        <th style="text-align:right">Net P&L</th>
        <th style="text-align:right">Debtors</th>
        <th style="text-align:right">Debt Outstanding</th>
      </tr>
    </thead>
    <tbody>
      ${sectionRows}
    </tbody>
    <tfoot>
      <tr>
        <td>TOTALS</td>
        <td style="text-align:right">${summary.totalStudents}</td>
        <td style="text-align:right;color:#059669">${curr}${fmt(summary.totalRevenue)}</td>
        <td style="text-align:right;color:#dc2626">${curr}${fmt(summary.totalExpenses)}</td>
        <td style="text-align:right;color:${summary.netProfit >= 0 ? "#059669" : "#dc2626"}">${curr}${fmt(summary.netProfit)}</td>
        <td style="text-align:right">${summary.totalDebtorsCount}</td>
        <td style="text-align:right;color:#b45309">${curr}${fmt(summary.totalOutstandingDebt)}</td>
      </tr>
    </tfoot>
  </table>

  <div class="footer">
    ${cfg.schoolName} &bull; ${cfg.address} &bull; ${cfg.phone}<br>
    Generated on ${new Date().toLocaleString("en-GB")} &bull; OJ Schools Bursary Ledger
  </div>
  <script>window.onload = () => { window.print(); };<\/script>
</body>
</html>`;

    printHtmlDocument(html, "P&L Statement");
  }

  // ── Helper ───────────────────────────────────────────────────────────────────
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

  return {
    printReceipt,
    printClearancePass,
    printDebtorsReport,
    exportDebtorsCSV,
    exportLearnersCSV,
    exportPaymentsCSV,
    exportExpensesCSV,
    printPLStatement
  };
})();

if (typeof window !== "undefined") {
  window.OJSchoolsReports = OJSchoolsReports;
}
