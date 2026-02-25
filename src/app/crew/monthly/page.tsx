// @ts-nocheck
"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import CrewHeader from "@/components/crew/CrewHeader";
import { useCrewToast } from "@/components/crew/CrewToast";
import CrewBottomNav, { CrewNavSpacer } from "@/components/crew/CrewBottomNav";

/* ─────────────────────────────────────────────
   유틸
───────────────────────────────────────────── */
function getDaysLeft(endDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(endDate + "T00:00:00");
  return Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function fmtDate(d: string) {
  if (!d) return "-";
  const [y, m, day] = d.split("-");
  return `${y}.${m}.${day}`;
}

function fmtFee(n: number) {
  return n?.toLocaleString("ko-KR") + "원";
}

function getStatusInfo(contract: any) {
  const days = getDaysLeft(contract.end_date);
  if (contract.contract_status === "cancelled")
    return { label: "해지", bg: "#F1F5F9", color: "#64748B", icon: "🚫" };
  if (contract.contract_status === "expired" || days < 0)
    return { label: "만료", bg: "#FEE2E2", color: "#DC2626", icon: "❌" };
  if (days <= 7)
    return { label: `D-${days} 만료임박`, bg: "#FEF3C7", color: "#D97706", icon: "⚠️" };
  return { label: "정상", bg: "#DCFCE7", color: "#16A34A", icon: "✅" };
}

/* ─────────────────────────────────────────────
   CSS
───────────────────────────────────────────── */
const CSS = `
  .mly-page { min-height:100dvh; background:#F8FAFC; }

  .mly-search-bar {
    position:sticky; top:56px; z-index:30;
    background:#fff; border-bottom:1px solid #E2E8F0; padding:12px 16px;
  }
  .mly-search-input-wrap {
    display:flex; align-items:center; gap:8px;
    background:#F1F5F9; border-radius:12px; padding:0 14px; height:44px;
  }
  .mly-search-input {
    flex:1; border:none; background:transparent;
    font-size:16px; font-weight:700; color:#1A1D2B;
    outline:none; letter-spacing:2px; text-transform:uppercase; font-family:inherit;
  }
  .mly-search-input::placeholder { font-size:14px; font-weight:400; letter-spacing:0; }
  .mly-search-btn {
    background:#1428A0; color:#fff; border:none; border-radius:8px;
    padding:8px 16px; font-size:14px; font-weight:700; cursor:pointer; font-family:inherit;
    -webkit-tap-highlight-color:transparent; transition:opacity .2s;
  }
  .mly-search-btn:active { opacity:.8; }
  .mly-search-clear {
    background:none; border:none; color:#94A3B8; font-size:18px;
    cursor:pointer; padding:0 2px; line-height:1;
    -webkit-tap-highlight-color:transparent;
  }

  .mly-store-badge {
    display:inline-flex; align-items:center; gap:6px; padding:5px 12px;
    border-radius:20px; background:#EEF2FF; color:#1428A0;
    font-size:12px; font-weight:700; margin:12px 16px 0;
  }

  /* 결과 없음 */
  .mly-empty {
    display:flex; flex-direction:column; align-items:center;
    padding:60px 32px; text-align:center; gap:12px;
  }
  .mly-empty-icon { font-size:48px; }
  .mly-empty-title { font-size:16px; font-weight:700; color:#1A1D2B; }
  .mly-empty-sub { font-size:13px; color:#64748B; line-height:1.6; }

  /* 초기 화면 */
  .mly-intro {
    display:flex; flex-direction:column; align-items:center;
    padding:60px 32px; text-align:center; gap:10px;
  }
  .mly-intro-icon { font-size:56px; }
  .mly-intro-title { font-size:17px; font-weight:800; color:#1A1D2B; }
  .mly-intro-sub { font-size:13px; color:#64748B; line-height:1.7; }
  .mly-intro-kbd {
    display:inline-block; background:#F1F5F9; border-radius:8px;
    padding:6px 14px; font-size:12px; color:#1428A0; font-weight:700; margin-top:4px;
  }

  /* 계약 카드 */
  .mly-card-list { padding:14px 16px; display:flex; flex-direction:column; gap:12px; }
  .mly-card {
    background:#fff; border-radius:16px; border:1px solid #E2E8F0;
    overflow:hidden; box-shadow:0 2px 8px rgba(20,40,160,.06);
  }
  .mly-card-header {
    padding:14px 16px 12px;
    border-bottom:1px solid #F1F5F9;
    display:flex; justify-content:space-between; align-items:flex-start;
  }
  .mly-card-plate {
    font-size:20px; font-weight:900; color:#1A1D2B; letter-spacing:2px;
  }
  .mly-card-name { font-size:13px; color:#64748B; font-weight:600; margin-top:2px; }
  .mly-status-badge {
    display:inline-flex; align-items:center; gap:4px;
    padding:5px 10px; border-radius:8px; font-size:12px; font-weight:700;
    white-space:nowrap;
  }
  .mly-card-body { padding:14px 16px; }
  .mly-info-row {
    display:flex; align-items:center; gap:8px;
    font-size:13px; margin-bottom:8px;
  }
  .mly-info-row:last-child { margin-bottom:0; }
  .mly-info-label { color:#94A3B8; font-weight:600; min-width:60px; }
  .mly-info-value { color:#1A1D2B; font-weight:700; }
  .mly-info-value.fee { color:#1428A0; }
  .mly-card-footer {
    padding:10px 16px 14px;
    display:flex; align-items:center; gap:8px;
  }
  .mly-payment-badge {
    padding:4px 10px; border-radius:6px; font-size:11px; font-weight:700;
  }
  .mly-days-bar {
    flex:1; height:6px; background:#E2E8F0; border-radius:3px; overflow:hidden;
  }
  .mly-days-fill { height:100%; border-radius:3px; transition:width .4s; }

  /* 결과 헤더 */
  .mly-result-header {
    padding:12px 16px 4px;
    font-size:13px; color:#64748B; font-weight:600;
    display:flex; align-items:center; gap:6px;
  }
  .mly-result-count {
    display:inline-flex; align-items:center; justify-content:center;
    min-width:22px; height:22px; padding:0 6px;
    background:#1428A0; color:#fff; border-radius:11px;
    font-size:11px; font-weight:800;
  }

  /* 로딩 스켈레톤 */
  @keyframes shimmer {
    0%{background-position:-200% 0;} 100%{background-position:200% 0;}
  }
  .skeleton {
    background:linear-gradient(90deg,#F1F5F9 25%,#E2E8F0 50%,#F1F5F9 75%);
    background-size:200% 100%; animation:shimmer 1.5s infinite; border-radius:8px;
  }
`;

/* ─────────────────────────────────────────────
   컴포넌트
───────────────────────────────────────────── */
export default function CrewMonthlyPage() {
  const supabase = createClient();
  const { showToast } = useCrewToast();

  const [orgId, setOrgId] = useState("");
  const [storeId, setStoreId] = useState("");
  const [storeName, setStoreName] = useState("");

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from("profiles").select("org_id").eq("id", user.id).single();
      if (profile) setOrgId(profile.org_id || "");
      setStoreId(localStorage.getItem("crew_store_id") || "");
      setStoreName(localStorage.getItem("crew_store_name") || "");
    })();
  }, []);

  const handleSearch = useCallback(async () => {
    if (!orgId) return;
    const q = query.trim().toUpperCase();
    setLoading(true);
    setSearched(true);

    try {
      let dbq = supabase
        .from("monthly_parking")
        .select("*, stores(name)")
        .eq("org_id", orgId)
        .order("end_date", { ascending: true });

      if (storeId) dbq = dbq.eq("store_id", storeId);

      if (q) {
        dbq = dbq.or(`vehicle_number.ilike.%${q}%,customer_name.ilike.%${q}%`);
      }

      const { data, error } = await dbq.limit(50);
      if (error) throw error;
      setResults(data || []);
    } catch (e: any) {
      showToast("조회 실패: " + e.message, "error");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [orgId, storeId, query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  const clearSearch = () => {
    setQuery("");
    setResults(null);
    setSearched(false);
  };

  return (
    <>
      <style>{CSS}</style>
      <div className="mly-page">
        <CrewHeader title="월주차 조회" showBack />

        {/* 검색 바 */}
        <div className="mly-search-bar">
          <div className="mly-search-input-wrap">
            <span style={{ fontSize:16 }}>🔍</span>
            <input
              className="mly-search-input"
              value={query}
              onChange={e => setQuery(e.target.value.toUpperCase())}
              onKeyDown={handleKeyDown}
              placeholder="차량번호 또는 고객명 검색"
            />
            {query && (
              <button className="mly-search-clear" onClick={clearSearch}>✕</button>
            )}
          </div>
          <button
            className="mly-search-btn"
            style={{ marginTop:8, width:"100%", height:44, borderRadius:12 }}
            onClick={handleSearch}
          >
            조회하기
          </button>
        </div>

        {/* 매장 뱃지 */}
        {storeName && (
          <div className="mly-store-badge">🏢 {storeName}</div>
        )}

        {/* 초기 화면 */}
        {!searched && !loading && (
          <div className="mly-intro">
            <div className="mly-intro-icon">📅</div>
            <div className="mly-intro-title">월주차 계약 조회</div>
            <div className="mly-intro-sub">
              차량번호 또는 고객명으로 검색하세요.<br />
              빈칸으로 검색하면 전체 계약을 볼 수 있습니다.
            </div>
            <div className="mly-intro-kbd">예) 12가3456 · 홍길동</div>
          </div>
        )}

        {/* 로딩 */}
        {loading && (
          <div style={{ padding:16, display:"flex", flexDirection:"column", gap:12 }}>
            {[1,2,3].map(i => (
              <div key={i} style={{ background:"#fff", borderRadius:16, border:"1px solid #E2E8F0", padding:16 }}>
                <div className="skeleton" style={{ height:22, width:"50%", marginBottom:10 }} />
                <div className="skeleton" style={{ height:14, width:"80%", marginBottom:8 }} />
                <div className="skeleton" style={{ height:14, width:"65%" }} />
              </div>
            ))}
          </div>
        )}

        {/* 검색 결과 */}
        {!loading && searched && results !== null && (
          <>
            <div className="mly-result-header">
              <span className="mly-result-count">{results.length}</span>
              <span>건 검색됨</span>
              {query && <span style={{ color:"#1428A0" }}>"{query}"</span>}
            </div>

            {results.length === 0 ? (
              <div className="mly-empty">
                <div className="mly-empty-icon">🔍</div>
                <div className="mly-empty-title">검색 결과 없음</div>
                <div className="mly-empty-sub">
                  "{query}" 에 해당하는<br />월주차 계약이 없습니다.
                </div>
              </div>
            ) : (
              <div className="mly-card-list">
                {results.map(c => {
                  const status = getStatusInfo(c);
                  const daysLeft = getDaysLeft(c.end_date);
                  const totalDays = getDaysLeft(c.end_date) - getDaysLeft(c.start_date);
                  const progressPct = Math.max(0, Math.min(100,
                    totalDays > 0
                      ? Math.round(((totalDays - Math.max(0, daysLeft)) / totalDays) * 100)
                      : 100
                  ));
                  const barColor = daysLeft < 0 ? "#DC2626" : daysLeft <= 7 ? "#F5B731" : "#1428A0";

                  return (
                    <div key={c.id} className="mly-card">
                      {/* 헤더 */}
                      <div className="mly-card-header">
                        <div>
                          <div className="mly-card-plate">{c.vehicle_number}</div>
                          <div className="mly-card-name">👤 {c.customer_name}</div>
                        </div>
                        <div
                          className="mly-status-badge"
                          style={{ background: status.bg, color: status.color }}
                        >
                          {status.icon} {status.label}
                        </div>
                      </div>

                      {/* 정보 */}
                      <div className="mly-card-body">
                        <div className="mly-info-row">
                          <span className="mly-info-label">📅 기간</span>
                          <span className="mly-info-value">
                            {fmtDate(c.start_date)} ~ {fmtDate(c.end_date)}
                          </span>
                        </div>
                        <div className="mly-info-row">
                          <span className="mly-info-label">💰 요금</span>
                          <span className="mly-info-value fee">{fmtFee(c.monthly_fee)}</span>
                        </div>
                        {c.stores?.name && (
                          <div className="mly-info-row">
                            <span className="mly-info-label">🏢 매장</span>
                            <span className="mly-info-value">{c.stores.name}</span>
                          </div>
                        )}
                      </div>

                      {/* 푸터: 결제 상태 + 진행 바 */}
                      <div className="mly-card-footer">
                        <div
                          className="mly-payment-badge"
                          style={{
                            background: c.payment_status === "paid" ? "#DCFCE7" : "#FEF3C7",
                            color: c.payment_status === "paid" ? "#16A34A" : "#D97706",
                          }}
                        >
                          {c.payment_status === "paid" ? "💳 결제완료" : "⏳ 결제대기"}
                        </div>
                        <div className="mly-days-bar">
                          <div
                            className="mly-days-fill"
                            style={{ width: progressPct + "%", background: barColor }}
                          />
                        </div>
                        <span style={{ fontSize:11, color:"#94A3B8", fontWeight:600, whiteSpace:"nowrap" }}>
                          {daysLeft >= 0 ? `D-${daysLeft}` : `${Math.abs(daysLeft)}일 초과`}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        <CrewNavSpacer />
      </div>
      <CrewBottomNav />
    </>
  );
}
