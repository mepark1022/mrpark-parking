// @ts-nocheck
"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * CREW v2 매장 선택 페이지
 * - GET /api/v1/auth/me → stores 배열 사용
 * - 매장 1개면 자동 선택 → 홈 이동
 * - Supabase 직접 호출 없음
 */

interface StoreItem {
  store_id: string;
  store_name: string;
  is_primary: boolean;
}

export default function CrewV2SelectStorePage() {
  const [stores, setStores] = useState<StoreItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selecting, setSelecting] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/v1/auth/me", { credentials: "include" });
        if (!res.ok) {
          router.replace("/v2/crew/login");
          return;
        }
        const { data } = await res.json();

        // 역할 확인
        const allowedRoles = ["crew", "admin", "owner", "super_admin"];
        if (!allowedRoles.includes(data?.role)) {
          router.replace("/v2/crew/login?error=no_access");
          return;
        }

        // admin/owner/super_admin은 org 전체 매장, crew는 배정 매장만
        const isAdmin = ["admin", "owner", "super_admin"].includes(data?.role);
        let list: StoreItem[] = [];

        if (isAdmin) {
          // 전체 매장 조회 (admin은 MANAGE 권한이라 가능)
          const storesRes = await fetch("/api/v1/stores?limit=200", { credentials: "include" });
          if (storesRes.ok) {
            const json = await storesRes.json();
            list = (json?.data || []).map((s: any) => ({
              store_id: s.id,
              store_name: s.name,
              is_primary: false,
            }));
          }
        } else {
          // crew: 배정된 매장만
          list = data?.stores || [];
        }

        if (list.length === 0) {
          setError(isAdmin
            ? "등록된 매장이 없습니다. 매장을 먼저 등록해주세요."
            : "배정된 매장이 없습니다. 관리자에게 문의하세요.");
          setLoading(false);
          return;
        }

        // 1개면 자동 선택
        if (list.length === 1) {
          localStorage.setItem("crew_store_id", list[0].store_id);
          localStorage.setItem("crew_store_name", list[0].store_name);
          router.replace("/v2/crew");
          return;
        }

        setStores(list);
        setLoading(false);
      } catch {
        setError("매장 정보를 불러오는데 실패했습니다.");
        setLoading(false);
      }
    };
    load();
  }, [router]);

  const handleSelect = (store: StoreItem) => {
    setSelecting(store.store_id);
    localStorage.setItem("crew_store_id", store.store_id);
    localStorage.setItem("crew_store_name", store.store_name);
    setTimeout(() => router.replace("/v2/crew"), 200);
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100dvh", background: "#F8FAFC", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "#64748B", fontSize: 14 }}>매장 불러오는 중...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: "100dvh", background: "#F8FAFC", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, gap: 16 }}>
        <div style={{ width: 64, height: 64, background: "#FEE2E2", borderRadius: 20, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          </svg>
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#1A1D2B", textAlign: "center" }}>{error}</div>
        <button onClick={() => window.location.reload()}
          style={{ padding: "12px 24px", borderRadius: 10, background: "#1428A0", color: "#fff", border: "none", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
          새로고침
        </button>
      </div>
    );
  }

  return (
    <>
      <style>{`
        .cv2-sel-page { min-height: 100dvh; background: #F8FAFC; }
        .cv2-sel-header {
          background: linear-gradient(135deg, #0a1352 0%, #1428A0 100%);
          padding: 48px 24px 28px;
          padding-top: calc(48px + env(safe-area-inset-top, 0));
        }
        .cv2-sel-content { padding: 20px 16px; }
        .cv2-store-card {
          background: #fff; border-radius: 14px; border: 2px solid #E2E8F0;
          padding: 16px; display: flex; align-items: center; justify-content: space-between;
          cursor: pointer; transition: all 0.15s; -webkit-tap-highlight-color: transparent;
          margin-bottom: 10px;
        }
        .cv2-store-card:active { transform: scale(0.98); }
        .cv2-store-card.selected { border-color: #1428A0; background: #f0f4ff; }
      `}</style>

      <div className="cv2-sel-page">
        <div className="cv2-sel-header">
          {/* 로고 */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
            <div style={{
              width: 34, height: 34, background: "rgba(255,255,255,0.15)", borderRadius: 10,
              position: "relative", display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <span style={{ fontFamily: "'Outfit',sans-serif", fontSize: 20, fontWeight: 900, color: "#fff", marginTop: -2 }}>P</span>
              <span style={{ position: "absolute", bottom: 6, left: "50%", transform: "translateX(-50%)", width: 14, height: 3, background: "#F5B731", borderRadius: 1.5 }} />
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 2 }}>
              <span style={{ fontFamily: "'Noto Sans KR',sans-serif", fontSize: 18, fontWeight: 800, color: "#fff" }}>미팍</span>
              <span style={{ fontFamily: "'Outfit',sans-serif", fontSize: 18, fontWeight: 700, color: "#F5B731" }}>Ticket</span>
            </div>
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#fff", marginBottom: 4 }}>매장 선택</div>
          <div style={{ fontSize: 14, color: "rgba(255,255,255,0.65)" }}>근무할 매장을 선택하세요</div>
        </div>

        <div className="cv2-sel-content">
          {stores.map((store) => (
            <div
              key={store.store_id}
              className={`cv2-store-card ${selecting === store.store_id ? "selected" : ""}`}
              onClick={() => handleSelect(store)}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{
                  width: 46, height: 46, borderRadius: 12, flexShrink: 0,
                  background: selecting === store.store_id ? "#1428A0" : "#F1F5F9",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "background 0.15s",
                }}>
                  {selecting === store.store_id ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12l5 5L20 7" />
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
                    </svg>
                  )}
                </div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "#1A1D2B", marginBottom: 3 }}>
                    {store.store_name}
                    {store.is_primary && (
                      <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 600, color: "#1428A0", background: "#EEF2FF", padding: "2px 6px", borderRadius: 4 }}>주</span>
                    )}
                  </div>
                </div>
              </div>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                stroke={selecting === store.store_id ? "#1428A0" : "#CBD5E1"}
                strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
