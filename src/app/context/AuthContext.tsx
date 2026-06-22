"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/app/lib/firebase";
import { UserSession } from "@/app/types";

interface AuthContextType {
  user: UserSession | null;
  verified: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  markVerified: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserSession | null>(null);
  const [verified, setVerified] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const storedUser = localStorage.getItem("userSession");
      if (storedUser) {
        const parsed = JSON.parse(storedUser);
        setUser(parsed);
      }
      const storedVerified = localStorage.getItem("userVerified");
      if (storedVerified === "true") {
        setVerified(true);
      }
    } catch (e) {
      localStorage.removeItem("userSession");
      localStorage.removeItem("userVerified");
    }
    setLoading(false);
  }, []);

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

      setUser(userData);
      localStorage.setItem("userSession", JSON.stringify(userData));
      return true;
    } catch (error) {
      console.error("Login error:", error);
      return false;
    }
  };

  const markVerified = () => {
    setVerified(true);
    localStorage.setItem("userVerified", "true");
  };

  const logout = () => {
    setUser(null);
    setVerified(false);
    localStorage.removeItem("userSession");
    localStorage.removeItem("userVerified");
  };

  return (
    <AuthContext.Provider value={{ user, verified, loading, login, logout, markVerified }}>
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