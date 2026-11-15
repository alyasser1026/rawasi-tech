import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';

export const runtime = 'nodejs';

export async function POST() {
  try {
    revalidatePath('/', 'layout');
    revalidatePath('/');
    revalidatePath('/store');
    revalidatePath('/real-estate');
    revalidatePath('/website');
    return NextResponse.json({ ok: true, revalidatedAt: new Date().toISOString() });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || 'Revalidation failed' },
      { status: 500 }
    );
  }
}
