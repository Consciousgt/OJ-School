/**
 * OJ SCHOOLS - Firebase Cloud Sync Bridge v2
 * Firebase Project: oj-schools
 * Academic Session: 2026/2027
 *
 * Bi-directional real-time sync with Cloud Firestore:
 * Collections: students, payments, expenses, auditLogs, config
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js";
import { getAnalytics }  from "https://www.gstatic.com/firebasejs/13.0.0/firebase-analytics.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  setDoc,
  deleteDoc,
  collection,
  getDocs,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey:            "AIzaSyBGKHdkZoTt06ySkSx1jBrKr94P5IMQqDM",
  authDomain:        "oj-schools.firebaseapp.com",
  projectId:         "oj-schools",
  storageBucket:     "oj-schools.firebasestorage.app",
  messagingSenderId: "613243252165",
  appId:             "1:613243252165:web:14e4904fc1bf26dcfd6fac",
  measurementId:     "G-JHPLML8JPS"
};

// 1. Initialize Firebase Core
const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

// 2. Optional Analytics with safe guard
try {
  getAnalytics(app);
} catch (_) {
  // Analytics optional or blocked by ad-blocker/local environment
}

// 3. Optional Anonymous Auth Bridge
try {
  const auth = getAuth(app);
  signInAnonymously(auth).then(() => {
    console.info("[OJ Firebase] Authenticated anonymously to oj-schools");
  }).catch(e => {
    console.info("[OJ Firebase] Auth notice (continuing in standard mode):", e.message);
  });
} catch (_) {}

// ─── Global Cloud Bridge ─────────────────────────────────────────────────────
window.OJSchoolsFirebase = {
  ready: false,
  _syncing: false,

  // Deep-clean & conform object before sending to Firestore
  _sanitize(obj, colName) {
    if (!obj || typeof obj !== "object") return obj;
    const clean = {};
    for (const [k, v] of Object.entries(obj)) {
      if (v === undefined || v === null) continue;
      else if (Array.isArray(v)) {
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

    // Ensure schema defaults per collection
    if (colName === "students") {
      clean.status          = clean.status || "Active";
      clean.clearanceStatus = clean.clearanceStatus || "Pending";
      clean.termFee         = Number(clean.termFee) || 0;
      clean.arrears         = Number(clean.arrears) || 0;
      clean.section         = clean.section || (typeof getSectionByClass === "function" ? (getSectionByClass(clean.currentClass) || { id: "primary" }).id : "primary");
    } else if (colName === "payments") {
      clean.amount          = Number(clean.amount) || 0;
      clean.method          = clean.method || "Cash";
      clean.recordedBy      = clean.recordedBy || "Bursar";
      clean.date            = clean.date || new Date().toISOString().split("T")[0];
    } else if (colName === "expenses") {
      clean.amount          = Number(clean.amount) || 0;
      clean.period          = clean.period || "monthly";
      clean.section         = clean.section || clean.account || "general";
      clean.category        = clean.category || clean.title || "General";
      clean.recordedBy      = clean.recordedBy || "Bursar";
      clean.date            = clean.date || new Date().toISOString().split("T")[0];
    } else if (colName === "auditLogs") {
      clean.entity          = clean.entity || "system";
      clean.performedBy     = clean.performedBy || clean.user || "System";
      clean.timestamp       = clean.timestamp || Date.now();
    }

    return clean;
  },

  // Update cloud-sync status badge in the dashboard UI
  _setSyncStatus(status, text) {
    const badge  = document.getElementById("cloud-sync-badge");
    const textEl = document.getElementById("cloud-sync-text");
    const iconEl = badge ? badge.querySelector("i") : null;
    if (!badge || !textEl) return;

    const styles = {
      synced:  { bg: "#f0fdf4", border: "#bbf7d0", color: "#166534", icon: "fas fa-cloud",               label: "Cloud Synced"  },
      syncing: { bg: "#eff6ff", border: "#bfdbfe", color: "#1e40af", icon: "fas fa-sync fa-spin",         label: "Syncing..."    },
      offline: { bg: "#fffbeb", border: "#fde68a", color: "#92400e", icon: "fas fa-cloud-slash",          label: "Offline"       },
      error:   { bg: "#fef2f2", border: "#fecaca", color: "#991b1b", icon: "fas fa-exclamation-triangle", label: "Sync Error"    }
    };

    const style = styles[status] || styles.error;
    badge.style.background   = style.bg;
    badge.style.borderColor  = style.border;
    badge.style.color        = style.color;
    if (iconEl) iconEl.className = style.icon;
    textEl.textContent = text || style.label;
  },

  // Full two-way reconciliation
  async syncWithCloud() {
    if (this._syncing) return;
    this._syncing = true;
    this._setSyncStatus("syncing", "Syncing Cloud...");

    try {
      const collections = ["students", "payments", "expenses", "auditLogs"];
      const localDb = OJSchoolsDB.get();
      let changed = false;

      // 1. Push pending local deletions to Firestore
      if (localDb._deleted) {
        for (const [colName, ids] of Object.entries(localDb._deleted)) {
          if (!Array.isArray(ids)) continue;
          for (const id of ids) {
            try { await deleteDoc(doc(db, colName, id)); } catch (_) {}
          }
        }
        const cleared = OJSchoolsDB.get();
        delete cleared._deleted;
        OJSchoolsDB.save(cleared, false);
      }

      // 2. Pull all Firestore records; merge into local if newer
      for (const colName of collections) {
        try {
          const snap = await getDocs(collection(db, colName));
          snap.forEach(docSnap => {
            const cloudRecord = docSnap.data();
            if (!cloudRecord || !cloudRecord.id) return;

            const arr = localDb[colName];
            if (!Array.isArray(arr)) return;

            const localIdx = arr.findIndex(r => r.id === cloudRecord.id);
            const cloudTs  = Number(cloudRecord.timestamp || cloudRecord.updatedAt || 0);
            const localTs  = localIdx >= 0 ? Number(arr[localIdx].timestamp || arr[localIdx].updatedAt || 0) : -1;

            if (localIdx < 0) {
              arr.unshift(cloudRecord);
              changed = true;
            } else if (cloudTs > localTs) {
              arr[localIdx] = cloudRecord;
              changed = true;
            }
          });
        } catch (colErr) {
          console.warn(`[OJ Firebase] Pull ${colName} notice:`, colErr.message);
        }
      }

      // Also pull config if present
      try {
        const configSnap = await getDocs(collection(db, "config"));
        configSnap.forEach(d => {
          if (d.id === "school_config" && d.data()) {
            localDb.config = { ...localDb.config, ...d.data() };
            changed = true;
          }
        });
      } catch (_) {}

      if (changed) OJSchoolsDB.save(localDb, false);

      // 3. Push local records to Firestore individually (safe against single-item failure)
      const freshDb = OJSchoolsDB.get();
      let pushedCount = 0;

      for (const colName of collections) {
        if (!Array.isArray(freshDb[colName])) continue;
        for (const record of freshDb[colName]) {
          if (!record || !record.id) continue;
          try {
            const ref = doc(db, colName, record.id);
            await setDoc(ref, this._sanitize(record, colName), { merge: true });
            pushedCount++;
          } catch (writeErr) {
            console.warn(`[OJ Firebase] Record sync skipped (${colName}/${record.id}):`, writeErr.message);
          }
        }
      }

      // Push school config
      try {
        if (freshDb.config) {
          await setDoc(doc(db, "config", "school_config"), this._sanitize(freshDb.config, ""), { merge: true });
        }
      } catch (_) {}

      this.ready = true;
      this._setSyncStatus("synced", "Cloud Synced");
      console.info(`[OJ Firebase] Sync complete. Processed records across ${collections.length} collections.`);
    } catch (err) {
      console.error("[OJ Firebase] Cloud sync error:", err);
      if (err.code === "unavailable" || err.message?.includes("network")) {
        this._setSyncStatus("offline", "Working Offline");
      } else {
        this._setSyncStatus("error", "Sync Notice");
      }
    } finally {
      this._syncing = false;
    }
  },

  // Real-time live listener for multi-device sync
  startLiveSync() {
    const syncCollections = ["students", "payments", "expenses"];
    syncCollections.forEach(colName => {
      try {
        onSnapshot(collection(db, colName), (snap) => {
          const localDb = OJSchoolsDB.get();
          let changed = false;

          snap.docChanges().forEach(change => {
            const record = change.doc.data();
            if (!record || !record.id) return;
            const arr = localDb[colName];
            if (!Array.isArray(arr)) return;

            if (change.type === "added" || change.type === "modified") {
              const idx = arr.findIndex(r => r.id === record.id);
              if (idx < 0) {
                arr.unshift(record);
                changed = true;
              } else if (JSON.stringify(arr[idx]) !== JSON.stringify(record)) {
                arr[idx] = record;
                changed = true;
              }
            } else if (change.type === "removed") {
              const before = arr.length;
              localDb[colName] = arr.filter(r => r.id !== record.id);
              if (localDb[colName].length !== before) changed = true;
            }
          });

          if (changed) {
            OJSchoolsDB.save(localDb, false);
            if (window.OJSchoolsApp && typeof window.OJSchoolsApp.refreshCurrentTab === "function") {
              window.OJSchoolsApp.refreshCurrentTab();
            }
            this._setSyncStatus("synced", "Live Synced");
          }
        }, (err) => {
          console.warn(`[OJ Firebase] Live listener notice for ${colName}:`, err.message);
        });
      } catch (err) {
        console.warn(`[OJ Firebase] Listener initialization notice for ${colName}:`, err.message);
      }
    });
  }
};

// Auto-initialize on load
document.addEventListener("DOMContentLoaded", () => {
  setTimeout(async () => {
    if (window.OJSchoolsFirebase) {
      await window.OJSchoolsFirebase.syncWithCloud();
      window.OJSchoolsFirebase.startLiveSync();
    }
  }, 1000);
});
