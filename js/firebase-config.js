/**
 * OJ SCHOOLS - Firebase Firestore Integration Layer v3
 * Powered by BURSAR IQ
 * Multi-Tab Persistent Cache & Spark Free-Tier Quota Shield
 * Physical Firestore Backend Deletion & Real-Time Cloud Synchronization
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-analytics.js";
import {
  initializeFirestore,
  getFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  doc,
  setDoc,
  deleteDoc,
  collection,
  getDocs,
  onSnapshot,
  writeBatch
} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js";
import {
  getAuth,
  signInAnonymously
} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js";

const firebaseConfig = {
  apiKey:            "AIzaSyBGKHdkZoTt06ySkSx1jBrKr94P5IMQqDM",
  authDomain:        "oj-schools.firebaseapp.com",
  projectId:         "oj-schools",
  storageBucket:     "oj-schools.firebasestorage.app",
  messagingSenderId: "613243252165",
  appId:             "1:613243252165:web:14e4904fc1bf26dcfd6fac",
  measurementId:     "G-JHPLML8JPS"
};

let app, db, auth;
try {
  app = initializeApp(firebaseConfig);
  try {
    // Multi-Tab Persistent IndexedDB Cache (Spark Free-Tier Quota Shield)
    // Firestore serves unchanged documents directly from local cache with 0 server reads!
    db = initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
      })
    });
    console.info("[OJ Firebase] Persistent multi-tab IndexedDB cache active ✓ (Quota Shield Active)");
  } catch (cacheErr) {
    console.warn("[OJ Firebase] Cache init note, falling back to standard getFirestore:", cacheErr.message);
    db = getFirestore(app);
  }
  auth = getAuth(app);
  console.info("[OJ Firebase] Firebase initialized successfully for project: oj-schools");
} catch (e) {
  console.warn("[OJ Firebase] Initialization error:", e.message);
}

// Anonymous Auth for Firestore security rules compliance
if (auth) {
  signInAnonymously(auth).then(() => {
    console.info("[OJ Firebase] Auth session active (uid:", auth.currentUser?.uid, ")");
    if (window.OJSchoolsFirebase && window.OJSchoolsFirebase.syncWithCloud) {
      window.OJSchoolsFirebase.syncWithCloud(false);
    }
  }).catch((err) => {
    console.warn("[OJ Firebase] Anonymous auth notice:", err.message);
  });
}

const OJSchoolsFirebase = {
  ready: false,
  _syncing: false,
  _realtimeActive: false,
  _refreshTimer: null,

  _scheduleRefresh(cb) {
    if (this._refreshTimer) clearTimeout(this._refreshTimer);
    this._refreshTimer = setTimeout(() => {
      this._refreshTimer = null;
      if (typeof cb === "function") cb();
    }, 250);
  },

  _sanitize(obj, colName = "") {
    if (!obj || typeof obj !== "object") return obj;
    const clean = {};
    for (const [k, v] of Object.entries(obj)) {
      if (v === undefined || v === null) {
        continue;
      } else if (Array.isArray(v)) {
        clean[k] = v.map(item =>
          item && typeof item === "object"
            ? this._sanitize(item, "")
            : (item === undefined || item === null ? "" : item)
        );
      } else if (typeof v === "object" && !(v instanceof Date)) {
        clean[k] = this._sanitize(v, "");
      } else {
        clean[k] = v;
      }
    }

    if (colName === "students") {
      clean.status          = clean.status || "Active";
      clean.clearanceStatus = clean.clearanceStatus || "Pending";
      clean.termFee         = Number(clean.termFee) || 0;
      clean.arrears         = Number(clean.arrears) || 0;
      if (!clean.section && typeof window.getSectionByClass === "function" && clean.currentClass) {
        const sec = window.getSectionByClass(clean.currentClass);
        clean.section = sec ? sec.id : "primary";
      }
      if (!clean.enrolledDate) clean.enrolledDate = new Date().toISOString().split("T")[0];
    } else if (colName === "payments") {
      clean.amount     = Number(clean.amount) || 0;
      clean.method     = clean.method || "Cash";
      clean.recordedBy = clean.recordedBy || "Bursar";
      clean.date       = clean.date || new Date().toISOString().split("T")[0];
    } else if (colName === "expenses") {
      clean.amount     = Number(clean.amount) || 0;
      clean.period     = clean.period || "monthly";
      clean.section    = clean.section || clean.account || "general";
      clean.category   = clean.category || clean.title || "General";
      clean.recordedBy = clean.recordedBy || "Bursar";
      clean.date       = clean.date || new Date().toISOString().split("T")[0];
    } else if (colName === "staff") {
      clean.name       = clean.name || "Staff Member";
      clean.section    = clean.section || "general";
      clean.baseSalary = Number(clean.baseSalary) || 0;
    } else if (colName === "salaries") {
      clean.amount     = Number(clean.amount) || 0;
      clean.year       = Number(clean.year) || new Date().getFullYear();
    } else if (colName === "stocks") {
      clean.quantity   = Number(clean.quantity) || 0;
      clean.unitPrice  = Number(clean.unitPrice) || 0;
    }

    return clean;
  },

  _setSyncStatus(status, text) {
    const badge = document.getElementById("cloud-sync-badge");
    const textEl = document.getElementById("cloud-sync-text");
    const iconEl = badge ? badge.querySelector("i") : null;
    if (!badge || !textEl) return;

    if (status === "synced") {
      badge.style.background = "#f0fdf4";
      badge.style.borderColor = "#bbf7d0";
      badge.style.color = "#166534";
      if (iconEl) iconEl.className = "fas fa-cloud text-emerald-500";
      textEl.textContent = text || "Cloud Synced";
    } else if (status === "syncing") {
      badge.style.background = "#eff6ff";
      badge.style.borderColor = "#bfdbfe";
      badge.style.color = "#1e40af";
      if (iconEl) iconEl.className = "fas fa-sync fa-spin text-sky-500";
      textEl.textContent = text || "Syncing...";
    } else if (status === "offline") {
      badge.style.background = "#fffbeb";
      badge.style.borderColor = "#fde68a";
      badge.style.color = "#92400e";
      if (iconEl) iconEl.className = "fas fa-cloud-rain text-amber-500";
      textEl.textContent = text || "Offline";
    } else {
      badge.style.background = "#fef2f2";
      badge.style.borderColor = "#fecaca";
      badge.style.color = "#991b1b";
      if (iconEl) iconEl.className = "fas fa-exclamation-triangle text-red-500";
      textEl.textContent = text || "Sync Alert";
    }
  },

  // ── Permanent Backend Deletion & Cloud Tombstone Logger ─────────────────────
  async recordCloudDeletion(col, id) {
    if (!col || !id || !db) return;
    const tombstoneId = `${col}_${id}`;
    const localDb = (window.OJSchoolsDB || window.RichVineDB) ? (window.OJSchoolsDB || window.RichVineDB).get() : {};
    if (!localDb._tombstones) localDb._tombstones = {};
    localDb._tombstones[id] = Date.now();
    localDb._tombstones[tombstoneId] = Date.now();
    try {
      await setDoc(doc(db, "deletedRecords", tombstoneId), {
        id: tombstoneId,
        col: col,
        targetId: id,
        deletedAt: Date.now()
      }, { merge: true });
      console.info(`[OJ Firebase] Permanent tombstone logged: deletedRecords/${tombstoneId}`);
    } catch (e) {
      console.warn(`[OJ Firebase] Tombstone write note (${col}/${id}):`, e.message);
    }
  },

  // ── Flush Pending Offline Deletions & Writes (Zero-Read Quota Shield) ───────
  async _flushPendingOfflineChanges() {
    if (!db) return;
    const dbRef = window.OJSchoolsDB || window.RichVineDB;
    const localDb = dbRef ? dbRef.get() : {};
    let changed = false;

    // 1. Process pending offline deletes directly against Firestore backend
    if (Array.isArray(localDb._pendingDeletes) && localDb._pendingDeletes.length > 0) {
      const remaining = [];
      for (const item of localDb._pendingDeletes) {
        try {
          if (item && item.col && item.id) {
            await deleteDoc(doc(db, item.col, item.id));
            await this.recordCloudDeletion(item.col, item.id);
            if (!localDb._tombstones) localDb._tombstones = {};
            localDb._tombstones[item.id] = Date.now();
            changed = true;
            console.info(`[OJ Firebase] Permanently deleted from backend: ${item.col}/${item.id}`);
          }
        } catch (e) {
          console.warn(`[OJ Firebase] Pending delete note for ${item.col}/${item.id}:`, e.message);
          remaining.push(item);
        }
      }
      localDb._pendingDeletes = remaining;
    }

    // 2. Process pending offline uploads across all collections
    const collections = ["students", "payments", "expenses", "stocks", "stockSales", "stockRestocks", "staff", "salaries"];
    for (const colName of collections) {
      const list = Array.isArray(localDb[colName]) ? localDb[colName] : [];
      for (const item of list) {
        if (item && item._pendingUpload === true) {
          try {
            const clean = this._sanitize(item, colName);
            delete clean._pendingUpload;
            await setDoc(doc(db, colName, item.id), clean, { merge: true });
            delete item._pendingUpload;
            changed = true;
            console.info(`[OJ Firebase] Flushed offline item to Cloud: ${colName}/${item.id}`);
          } catch (err) {
            console.warn(`[OJ Firebase] Pending upload skipped for ${colName}/${item.id}:`, err.message);
          }
        }
      }
    }

    if (changed && dbRef) {
      dbRef.save(localDb, false);
    }
  },

  // ── Two-Way Cloud Synchronization with Free-Tier Spark Shield ─────────────
  async syncWithCloud(force = false) {
    if (this._syncing || !db) return;
    const now = Date.now();
    const lastSync = Number(localStorage.getItem("ojschools_last_cloud_sync") || 0);

    // Free Spark Plan Quota Shield:
    // If realtime listener is already active, avoid redundant full getDocs scans
    if (!force && this._realtimeActive) {
      this._syncing = true;
      try {
        await this._flushPendingOfflineChanges();
        this._setSyncStatus("synced", "Cloud Synced");
      } catch (err) {
        console.warn("[OJ Firebase] Offline flush note:", err.message);
      } finally {
        this._syncing = false;
      }
      return;
    }

    // Rate-limit forced manual scans to once per 20 seconds
    if (force && lastSync && (now - lastSync < 20 * 1000)) {
      console.info("[OJ Firebase] Quota shield: Manual sync throttled (< 20s). Cache active.");
      return;
    }

    // Rate-limit auto full scans when realtime is inactive to 10 minutes
    if (!force && lastSync && (now - lastSync < 10 * 60 * 1000)) {
      console.info("[OJ Firebase] Quota shield active: Full scan throttled. Using local IndexedDB cache.");
      return;
    }

    this._syncing = true;
    this._setSyncStatus("syncing", "Syncing Cloud...");

    try {
      const collections = ["students", "payments", "expenses", "stocks", "stockSales", "stockRestocks", "staff", "salaries"];
      const dbRef = window.OJSchoolsDB || window.RichVineDB;
      const localDb = dbRef ? dbRef.get() : {};
      let changed = false;

      if (!localDb._tombstones) localDb._tombstones = {};

      // 1. Process explicit user-initiated pending deletes from backend
      await this._flushPendingOfflineChanges();

      // 2. Fetch tombstones from Cloud
      if (localDb._tombstones && typeof localDb._tombstones === "object") {
        for (const k of Object.keys(localDb._tombstones)) {
          if (k.startsWith("PAY-2026-") || k.includes("PAY-2026-")) {
            delete localDb._tombstones[k];
          }
        }
      }
      const tombstoneSet = new Set(Object.keys(localDb._tombstones || {}));
      try {
        const delSnap = await getDocs(collection(db, "deletedRecords"));
        if (!delSnap.empty) {
          for (const docSnap of delSnap.docs) {
            const d = docSnap.data();
            if (d && d.targetId) {
              tombstoneSet.add(d.targetId);
              tombstoneSet.add(`${d.col || ''}_${d.targetId}`);
              localDb._tombstones[d.targetId] = d.deletedAt || Date.now();
            }
            tombstoneSet.add(docSnap.id);
          }
        }
      } catch (delErr) {
        console.warn("[OJ Firebase] Notice reading deletedRecords:", delErr.message);
      }

      // 3. Two-Way Collection Reconciliation
      for (const colName of collections) {
        try {
          const snap = await getDocs(collection(db, colName));
          const cloudDocsMap = new Map();

          if (!snap.empty) {
            for (const docSnap of snap.docs) {
              // If document was registered as deleted, purge from cloud backend
              if (tombstoneSet.has(docSnap.id) || tombstoneSet.has(`${colName}_${docSnap.id}`)) {
                try { await deleteDoc(doc(db, colName, docSnap.id)); } catch (_) {}
                continue;
              }
              cloudDocsMap.set(docSnap.id, { id: docSnap.id, ...docSnap.data() });
            }
          }

          if (!localDb[colName]) localDb[colName] = [];
          const currentLocal = Array.isArray(localDb[colName]) ? localDb[colName] : [];
          const reconciledLocal = [];
          const seenIds = new Set();

          // Process existing local records
          for (const item of currentLocal) {
            if (!item || !item.id || seenIds.has(item.id)) continue;

            if (tombstoneSet.has(item.id) || tombstoneSet.has(`${colName}_${item.id}`)) {
              changed = true;
              continue;
            }

            seenIds.add(item.id);

            if (cloudDocsMap.has(item.id)) {
              const cloudData = cloudDocsMap.get(item.id);
              reconciledLocal.push({ ...item, ...cloudData });
              cloudDocsMap.delete(item.id);
            } else {
              // Local record not yet in Cloud:
              // Only purge if it was explicitly deleted by user (present in tombstoneSet)
              if (tombstoneSet.has(item.id) || tombstoneSet.has(`${colName}_${item.id}`)) {
                changed = true;
                continue;
              }

              // Record was NOT deleted! Keep it safe in local database
              reconciledLocal.push(item);

              // Upload to Cloud
              if (item._pendingUpload === true || colName === "payments") {
                try {
                  const clean = this._sanitize(item, colName);
                  delete clean._pendingUpload;
                  await setDoc(doc(db, colName, item.id), clean, { merge: true });
                  delete item._pendingUpload;
                  changed = true;
                } catch (upErr) {
                  // If cloud throttled or offline, keep in local
                }
              }
            }
          }

          // Add new Cloud records not yet in local storage
          for (const [cId, cloudData] of cloudDocsMap.entries()) {
            if (seenIds.has(cId) || tombstoneSet.has(cId) || tombstoneSet.has(`${colName}_${cId}`)) continue;
            seenIds.add(cId);
            reconciledLocal.unshift(cloudData);
            changed = true;
          }

          localDb[colName] = reconciledLocal;
        } catch (colErr) {
          console.warn(`[OJ Firebase] Notice syncing ${colName}:`, colErr.message);
        }
      }

      // Safe deduplication and student balance rebalancing
      if (dbRef) {
        if (dbRef.cleanDuplicatePayments) {
          const dupRes = dbRef.cleanDuplicatePayments(localDb);
          if (dupRes && dupRes.removedCount > 0) changed = true;
        }
        if (dbRef.recalculateAllStudentBalances) {
          dbRef.recalculateAllStudentBalances(localDb);
        }
      }

      if (changed && dbRef) {
        dbRef.save(localDb, false);
        const app = window.OJSchoolsApp || window.RichVineApp;
        if (app && app.refreshCurrentTab) app.refreshCurrentTab();
      }

      localStorage.setItem("ojschools_last_cloud_sync", String(Date.now()));
      this.ready = true;
      this._setSyncStatus("synced", "Cloud Synced");
      console.info("[OJ Firebase] Cloud reconciliation complete ✓");
    } catch (e) {
      console.warn("[OJ Firebase] Sync note:", e.message);
      this._setSyncStatus("offline", "Offline Mode");
    } finally {
      this._syncing = false;
    }
  },

  async pullFromCloud() {
    return this.syncWithCloud(true);
  },

  // ── Individual Entity Operations (Zero Over-Write, Minimal Quota Cost) ──────
  async saveStudent(student) {
    if (!student || !student.id || !db) return;
    try {
      const clean = this._sanitize(student, "students");
      clean.updatedAt = new Date().toISOString();
      await setDoc(doc(db, "students", student.id), clean, { merge: true });
      this._setSyncStatus("synced", "Cloud Synced");
      console.info("[OJ Firebase] Student synced to cloud:", student.id);
    } catch (e) {
      console.warn("[OJ Firebase] saveStudent failed:", e.message);
      this._setSyncStatus("error", "Sync Pending");
    }
  },

  async deleteStudent(id) {
    if (!id || !db) return;
    try {
      await deleteDoc(doc(db, "students", id));
      await this.recordCloudDeletion("students", id);
      console.info("[OJ Firebase] Student permanently deleted from cloud backend:", id);
    } catch (e) {
      console.warn("[OJ Firebase] deleteStudent failed/offline:", e.message);
      const dbRef = window.OJSchoolsDB || window.RichVineDB;
      const localDb = dbRef ? dbRef.get() : {};
      if (!localDb._pendingDeletes) localDb._pendingDeletes = [];
      localDb._pendingDeletes.push({ col: "students", id });
      if (dbRef) dbRef.save(localDb, false);
    }
  },

  async savePayment(payment) {
    if (!payment || !payment.id || !db) return;
    try {
      const clean = this._sanitize(payment, "payments");
      await setDoc(doc(db, "payments", payment.id), clean, { merge: true });
      this._setSyncStatus("synced", "Cloud Synced");
      console.info("[OJ Firebase] Payment synced to cloud:", payment.id);
    } catch (e) {
      console.warn("[OJ Firebase] savePayment failed:", e.message);
      this._setSyncStatus("error", "Sync Pending");
    }
  },

  async deletePayment(id) {
    if (!id || !db) return;
    try {
      await deleteDoc(doc(db, "payments", id));
      await this.recordCloudDeletion("payments", id);
      console.info("[OJ Firebase] Payment permanently deleted from cloud backend:", id);
    } catch (e) {
      console.warn("[OJ Firebase] deletePayment failed/offline:", e.message);
      const dbRef = window.OJSchoolsDB || window.RichVineDB;
      const localDb = dbRef ? dbRef.get() : {};
      if (!localDb._pendingDeletes) localDb._pendingDeletes = [];
      localDb._pendingDeletes.push({ col: "payments", id });
      if (dbRef) dbRef.save(localDb, false);
    }
  },

  async saveExpense(expense) {
    if (!expense || !expense.id || !db) return;
    try {
      const clean = this._sanitize(expense, "expenses");
      await setDoc(doc(db, "expenses", expense.id), clean, { merge: true });
      this._setSyncStatus("synced", "Cloud Synced");
      console.info("[OJ Firebase] Expense synced to cloud:", expense.id);
    } catch (e) {
      console.warn("[OJ Firebase] saveExpense failed:", e.message);
      this._setSyncStatus("error", "Sync Pending");
    }
  },

  async deleteExpense(id) {
    if (!id || !db) return;
    try {
      await deleteDoc(doc(db, "expenses", id));
      await this.recordCloudDeletion("expenses", id);
      console.info("[OJ Firebase] Expense permanently deleted from cloud backend:", id);
    } catch (e) {
      console.warn("[OJ Firebase] deleteExpense failed/offline:", e.message);
      const dbRef = window.OJSchoolsDB || window.RichVineDB;
      const localDb = dbRef ? dbRef.get() : {};
      if (!localDb._pendingDeletes) localDb._pendingDeletes = [];
      localDb._pendingDeletes.push({ col: "expenses", id });
      if (dbRef) dbRef.save(localDb, false);
    }
  },

  async saveStaff(staff) {
    if (!staff || !staff.id || !db) return;
    try {
      const clean = this._sanitize(staff, "staff");
      await setDoc(doc(db, "staff", staff.id), clean, { merge: true });
      this._setSyncStatus("synced", "Cloud Synced");
      console.info("[OJ Firebase] Staff synced to cloud:", staff.id);
    } catch (e) {
      console.warn("[OJ Firebase] saveStaff failed:", e.message);
    }
  },

  async deleteStaff(id) {
    if (!id || !db) return;
    try {
      await deleteDoc(doc(db, "staff", id));
      await this.recordCloudDeletion("staff", id);
      console.info("[OJ Firebase] Staff permanently deleted from cloud backend:", id);
    } catch (e) {
      console.warn("[OJ Firebase] deleteStaff offline:", e.message);
      const dbRef = window.OJSchoolsDB || window.RichVineDB;
      const localDb = dbRef ? dbRef.get() : {};
      if (!localDb._pendingDeletes) localDb._pendingDeletes = [];
      localDb._pendingDeletes.push({ col: "staff", id });
      if (dbRef) dbRef.save(localDb, false);
    }
  },

  async saveSalary(salary) {
    if (!salary || !salary.id || !db) return;
    try {
      const clean = this._sanitize(salary, "salaries");
      await setDoc(doc(db, "salaries", salary.id), clean, { merge: true });
      this._setSyncStatus("synced", "Cloud Synced");
      console.info("[OJ Firebase] Salary synced to cloud:", salary.id);
    } catch (e) {
      console.warn("[OJ Firebase] saveSalary failed:", e.message);
    }
  },

  async deleteSalary(id) {
    if (!id || !db) return;
    try {
      await deleteDoc(doc(db, "salaries", id));
      await this.recordCloudDeletion("salaries", id);
      console.info("[OJ Firebase] Salary permanently deleted from cloud backend:", id);
    } catch (e) {
      console.warn("[OJ Firebase] deleteSalary offline:", e.message);
      const dbRef = window.OJSchoolsDB || window.RichVineDB;
      const localDb = dbRef ? dbRef.get() : {};
      if (!localDb._pendingDeletes) localDb._pendingDeletes = [];
      localDb._pendingDeletes.push({ col: "salaries", id });
      if (dbRef) dbRef.save(localDb, false);
    }
  },

  async saveStockItem(item) {
    if (!item || !item.id || !db) return;
    try {
      const clean = this._sanitize(item, "stocks");
      await setDoc(doc(db, "stocks", item.id), clean, { merge: true });
      this._setSyncStatus("synced", "Cloud Synced");
      console.info("[OJ Firebase] Stock item synced to cloud:", item.id);
    } catch (e) {
      console.warn("[OJ Firebase] saveStockItem failed:", e.message);
    }
  },

  async saveStockSale(sale) {
    if (!sale || !sale.id || !db) return;
    try {
      const clean = this._sanitize(sale, "stockSales");
      await setDoc(doc(db, "stockSales", sale.id), clean, { merge: true });
      console.info("[OJ Firebase] Stock sale synced to cloud:", sale.id);
    } catch (e) {
      console.warn("[OJ Firebase] saveStockSale failed:", e.message);
    }
  },

  async saveStockRestock(restock) {
    if (!restock || !restock.id || !db) return;
    try {
      const clean = this._sanitize(restock, "stockRestocks");
      await setDoc(doc(db, "stockRestocks", restock.id), clean, { merge: true });
      console.info("[OJ Firebase] Stock restock synced to cloud:", restock.id);
    } catch (e) {
      console.warn("[OJ Firebase] saveStockRestock failed:", e.message);
    }
  },

  async deleteStockItem(id) {
    if (!id || !db) return;
    try {
      await deleteDoc(doc(db, "stocks", id));
      await this.recordCloudDeletion("stocks", id);
      console.info("[OJ Firebase] Stock item permanently deleted from cloud backend:", id);
    } catch (e) {
      console.warn("[OJ Firebase] deleteStockItem offline:", e.message);
      const dbRef = window.OJSchoolsDB || window.RichVineDB;
      const localDb = dbRef ? dbRef.get() : {};
      if (!localDb._pendingDeletes) localDb._pendingDeletes = [];
      localDb._pendingDeletes.push({ col: "stocks", id });
      if (dbRef) dbRef.save(localDb, false);
    }
  },

  async saveLog(log) {
    if (!log || !log.id || !db) return;
    try {
      const clean = this._sanitize(log, "auditLogs");
      await setDoc(doc(db, "auditLogs", log.id), clean, { merge: true });
    } catch (e) {
      // Non-critical, avoid console clutter
    }
  },

  // ── Realtime Listener for Multi-Device Multi-Tab Sync ─────────────────────
  initRealtimeSync(callbacks = {}) {
    if (this._realtimeActive || !db) return;
    this._realtimeActive = true;
    console.info("[OJ Firebase] Multi-device realtime listeners starting...");

    const collections = ["students", "payments", "expenses", "staff", "salaries", "stocks"];
    collections.forEach(colName => {
      try {
        onSnapshot(collection(db, colName), snap => {
          const dbRef = window.OJSchoolsDB || window.RichVineDB;
          const localDb = dbRef ? dbRef.get() : null;
          if (!localDb) return;
          if (!localDb[colName]) localDb[colName] = [];
          let changed = false;
          const tombstones = localDb._tombstones || {};

          snap.docChanges().forEach(change => {
            const data = { id: change.doc.id, ...change.doc.data() };
            if (tombstones[data.id] || tombstones[`${colName}_${data.id}`]) return;

            if (change.type === "added" || change.type === "modified") {
              const idx = localDb[colName].findIndex(r => r.id === data.id);
              if (idx === -1) {
                localDb[colName].unshift(data);
                changed = true;
              } else if (JSON.stringify(localDb[colName][idx]) !== JSON.stringify(data)) {
                localDb[colName][idx] = { ...localDb[colName][idx], ...data };
                changed = true;
              }
            } else if (change.type === "removed") {
              localDb[colName] = localDb[colName].filter(r => r.id !== data.id);
              changed = true;
            }
          });

          if (changed && dbRef) {
            dbRef.save(localDb, false);
            this._scheduleRefresh(() => {
              const app = window.OJSchoolsApp || window.RichVineApp;
              if (app && app.refreshCurrentTab) app.refreshCurrentTab();
            });
          }
          this._setSyncStatus("synced", "Cloud Synced");
        }, e => console.warn(`[OJ Realtime] ${colName} sync warning:`, e.message));
      } catch (err) {
        console.warn(`[OJ Realtime] Listener init notice for ${colName}:`, err.message);
      }
    });
  },

  startLiveSync() {
    this.initRealtimeSync();
  }
};

// Global exports
if (typeof window !== "undefined") {
  window.OJSchoolsFirebase = OJSchoolsFirebase;
  window.OJFirebase = OJSchoolsFirebase;
  window.RichVineFirebase = OJSchoolsFirebase; // Alias for seamless module interoperability
}

// Auto-initialize on dashboard load
if (typeof window !== "undefined") {
  const path = window.location.pathname.toLowerCase();
  if (path.includes("dashboard.html")) {
    setTimeout(() => {
      if (window.OJSchoolsFirebase && window.OJSchoolsFirebase.syncWithCloud) {
        window.OJSchoolsFirebase.syncWithCloud(false);
      }
      if (window.OJSchoolsFirebase && window.OJSchoolsFirebase.initRealtimeSync) {
        window.OJSchoolsFirebase.initRealtimeSync();
      }
    }, 700);
  }
}
