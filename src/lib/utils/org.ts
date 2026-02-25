// @ts-nocheck
import { createClient } from "@/lib/supabase/client";

/**
 * 세션 내 캐시 — 페이지 새로고침 전까지 재사용
 * 로그아웃 시 clearOrgCache() 호출 필요
 */
let _cachedOrgId: string | null | undefined = undefined;
let _cachedContext: { userId: string | null; orgId: string | null; role: string; allStores: boolean; storeIds: string[] } | undefined = undefined;

export function clearOrgCache() {
  _cachedOrgId = undefined;
  _cachedContext = undefined;
}

/**
 * 현재 로그인 사용자의 org_id를 가져옵니다.
 * 세션 내 첫 호출 이후 캐시에서 반환 (DB 왕복 없음)
 */
export async function getOrgId(): Promise<string | null> {
  if (_cachedOrgId !== undefined) return _cachedOrgId;
  // getUserContext 호출로 한 번에 처리 (중복 DB 왕복 방지)
  const ctx = await getUserContext();
  return ctx.orgId;
}

/**
 * 사용자 컨텍스트: role, org_id, 배정매장 목록
 * - admin: allStores = true (전체 매장 접근)
 * - crew: allStores = false, storeIds = [배정매장만]
 * 세션 내 첫 호출 이후 캐시에서 반환
 */
export async function getUserContext(): Promise<{
  userId: string | null;
  orgId: string | null;
  role: string;
  allStores: boolean;
  storeIds: string[];
}> {
  if (_cachedContext !== undefined) return _cachedContext;

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    _cachedContext = { userId: null, orgId: null, role: "viewer", allStores: false, storeIds: [] };
    return _cachedContext;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id, role")
    .eq("id", user.id)
    .single();

  const orgId = profile?.org_id || user.app_metadata?.org_id || null;
  const role = profile?.role || "viewer";
  _cachedOrgId = orgId;

  if (role === "admin" || role === "owner") {
    _cachedContext = { userId: user.id, orgId, role, allStores: true, storeIds: [] };
    return _cachedContext;
  }

  const { data: members } = await supabase
    .from("store_members")
    .select("store_id")
    .eq("user_id", user.id);

  const storeIds = members?.map((m) => m.store_id) || [];
  _cachedContext = { userId: user.id, orgId, role, allStores: false, storeIds };
  return _cachedContext;
}

/**
 * 매장 목록 필터링 (admin=전체, crew=배정매장만)
 */
export async function getFilteredStores(supabase: any): Promise<{ stores: any[]; ctx: Awaited<ReturnType<typeof getUserContext>> }> {
  const ctx = await getUserContext();
  if (!ctx.orgId) return { stores: [], ctx };

  let query = supabase.from("stores").select("*").eq("org_id", ctx.orgId).order("name");

  if (!ctx.allStores && ctx.storeIds.length > 0) {
    query = query.in("id", ctx.storeIds);
  } else if (!ctx.allStores && ctx.storeIds.length === 0) {
    return { stores: [], ctx };
  }

  const { data } = await query;
  return { stores: data || [], ctx };
}
