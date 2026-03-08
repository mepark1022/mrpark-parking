// @ts-nocheck
"use client";
export const dynamic = 'force-dynamic';

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getUserContext } from "@/lib/utils/org";

export const ACTIVE_STORE_KEY = "mepark_active_store"; // localStorage key

type Store = {
  id: string;
  name: string;
  region_city: string | null;
  road_address: string | null;
  is_active: boolean;
};

const SS_STYLES = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #f5f7ff; }

  .ss-wrap {
    min-height: 100vh;
    background: #f5f7ff;
    display: flex;
    flex-direction: column;
  }

  /* 헤더 */
  .ss-header {
    background: #1428A0;
    padding: 20px 20px 24px;
    position: relative;
  }
  .ss-header-logo {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 16px;
  }
  .ss-logo-icon {
    width: 34px; height: 34px;
    border-radius: 8px;
    background: #fff;
    border: 2px solid rgba(255,255,255,0.3);
    display: flex; align-items: center; justify-content: center;
    font-family: 'Outfit', sans-serif;
    font-size: 16px; font-weight: 900;
    color: #1428A0;
    position: relative;
    overflow: hidden;
  }
  .ss-logo-icon::after {
    content: '';
    position: absolute;
    bottom: 0; left: 0; right: 0;
    height: 7px;
    background: #F5B731;
  }
  .ss-logo-text {
    font-family: 'Outfit', sans-serif;
    font-size: 14px; font-weight: 800;
    color: #fff;
    letter-spacing: -0.3px;
  }
  .ss-logo-text em {
    font-style: normal;
    font-weight: 300;
    color: rgba(255,255,255,0.45);
    margin-left: 3px;
    font-size: 12px;
  }
  .ss-header-title {
    font-size: 22px; font-weight: 800;
    color: #fff;
    line-height: 1.2;
    margin-bottom: 6px;
  }
  .ss-header-sub {
    font-size: 13px;
    color: rgba(255,255,255,0.65);
    line-height: 1.4;
  }

  /* 역할 뱃지 */
  .ss-role-badge {
    display: inline-flex; align-items: center; gap: 5px;
    padding: 4px 10px;
    border-radius: 20px;
    font-size: 11px; font-weight: 700;
    margin-top: 12px;
  }

  /* 검색 */
  .ss-search-wrap {
    padding: 16px 20px 0;
  }
  .ss-search-input {
    width: 100%;
    padding: 10px 14px 10px 36px;
    border: 1.5px solid #e2e8f0;
    border-radius: 10px;
    font-size: 14px;
    font-family: inherit;
    background: #fff url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%238b90a0' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='11' cy='11' r='8'/%3E%3Cline x1='21' y1='21' x2='16.65' y2='16.65'/%3E%3C/svg%3E") no-repeat 12px center;
    color: #1a1d2b;
    outline: none;
  }
  .ss-search-input:focus {
    border-color: #1428A0;
  }

  /* 매장 목록 */
  .ss-list {
    padding: 12px 20px 100px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .ss-store-card {
    background: #fff;
    border-radius: 14px;
    padding: 16px;
    border: 2px solid #e2e8f0;
    cursor: pointer;
    transition: all 0.15s ease;
    display: flex;
    align-items: center;
    gap: 14px;
    -webkit-tap-highlight-color: transparent;
  }
  .ss-store-card:active {
    transform: scale(0.98);
  }
  .ss-store-card.selected {
    border-color: #1428A0;
    background: #f0f4ff;
  }
  .ss-store-icon {
    width: 44px; height: 44px;
    border-radius: 12px;
    background: #ecf0ff;
    display: flex; align-items: center; justify-content: center;
    font-size: 20px;
    flex-shrink: 0;
  }
  .ss-store-card.selected .ss-store-icon {
    background: #1428A0;
  }
  .ss-store-info { flex: 1; min-width: 0; }
  .ss-store-name {
    font-size: 15px; font-weight: 800;
    color: #1a1d2b;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    margin-bottom: 3px;
  }
  .ss-store-addr {
    font-size: 12px; color: #8b90a0;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .ss-store-region {
    font-size: 10px; font-weight: 700;
    background: #f0f2f7; color: #666;
    padding: 2px 7px; border-radius: 5px;
    flex-shrink: 0;
  }
  .ss-store-check {
    width: 22px; height: 22px;
    border-radius: 50%;
    background: #1428A0;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
  }

  /* 빈 상태 */
  .ss-empty {
    text-align: center;
    padding: 60px 20px;
    color: #8b90a0;
  }
  .ss-empty-icon { font-size: 48px; margin-bottom: 12px; }
  .ss-empty-text { font-size: 14px; font-weight: 600; }

  /* 하단 버튼 */
  .ss-bottom {
    position: fixed;
    bottom: 0; left: 0; right: 0;
    padding: 16px 20px;
    background: rgba(245,247,255,0.95);
    backdrop-filter: blur(12px);
    border-top: 1px solid #e2e8f0;
  }
  .ss-btn {
    width: 100%;
    padding: 16px;
    background: #1428A0;
    color: #fff;
    border: none;
    border-radius: 14px;
    font-size: 16px; font-weight: 800;
    font-family: inherit;
    cursor: pointer;
    display: flex; align-items: center; justify-content: center; gap: 8px;
    transition: opacity 0.15s;
  }
  .ss-btn:disabled {
    background: #c4cad4;
    cursor: not-allowed;
  }
  .ss-btn.loading {
    opacity: 0.7;
    cursor: not-allowed;
  }

  /* 로딩 */
  .ss-loading {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    padding: 60px 20px;
    gap: 12px;
    color: #8b90a0;
    font-size: 14px;
  }
  .ss-spinner {
    width: 32px; height: 32px;
    border: 3px solid #e2e8f0;
    border-top-color: #1428A0;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* 섹션 라벨 */
  .ss-section-label {
    font-size: 11px; font-weight: 700;
    color: #8b90a0; letter-spacing: 0.5px;
    text-transform: uppercase;
    padding: 8px 0 4px;
  }

  @media (min-width: 480px) {
    .ss-header { padding: 24px 28px 28px; }
    .ss-search-wrap { padding: 20px 28px 0; }
    .ss-list { padding: 14px 28px 100px; }
    .ss-bottom { padding: 16px 28px; }
  }

  /* PC 레이아웃 - 중앙 카드 */
  @media (min-width: 768px) {
    .ss-wrap {
      align-items: center;
      justify-content: flex-start;
      padding: 40px 20px;
      background: linear-gradient(165deg, #0f1f8a 0%, #1428A0 40%, #1e36c0 100%);
    }
    .ss-inner {
      width: 100%;
      max-width: 520px;
      background: #fff;
      border-radius: 20px;
      overflow: hidden;
      box-shadow: 0 8px 40px rgba(0,0,0,0.25);
    }
    .ss-header {
      border-radius: 0;
    }
    .ss-list {
      max-height: 400px;
      overflow-y: auto;
      padding-bottom: 20px;
    }
    .ss-bottom {
      position: static;
      background: #fff;
      border-top: 1px solid #e2e8f0;
      padding: 16px 28px 20px;
    }
  }
`;

function getRoleBadge(role: string) {
  if (role === "super_admin") return { emoji: "⭐", label: "최고관리자", bg: "#FFF8E1", color: "#F59E0B" };
  if (role === "admin" || role === "owner") return { emoji: "🛡️", label: "관리자", bg: "#EFF6FF", color: "#1428A0" };
  return { emoji: "👷", label: "크루", bg: "#F0FDF4", color: "#16A34A" };
}

function StoreSelectInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("return") || "/dashboard";
  const isChange = searchParams.get("change") === "1"; // 변경 모드

  const [stores, setStores] = useState<Store[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("crew");
  const [userName, setUserName] = useState("");

  useEffect(() => {
    loadStores();
  }, []);

  async function loadStores() {
    setLoading(true);
    try {
      const supabase = createClient();
      const ctx = await getUserContext();
      setRole(ctx.role || "crew");

      // 어드민은 매장 선택 불필요 → 바로 대시보드
      const isAdminRole = ctx.role === "admin" || ctx.role === "owner" || ctx.role === "super_admin";
      if (isAdminRole && !isChange) {
        router.replace(returnTo);
        return;
      }

      // 현재 선택된 매장 불러오기
      const saved = localStorage.getItem(ACTIVE_STORE_KEY);
      if (saved) {
        try { setSelectedId(JSON.parse(saved).id); } catch {}
      }

      // 프로필 이름
      if (ctx.userId) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("name")
          .eq("id", ctx.userId)
          .single();
        if (profile?.name) setUserName(profile.name);
      }

      if (!ctx.orgId) { setLoading(false); return; }

      let query = supabase
        .from("stores")
        .select("id, name, region_city, road_address, is_active")
        .eq("org_id", ctx.orgId)
        .order("name");

      // crew는 배정 매장만, admin/super_admin은 전체
      const isAdmin = ctx.role === "admin" || ctx.role === "owner" || ctx.role === "super_admin";
      if (!isAdmin && ctx.storeIds.length > 0) {
        query = query.in("id", ctx.storeIds);
      } else if (!isAdmin && ctx.storeIds.length === 0) {
        setStores([]);
        setLoading(false);
        return;
      }

      const { data } = await query;
      const list = data || [];
      setStores(list);

      // crew & 매장 1개면 바로 자동 진입
      if (!isAdmin && list.length === 1 && !isChange) {
        // crew가 /dashboard로 진입하지 않도록: returnTo가 /dashboard면 /crew로 보냄
        const crewReturnTo = returnTo === "/dashboard" ? "/crew" : returnTo;
        saveAndGo(list[0], crewReturnTo);
        return;
      }
    } catch (e) {
      console.error("store load error", e);
    } finally {
      setLoading(false);
    }
  }

  function saveAndGo(store: Store, to: string) {
    localStorage.setItem(ACTIVE_STORE_KEY, JSON.stringify({ id: store.id, name: store.name }));
    router.replace(to);
  }

  async function handleConfirm() {
    if (!selectedId) return;
    const store = stores.find(s => s.id === selectedId);
    if (!store) return;
    setConfirming(true);
    // crew는 /dashboard 대신 /crew로 이동
    const isAdminRole = role === "admin" || role === "owner" || role === "super_admin";
    const dest = (!isAdminRole && returnTo === "/dashboard") ? "/crew" : returnTo;
    saveAndGo(store, dest);
  }

  const filtered = stores.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.region_city || "").toLowerCase().includes(search.toLowerCase())
  );

  const isAdmin = role === "admin" || role === "owner" || role === "super_admin";
  const badge = getRoleBadge(role);

  return (
    <div className="ss-wrap">
      <style>{SS_STYLES}</style>
      <div className="ss-inner">

      {/* 헤더 */}
      <div className="ss-header">
        <div className="ss-header-logo">
          <div className="ss-logo-icon">P</div>
          <span className="ss-logo-text">미팍 <em>2.0</em></span>
        </div>
        <div className="ss-header-title">
          {isChange ? "매장 변경" : "매장 선택"}
        </div>
        <div className="ss-header-sub">
          {isChange
            ? "다른 매장으로 전환합니다"
            : isAdmin
              ? "관리할 매장을 선택해주세요"
              : "근무할 매장을 선택해주세요"}
        </div>
        <div className="ss-role-badge" style={{ background: badge.bg, color: badge.color }}>
          <span>{badge.emoji}</span>
          <span>{userName || badge.label}</span>
          {userName && <span style={{ opacity: 0.6 }}>· {badge.label}</span>}
        </div>
      </div>

      {/* 검색 */}
      {!loading && stores.length > 4 && (
        <div className="ss-search-wrap">
          <input
            className="ss-search-input"
            placeholder="매장명 검색..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      )}

      {/* 목록 */}
      {loading ? (
        <div className="ss-loading">
          <div className="ss-spinner" />
          <span>매장 목록 불러오는 중...</span>
        </div>
      ) : (
        <div className="ss-list">
          {filtered.length === 0 ? (
            <div className="ss-empty">
              <div className="ss-empty-icon">🏢</div>
              <div className="ss-empty-text">
                {search ? "검색 결과가 없습니다" : "배정된 매장이 없습니다"}
              </div>
            </div>
          ) : (
            <>
              <div className="ss-section-label">
                {stores.length}개 매장 {search && `(${filtered.length}개 검색됨)`}
              </div>
              {filtered.map(store => {
                const isSelected = selectedId === store.id;
                return (
                  <div
                    key={store.id}
                    className={`ss-store-card ${isSelected ? "selected" : ""}`}
                    onClick={() => setSelectedId(store.id)}
                  >
                    <div className="ss-store-icon">
                      {isSelected ? (
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      ) : "🏢"}
                    </div>
                    <div className="ss-store-info">
                      <div className="ss-store-name">{store.name}</div>
                      <div className="ss-store-addr">
                        {store.road_address || store.region_city || "주소 미등록"}
                      </div>
                    </div>
                    {store.region_city && (
                      <div className="ss-store-region">{store.region_city}</div>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}

      {/* 하단 확인 버튼 */}
      {!loading && (
        <div className="ss-bottom">
          <button
            className={`ss-btn ${confirming ? "loading" : ""}`}
            onClick={handleConfirm}
            disabled={!selectedId || confirming}
          >
            {confirming ? (
              <>⏳ 이동 중...</>
            ) : selectedId ? (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                {stores.find(s => s.id === selectedId)?.name} 선택하기
              </>
            ) : (
              "매장을 선택해주세요"
            )}
          </button>
        </div>
      )}
      </div>{/* ss-inner */}
    </div>
  );
}

export default function StoreSelectPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: "100vh", background: "#f5f7ff", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", color: "#8b90a0" }}>
          <div style={{ width: 32, height: 32, border: "3px solid #e2e8f0", borderTopColor: "#1428A0", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
          <div style={{ fontSize: 14 }}>로딩 중...</div>
        </div>
      </div>
    }>
      <StoreSelectInner />
    </Suspense>
  );
}
