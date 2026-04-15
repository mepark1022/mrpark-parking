// @ts-nocheck
"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { fmtPlate } from "@/lib/utils/format";
import { extractDigits } from "@/lib/plate";

/**
 * CREW v2 주차 목록 페이지
 * - GET /api/v1/tickets/active?store_id=xxx — 현재 주차중 (valet/self/monthly)
 * - GET /api/v1/tickets?store_id=xxx&status=completed&date_from&date_to — 출차완료
 * - 5초 폴링 (출차요청 감지 시 진동)
 * - Supabase 직접 호출 0건
 */

const CSS = `
  @keyframes cv2SlideDown {
    from { opacity: 0; transform: translateX(-50%) translateY(-16px); }
    to   { opacity: 1; transform: translateX(-50%) translateY(0); }
  }
  @keyframes cv2PulseOrange {
    0%, 100% { box-shadow: 0 0 0 3px rgba(234,88,12,0.15); }
    50%      { box-shadow: 0 0 0 6px rgba(234,88,12,0.08); }
  }
  .cv2-plist-page { min-height: 100dvh; background: #F8FAFC; }

  .cv2-plist-header {
    background: linear-gradient(135deg, #0a1352 0%, #1428A0 100%);
    padding: 14px 16px;
    padding-top: calc(14px + env(safe-area-inset-top, 0));
    color: #fff;
    position: sticky;
    top: 0;
    z-index: 30;
  }
  .cv2-plist-title { font-size: 16px; font-weight: 700; }
  .cv2-plist-store { font-size: 12px; color: rgba(255,255,255,0.65); margin-top: 2px; }

  .cv2-plist-toolbar {
    background: #fff;
    border-bottom: 1px solid #E2E8F0;
    padding: 12px 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    position: sticky;
    top: 56px;
    z-index: 20;
  }
  .cv2-plist-search {
    display: flex; align-items: center; gap: 8px;
    background: #F1F5F9; border-radius: 10px;
    padding: 0 12px; height: 40px;
  }
  .cv2-plist-search input {
    flex: 1; border: none; background: transparent;
    font-size: 15px; color: #1A1D2B; outline: none;
  }
  .cv2-plist-tabs {
    display: flex; gap: 6px;
    overflow-x: auto; -webkit-overflow-scrolling: touch;
  }
  .cv2-plist-tabs::-webkit-scrollbar { display: none; }
  .cv2-plist-tab {
    flex-shrink: 0;
    padding: 6px 14px; border-radius: 20px;
    font-size: 13px; font-weight: 600;
    cursor: pointer; transition: all 0.2s;
    border: 1.5px solid #E2E8F0;
    background: #fff; color: #64748B;
    white-space: nowrap;
  }
  .cv2-plist-tab.active { background: #1428A0; color: #fff; border-color: #1428A0; }
  .cv2-plist-tab.active-exit { background: #94A3B8; color: #fff; border-color: #94A3B8; }

  .cv2-plist-stats {
    display: grid; grid-template-columns: repeat(4, 1fr);
    background: #fff;
    border-bottom: 1px solid #E2E8F0;
    padding: 10px 0;
  }
  .cv2-stat-item {
    display: flex; flex-direction: column; align-items: center; gap: 2px;
    border-right: 1px solid #E2E8F0;
  }
  .cv2-stat-item:last-child { border-right: none; }
  .cv2-stat-num { font-size: 20px; font-weight: 800; color: #1A1D2B; font-family: 'Outfit', sans-serif; }
  .cv2-stat-label { font-size: 10px; color: #94A3B8; }

  .cv2-plist-list { padding: 12px 16px; display: flex; flex-direction: column; gap: 10px; }
  .cv2-vehicle-card {
    background: #fff; border-radius: 14px;
    border: 1.5px solid #E2E8F0; overflow: hidden;
    cursor: pointer; transition: transform 0.1s, box-shadow 0.1s;
  }
  .cv2-vehicle-card:active { transform: scale(0.98); }
  .cv2-vehicle-card.exit_requested {
    border-color: #EA580C; border-width: 2.5px; background: #FFF7ED;
    box-shadow: 0 0 0 3px rgba(234,88,12,0.15);
    animation: cv2PulseOrange 1.5s ease-in-out infinite;
  }
  .cv2-vehicle-card.car_ready {
    border-color: #16A34A; border-width: 2px; background: #F0FDF4;
  }

  .cv2-vcard-top {
    display: flex; align-items: center; justify-content: space-between;
    padding: 12px 14px 10px;
    border-bottom: 1px solid #F1F5F9;
  }
  .cv2-vplate { font-size: 20px; font-weight: 800; letter-spacing: 1px; color: #1A1D2B; font-family: 'Outfit', sans-serif; }
  .cv2-vbadge { padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 700; }

  .cv2-vcard-body {
    padding: 10px 14px;
    display: flex; align-items: center; gap: 8px;
  }
  .cv2-vtype-badge {
    padding: 3px 9px; border-radius: 6px;
    font-size: 11px; font-weight: 600;
  }
  .cv2-vtype-badge.valet   { background: #FFF7ED; color: #EA580C; }
  .cv2-vtype-badge.self    { background: #EEF2FF; color: #1428A0; }
  .cv2-vtype-badge.monthly { background: #F0FDF4; color: #16A34A; }

  .cv2-vinfo-row {
    display: flex; align-items: center; gap: 4px;
    font-size: 12px; color: #64748B;
  }
  .cv2-velapsed {
    font-size: 14px; font-weight: 700;
    margin-left: auto;
    font-family: 'Outfit', sans-serif;
  }
  .cv2-velapsed.warn { color: #DC2626; }
  .cv2-velapsed.caution { color: #EA580C; }
  .cv2-velapsed.ok { color: #16A34A; }

  .cv2-vcard-footer {
    padding: 8px 14px 12px;
    display: flex; align-items: center; justify-content: space-between;
  }
  .cv2-vlocation { font-size: 12px; color: #94A3B8; }
  .cv2-vfee { font-size: 14px; font-weight: 700; color: #1A1D2B; font-family: 'Outfit', sans-serif; }

  .cv2-plist-empty {
    padding: 60px 20px; text-align: center;
    color: #94A3B8; font-size: 14px;
  }
`;

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  parking:        { label: "주차 중",   bg: "#EEF2FF", color: "#1428A0" },
  pre_paid:       { label: "사전정산",  bg: "#F0FDF4", color: "#16A34A" },
  exit_requested: { label: "출차요청",  bg: "#FFF7ED", color: "#EA580C" },
  car_ready:      { label: "차량준비",  bg: "#DCFCE7", color: "#16A34A" },
  completed:      { label: "출차완료",  bg: "#F1F5F9", color: "#94A3B8" },
};

const TABS = [
  { key: "valet",   label: "🔑 발렛" },
  { key: "self",    label: "🏢 자주식" },
  { key: "monthly", label: "📅 월주차" },
  { key: "exited",  label: "🚗 출차완료" },
];

function elapsedMin(entryAt: string): number {
  return Math.floor((Date.now() - new Date(entryAt).getTime()) / 60000);
}

function elapsedString(entryAt: string): string {
  const mins = elapsedMin(entryAt);
  if (mins < 60) return `${mins}분`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}시간 ${m}분` : `${h}시간`;
}

// 요금 계산 (visit_places 또는 stores 기준)
function calcFee(entryAt: string, feeStructure: any, parkingType: string): number {
  if (!feeStructure) return 0;
  const mins = elapsedMin(entryAt);
  const { free_minutes = 30, base_fee = 0, base_minutes = 30, extra_fee = 0, daily_max = 0, valet_fee = 0 } = feeStructure;
  let amount = 0;
  if (mins > free_minutes) {
    const chargeable = mins - free_minutes;
    if (chargeable <= base_minutes) {
      amount = base_fee;
    } else {
      const extraUnits = Math.ceil((chargeable - base_minutes) / 10);
      amount = base_fee + extraUnits * extra_fee;
    }
    if (daily_max) amount = Math.min(amount, daily_max);
  }
  if (parkingType === "valet") amount += (valet_fee || 0);
  return amount;
}

// 오늘 날짜 (YYYY-MM-DD, KST)
function getTodayKST(): string {
  const d = new Date();
  const kst = new Date(d.getTime() + 9 * 3600 * 1000);
  return kst.toISOString().slice(0, 10);
}

export default function CrewV2ParkingListPage() {
  const router = useRouter();
  const [tickets, setTickets] = useState<any[]>([]);
  const [exitedTickets, setExitedTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [exitedLoading, setExitedLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("valet");
  const [storeId, setStoreId] = useState<string | null>(null);
  const [storeName, setStoreName] = useState("");
  const [selectedDate, setSelectedDate] = useState(getTodayKST());
  const [tick, setTick] = useState(0); // 경과시간 재렌더 트리거

  // 초기 로드
  useEffect(() => {
    const sid = localStorage.getItem("crew_store_id");
    const sname = localStorage.getItem("crew_store_name");
    if (!sid) {
      router.replace("/v2/crew/login");
      return;
    }
    setStoreId(sid);
    setStoreName(sname || "매장");
    fetchTickets(sid);

    // 5초 폴링
    const interval = setInterval(() => fetchTickets(sid, true), 5000);
    // 1분마다 경과시간 재렌더
    const tickInterval = setInterval(() => setTick(t => t + 1), 60000);
    return () => {
      clearInterval(interval);
      clearInterval(tickInterval);
    };
  }, [router]);

  const fetchTickets = useCallback(async (sid: string, silent = false) => {
    if (!sid) return;
    if (!silent) setLoading(true);
    try {
      const res = await fetch(`/api/v1/tickets/active?store_id=${sid}`, {
        credentials: "include",
      });
      if (!res.ok) {
        if (res.status === 401) router.replace("/v2/crew/login?error=session_expired");
        return;
      }
      const { data } = await res.json();
      setTickets(data?.tickets || []);
    } catch (err) {
      console.error("fetchTickets error:", err);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [router]);

  const fetchExitedTickets = useCallback(async (sid: string, date: string) => {
    if (!sid) return;
    setExitedLoading(true);
    try {
      const params = new URLSearchParams({
        store_id: sid,
        status: "completed",
        date_from: `${date}T00:00:00+09:00`,
        date_to: `${date}T23:59:59+09:00`,
        limit: "100",
      });
      const res = await fetch(`/api/v1/tickets?${params.toString()}`, {
        credentials: "include",
      });
      if (!res.ok) return;
      const json = await res.json();
      setExitedTickets(json?.data || []);
    } catch (err) {
      console.error("fetchExitedTickets error:", err);
    } finally {
      setExitedLoading(false);
    }
  }, []);

  // 출차탭 선택 or 날짜 변경 시 fetch
  useEffect(() => {
    if (activeTab === "exited" && storeId) {
      fetchExitedTickets(storeId, selectedDate);
    }
  }, [activeTab, selectedDate, storeId, fetchExitedTickets]);

  // 검색/탭 필터
  const filtered = useMemo(() => {
    const list = activeTab === "exited" ? exitedTickets : tickets;
    const digits = extractDigits(search);
    return list.filter((t: any) => {
      // 검색 매칭
      let searchMatch = true;
      if (search) {
        if (digits.length >= 2) {
          // 숫자 검색 → digits 비교
          const plateDigits = extractDigits(t.plate_number);
          searchMatch = plateDigits.includes(digits);
        } else {
          // 비숫자 포함 시 원문 비교
          searchMatch = t.plate_number?.toUpperCase().includes(search.toUpperCase());
        }
      }
      // 탭 매칭 (exited는 이미 completed 필터됨, 나머지는 parking_type or is_monthly)
      let tabMatch = true;
      if (activeTab === "monthly") tabMatch = !!t.is_monthly;
      else if (activeTab === "valet" || activeTab === "self") tabMatch = t.parking_type === activeTab && !t.is_monthly;
      return searchMatch && tabMatch;
    });
  }, [tickets, exitedTickets, activeTab, search]);

  // 통계 (현재 주차중 기준)
  const stats = useMemo(() => ({
    total: tickets.length,
    valet: tickets.filter((t: any) => t.parking_type === "valet").length,
    monthly: tickets.filter((t: any) => t.is_monthly).length,
    exitReq: tickets.filter((t: any) => t.status === "exit_requested").length,
  }), [tickets]);

  const exitReqCount = stats.exitReq;

  // 경과 시간 색상
  const elapsedColor = (mins: number) => {
    if (mins > 240) return "warn";
    if (mins > 120) return "caution";
    return "ok";
  };

  return (
    <>
      <style>{CSS}</style>
      <div className="cv2-plist-page">
        {/* 헤더 */}
        <div className="cv2-plist-header">
          <div className="cv2-plist-title">🚗 주차 현황</div>
          <div className="cv2-plist-store">📍 {storeName}</div>
        </div>

        {/* 출차요청 고정 배너 */}
        {exitReqCount > 0 && activeTab !== "exited" && (
          <div
            onClick={() => {
              const firstExit = tickets.find((t: any) => t.status === "exit_requested");
              if (firstExit) router.push(`/v2/crew/parking/${firstExit.id}`);
            }}
            style={{
              background: "#EA580C", color: "#fff",
              padding: "12px 16px", display: "flex",
              alignItems: "center", justifyContent: "space-between",
              cursor: "pointer",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 20 }}>🚗</span>
              <span style={{ fontWeight: 800, fontSize: 15 }}>
                출차요청 {exitReqCount}건 대기 중
              </span>
            </div>
            <span style={{ fontSize: 12, opacity: 0.85 }}>탭하여 확인 →</span>
          </div>
        )}

        {/* 툴바 */}
        <div className="cv2-plist-toolbar">
          <div className="cv2-plist-search">
            <span style={{ fontSize: 16, color: "#94A3B8" }}>🔍</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="번호판 검색 (숫자 또는 전체)"
              inputMode="text"
            />
            {search && (
              <span onClick={() => setSearch("")}
                style={{ fontSize: 16, color: "#94A3B8", cursor: "pointer" }}>✕</span>
            )}
          </div>
          <div className="cv2-plist-tabs">
            {TABS.map(tab => (
              <div
                key={tab.key}
                className={`cv2-plist-tab${activeTab === tab.key ? (tab.key === "exited" ? " active-exit" : " active") : ""}`}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
              </div>
            ))}
          </div>
          {activeTab === "exited" && (
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{
                width: "100%", height: 40, padding: "0 12px",
                border: "1.5px solid #E2E8F0", borderRadius: 10,
                fontSize: 14, color: "#1A1D2B", outline: "none",
              }}
            />
          )}
        </div>

        {/* 통계 */}
        <div className="cv2-plist-stats">
          {(activeTab === "exited" ? [
            { num: String(exitedTickets.length), label: "출차완료" },
            { num: String(exitedTickets.filter((t: any) => t.parking_type === "valet").length), label: "발렛" },
            { num: String(exitedTickets.filter((t: any) => t.is_monthly).length), label: "월주차" },
            { num: exitedTickets.reduce((s, t) => s + (t.paid_amount || 0), 0).toLocaleString() + "원", label: "매출", isText: true },
          ] : [
            { num: String(stats.total),   label: "주차 중" },
            { num: String(stats.valet),   label: "발렛" },
            { num: String(stats.monthly), label: "월주차" },
            { num: String(stats.exitReq), label: "출차요청", color: stats.exitReq > 0 ? "#EA580C" : undefined },
          ]).map((s: any, i) => (
            <div key={i} className="cv2-stat-item">
              <div className="cv2-stat-num" style={{
                ...(s.color ? { color: s.color } : {}),
                ...(s.isText ? { fontSize: 13, fontFamily: "'Noto Sans KR', sans-serif" } : {}),
              }}>
                {s.num}
              </div>
              <div className="cv2-stat-label">{s.label}</div>
            </div>
          ))}
        </div>

        {/* 리스트 */}
        <div className="cv2-plist-list">
          {(activeTab === "exited" ? exitedLoading : loading) ? (
            <div className="cv2-plist-empty">로딩 중...</div>
          ) : filtered.length === 0 ? (
            <div className="cv2-plist-empty">
              {search ? `"${search}" 검색 결과가 없습니다` :
               activeTab === "exited" ? "해당 날짜의 출차 내역이 없습니다" :
               "해당 조건의 차량이 없습니다"}
            </div>
          ) : (
            filtered.map((t: any) => {
              const mins = elapsedMin(t.entry_at);
              const statusCfg = STATUS_CONFIG[t.status] || STATUS_CONFIG.parking;
              const feeStructure = t.visit_places || t.stores;
              const currentFee = activeTab === "exited"
                ? (t.paid_amount || 0)
                : (t.is_monthly ? 0 : calcFee(t.entry_at, feeStructure, t.parking_type));

              return (
                <div
                  key={t.id}
                  className={`cv2-vehicle-card ${t.status}`}
                  onClick={() => router.push(`/v2/crew/parking/${t.id}`)}
                >
                  {/* 상단: 번호판 + 상태 */}
                  <div className="cv2-vcard-top">
                    <span className="cv2-vplate">{fmtPlate(t.plate_number)}</span>
                    <span className="cv2-vbadge" style={{ background: statusCfg.bg, color: statusCfg.color }}>
                      {statusCfg.label}
                    </span>
                  </div>

                  {/* 본문: 타입 + 경과 */}
                  <div className="cv2-vcard-body">
                    <span className={`cv2-vtype-badge ${t.is_monthly ? "monthly" : t.parking_type}`}>
                      {t.is_monthly ? "📅 월주차" : t.parking_type === "valet" ? "🔑 발렛" : "🏢 자주식"}
                    </span>
                    {t.is_free && (
                      <span className="cv2-vtype-badge" style={{ background: "#FEF3C7", color: "#92400E" }}>
                        🎟 무료
                      </span>
                    )}
                    <span className={`cv2-velapsed ${activeTab === "exited" ? "" : elapsedColor(mins)}`}>
                      {activeTab === "exited"
                        ? new Date(t.entry_at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })
                        : elapsedString(t.entry_at)}
                    </span>
                  </div>

                  {/* 푸터: 주차위치 + 요금 */}
                  <div className="cv2-vcard-footer">
                    <span className="cv2-vlocation">
                      {t.parking_location ? `📍 ${t.parking_location}` : "위치 미지정"}
                    </span>
                    <span className="cv2-vfee">
                      {t.is_monthly ? "월주차" : `₩${currentFee.toLocaleString()}`}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
