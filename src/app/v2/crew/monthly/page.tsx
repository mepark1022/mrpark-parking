// @ts-nocheck
"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

/**
 * CREW v2 월주차 조회 페이지 (GAP-P1-7 Part 2)
 * - 레거시 src/app/crew/monthly/page.tsx 이식. 단, Supabase 직접조회 제거.
 * - 데이터는 전부 v1 API 경유: GET /api/v1/monthly?store_id&search&contract_status=all (credentials:include)
 *   → P1-7 Part 1에서 GET 게이트가 MANAGE→OPERATE로 완화되어 CREW 호출 가능.
 *   → crew는 API 내부에서 배정 store로 자동 스코핑(타 매장 차단).
 * - store_id = localStorage.crew_store_id (없으면 로그인으로 회귀)
 * - 검색(차량번호/고객명) + 상태배지(정상/D-N만료임박/만료/해지) + 카드리스트
 * - 신규등록 → /v2/crew/monthly/register, 카드 수정 → register?id= (Part 3에서 구현)
 * - BottomNav/NavSpacer는 v2/crew/layout 상속 → 여기서 수동 추가 금지.
 * - 네임스페이스 cv2mly-*, NAVY/GOLD/Outfit.
 */

/* ─────────────────────────────────────────────
   유틸 (레거시 동일 로직 이식)
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
  return (n ?? 0).toLocaleString("ko-KR") + "원";
}

// 상태 계산: contract_status(active|expired|cancelled) + 만료일 D-N
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
   CSS (네임스페이스 cv2mly-*)
───────────────────────────────────────────── */
const CSS = `
  .cv2mly-page { min-height:100dvh; background:#F8FAFC; font-family:'Noto Sans KR', sans-serif; }

  /* 헤더 (NAVY 그라데이션) */
  .cv2mly-header {
    background:linear-gradient(135deg, #0a1352 0%, #1428A0 100%);
    padding:14px 16px; padding-top:calc(14px + env(safe-area-inset-top, 0));
    color:#fff; display:flex; align-items:center; gap:12px;
  }
  .cv2mly-back-btn {
    width:36px; height:36px; border-radius:10px; background:rgba(255,255,255,0.15);
    display:flex; align-items:center; justify-content:center; cursor:pointer;
    -webkit-tap-highlight-color:transparent; flex-shrink:0;
  }
  .cv2mly-back-btn:active { background:rgba(255,255,255,0.25); }
  .cv2mly-header-title { font-size:16px; font-weight:700; flex:1; }
  .cv2mly-add-btn {
    display:flex; align-items:center; gap:4px; padding:7px 14px; border-radius:9px;
    background:#F5B731; color:#1A1D2B; border:none; font-size:13px; font-weight:800;
    cursor:pointer; font-family:inherit; -webkit-tap-highlight-color:transparent;
    transition:transform .12s; flex-shrink:0;
  }
  .cv2mly-add-btn:active { transform:scale(.95); }

  /* 검색 바 */
  .cv2mly-search-bar { background:#fff; border-bottom:1px solid #E2E8F0; padding:12px 16px; }
  .cv2mly-search-input-wrap {
    display:flex; align-items:center; gap:8px;
    background:#F1F5F9; border-radius:12px; padding:0 14px; height:46px;
  }
  .cv2mly-search-input {
    flex:1; border:none; background:transparent; font-size:16px; font-weight:700;
    color:#1A1D2B; outline:none; letter-spacing:2px; text-transform:uppercase; font-family:inherit;
  }
  .cv2mly-search-input::placeholder { font-size:14px; font-weight:400; letter-spacing:0; }
  .cv2mly-search-clear {
    background:none; border:none; color:#94A3B8; font-size:18px;
    cursor:pointer; padding:0 2px; line-height:1; -webkit-tap-highlight-color:transparent;
  }
  .cv2mly-search-btn {
    margin-top:8px; width:100%; height:46px; border-radius:12px;
    background:#1428A0; color:#fff; border:none; font-size:15px; font-weight:700;
    cursor:pointer; font-family:inherit; -webkit-tap-highlight-color:transparent; transition:opacity .2s;
  }
  .cv2mly-search-btn:active { opacity:.85; }

  /* 매장 뱃지 */
  .cv2mly-store-badge {
    display:inline-flex; align-items:center; gap:6px; padding:5px 12px;
    border-radius:20px; background:#EEF2FF; color:#1428A0;
    font-size:12px; font-weight:700; margin:12px 16px 0;
  }

  /* 초기 화면 */
  .cv2mly-intro {
    display:flex; flex-direction:column; align-items:center;
    padding:60px 32px; text-align:center; gap:10px;
  }
  .cv2mly-intro-icon { font-size:56px; }
  .cv2mly-intro-title { font-size:17px; font-weight:800; color:#1A1D2B; }
  .cv2mly-intro-sub { font-size:13px; color:#64748B; line-height:1.7; }
  .cv2mly-intro-kbd {
    display:inline-block; background:#F1F5F9; border-radius:8px;
    padding:6px 14px; font-size:12px; color:#1428A0; font-weight:700; margin-top:4px;
  }

  /* 결과 없음 */
  .cv2mly-empty {
    display:flex; flex-direction:column; align-items:center;
    padding:60px 32px; text-align:center; gap:12px;
  }
  .cv2mly-empty-title { font-size:16px; font-weight:700; color:#1A1D2B; }
  .cv2mly-empty-sub { font-size:13px; color:#64748B; line-height:1.6; }

  /* 결과 헤더 */
  .cv2mly-result-header {
    padding:12px 16px 4px; font-size:13px; color:#64748B; font-weight:600;
    display:flex; align-items:center; gap:6px;
  }
  .cv2mly-result-count {
    display:inline-flex; align-items:center; justify-content:center;
    min-width:22px; height:22px; padding:0 6px;
    background:#1428A0; color:#fff; border-radius:11px; font-size:11px; font-weight:800;
    font-family:'Outfit', sans-serif;
  }

  /* 계약 카드 */
  .cv2mly-card-list { padding:14px 16px; display:flex; flex-direction:column; gap:12px; }
  .cv2mly-card {
    background:#fff; border-radius:16px; border:1px solid #E2E8F0;
    overflow:hidden; box-shadow:0 2px 8px rgba(20,40,160,.06);
  }
  .cv2mly-card-header {
    padding:14px 16px 12px; border-bottom:1px solid #F1F5F9;
    display:flex; justify-content:space-between; align-items:flex-start;
  }
  .cv2mly-card-plate {
    font-size:20px; font-weight:900; color:#1A1D2B; letter-spacing:2px;
    font-family:'Outfit', 'Noto Sans KR', sans-serif;
  }
  .cv2mly-card-name { font-size:13px; color:#64748B; font-weight:600; margin-top:2px; }
  .cv2mly-status-badge {
    display:inline-flex; align-items:center; gap:4px;
    padding:5px 10px; border-radius:8px; font-size:12px; font-weight:700; white-space:nowrap;
  }
  .cv2mly-card-body { padding:14px 16px; }
  .cv2mly-info-row { display:flex; align-items:center; gap:8px; font-size:13px; margin-bottom:8px; }
  .cv2mly-info-row:last-child { margin-bottom:0; }
  .cv2mly-info-label { color:#94A3B8; font-weight:600; min-width:60px; }
  .cv2mly-info-value { color:#1A1D2B; font-weight:700; }
  .cv2mly-info-value.fee { color:#1428A0; }
  .cv2mly-card-footer { padding:10px 16px 14px; display:flex; align-items:center; gap:8px; }
  .cv2mly-payment-badge { padding:4px 10px; border-radius:6px; font-size:11px; font-weight:700; white-space:nowrap; }
  .cv2mly-days-bar { flex:1; height:6px; background:#E2E8F0; border-radius:3px; overflow:hidden; }
  .cv2mly-days-fill { height:100%; border-radius:3px; transition:width .4s; }
  .cv2mly-days-label { font-size:11px; color:#94A3B8; font-weight:600; white-space:nowrap; font-family:'Outfit', sans-serif; }
  .cv2mly-card-action { padding:0 16px 14px; }
  .cv2mly-edit-btn {
    width:100%; height:42px; border-radius:10px; border:1.5px solid #1428A0;
    background:#EEF2FF; color:#1428A0; font-size:14px; font-weight:700;
    cursor:pointer; font-family:inherit;
    display:flex; align-items:center; justify-content:center; gap:6px;
    transition:all .15s; -webkit-tap-highlight-color:transparent;
  }
  .cv2mly-edit-btn:active { background:#1428A0; color:#fff; transform:scale(.97); }

  /* 로딩 스켈레톤 */
  @keyframes cv2mly-shimmer { 0%{background-position:-200% 0;} 100%{background-position:200% 0;} }
  .cv2mly-skeleton {
    background:linear-gradient(90deg,#F1F5F9 25%,#E2E8F0 50%,#F1F5F9 75%);
    background-size:200% 100%; animation:cv2mly-shimmer 1.5s infinite; border-radius:8px;
  }
`;

/* ─────────────────────────────────────────────
   컴포넌트
───────────────────────────────────────────── */
export default function CrewV2MonthlyPage() {
  const router = useRouter();

  const [storeId, setStoreId] = useState("");
  const [storeName, setStoreName] = useState("");

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [lastQuery, setLastQuery] = useState(""); // 결과 헤더 표기용(조회 시점 검색어 고정)

  // 가드: crew_store_id 확인
  useEffect(() => {
    const sid = localStorage.getItem("crew_store_id");
    if (!sid) {
      router.replace("/v2/crew/login");
      return;
    }
    setStoreId(sid);
    setStoreName(localStorage.getItem("crew_store_name") || "매장");
  }, [router]);

  // 조회: v1 API 경유 (Supabase 직접조회 없음)
  const handleSearch = useCallback(async () => {
    if (!storeId) return;
    const q = query.trim().toUpperCase();
    setLoading(true);
    setSearched(true);
    setLastQuery(q);

    try {
      const params = new URLSearchParams({
        store_id: storeId,
        contract_status: "all", // 정상/만료/해지 모두 표시 (레거시 동일)
        limit: "50",
      });
      if (q) params.set("search", q);

      const res = await fetch(`/api/v1/monthly?${params.toString()}`, {
        credentials: "include",
      });

      if (res.status === 401) {
        router.replace("/v2/crew/login?error=session_expired");
        return;
      }
      if (!res.ok) {
        setResults([]);
        return;
      }

      const json = await res.json();
      setResults(json?.data || []);
    } catch (e) {
      console.error("monthly fetch error:", e);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [storeId, query, router]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  const clearSearch = () => {
    setQuery("");
    setResults(null);
    setSearched(false);
    setLastQuery("");
  };

  return (
    <>
      <style>{CSS}</style>
      <div className="cv2mly-page">
        {/* ── 헤더 ── */}
        <div className="cv2mly-header">
          <div className="cv2mly-back-btn" onClick={() => router.push("/v2/crew")}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
          </div>
          <div className="cv2mly-header-title">월주차 관리</div>
          <button
            className="cv2mly-add-btn"
            onClick={() => router.push("/v2/crew/monthly/register")}
          >
            <span style={{ fontSize: 15 }}>+</span> 등록
          </button>
        </div>

        {/* ── 검색 바 ── */}
        <div className="cv2mly-search-bar">
          <div className="cv2mly-search-input-wrap">
            <span style={{ fontSize: 16 }}>🔍</span>
            <input
              className="cv2mly-search-input"
              value={query}
              onChange={(e) => setQuery(e.target.value.toUpperCase())}
              onKeyDown={handleKeyDown}
              placeholder="차량번호 또는 고객명 검색"
            />
            {query && (
              <button className="cv2mly-search-clear" onClick={clearSearch}>✕</button>
            )}
          </div>
          <button className="cv2mly-search-btn" onClick={handleSearch}>
            조회하기
          </button>
        </div>

        {/* ── 매장 뱃지 ── */}
        {storeName && <div className="cv2mly-store-badge">🏢 {storeName}</div>}

        {/* ── 초기 화면 ── */}
        {!searched && !loading && (
          <div className="cv2mly-intro">
            <div className="cv2mly-intro-icon">📅</div>
            <div className="cv2mly-intro-title">월주차 계약 조회</div>
            <div className="cv2mly-intro-sub">
              차량번호 또는 고객명으로 검색하세요.<br />
              빈칸으로 검색하면 전체 계약을 볼 수 있습니다.
            </div>
            <div className="cv2mly-intro-kbd">예) 12가3456 · 홍길동</div>
          </div>
        )}

        {/* ── 로딩 스켈레톤 ── */}
        {loading && (
          <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
            {[1, 2, 3].map((i) => (
              <div key={i} style={{ background: "#fff", borderRadius: 16, border: "1px solid #E2E8F0", padding: 16 }}>
                <div className="cv2mly-skeleton" style={{ height: 22, width: "50%", marginBottom: 10 }} />
                <div className="cv2mly-skeleton" style={{ height: 14, width: "80%", marginBottom: 8 }} />
                <div className="cv2mly-skeleton" style={{ height: 14, width: "65%" }} />
              </div>
            ))}
          </div>
        )}

        {/* ── 검색 결과 ── */}
        {!loading && searched && results !== null && (
          <>
            <div className="cv2mly-result-header">
              <span className="cv2mly-result-count">{results.length}</span>
              <span>건 검색됨</span>
              {lastQuery && <span style={{ color: "#1428A0" }}>"{lastQuery}"</span>}
            </div>

            {results.length === 0 ? (
              <div className="cv2mly-empty">
                <div style={{ width: 56, height: 56, background: "#F1F5F9", borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" strokeWidth={2.5} />
                  </svg>
                </div>
                <div className="cv2mly-empty-title">검색 결과 없음</div>
                <div className="cv2mly-empty-sub">
                  {lastQuery ? <>"{lastQuery}" 에 해당하는<br />월주차 계약이 없습니다.</> : <>등록된 월주차 계약이 없습니다.</>}
                </div>
              </div>
            ) : (
              <div className="cv2mly-card-list">
                {results.map((c) => {
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
                    <div key={c.id} className="cv2mly-card">
                      {/* 헤더 */}
                      <div className="cv2mly-card-header">
                        <div>
                          <div className="cv2mly-card-plate">{c.vehicle_number}</div>
                          <div className="cv2mly-card-name">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ display: "inline", marginRight: 4, verticalAlign: "middle" }}>
                              <circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
                            </svg>
                            {c.customer_name}
                          </div>
                        </div>
                        <div className="cv2mly-status-badge" style={{ background: status.bg, color: status.color }}>
                          {status.icon} {status.label}
                        </div>
                      </div>

                      {/* 정보 */}
                      <div className="cv2mly-card-body">
                        <div className="cv2mly-info-row">
                          <span className="cv2mly-info-label">📅 기간</span>
                          <span className="cv2mly-info-value">
                            {fmtDate(c.start_date)} ~ {fmtDate(c.end_date)}
                          </span>
                        </div>
                        <div className="cv2mly-info-row">
                          <span className="cv2mly-info-label">💰 요금</span>
                          <span className="cv2mly-info-value fee">{fmtFee(c.monthly_fee)}</span>
                        </div>
                        {c.stores?.name && (
                          <div className="cv2mly-info-row">
                            <span className="cv2mly-info-label">🏢 매장</span>
                            <span className="cv2mly-info-value">{c.stores.name}</span>
                          </div>
                        )}
                      </div>

                      {/* 푸터: 결제 상태 + 진행 바 + D-N */}
                      <div className="cv2mly-card-footer">
                        <div
                          className="cv2mly-payment-badge"
                          style={{
                            background: c.payment_status === "paid" ? "#DCFCE7" : "#FEF3C7",
                            color: c.payment_status === "paid" ? "#16A34A" : "#D97706",
                          }}
                        >
                          {c.payment_status === "paid" ? "💳 결제완료" : "⏳ 결제대기"}
                        </div>
                        <div className="cv2mly-days-bar">
                          <div className="cv2mly-days-fill" style={{ width: progressPct + "%", background: barColor }} />
                        </div>
                        <span className="cv2mly-days-label">
                          {daysLeft >= 0 ? `D-${daysLeft}` : `${Math.abs(daysLeft)}일 초과`}
                        </span>
                      </div>

                      {/* 수정 버튼 */}
                      <div className="cv2mly-card-action">
                        <button
                          className="cv2mly-edit-btn"
                          onClick={() => router.push(`/v2/crew/monthly/register?id=${c.id}`)}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                          수정하기
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
