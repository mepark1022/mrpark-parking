// @ts-nocheck
import { createClient } from "@/lib/supabase/client";

/**
 * 현재 로그인 사용자의 org_id를 가져옵니다.
 */
export async function getOrgId(): Promise<string | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const orgId = user.app_metadata?.org_id;
  if (orgId) return orgId;

  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", user.id)
    .single();

  return profile?.org_id || null;
}

/**
 * 사용자 컨텍스트: role, org_id, 배정매장 목록
 * - admin: allStores = true (전체 매장 접근)
 * - crew: allStores = false, storeIds = [배정매장만]
 */
export async function getUserContext(): Promise<{
  userId: string | null;
  orgId: string | null;
  role: string;
  allStores: boolean;
  storeIds: string[];
}> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { userId: null, orgId: null, role: "viewer", allStores: false, storeIds: [] };

  // 프로필 조회
  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id, role")
    .eq("id", user.id)
    .single();

  const orgId = profile?.org_id || user.app_metadata?.org_id || null;
  const role = profile?.role || "viewer";

  // admin/owner → 전체 매장
  if (role === "admin" || role === "owner") {
    return { userId: user.id, orgId, role, allStores: true, storeIds: [] };
  }

  // crew → 배정매장만
  const { data: members } = await supabase
    .from("store_members")
    .select("store_id")
    .eq("user_id", user.id);

  const storeIds = members?.map((m) => m.store_id) || [];

  return { userId: user.id, orgId, role, allStores: false, storeIds };
}

/**
 * 매장 목록 필터링 (admin=전체, crew=배정매장만)
 */
export async function getFilteredStores(supabase: any): Promise<{ stores: any[]; ctx: Awaited<ReturnType<typeof getUserContext>> }> {
  const ctx = await getUserContext();
  if (!ctx.orgId) return { stores: [], ctx };

  let query = supabase.from("stores").select("*").eq("org_id", ctx.orgId).eq("is_active", true).order("name");

  if (!ctx.allStores && ctx.storeIds.length > 0) {
    query = query.in("id", ctx.storeIds);
  } else if (!ctx.allStores && ctx.storeIds.length === 0) {
    return { stores: [], ctx }; // 배정매장 없는 crew
  }

  const { data } = await query;
  return { stores: data || [], ctx };
}
