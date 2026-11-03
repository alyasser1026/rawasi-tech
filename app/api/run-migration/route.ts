import { NextResponse } from 'next/server';

// Schema changes are maintained in supabase/migrations and are never executed by a public GET route.
export async function GET() {
  return NextResponse.json(
    { error: 'مسار الصيانة القديم متوقف. تُنفّذ تغييرات قاعدة البيانات من خلال ملفات migrations المعتمدة.' },
    { status: 410 }
  );
}
