import { pool } from '@/lib/db';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const r = await pool.query('SELECT 1 as ok');
    return NextResponse.json({ db: r.rows[0].ok === 1 ? 'connected' : 'fail' });
  } catch (e) {
    return NextResponse.json({ db: 'error', message: String(e) }, { status: 500 });
  }
}