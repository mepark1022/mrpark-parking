// src/app/api/v1/location/log/route.ts
// 위치정보 이용·제공사실 취급대장 기록 전용 엔드포인트 (위치기반서비스 신고)
// 방문객(비로그인)이 현재 위치로 주변 주차장 검색을 요청할 때 호출.
// ⚠️ 좌표(lat/lng)는 받기만 하고 저장하지 않는다. '이용한 사실'만 취급대장에 남긴다.
import { NextResponse } from 'next/server';
import { logLocationAccess, detectLocSource } from '@/lib/locationLog';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { lat, lng, subjectUuid } = body as {
      lat?: number;
      lng?: number;
      subjectUuid?: string;
    };

    // 좌표가 없으면 위치 요청이 아님 → 무시
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return NextResponse.json({ ok: false, error: 'NO_COORDS' }, { status: 400 });
    }

    // 취급대장 1건 기록 (좌표는 저장하지 않음, '이용 사실'만)
    await logLocationAccess(
      subjectUuid && subjectUuid.length > 0 ? subjectUuid : crypto.randomUUID(),
      detectLocSource(req.headers.get('user-agent'))
    );

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[location/log] 처리 실패:', e);
    // 기록 실패가 사용자 흐름을 막지 않도록 200으로 흘려보냄
    return NextResponse.json({ ok: false });
  }
}