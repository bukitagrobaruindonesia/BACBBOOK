"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/app/lib/firebase";
import { UserSession } from "@/app/types";
import { getAuth, signInWithCustomToken, onAuthStateChanged, signOut } from "firebase/auth";

interface AuthContextType {
  user: UserSession | null;
  loading: boolean;
  verified: boolean;
  needsVerification: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  markVerified: () => void;
  setNeedsVerification: (value: boolean) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [verified, setVerified] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(false);
  const firebaseAuth = getAuth();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, (firebaseUser) => {
      try {
        const storedUser = localStorage.getItem("userSession");
        const storedVerified = localStorage.getItem("userVerified");
        if (storedUser && firebaseUser) {
          const parsed = JSON.parse(storedUser);
          setUser(parsed);
          if (storedVerified === "true") {
            setVerified(true);
            setNeedsVerification(false);
          } else {
            setVerified(false);
            setNeedsVerification(true);
          }
        } else {
          setUser(null);
          setVerified(false);
          setNeedsVerification(false);
        }
      } catch (e) {
        localStorage.removeItem("userSession");
        localStorage.removeItem("userVerified");
        setUser(null);
        setVerified(false);
        setNeedsVerification(false);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [firebaseAuth]);

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      const q = query(
        collection(db, "karyawan"),
        where("email", "==", email),
        where("password", "==", password)
      );
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        return false;
      }

      const doc = snapshot.docs[0];
      const data = doc.data();
      const userData: UserSession = {
        id: doc.id,
        email: data.email,
        nama: data.nama,
        role: data.role,
      };

      const res = await fetch("/api/custom-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, uid: doc.id }),
      });

      if (!res.ok) {
        return false;
      }

      const { token } = await res.json();
      await signInWithCustomToken(firebaseAuth, token);

      setUser(userData);
      setVerified(false);
      setNeedsVerification(true);
      localStorage.setItem("userSession", JSON.stringify(userData));
      localStorage.removeItem("userVerified");
      return true;
    } catch (error) {
      console.error("Login error:", error);
      return false;
    }
  };

  const logout = () => {
    signOut(firebaseAuth);
    setUser(null);
    setVerified(false);
    setNeedsVerification(false);
    localStorage.removeItem("userSession");
    localStorage.removeItem("userVerified");
  };

  const markVerified = () => {
    setVerified(true);
    setNeedsVerification(false);
    localStorage.setItem("userVerified", "true");
  };

  return (
    <AuthContext.Provider value={{ user, loading, verified, needsVerification, login, logout, markVerified, setNeedsVerification }}>
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