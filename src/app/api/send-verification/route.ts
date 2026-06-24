import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { email, code } = await request.json();

    if (!email || !code) {
      return NextResponse.json(
        { error: "Email dan kode diperlukan" },
        { status: 400 }
      );
    }

    const serviceId = process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID || process.env.EMAILJS_SERVICE_ID;
    const templateId = process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID || process.env.EMAILJS_TEMPLATE_ID;
    const publicKey = process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY || process.env.EMAILJS_PUBLIC_KEY;
    const privateKey = process.env.EMAILJS_PRIVATE_KEY;

    if (!serviceId || !templateId || !publicKey) {
      return NextResponse.json(
        { error: "Konfigurasi email tidak lengkap. EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, EMAILJS_PUBLIC_KEY wajib diisi di environment variables." },
        { status: 500 }
      );
    }

    const templateParams = {
      user_email: email,
      verification_code: code,
      company_name: "PT Bukit Agrochemical Baru",
      expiry_time: "10 menit",
    };

    const payload: any = {
      service_id: serviceId,
      template_id: templateId,
      user_id: publicKey,
      template_params: templateParams,
    };

    if (privateKey && privateKey.trim() !== "") {
      payload.accessToken = privateKey;
    }

    const response = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();

    if (!response.ok) {
      console.error("EmailJS API error:", {
        status: response.status,
        statusText: response.statusText,
        body: responseText,
        serviceId: serviceId ? "set" : "missing",
        templateId: templateId ? "set" : "missing",
        publicKey: publicKey ? "set" : "missing",
      });
      return NextResponse.json(
        { error: "Gagal mengirim email: " + responseText, status: response.status },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, message: "Email terkirim" });
  } catch (error: any) {
    console.error("API route error:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan server: " + (error.message || "Unknown") },
      { status: 500 }
    );
  }
}