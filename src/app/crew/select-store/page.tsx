// @ts-nocheck
"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { getUserContext } from "@/lib/utils/org";
import { useRouter } from "next/navigation";

interface Store {
  id: string;
  name: string;
  road_address: string;
  region_city: string;
}

export default function CrewSelectStorePage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selecting, setSelecting] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const fetchStores = async () => {
      try {
        const ctx = await getUserContext();
        if (!ctx.userId) {
          router.replace("/crew/login");
          return;
        }
        if (!ctx.orgId) {
          setError("조직 정보가 없습니다. 관리자에게 문의하세요.");
          setLoading(false);
          return;
        }

        const supabase = createClient();

        // admin/owner/super_admin: org 전체 매장 / crew: 배정 매장만
        let storesData: Store[] = [];

        if (ctx.allStores) {
          const { data, error: storeErr } = await supabase
            .from("stores")
            .select("id, name, road_address, region_city")
            .eq("org_id", ctx.orgId)
            .order("name");
          storesData = data || [];
          if (storeErr) {
            setError(`매장 조회 실패: ${storeErr.message}`);
            setLoading(false);
            return;
          }
        } else if (ctx.storeIds.length > 0) {
          const { data } = await supabase
            .from("stores")
            .select("id, name, road_address, region_city")
            .in("id", ctx.storeIds)
            .order("name");
          storesData = data || [];
        }

        if (storesData.length === 0) {
          setError("접근 가능한 매장이 없습니다. 관리자에게 문의하세요.");
          setLoading(false);
          return;
        }

        setStores(storesData);
        setLoading(false);
      } catch (e) {
        console.error("store load error", e);
        setError("매장 정보를 불러오는데 실패했습니다.");
        setLoading(false);
      }
    };

    fetchStores();
  }, [router]);

  const handleSelectStore = (storeId: string) => {
    setSelecting(storeId);
    localStorage.setItem("crew_store_id", storeId);
    const selectedStore = stores.find(s => s.id === storeId);
    if (selectedStore) localStorage.setItem("crew_store_name", selectedStore.name);
    
    // 약간의 딜레이 후 이동 (선택 피드백)
    setTimeout(() => {
      router.replace("/crew");
    }, 200);
  };

  if (loading) {
    return (
      <div style={{
        minHeight: "100dvh",
        background: "#F8FAFC",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}>
        <div style={{ color: "#64748B", fontSize: 14 }}>매장 불러오는 중...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        minHeight: "100dvh",
        background: "#F8FAFC",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        gap: 16,
      }}>
        <div style={{ width: 64, height: 64, background: "#FEE2E2", borderRadius: 20, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          </svg>
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#1A1D2B", textAlign: "center" }}>{error}</div>
        <button
          onClick={() => { setLoading(true); setError(""); window.location.reload(); }}
          style={{
            padding: "12px 24px", borderRadius: 10, background: "#1428A0",
            color: "#fff", border: "none", fontSize: 14, fontWeight: 600, cursor: "pointer",
          }}
        >
          새로고침
        </button>
      </div>
    );
  }

  return (
    <>
      <style>{`
        .select-store-page {
          min-height: 100dvh;
          background: #F8FAFC;
        }

        /* 상단 헤더 */
        .select-store-header-bar {
          background: linear-gradient(135deg, #0a1352 0%, #1428A0 100%);
          padding: 48px 24px 28px;
          padding-top: calc(48px + env(safe-area-inset-top, 0));
        }

        .select-store-logo {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 20px;
        }

        .select-store-content {
          padding: 20px 16px;
        }

        .select-store-title {
          font-size: 20px;
          font-weight: 700;
          color: #fff;
          margin-bottom: 4px;
        }
        
        .select-store-subtitle {
          font-size: 14px;
          color: rgba(255,255,255,0.65);
        }
        
        .store-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        
        .store-card {
          background: #fff;
          border-radius: 14px;
          border: 2px solid #E2E8F0;
          padding: 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          cursor: pointer;
          transition: all 0.15s;
          -webkit-tap-highlight-color: transparent;
        }
        
        .store-card:active {
          transform: scale(0.98);
        }
        
        .store-card.selected {
          border-color: #1428A0;
          background: #f0f4ff;
        }
        
        .store-info {
          display: flex;
          align-items: center;
          gap: 14px;
        }
        
        .store-icon {
          width: 46px;
          height: 46px;
          background: #F1F5F9;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: background 0.15s;
        }
        
        .store-card.selected .store-icon {
          background: #1428A0;
        }
        
        .store-name {
          font-size: 16px;
          font-weight: 700;
          color: #1A1D2B;
          margin-bottom: 3px;
        }
        
        .store-address {
          font-size: 13px;
          color: #64748B;
        }
      `}</style>

      <div className="select-store-page">
        {/* 상단 네이비 헤더 */}
        <div className="select-store-header-bar">
          <div className="select-store-logo">
            {/* P 아이콘 */}
            <div style={{
              width: 34, height: 34, background: "rgba(255,255,255,0.15)",
              borderRadius: 10, position: "relative",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <span style={{ fontFamily: "'Outfit',sans-serif", fontSize: 20, fontWeight: 900, color: "#fff", marginTop: -2 }}>P</span>
              <span style={{ position: "absolute", bottom: 6, left: "50%", transform: "translateX(-50%)", width: 14, height: 3, background: "#F5B731", borderRadius: 1.5 }} />
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 2 }}>
              <span style={{ fontFamily: "'Noto Sans KR',sans-serif", fontSize: 18, fontWeight: 800, color: "#fff" }}>미팍</span>
              <span style={{ fontFamily: "'Outfit',sans-serif", fontSize: 18, fontWeight: 700, color: "#F5B731" }}>Ticket</span>
            </div>
          </div>
          <div className="select-store-title">매장 선택</div>
          <div className="select-store-subtitle">근무할 매장을 선택하세요</div>
        </div>

        <div className="select-store-content">
          <div className="store-list">
            {stores.map((store) => (
              <div
                key={store.id}
                className={`store-card ${selecting === store.id ? "selected" : ""}`}
                onClick={() => handleSelectStore(store.id)}
              >
                <div className="store-info">
                  <div className="store-icon">
                    {selecting === store.id ? (
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
                    <div className="store-name">{store.name}</div>
                    <div className="store-address">
                      {store.road_address || store.region_city || "주소 미등록"}
                    </div>
                  </div>
                </div>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                  stroke={selecting === store.id ? "#1428A0" : "#CBD5E1"}
                  strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
