# 🏫 OJ SCHOOLS — Complete Educational Ecosystem & Automated Bursary Management

A modern, responsive, automated school administrative portal and bursary management system designed specifically for **OJ SCHOOLS**, covering all four academic sections: **Primary Section**, **Junior Secondary**, **Senior Secondary**, and **Tutorial Section**.

---

## 🎨 Official Brand Identity
- **Primary Brand Color:** Deep Midnight Navy (`#0A192F`, `#0F2744`, `#16365C`)
- **Secondary Tone:** Royal Emerald Green (`#059669`, `#10B981`, `#ECFDF5`)
- **Prestige Accent:** Imperial Amber Gold (`#F59E0B`, `#D97706`, `#FEF3C7`)
- **Neutral Accent:** Pure White (`#FFFFFF`) & Modern Slate Gray (`#F8FAFC`, `#E2E8F0`, `#64748B`, `#1E293B`)
- **Current Academic Session:** **2026/2027**
- **Motto:** *"Knowledge, Diligence & Distinction"*

---

## 🏛️ The 4 Distinct School Sections

1. **Primary Section:**
   - Creche / Day Care, Kindergarten, Nursery 1, Nursery 2
   - Basic 1, Basic 2, Basic 3, Basic 4, Basic 5, Basic 6
2. **Junior Secondary:**
   - JSS 1A, JSS 1B, JSS 2A, JSS 2B, JSS 3A, JSS 3B
   - BECE / Junior WAEC Preparation
3. **Senior Secondary:**
   - SSS 1 Science, SSS 1 Art, SSS 1 Commercial
   - SSS 2 Science, SSS 2 Art, SSS 2 Commercial
   - SSS 3 Science, SSS 3 Art, SSS 3 Commercial
   - WAEC, NECO & Practical Science Labs
4. **Tutorial Section:**
   - WAEC & NECO Intensive Prep
   - UTME / JAMB CBT Drill & Masterclass
   - Post-UTME Screening Clinic
   - GCE & Adult Education Cohort
   - Weekend Accelerated Class & Evening Tutoring

---

## 🚀 Key Modules & Capabilities

### 1. 🔥 Firebase Cloud Backend Integration
Integrated Google Firebase SDK v13 with Firestore & Analytics:
- **Project ID:** `oj-schools`
- **Auth Domain:** `oj-schools.firebaseapp.com`
- **Storage Bucket:** `oj-schools.firebasestorage.app`
- **Messaging Sender ID:** `613243252165`
- **App ID:** `1:613243252165:web:14e4904fc1bf26dcfd6fac`
- **Measurement ID:** `G-JHPLML8JPS`
- **Real-Time Synchronization:** Whenever an administrator adds a learner, logs an expense, or records a payment, the data is saved locally and instantly persisted to Firebase Firestore collections (`students`, `payments`, `expenses`, `auditLogs`).
- **Offline / Cross-Platform Fallback:** Automatically caches and synchronizes to ensure continuous functionality across all mobile devices, laptops, tablets, and desktop browsers.

### 2. 🔐 Discrete Administrative Access Route (`/admin`)
- The public landing page (`index.html`) is **exclusively a public school showcase** with zero administrator buttons or login links.
- The administrative portal is accessed securely via **`/admin`** (or `admin/index.html`).

### 3. ⚖️ Learner Term School Fee & Arrears Priority Deduction
- **Enrollment Input:** Admin enters the learner's **Term School Fee** and any **Opening Arrears**.
- **Automatic Priority Clearance:** When school fees are logged, **arrears are paid first before term tuition**.
- **Complete Visibility:** Real-time visibility into **Arrears Balance**, **Term Fee Remaining**, and **Total Outstanding Amount**.

### 4. 💰 Flexible Currency & Kobo Precision
- Accepts amounts with comma separation (e.g. `150,000` or `2,500,000`).
- Supports exact decimal kobo precision (e.g. `₦150,000.50`).
- No restriction on digits or increments.

### 5. 📉 School Expenses Ledger & 5-Section P&L Breakdown
- Dedicated **Expenses Ledger** allowing logging of school expenses across periods: **Daily, Weekly, Monthly, Termly, Session, or One-Time**.
- **P&L Financial Overview** detailing:
  - **Total Revenue**
  - **Total Expenses**
  - **Net Profit / Loss**
  - Section-by-section breakdown:
    - Primary Section
    - Junior Secondary
    - Senior Secondary
    - Tutorial Section
    - Central Operations

### 6. 📊 Multi-Period Audit Reports & Official Receipts
- **Periods:** Daily, Weekly, Monthly, Termly, Session (2026/2027), and All-Time.
- **Export Formats:** One-click CSV spreadsheets for Learners, Payments, and Expenses.
- **Official Printouts:** Formal bursary receipts, Examination Clearance Passes, and P&L Financial Statements.

---

## 🔐 Administrative Login Credentials

To log into the administration portal, navigate to `/admin` (or `admin/index.html`):

| Role | Username | Password |
|---|---|---|
| **Principal Administrator** | `admin` | `ojschools2025` |
| **Chief Bursar** | `bursar` | `bursar123` |
| **Academic Records Officer** | `records` | `records123` |

*(Convenient 1-click test buttons are also available on the login screen for rapid administrative testing)*

---

## 📂 Project Structure

```
OJ SCHOOLS/
├── index.html            # Public School Showcase (Admissions, 4 Sections, Campus — NO Admin links)
├── dashboard.html        # Administrative Operations Hub (Synced with Firebase)
├── firestore.rules       # Cloud Firestore Security Rules v2 for oj-schools
├── firebase.json         # Firebase project configuration & routing
├── README.md             # Complete documentation & usage manual
├── admin/
│   └── index.html        # Administrative Login Gateway (/admin)
├── css/
│   └── custom.css        # Bespoke design system (Navy, Royal Emerald, Gold palette)
├── js/
│   ├── firebase-config.js# Firebase SDK v13 configuration & Firestore engine
│   ├── data.js           # 4-section schema, arithmetic, LocalStorage & Firestore sync
│   ├── auth.js           # Role session manager & /admin route protection
│   ├── app.js            # App controller, currency formatters, modal handlers
│   └── reports.js        # CSV exporter, receipt generator & statement printer
└── assets/
    └── images/           # Campus media assets
```

---

## 🌐 Deployment Instructions

When ready to host or deploy:
1. **Firebase Hosting:**
   ```bash
   firebase login
   firebase use oj-schools
   firebase deploy
   ```
2. **GitHub Pages (when ready):**
   ```bash
   git init
   git add .
   git commit -m "Initial commit: OJ Schools Educational Portal and Bursary System"
   git branch -M main
   # Note: User requested NOT to push to GitHub yet
   ```
