// ── Storage: Firebase Firestore + localStorage 하이브리드 ─────────
import { initializeApp } from "firebase/app";
import {
  getFirestore, doc, getDoc, setDoc, deleteDoc,
  collection, getDocs, onSnapshot
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBmHLY_SrxOcIyBITEgD24z8LIU8h5u2G0",
  authDomain: "blind-tasting-526b2.firebaseapp.com",
  projectId: "blind-tasting-526b2",
  storageBucket: "blind-tasting-526b2.firebasestorage.app",
  messagingSenderId: "527427965448",
  appId: "1:527427965448:web:4f3692cdf0a4ee8d8077bd"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export { doc, setDoc, onSnapshot, collection, getDocs, getDoc };

const COL = "blind-tasting-data";
const SESSIONS_COL = "sessions"; // 실시간 협업용 세션 컬렉션

// ── 키-값 스토리지 (기존 데이터 호환) ──────────────────────────────
export const storage = {
  async get(key) {
    try {
      const snap = await getDoc(doc(db, COL, key));
      if (snap.exists()) {
        const value = snap.data().value;
        localStorage.setItem(key, value);
        return { key, value };
      }
      const local = localStorage.getItem(key);
      return local === null ? null : { key, value: local };
    } catch (e) {
      const local = localStorage.getItem(key);
      return local === null ? null : { key, value: local };
    }
  },
  async set(key, value) {
    try {
      localStorage.setItem(key, value);
      await setDoc(doc(db, COL, key), { value, updatedAt: new Date().toISOString() });
      return { key, value };
    } catch (e) {
      console.warn("[Storage] Firestore 쓰기 실패:", e.message);
      return { key, value };
    }
  },
  async delete(key) {
    try {
      localStorage.removeItem(key);
      await deleteDoc(doc(db, COL, key));
    } catch (e) {}
    return { key, deleted: true };
  },
  async list(prefix = '') {
    try {
      const snap = await getDocs(collection(db, COL));
      const keys = [];
      snap.forEach(d => { if (d.id.startsWith(prefix)) keys.push(d.id); });
      return { keys, prefix };
    } catch (e) {
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(prefix)) keys.push(k);
      }
      return { keys, prefix };
    }
  },
};

// ── 실시간 협업 세션 (멀티플레이어용) ────────────────────────────────
export const sessionDB = {
  // 세션 저장 (호스트가 생성 시)
  async save(session) {
    await setDoc(doc(db, SESSIONS_COL, session.id), session);
  },
  // 초대코드로 세션 찾기
  async findByCode(code) {
    const snap = await getDocs(collection(db, SESSIONS_COL));
    let found = null;
    snap.forEach(d => {
      if (d.data().accessCode === code.toUpperCase()) found = d.data();
    });
    return found;
  },
  // 실시간 리스너 (세션 변경 시 콜백)
  subscribe(sessionId, callback) {
    return onSnapshot(doc(db, SESSIONS_COL, sessionId), snap => {
      if (snap.exists()) callback(snap.data());
    });
  },
};

if (typeof window !== "undefined" && !window.storage) {
  window.storage = storage;
}
