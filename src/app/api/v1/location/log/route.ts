// src/app/api/v1/location/log/route.ts
// 위치정보 이용·제공사실 취급대장 기록 전용 엔드포인트 (위치기반서비스 신고)
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
    await logLocationAccess(
      subjectUuid && subjectUuid.length > 0 ? subjectUuid : crypto.randomUUID(),
      detectLocSource(req.headers.get('user-agent'))
    );
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[location/log] 처리 실패:', e);
    return NextResponse.json({ ok: false });
  }
}