/**
 * OJ SCHOOLS - Firebase Cloud Sync Bridge v1
 * Firebase Project: oj-schools
 * Academic Session: 2026/2027
 *
 * Bi-directional real-time sync with Firestore:
 * Collections: students, payments, expenses, auditLogs
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js";
import { getAnalytics }  from "https://www.gstatic.com/firebasejs/13.0.0/firebase-analytics.js";
import {
  getFirestore,
  doc,
  setDoc,
  deleteDoc,
  collection,
  getDocs,
  onSnapshot,
  writeBatch
} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBGKHdkZoTt06ySkSx1jBrKr94P5IMQqDM",
  authDomain: "oj-schools.firebaseapp.com",
  projectId: "oj-schools",
  storageBucket: "oj-schools.firebasestorage.app",
  messagingSenderId: "613243252165",
  appId: "1:613243252165:web:14e4904fc1bf26dcfd6fac",
  measurementId: "G-JHPLML8JPS"
};

const app       = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db        = getFirestore(app);

// ─── Global Cloud Bridge ─────────────────────────────────────────────────────
window.OJSchoolsFirebase = {
  ready: false,
  _syncing: false,

  // Deep-clean object before sending to Firestore (removes undefined/null)
  _sanitize(obj) {
    if (!obj || typeof obj !== "object") return obj;
    const clean = {};
    for (const [k, v] of Object.entries(obj)) {
      if (v === undefined || v === null) continue;
      else if (Array.isArray(v)) {
        clean[k] = v.map(item =>
          item && typeof item === "object"
            ? this._sanitize(item)
            : (item === undefined || item === null ? "" : item)
        );
      } else if (typeof v === "object" && !(v instanceof Date)) {
        clean[k] = this._sanitize(v);
      } else {
        clean[k] = v;
      }
    }
    return clean;
  },

  // Update the cloud-sync status badge in the dashboard UI
  _setSyncStatus(status, text) {
    const badge  = document.getElementById("cloud-sync-badge");
    const textEl = document.getElementById("cloud-sync-text");
    const iconEl = badge ? badge.querySelector("i") : null;
    if (!badge || !textEl) return;

    const styles = {
      synced:  { bg: "#f0fdf4", border: "#bbf7d0", color: "#166534", icon: "fas fa-cloud",                    label: "Cloud Synced"  },
      syncing: { bg: "#eff6ff", border: "#bfdbfe", color: "#1e40af", icon: "fas fa-sync fa-spin",              label: "Syncing..."    },
      offline: { bg: "#fffbeb", border: "#fde68a", color: "#92400e", icon: "fas fa-cloud-slash",               label: "Offline"       },
      error:   { bg: "#fef2f2", border: "#fecaca", color: "#991b1b", icon: "fas fa-exclamation-triangle",      label: "Sync Error"    }
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
      }

      if (changed) OJSchoolsDB.save(localDb, false);

      // 3. Push local records not yet in Firestore
      const freshDb = OJSchoolsDB.get();
      const batch = writeBatch(db);
      let batchSize = 0;

      for (const colName of collections) {
        if (!Array.isArray(freshDb[colName])) continue;
        for (const record of freshDb[colName]) {
          if (!record || !record.id) continue;
          const ref = doc(db, colName, record.id);
          batch.set(ref, this._sanitize(record), { merge: true });
          batchSize++;
          if (batchSize >= 490) break;
        }
        if (batchSize >= 490) break;
      }

      if (batchSize > 0) await batch.commit();

      this.ready = true;
      this._setSyncStatus("synced");
    } catch (err) {
      console.error("OJ Schools cloud sync error:", err);
      if (err.code === "unavailable" || err.message?.includes("network")) {
        this._setSyncStatus("offline", "Working Offline");
      } else {
        this._setSyncStatus("error", "Sync Error");
      }
    } finally {
      this._syncing = false;
    }
  },

  // Real-time live listener for multi-device sync
  startLiveSync() {
    const syncCollections = ["students", "payments", "expenses"];
    syncCollections.forEach(colName => {
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
            if (idx < 0) { arr.unshift(record); changed = true; }
            else if (JSON.stringify(arr[idx]) !== JSON.stringify(record)) {
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
          // Refresh the UI if app is loaded
          if (window.OJSchoolsApp && typeof window.OJSchoolsApp.refreshCurrentTab === "function") {
            window.OJSchoolsApp.refreshCurrentTab();
          }
          this._setSyncStatus("synced");
        }
      }, (err) => {
        console.warn("Live sync listener error:", err);
        this._setSyncStatus("offline", "Working Offline");
      });
    });
  }
};

// Auto-initialize on load
document.addEventListener("DOMContentLoaded", () => {
  setTimeout(async () => {
    await window.OJSchoolsFirebase.syncWithCloud();
    window.OJSchoolsFirebase.startLiveSync();
  }, 1200);
});
