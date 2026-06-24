"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/app/lib/firebase";
import { UserSession } from "@/app/types";

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

  useEffect(() => {
    try {
      const storedUser = localStorage.getItem("userSession");
      const storedVerified = localStorage.getItem("userVerified");
      if (storedUser) {
        const parsed = JSON.parse(storedUser);
        setUser(parsed);
        if (storedVerified === "true") {
          setVerified(true);
        }
      }
    } catch (e) {
      localStorage.removeItem("userSession");
      localStorage.removeItem("userVerified");
    }
    setLoading(false);
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    console.log("Login attempt:", email);
    try {
      const q = query(
        collection(db, "karyawan"),
        where("email", "==", email),
        where("password", "==", password)
      );
      const snapshot = await getDocs(q);
      console.log("Query result:", snapshot.empty ? "empty" : "found");

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

      setUser(userData);
      setVerified(false);
      setNeedsVerification(true);
      localStorage.setItem("userSession", JSON.stringify(userData));
      localStorage.removeItem("userVerified");
      console.log("User set, returning true");
      return true;
    } catch (error) {
      console.error("Login error:", error);
      return false;
    }
  };

  const logout = () => {
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