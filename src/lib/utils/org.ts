// @ts-nocheck
import { createClient } from "@/lib/supabase/client";

/**
 * 현재 로그인 사용자의 org_id를 가져옵니다.
 * app_metadata.org_id 또는 profiles.org_id에서 조회
 */
export async function getOrgId(): Promise<string | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // 1차: app_metadata에서 org_id 확인
  const orgId = user.app_metadata?.org_id;
  if (orgId) return orgId;

  // 2차: profiles 테이블에서 org_id 확인
  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", user.id)
    .single();

  return profile?.org_id || null;
}

/**
 * org_id가 필수인 쿼리용 - org_id 없으면 빈 배열 반환
 */
export async function getOrgIdOrEmpty(): Promise<{ orgId: string | null; hasOrg: boolean }> {
  const orgId = await getOrgId();
  return { orgId, hasOrg: !!orgId };
}
