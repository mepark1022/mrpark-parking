// src/lib/locationLog.ts
// 위치정보 이용·제공사실 취급대장 기록 (위치기반서비스 신고 법정 필수)
// ⚠️ 임시 진단 버전: 실패 원인을 호출부로 돌려준다(나중에 원복).
import { createAdminClient } from '@/lib/supabase/admin';

const OPERATOR_ORG_ID = process.env.LBS_OPERATOR_ORG_ID || '';

export type LocSource = 'google_geolocation' | 'apple_corelocation';

// 진단용: 성공 여부 + 실패 사유를 돌려준다
export async function logLocationAccess(
  subjectUuid: string,
  source: LocSource,
  orgId: string = OPERATOR_ORG_ID
): Promise<{ ok: boolean; reason?: string }> {
  // 환경변수가 비었는지 직접 확인
  if (!orgId) {
    return { ok: false, reason: 'ORG_ID_EMPTY: LBS_OPERATOR_ORG_ID 미설정' };
  }
  try {
    // Supabase는 실패해도 throw 안 함 → error를 직접 받아서 확인
    const { error } = await (createAdminClient() as any)
      .from('location_access_logs')
      .insert({
        org_id: orgId,
        subject_uuid: subjectUuid,
        source,
      });
    if (error) {
      // 진짜 실패 사유(메시지)를 그대로 돌려줌
      return { ok: false, reason: `INSERT_ERROR: ${error.message}` };
    }
    return { ok: true };
  } catch (e: any) {
    return { ok: false, reason: `THROWN: ${e?.message || String(e)}` };
  }
}

export function detectLocSource(userAgent: string | null): LocSource {
  const ua = (userAgent || '').toLowerCase();
  const isIOS = /iphone|ipad|ipod/.test(ua);
  const isSafari = /safari/.test(ua) && !/crios|chrome|fxios|edg/.test(ua);
  return isIOS && isSafari ? 'apple_corelocation' : 'google_geolocation';
}