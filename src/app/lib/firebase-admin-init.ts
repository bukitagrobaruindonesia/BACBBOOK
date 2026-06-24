import "server-only";
import { initializeApp, cert, getApps, getApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

interface FirebaseAdminAppParams {
  projectId: string;
  clientEmail: string;
  privateKey: string;
}

function formatPrivateKey(key: string) {
  return key.replace(/\\n/g, "\n");
}

export function createFirebaseAdminApp(params: FirebaseAdminAppParams) {
  const privateKey = formatPrivateKey(params.privateKey);
  if (getApps().length > 0) {
    return getApp();
  }
  const credential = cert({
    projectId: params.projectId,
    clientEmail: params.clientEmail,
    privateKey,
  });
  return initializeApp({
    credential,
    projectId: params.projectId,
  });
}

export function getFirebaseAdmin() {
  const params = {
    projectId: process.env.FIREBASE_PROJECT_ID as string,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL as string,
    privateKey: process.env.FIREBASE_PRIVATE_KEY as string,
  };
  return createFirebaseAdminApp(params);
}

export function getAdminAuth() {
  const app = getFirebaseAdmin();
  return getAuth(app);
}

export function getAdminFirestore() {
  const app = getFirebaseAdmin();
  return getFirestore(app);
}