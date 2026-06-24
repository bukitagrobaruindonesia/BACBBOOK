import { NextResponse } from "next/server";
import { getAdminAuth } from "@/app/lib/firebase-admin-init";

export async function POST(request: Request) {
  try {
    const { email, uid } = await request.json();

    if (!email || !uid) {
      return NextResponse.json(
        { error: "Email dan UID diperlukan" },
        { status: 400 }
      );
    }

    const auth = getAdminAuth();
    const customToken = await auth.createCustomToken(uid, { email });

    return NextResponse.json({ token: customToken });
  } catch (error: any) {
    console.error("Custom token error:", error);
    return NextResponse.json(
      { error: "Gagal membuat token: " + error.message },
      { status: 500 }
    );
  }
}