"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from "@/app/lib/firebase";
import { UserSession } from "@/app/types";

interface AuthContextType {
  user: UserSession | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const SESSION_KEY = "userSession";
const SESSION_EXPIRY_KEY = "sessionExpiry";
const SESSION_DURATION_MS = 8 * 60 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

function hashPassword(password: string): string {
  let hash = 0;
  const salt = "REKAP_PI_BUKIT_AGROCHEMICAL_2026";
  const combined = password + salt;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(16, "0");
}

function generateSessionToken(): string {
  const array = new Uint8Array(32);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(array);
  } else {
    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function getLoginAttempts(): { count: number; lastAttempt: number } {
  try {
    const stored = localStorage.getItem("loginAttempts");
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    localStorage.removeItem("loginAttempts");
  }
  return { count: 0, lastAttempt: 0 };
}

function setLoginAttempts(count: number) {
  localStorage.setItem("loginAttempts", JSON.stringify({ count, lastAttempt: Date.now() }));
}

function clearLoginAttempts() {
  localStorage.removeItem("loginAttempts");
}

function isLockedOut(): boolean {
  const attempts = getLoginAttempts();
  if (attempts.count >= MAX_LOGIN_ATTEMPTS) {
    const timeSinceLastAttempt = Date.now() - attempts.lastAttempt;
    if (timeSinceLastAttempt < LOCKOUT_DURATION_MS) {
      return true;
    }
    clearLoginAttempts();
  }
  return false;
}

function getRemainingLockoutMinutes(): number {
  const attempts = getLoginAttempts();
  const timeSinceLastAttempt = Date.now() - attempts.lastAttempt;
  const remaining = LOCKOUT_DURATION_MS - timeSinceLastAttempt;
  return Math.ceil(remaining / 60000);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const validateSession = useCallback(async (): Promise<boolean> => {
    try {
      const storedUser = localStorage.getItem(SESSION_KEY);
      const storedExpiry = localStorage.getItem(SESSION_EXPIRY_KEY);
      const storedToken = localStorage.getItem("sessionToken");

      if (!storedUser || !storedExpiry || !storedToken) {
        return false;
      }

      const expiry = parseInt(storedExpiry, 10);
      if (Date.now() > expiry) {
        return false;
      }

      const parsedUser: UserSession = JSON.parse(storedUser);
      if (!parsedUser.id || !parsedUser.email || !parsedUser.nama) {
        return false;
      }

      const userDocRef = doc(db, "karyawan", parsedUser.id);
      const userDoc = await getDoc(userDocRef);

      if (!userDoc.exists()) {
        return false;
      }

      const userData = userDoc.data();
      if (
        userData.email !== parsedUser.email ||
        userData.nama !== parsedUser.nama ||
        userData.role !== parsedUser.role
      ) {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      try {
        const isValid = await validateSession();
        if (isValid) {
          const storedUser = localStorage.getItem(SESSION_KEY);
          if (storedUser) {
            const parsedUser: UserSession = JSON.parse(storedUser);
            setUser(parsedUser);
            setIsAuthenticated(true);
            const newExpiry = Date.now() + SESSION_DURATION_MS;
            localStorage.setItem(SESSION_EXPIRY_KEY, newExpiry.toString());
          }
        } else {
          localStorage.removeItem(SESSION_KEY);
          localStorage.removeItem(SESSION_EXPIRY_KEY);
          localStorage.removeItem("sessionToken");
        }
      } catch {
        localStorage.removeItem(SESSION_KEY);
        localStorage.removeItem(SESSION_EXPIRY_KEY);
        localStorage.removeItem("sessionToken");
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, [validateSession]);

  const login = async (email: string, password: string): Promise<boolean> => {
    if (isLockedOut()) {
      const minutes = getRemainingLockoutMinutes();
      throw new Error(`Akun terkunci. Coba lagi dalam ${minutes} menit.`);
    }

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPassword = password.trim();

    if (!trimmedEmail || !trimmedPassword) {
      setLoginAttempts(getLoginAttempts().count + 1);
      return false;
    }

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(trimmedEmail)) {
      setLoginAttempts(getLoginAttempts().count + 1);
      return false;
    }

    if (trimmedPassword.length < 6) {
      setLoginAttempts(getLoginAttempts().count + 1);
      return false;
    }

    try {
      const hashedPassword = hashPassword(trimmedPassword);
      const q = query(
        collection(db, "karyawan"),
        where("email", "==", trimmedEmail),
        where("passwordHash", "==", hashedPassword)
      );
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        setLoginAttempts(getLoginAttempts().count + 1);
        return false;
      }

      const docData = snapshot.docs[0];
      const data = docData.data();

      if (data.status === "nonaktif" || data.isDeleted === true) {
        setLoginAttempts(getLoginAttempts().count + 1);
        return false;
      }

      const userData: UserSession = {
        id: docData.id,
        email: data.email,
        nama: data.nama,
        role: data.role,
      };

      const sessionToken = generateSessionToken();
      const expiry = Date.now() + SESSION_DURATION_MS;

      setUser(userData);
      setIsAuthenticated(true);
      localStorage.setItem(SESSION_KEY, JSON.stringify(userData));
      localStorage.setItem(SESSION_EXPIRY_KEY, expiry.toString());
      localStorage.setItem("sessionToken", sessionToken);
      clearLoginAttempts();

      return true;
    } catch {
      setLoginAttempts(getLoginAttempts().count + 1);
      return false;
    }
  };

  const logout = () => {
    setUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(SESSION_EXPIRY_KEY);
    localStorage.removeItem("sessionToken");
    clearLoginAttempts();
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isAuthenticated }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth harus digunakan dalam AuthProvider");
  }
  return context;
}