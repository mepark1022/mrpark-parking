// @ts-nocheck
"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

interface Store {
  id: string;
  name: string;
  address: string;
  region: string;
}

export default function CrewSelectStorePage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const fetchStores = async () => {
      const supabase = createClient();
      
      // 현재 사용자 확인
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/crew/login");
        return;
      }

      // 배정된 매장 조회
      const { data: storeMembers } = await supabase
        .from("store_members")
        .select("store_id")
        .eq("user_id", user.id);

      if (!storeMembers || storeMembers.length === 0) {
        router.replace("/crew/login");
        return;
      }

      // 매장 정보 조회
      const storeIds = storeMembers.map(m => m.store_id);
      const { data: storesData } = await supabase
        .from("stores")
        .select("id, name, address, region")
        .in("id", storeIds)
        .order("name");

      setStores(storesData || []);
      setLoading(false);
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
        <div style={{ color: "#64748B", fontSize: 14 }}>로딩 중...</div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        .select-store-page {
          min-height: 100dvh;
          background: #F8FAFC;
          padding: 24px;
          padding-top: calc(24px + env(safe-area-inset-top, 0));
        }
        
        .select-store-header {
          margin-bottom: 24px;
        }
        
        .select-store-title {
          font-size: 22px;
          font-weight: 700;
          color: #1A1D2B;
          margin-bottom: 8px;
        }
        
        .select-store-subtitle {
          font-size: 14px;
          color: #64748B;
        }
        
        .store-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        
        .store-card {
          background: #fff;
          border-radius: 14px;
          border: 2px solid #E2E8F0;
          padding: 18px 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          cursor: pointer;
          transition: all 0.15s;
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
          width: 44px;
          height: 44px;
          background: #F1F5F9;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
        }
        
        .store-card.selected .store-icon {
          background: #1428A0;
        }
        
        .store-name {
          font-size: 16px;
          font-weight: 600;
          color: #1A1D2B;
          margin-bottom: 4px;
        }
        
        .store-address {
          font-size: 13px;
          color: #64748B;
        }
        
        .store-arrow {
          color: #94A3B8;
          font-size: 20px;
        }
        
        .store-card.selected .store-arrow {
          color: #1428A0;
        }
      `}</style>

      <div className="select-store-page">
        <div className="select-store-header">
          <div className="select-store-title">매장 선택</div>
          <div className="select-store-subtitle">근무할 매장을 선택하세요</div>
        </div>

        <div className="store-list">
          {stores.map((store) => (
            <div
              key={store.id}
              className={`store-card ${selecting === store.id ? "selected" : ""}`}
              onClick={() => handleSelectStore(store.id)}
            >
              <div className="store-info">
                <div className="store-icon">
                  {selecting === store.id ? "✓" : "🏪"}
                </div>
                <div>
                  <div className="store-name">{store.name}</div>
                  <div className="store-address">
                    {store.address || store.region || "주소 미등록"}
                  </div>
                </div>
              </div>
              <div className="store-arrow">→</div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
