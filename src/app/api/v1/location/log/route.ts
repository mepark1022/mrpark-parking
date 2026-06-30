// src/app/api/v1/location/log/route.ts
// ⚠️ 임시 진단 버전: 실패 사유를 응답 JSON에 노출(나중에 원복).
import { NextResponse } from 'next/server';
import { logLocationAccess, detectLocSource } from '@/lib/locationLog';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { lat, lng, subjectUuid } = body as {
      lat?: number; lng?: number; subjectUuid?: string;
    };
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return NextResponse.json({ ok: false, error: 'NO_COORDS' }, { status: 400 });
    }
    const result = await logLocationAccess(
      subjectUuid && subjectUuid.length > 0 ? subjectUuid : crypto.randomUUID(),
      detectLocSource(req.headers.get('user-agent'))
    );
    // 진단: 성공/실패와 사유를 그대로 응답
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ ok: false, reason: `ROUTE_THROWN: ${e?.message || String(e)}` });
  }
}