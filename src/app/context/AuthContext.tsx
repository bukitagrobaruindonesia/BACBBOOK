"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/app/lib/firebase";

interface UserSession {
  uid: string;
  idKantor: string;
  nama: string;
  role: string;
}

interface AuthContextType {
  user: UserSession | null;
  loading: boolean;
  login: (idKantor: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const docRef = doc(db, "karyawan", firebaseUser.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            setUser({
              uid: firebaseUser.uid,
              idKantor: data.idKantor,
              nama: data.nama,
              role: data.role,
            });
          } else {
            console.error("No karyawan data found for UID:", firebaseUser.uid);
            setUser(null);
          }
        } catch (error) {
          console.error("Error fetching karyawan data:", error);
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (idKantor: string, password: string) => {
    const email = `${idKantor.toLowerCase()}@bukitagro.local`;
    console.log("Attempting login with email:", email);
    
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      console.log("Login successful, UID:", result.user.uid);
    } catch (error: any) {
      console.error("Login error:", error.code, error.message);
      throw error;
    }
  };

  const logout = async () => {
    await signOut(auth);
    setUser(null);
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