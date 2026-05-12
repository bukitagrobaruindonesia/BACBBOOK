"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/app/lib/firebase";
import { UserSession } from "@/app/types";

interface AuthContextType {
  user: UserSession | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem("userSession");
    if (storedUser) {
      setUser(JSON.parse(storedUser));
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
      localStorage.setItem("userSession", JSON.stringify(userData));
      return true;
    } catch (error) {
      console.error("Login error:", error);
      return false;
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("userSession");
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
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