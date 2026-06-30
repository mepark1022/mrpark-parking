// src/lib/locationLog.ts
// 위치정보 이용·제공사실 취급대장 기록 (위치기반서비스 신고 법정 필수)
// ⚠️ 실제 좌표(위/경도)는 저장하지 않는다. '위치를 이용·제공한 사실'만 기록.
// service_role 클라이언트(RLS 우회) — 호출부에서 org_id를 반드시 넣는다.
import { createAdminClient } from '@/lib/supabase/admin';

// 운영자(미스터팍) 고정 org — 방문객은 비로그인이라 세션에서 못 얻음
const OPERATOR_ORG_ID = process.env.LBS_OPERATOR_ORG_ID || '';

export type LocSource = 'google_geolocation' | 'apple_corelocation';

/**
 * 취급대장 1건 기록. 실패해도 주변검색은 막지 않는다(로그만 남김).
 * @param subjectUuid 익명 이용자 식별값(세션 UUID) — 전화·이름 아님
 * @param source 위치정보사업자(취득경로)
 * @param orgId 운영자 org (기본 = 환경변수 LBS_OPERATOR_ORG_ID)
 */
export async function logLocationAccess(
  subjectUuid: string,
  source: LocSource,
  orgId: string = OPERATOR_ORG_ID
): Promise<void> {
  if (!orgId) {
    console.error('[location_access_logs] org_id 없음 — LBS_OPERATOR_ORG_ID 미설정');
    return;
  }
  try {
    // location_access_logs가 database.types.ts에 아직 없으므로 클라이언트를 any로 캐스팅
    await (createAdminClient() as any)
      .from('location_access_logs')
      .insert({
        org_id: orgId,
        subject_uuid: subjectUuid,
        source,
        // service / used_at 은 DB default(now())
      });
  } catch (e) {
    console.error('[location_access_logs] insert 실패:', e); // 주변검색 차단 안 함
  }
}

/** User-Agent로 취득경로 추정: iOS Safari = 애플, 그 외 = 구글 */
export function detectLocSource(userAgent: string | null): LocSource {
  const ua = (userAgent || '').toLowerCase();
  const isIOS = /iphone|ipad|ipod/.test(ua);
  const isSafari = /safari/.test(ua) && !/crios|chrome|fxios|edg/.test(ua);
  return isIOS && isSafari ? 'apple_corelocation' : 'google_geolocation';
}