import { NextResponse } from "next/server";
import emailjs from "@emailjs/nodejs";

export async function POST(request: Request) {
  try {
    const { email, code } = await request.json();

    if (!email || !code) {
      return NextResponse.json(
        { error: "Email dan kode diperlukan" },
        { status: 400 }
      );
    }

    const serviceId = process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID;
    const templateId = process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID;
    const publicKey = process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY;
    const privateKey = process.env.EMAILJS_PRIVATE_KEY;

    if (!serviceId || !templateId || !publicKey) {
      return NextResponse.json(
        { error: "Konfigurasi email tidak lengkap" },
        { status: 500 }
      );
    }

    const templateParams = {
      user_email: email,
      verification_code: code,
      company_name: "PT Bukit Agrochemical Baru",
      expiry_time: "10 menit",
    };

    await emailjs.send(serviceId, templateId, templateParams, {
      publicKey: publicKey,
      privateKey: privateKey,
    });

    return NextResponse.json({ success: true, message: "Email terkirim" });
  } catch (error: any) {
    console.error("EmailJS error:", error);
    return NextResponse.json(
      { error: "Gagal mengirim email: " + (error.message || error.text || "Unknown error") },
      { status: 500 }
    );
  }
}