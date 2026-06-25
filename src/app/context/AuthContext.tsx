"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/app/lib/firebase";
import { UserSession } from "@/app/types";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "firebase/auth";

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
  const firebaseAuth = getAuth();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          const storedUser = localStorage.getItem("userSession");
          if (storedUser) {
            setUser(JSON.parse(storedUser));
          } else {
            const q = query(collection(db, "karyawan"), where("email", "==", firebaseUser.email));
            const snapshot = await getDocs(q);
            if (!snapshot.empty) {
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
            } else {
              setUser(null);
              localStorage.removeItem("userSession");
            }
          }
        } else {
          setUser(null);
          localStorage.removeItem("userSession");
        }
      } catch {
        localStorage.removeItem("userSession");
        setUser(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [firebaseAuth]);

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      const userCredential = await signInWithEmailAndPassword(firebaseAuth, email, password);
      const firebaseUser = userCredential.user;
      const q = query(collection(db, "karyawan"), where("email", "==", email));
      const snapshot = await getDocs(q);
      if (snapshot.empty) {
        await signOut(firebaseAuth);
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
    signOut(firebaseAuth);
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