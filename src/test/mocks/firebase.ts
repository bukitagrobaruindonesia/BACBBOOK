import { vi } from "vitest";

export const mockAuth = {
  currentUser: null,
  onAuthStateChanged: vi.fn((callback) => {
    callback(null);
    return vi.fn();
  }),
  signInWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
};

export const mockFirestore = {
  collection: vi.fn(() => ({
    doc: vi.fn(() => ({
      get: vi.fn(() => Promise.resolve({ exists: false, data: () => null })),
      set: vi.fn(() => Promise.resolve()),
      update: vi.fn(() => Promise.resolve()),
      delete: vi.fn(() => Promise.resolve()),
    })),
    add: vi.fn(() => Promise.resolve({ id: "mock-id" })),
    where: vi.fn(() => ({
      get: vi.fn(() => Promise.resolve({ docs: [], empty: true })),
    })),
    orderBy: vi.fn(() => ({
      get: vi.fn(() => Promise.resolve({ docs: [], empty: true })),
    })),
    get: vi.fn(() => Promise.resolve({ docs: [], empty: true })),
  })),
  doc: vi.fn(() => ({
    get: vi.fn(() => Promise.resolve({ exists: false, data: () => null })),
    set: vi.fn(() => Promise.resolve()),
    update: vi.fn(() => Promise.resolve()),
    delete: vi.fn(() => Promise.resolve()),
  })),
  getDoc: vi.fn(() => Promise.resolve({ exists: false, data: () => null })),
  setDoc: vi.fn(() => Promise.resolve()),
  updateDoc: vi.fn(() => Promise.resolve()),
  deleteDoc: vi.fn(() => Promise.resolve()),
  getDocs: vi.fn(() => Promise.resolve({ docs: [], empty: true })),
  addDoc: vi.fn(() => Promise.resolve({ id: "mock-id" })),
  query: vi.fn(() => ({
    get: vi.fn(() => Promise.resolve({ docs: [], empty: true })),
  })),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  onSnapshot: vi.fn(() => vi.fn()),
  Timestamp: {
    now: vi.fn(() => ({ toDate: () => new Date(), seconds: Date.now() / 1000 })),
    fromDate: vi.fn((date: Date) => ({ toDate: () => date, seconds: date.getTime() / 1000 })),
  },
  serverTimestamp: vi.fn(() => ({ seconds: Date.now() / 1000 })),
};

export const mockStorage = {
  ref: vi.fn(() => ({
    put: vi.fn(() => Promise.resolve({ ref: { getDownloadURL: vi.fn(() => Promise.resolve("mock-url")) } })),
    getDownloadURL: vi.fn(() => Promise.resolve("mock-url")),
    delete: vi.fn(() => Promise.resolve()),
  })),
};

vi.mock("@/app/lib/firebase", () => ({
  auth: mockAuth,
  db: mockFirestore,
  storage: mockStorage,
  default: { auth: mockAuth, db: mockFirestore, storage: mockStorage },
}));
