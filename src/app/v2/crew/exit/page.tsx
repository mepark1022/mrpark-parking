// @ts-nocheck
"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import CameraOcr from "@/components/crew/CameraOcr";
import { extractDigits } from "@/lib/plate";

/**
 * CREW v2 출차 검색 페이지 — 4자리 → N건 매칭 카드 리스트 (Part 19B-5D)
 * - 일반차 + 월주차 모두 검색 (GET /api/v1/tickets/check-collision?include_monthly=true)
 * - 4자리 입력(수동/OCR) → debounce 500ms 검색
 *   · 0건 → 안내
 *   · 1건 → 카드 없이 즉시 상세(/v2/crew/parking/[id])로 이동
 *   · N건 → 카드 리스트(차종·차색/차주성함·입차시간·위치·발렛/자주식·상태) → 선택 → 상세
 * - 카드 구분: 일반차=차종·차색 / 월주차=📅뱃지·차종·👤차주성함(계약 조인)
 * - CameraOcr 재사용 (풀번호 결과에서 last4만 추출 · 컴포넌트 무수정)
 * - Supabase 직접 호출 0건 / 신규 DB·기존코드 수정 0건 (check-collision additive 재사용)
 */

const CSS = `
  .cv2-exit-page { min-height: 100dvh; background: #F8FAFC; padding-bottom: 100px; }
  .cv2-exit-header {
    background: linear-gradient(135deg, #0a1352 0%, #1428A0 100%);
    padding: 14px 16px; padding-top: calc(14px + env(safe-area-inset-top, 0));
    color: #fff; display: flex; align-items: center; gap: 12px;
    position: sticky; top: 0; z-index: 30;
  }
  .cv2-back-btn {
    width: 36px; height: 36px; border-radius: 10px; background: rgba(255,255,255,0.15);
    display: flex; align-items: center; justify-content: center; cursor: pointer;
  }
  .cv2-back-btn:active { background: rgba(255,255,255,0.25); }

  .cv2-exit-section {
    margin: 14px 16px 0; background: #fff; border-radius: 16px;
    border: 1px solid #E2E8F0; overflow: hidden;
  }
  .cv2-exit-section-title {
    padding: 14px 16px 10px; font-size: 12px; font-weight: 700; color: #1428A0;
    letter-spacing: 0.5px; text-transform: uppercase; border-bottom: 1px solid #F1F5F9;
  }
  .cv2-exit-section-body { padding: 16px; }

  /* ── 4자리 입력 ── */
  .cv2-l4-wrap {
    border: 2.5px solid #E2E8F0; border-radius: 13px; background: #fff;
    padding: 10px; transition: border-color 0.2s;
  }
  .cv2-l4-wrap.focused { border-color: #1428A0; }
  .cv2-l4-input {
    width: 100%; height: 64px; border: none; outline: none; background: transparent;
    text-align: center; font-family: 'Outfit', sans-serif; font-weight: 800;
    font-size: 44px; letter-spacing: 14px; color: #1A1D2B; text-indent: 14px;
    box-sizing: border-box;
  }
  .cv2-l4-input::placeholder { color: #D7DEE8; letter-spacing: 14px; }
  .cv2-l4-hint { margin-top: 9px; font-size: 11px; color: #94A3B8; text-align: center; }
  .cv2-l4-hint b { color: #1428A0; }

  .cv2-ocr-btn {
    width: 100%; height: 52px; margin-top: 12px; background: #1428A0; color: #fff;
    border: none; border-radius: 12px; font-size: 15px; font-weight: 700;
    display: flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer;
  }
  .cv2-ocr-btn:active { opacity: 0.85; }

  .cv2-scoreline {
    margin-top: 10px; padding: 10px 13px; border-radius: 10px;
    font-size: 12px; font-weight: 600; display: flex; align-items: center; gap: 8px;
  }
  .cv2-scoreline.checking { background: #F8FAFC; color: #64748B; border: 1px solid #E2E8F0; }
  .cv2-scoreline.none { background: #FEF2F2; color: #B91C1C; border: 1px solid #FECACA; }
  .cv2-scoreline.one { background: #F0FDF4; color: #16A34A; border: 1px solid #BBF7D0; }
  .cv2-scoreline.many { background: #FEF3C7; color: #92400E; border: 1px solid #FDE68A; }

  /* ── 결과 카드 ── */
  .cv2-result-head {
    margin: 16px 16px 0; font-size: 13px; font-weight: 700; color: #1A1D2B;
    display: flex; align-items: center; gap: 6px;
  }
  .cv2-result-head .count { color: #1428A0; }
  .cv2-cards { padding: 10px 16px 16px; display: flex; flex-direction: column; gap: 10px; }
  .cv2-vcard {
    background: #fff; border-radius: 14px; border: 1.5px solid #E2E8F0; overflow: hidden;
    cursor: pointer; transition: transform 0.1s;
  }
  .cv2-vcard:active { transform: scale(0.98); }
  .cv2-vcard.exit_requested { border-color: #EA580C; border-width: 2.5px; background: #FFF7ED; }
  .cv2-vcard.car_ready { border-color: #16A34A; border-width: 2px; background: #F0FDF4; }
  .cv2-vcard-top {
    display: flex; align-items: center; justify-content: space-between;
    padding: 12px 14px 10px; border-bottom: 1px solid #F1F5F9;
  }
  .cv2-vplate { font-size: 22px; font-weight: 800; letter-spacing: 1px; color: #1A1D2B; font-family: 'Outfit', sans-serif; }
  .cv2-vbadge { padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 700; }
  .cv2-vcard-body { padding: 10px 14px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .cv2-vtype { padding: 3px 9px; border-radius: 6px; font-size: 11px; font-weight: 600; }
  .cv2-vtype.valet   { background: #FFF7ED; color: #EA580C; }
  .cv2-vtype.self    { background: #EEF2FF; color: #1428A0; }
  .cv2-vtype.monthly { background: #F0FDF4; color: #16A34A; }
  .cv2-vchip { padding: 3px 9px; border-radius: 6px; font-size: 11px; font-weight: 600; background: #F1F5F9; color: #475569; }
  .cv2-vchip.owner { background: #EEF2FF; color: #1428A0; }
  .cv2-velapsed { font-size: 13px; font-weight: 700; margin-left: auto; font-family: 'Outfit', sans-serif; }
  .cv2-velapsed.warn { color: #DC2626; }
  .cv2-velapsed.caution { color: #EA580C; }
  .cv2-velapsed.ok { color: #16A34A; }
  .cv2-vcard-footer { padding: 8px 14px 12px; display: flex; align-items: center; justify-content: space-between; }
  .cv2-vloc { font-size: 12px; color: #94A3B8; }
  .cv2-vgo { font-size: 12px; color: #1428A0; font-weight: 700; }

  .cv2-empty { padding: 50px 20px; text-align: center; color: #94A3B8; font-size: 14px; line-height: 1.7; }
  .cv2-empty b { color: #64748B; }
`;

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string; cls: string }> = {
  parking:        { label: "주차 중",  bg: "#EEF2FF", color: "#1428A0", cls: "parking" },
  pre_paid:       { label: "사전정산", bg: "#F0FDF4", color: "#16A34A", cls: "parking" },
  exit_requested: { label: "출차요청", bg: "#FFF7ED", color: "#EA580C", cls: "exit_requested" },
  car_ready:      { label: "차량준비", bg: "#DCFCE7", color: "#16A34A", cls: "car_ready" },
  overdue:        { label: "정산필요", bg: "#FEF2F2", color: "#DC2626", cls: "parking" },
};

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
function elapsedColor(mins: number): string {
  if (mins > 240) return "warn";
  if (mins > 120) return "caution";
  return "ok";
}

export default function CrewV2ExitSearchPage() {
  const router = useRouter();

  const [storeId, setStoreId] = useState<string | null>(null);
  const [storeName, setStoreName] = useState("");

  const [last4, setLast4] = useState("");
  const [focused, setFocused] = useState(false);
  const [showCamera, setShowCamera] = useState(false);

  // 검색 상태: idle | checking | none | navigating | many
  const [phase, setPhase] = useState<"idle" | "checking" | "none" | "navigating" | "many">("idle");
  const [matches, setMatches] = useState<any[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);
  const searchTimer = useRef<any>(null);

  // ── 초기 로드 ──
  useEffect(() => {
    const sid = localStorage.getItem("crew_store_id");
    const sname = localStorage.getItem("crew_store_name");
    if (!sid) { router.replace("/v2/crew/login"); return; }
    setStoreId(sid);
    setStoreName(sname || "매장");
  }, [router]);

  // ── 4자리 검색 (debounce 500ms) ──
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (last4.length !== 4 || !storeId) {
      setPhase("idle"); setMatches([]); return;
    }

    setPhase("checking");
    searchTimer.current = setTimeout(async () => {
      try {
        const params = new URLSearchParams({
          store_id: storeId,
          plate_last4: last4,
          include_monthly: "true", // 5D: 월주차 포함
        });
        const res = await fetch(`/api/v1/tickets/check-collision?${params}`, { credentials: "include" });
        if (!res.ok) {
          if (res.status === 401) router.replace("/v2/crew/login?error=session_expired");
          setPhase("none"); setMatches([]); return;
        }
        const { data } = await res.json();
        const list = data?.matches || [];

        if (list.length === 0) {
          setPhase("none"); setMatches([]);
        } else if (list.length === 1) {
          // 1건 → 즉시 상세 이동
          setPhase("navigating"); setMatches(list);
          setTimeout(() => router.push(`/v2/crew/parking/${list[0].id}`), 350);
        } else {
          setPhase("many"); setMatches(list);
        }
      } catch {
        setPhase("none"); setMatches([]);
      }
    }, 500);

    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [last4, storeId, router]);

  const handleLast4Change = (v: string) => {
    setLast4(v.replace(/\D/g, "").slice(0, 4));
  };

  // OCR 결과 → 풀번호에서 last4만 추출
  const handleOcrConfirm = (plate: string) => {
    const digits = extractDigits(plate);
    setLast4(digits.slice(-4));
    setShowCamera(false);
  };

  const goDetail = (id: string) => router.push(`/v2/crew/parking/${id}`);

  return (
    <>
      <style>{CSS}</style>
      <div className="cv2-exit-page">
        {/* 헤더 */}
        <div className="cv2-exit-header">
          <div className="cv2-back-btn" onClick={() => router.back()}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 700 }}>출차 검색</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", marginTop: 2 }}>📍 {storeName}</div>
          </div>
        </div>

        {/* 4자리 입력 */}
        <div className="cv2-exit-section">
          <div className="cv2-exit-section-title">차량 뒤 4자리</div>
          <div className="cv2-exit-section-body">
            <div className={`cv2-l4-wrap ${focused ? "focused" : ""}`}>
              <input
                ref={inputRef}
                className="cv2-l4-input"
                value={last4}
                onChange={(e) => handleLast4Change(e.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                placeholder="0000"
                inputMode="numeric"
                maxLength={4}
                autoFocus
              />
            </div>
            <div className="cv2-l4-hint">출차할 차량 <b>뒤 4자리</b> 입력 · 일반차 + 월주차</div>

            <button className="cv2-ocr-btn" onClick={() => setShowCamera(true)}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" />
              </svg>
              📷 카메라로 4자리 인식
            </button>

            {phase === "checking" && <div className="cv2-scoreline checking">⏳ 차량 검색 중...</div>}
            {phase === "none" && <div className="cv2-scoreline none">❌ 활성 차량 없음 — 이미 출차했거나 입차되지 않은 번호</div>}
            {phase === "navigating" && <div className="cv2-scoreline one">✓ 1건 매칭 — 상세로 이동합니다</div>}
            {phase === "many" && <div className="cv2-scoreline many">⚠️ 동일 4자리 {matches.length}대 — 출차할 차량을 선택하세요</div>}
          </div>
        </div>

        {/* 0건 안내 */}
        {phase === "none" && (
          <div className="cv2-empty">
            검색 결과가 없습니다<br />
            <b style={{ fontSize: 12 }}>번호를 다시 확인하거나 주차 현황에서 직접 찾아보세요</b>
          </div>
        )}

        {/* N건 카드 리스트 */}
        {phase === "many" && (
          <>
            <div className="cv2-result-head">🔎 <span className="count">{matches.length}대</span>의 차량 — 출차할 차량 선택</div>
            <div className="cv2-cards">
              {matches.map((m: any) => {
                const st = STATUS_CONFIG[m.status] || STATUS_CONFIG.parking;
                const isM = !!m.is_monthly;
                const mins = m.entry_at ? elapsedMin(m.entry_at) : 0;
                return (
                  <div key={m.id} className={`cv2-vcard ${st.cls}`} onClick={() => goDetail(m.id)}>
                    <div className="cv2-vcard-top">
                      <span className="cv2-vplate">{m.plate_last4 || m.plate_number}</span>
                      <span className="cv2-vbadge" style={{ background: st.bg, color: st.color }}>{st.label}</span>
                    </div>
                    <div className="cv2-vcard-body">
                      {isM ? (
                        <span className="cv2-vtype monthly">📅 월주차</span>
                      ) : (
                        <span className={`cv2-vtype ${m.parking_type}`}>{m.parking_type === "self" ? "🏢 자주식" : "🔑 발렛"}</span>
                      )}
                      {m.car_type && <span className="cv2-vchip">{m.car_type}</span>}
                      {isM
                        ? (m.owner_name && <span className="cv2-vchip owner">👤 {m.owner_name}</span>)
                        : (m.car_color && <span className="cv2-vchip">{m.car_color}</span>)}
                      {m.entry_at && (
                        <span className={`cv2-velapsed ${elapsedColor(mins)}`}>{elapsedString(m.entry_at)}</span>
                      )}
                    </div>
                    <div className="cv2-vcard-footer">
                      <span className="cv2-vloc">
                        {m.parking_location ? `📍 ${m.parking_location}` : "위치 미지정"}
                        {isM ? ` · ${m.parking_type === "self" ? "자주식" : "발렛"}` : ""}
                      </span>
                      <span className="cv2-vgo">출차 처리 ›</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* OCR 카메라 */}
        {showCamera && (
          <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "#0d0d0d" }}>
            <CameraOcr onConfirm={handleOcrConfirm} onCancel={() => setShowCamera(false)} />
          </div>
        )}
      </div>
    </>
  );
}
