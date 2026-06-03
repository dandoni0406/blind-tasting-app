// ── Storage abstraction (Firebase + localStorage 하이브리드) ─────
// - 쓰기: localStorage(즉시) + Firestore(동기화)
// - 읽기: Firestore 우선, 오프라인 시 localStorage 폴백
// - App.jsx는 수정 없이 기존 window.storage.get/set 그대로 사용

import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc, deleteDoc, collection, getDocs } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBmHLY_SrxOcIyBITEgD24z8LIU8h5u2G0",
  authDomain: "blind-tasting-526b2.firebaseapp.com",
  projectId: "blind-tasting-526b2",
  storageBucket: "blind-tasting-526b2.firebasestorage.app",
  messagingSenderId: "527427965448",
  appId: "1:527427965448:web:4f3692cdf0a4ee8d8077bd"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const COL = "blind-tasting-data";

export const storage = {
  async get(key) {
    try {
      // Firestore 우선
      const snap = await getDoc(doc(db, COL, key));
      if (snap.exists()) {
        const value = snap.data().value;
        localStorage.setItem(key, value); // 로컬 캐시 갱신
        return { key, value };
      }
      // Firestore에 없으면 localStorage 폴백
      const local = localStorage.getItem(key);
      return local === null ? null : { key, value: local };
    } catch (e) {
      // 오프라인 폴백
      const local = localStorage.getItem(key);
      return local === null ? null : { key, value: local };
    }
  },

  async set(key, value) {
    try {
      // localStorage 즉시 저장 (오프라인에서도 작동)
      localStorage.setItem(key, value);
      // Firestore 동기화
      await setDoc(doc(db, COL, key), {
        value,
        updatedAt: new Date().toISOString()
      });
      return { key, value };
    } catch (e) {
      // Firestore 실패해도 localStorage는 저장됨
      console.warn("[Storage] Firestore 쓰기 실패 (로컬 저장됨):", e.message);
      return { key, value };
    }
  },

  async delete(key) {
    try {
      localStorage.removeItem(key);
      await deleteDoc(doc(db, COL, key));
      return { key, deleted: true };
    } catch (e) {
      return { key, deleted: true };
    }
  },

  async list(prefix = '') {
    try {
      const snap = await getDocs(collection(db, COL));
      const keys = [];
      snap.forEach(d => { if (d.id.startsWith(prefix)) keys.push(d.id); });
      return { keys, prefix };
    } catch (e) {
      // 오프라인 폴백
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(prefix)) keys.push(k);
      }
      return { keys, prefix };
    }
  },
};

// window.storage로 노출 (App.jsx가 이걸 사용)
if (typeof window !== 'undefined' && !window.storage) {
  window.storage = storage;
}
