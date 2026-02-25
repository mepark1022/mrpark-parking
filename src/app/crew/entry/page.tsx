// @ts-nocheck
"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import CrewHeader from "@/components/crew/CrewHeader";
import { useCrewToast } from "@/components/crew/CrewToast";

const CSS = `
  .entry-page {
    min-height: 100dvh;
    background: #F8FAFC;
    padding-bottom: env(safe-area-inset-bottom, 0);
  }
  .step-indicator {
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding: 16px 20px 12px;
    background: #fff;
    border-bottom: 1px solid #E2E8F0;
    gap: 0;
  }
  .step-wrap {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }
  .step-dot {
    width: 28px; height: 28px;
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 12px; font-weight: 700;
    transition: all 0.2s;
  }
  .step-dot.active { background: #1428A0; color: #fff; }
  .step-dot.done   { background: #16A34A; color: #fff; }
  .step-dot.idle   { background: #E2E8F0; color: #94A3B8; }
  .step-line {
    flex: 1; max-width: 48px; height: 2px;
    background: #E2E8F0; margin-top: 14px;
  }
  .step-line.done { background: #16A34A; }
  .step-label { font-size: 10px; color: #94A3B8; }
  .entry-section {
    margin: 16px;
    background: #fff;
    border-radius: 16px;
    border: 1px solid #E2E8F0;
    overflow: hidden;
  }
  .entry-section-title {
    padding: 14px 16px 10px;
    font-size: 12px; font-weight: 700; color: #1428A0;
    letter-spacing: 0.5px; text-transform: uppercase;
    border-bottom: 1px solid #F1F5F9;
  }
  .entry-section-body { padding: 16px; }
  .plate-input {
    width: 100%; height: 60px;
    border: 2.5px solid #E2E8F0; border-radius: 12px;
    padding: 0 16px;
    font-size: 26px; font-weight: 800; color: #1A1D2B;
    text-align: center; letter-spacing: 4px; outline: none;
    text-transform: uppercase; transition: border-color 0.2s;
  }
  .plate-input:focus { border-color: #1428A0; }
  .plate-input.monthly { border-color: #16A34A; background: #F0FDF4; }
  .monthly-badge {
    margin-top: 10px; padding: 10px 14px;
    border-radius: 10px;
    display: flex; align-items: center; gap: 8px;
    font-size: 13px; font-weight: 600;
  }
  .monthly-badge.yes { background: #F0FDF4; color: #16A34A; border: 1px solid #BBF7D0; }
  .monthly-badge.no  { background: #F8FAFC; color: #64748B; border: 1px solid #E2E8F0; }
  .type-toggle { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .type-btn {
    padding: 16px 10px; border-radius: 12px;
    border: 2px solid #E2E8F0; background: #F8FAFC;
    display: flex; flex-direction: column; align-items: center; gap: 6px;
    cursor: pointer; transition: all 0.2s;
  }
  .type-btn.selected { border-color: #1428A0; background: #EEF2FF; }
  .type-btn-icon { font-size: 28px; }
  .type-btn-label { font-size: 14px; font-weight: 700; color: #1A1D2B; }
  .type-btn-desc { font-size: 11px; color: #64748B; }
  .form-select, .form-input {
    width: 100%; height: 48px;
    border: 1.5px solid #E2E8F0; border-radius: 10px;
    padding: 0 14px; font-size: 15px; color: #1A1D2B;
    background: #fff; outline: none; transition: border-color 0.2s;
  }
  .form-select:focus, .form-input:focus { border-color: #1428A0; }
  .form-label { font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 6px; display: block; }
  .form-group { margin-bottom: 14px; }
  .form-group:last-child { margin-bottom: 0; }
  .phone-notice {
    margin-top: 8px; padding: 8px 12px;
    background: #FFF7ED; border-radius: 8px;
    font-size: 11px; color: #92400E;
    display: flex; align-items: flex-start; gap: 6px;
  }
  .entry-footer {
    position: sticky; bottom: 0;
    padding: 16px;
    padding-bottom: calc(16px + env(safe-area-inset-bottom, 0));
    background: #fff; border-top: 1px solid #E2E8F0;
    display: flex; gap: 10px;
  }
  .btn-primary {
    flex: 1; height: 52px;
    background: #1428A0; color: #fff;
    border: none; border-radius: 12px;
    font-size: 16px; font-weight: 700; cursor: pointer;
    transition: opacity 0.2s;
  }
  .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
  .btn-primary.gold { background: #F5B731; color: #1A1D2B; }
  .btn-secondary {
    height: 52px; padding: 0 20px;
    background: #F1F5F9; color: #475569;
    border: none; border-radius: 12px;
    font-size: 15px; font-weight: 600; cursor: pointer;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  .spinner {
    width: 20px; height: 20px;
    border: 2px solid rgba(255,255,255,0.4); border-top-color: #fff;
    border-radius: 50%; animation: spin 0.7s linear infinite; display: inline-block;
  }
  .summary-card {
    background: #F8FAFC; border-radius: 12px; padding: 14px; margin-bottom: 12px;
  }
  .summary-row {
    display: flex; justify-content: space-between; align-items: center;
    padding: 7px 0; border-bottom: 1px solid #E2E8F0; font-size: 14px;
  }
  .summary-row:last-child { border-bottom: none; }
  .summary-key { color: #64748B; }
  .summary-val { font-weight: 600; color: #1A1D2B; }
  .plate-badge {
    font-size: 22px; font-weight: 800; letter-spacing: 3px;
    color: #1428A0; text-align: center;
    padding: 14px; background: #EEF2FF; border-radius: 10px; margin-bottom: 12px;
  }
`;

export default function CrewEntryPage() {
  const router = useRouter();
  const { showToast } = useCrewToast();
  const supabase = createClient();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [storeId, setStoreId] = useState(null);
  const [orgId, setOrgId] = useState(null);
  const [userId, setUserId] = useState(null);

  // Step 1
  const [plateNumber, setPlateNumber] = useState("");
  const [monthlyInfo, setMonthlyInfo] = useState(null);
  const [monthlyChecking, setMonthlyChecking] = useState(false);
  const plateTimer = useRef(null);

  // Step 2
  const [parkingType, setParkingType] = useState("self");
  const [visitPlaces, setVisitPlaces] = useState([]);
  const [visitPlaceId, setVisitPlaceId] = useState("");
  const [parkingLots, setParkingLots] = useState([]);
  const [parkingLotId, setParkingLotId] = useState("");
  const [parkingLocation, setParkingLocation] = useState("");

  // Step 3
  const [phone, setPhone] = useState("");

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/crew/login"); return; }
      setUserId(user.id);

      const savedStoreId = localStorage.getItem("crew_store_id");
      if (!savedStoreId) { router.replace("/crew/select-store"); return; }
      setStoreId(savedStoreId);

      const { data: profile } = await supabase
        .from("profiles").select("org_id").eq("id", user.id).single();
      if (profile) setOrgId(profile.org_id);

      const { data: places } = await supabase
        .from("visit_places").select("id, name, floor")
        .eq("store_id", savedStoreId).order("name");
      setVisitPlaces(places || []);

      const { data: lots } = await supabase
        .from("parking_lots").select("id, name")
        .eq("store_id", savedStoreId).order("name");
      setParkingLots(lots || []);
    };
    init();
  }, []);

  const handlePlateChange = (val) => {
    const cleaned = val.replace(/\s/g, "").toUpperCase().slice(0, 10);
    setPlateNumber(cleaned);
    setMonthlyInfo(null);
    if (plateTimer.current) clearTimeout(plateTimer.current);
    if (cleaned.length >= 4) {
      setMonthlyChecking(true);
      plateTimer.current = setTimeout(() => checkMonthly(cleaned), 600);
    } else {
      setMonthlyChecking(false);
    }
  };

  const checkMonthly = async (plate) => {
    if (!storeId) { setMonthlyChecking(false); return; }
    const today = new Date().toISOString().split("T")[0];
    const { data } = await supabase
      .from("monthly_parking")
      .select("id, customer_name, end_date")
      .eq("store_id", storeId)
      .eq("vehicle_number", plate)
      .gte("end_date", today)
      .eq("status", "active")
      .single();
    setMonthlyChecking(false);
    if (data) {
      const daysLeft = Math.ceil((new Date(data.end_date) - new Date()) / 86400000);
      setMonthlyInfo({ id: data.id, name: data.customer_name, endDate: data.end_date, daysLeft });
    }
  };

  const handleSubmit = async () => {
    if (!storeId || !orgId || !userId) return;
    setLoading(true);
    try {
      const { data: ticket, error } = await supabase
        .from("mepark_tickets")
        .insert({
          org_id: orgId, store_id: storeId,
          plate_number: plateNumber, plate_last4: plateNumber.slice(-4),
          parking_type: parkingType, status: "parking",
          entry_crew_id: userId,
          is_monthly: !!monthlyInfo, monthly_parking_id: monthlyInfo?.id || null,
          visit_place_id: visitPlaceId || null,
          parking_lot_id: parkingLotId || null,
          parking_location: parkingLocation || null,
          entry_at: new Date().toISOString(),
        })
        .select("id").single();

      if (error) throw error;

      if (phone && phone.length >= 10) {
        fetch("/api/alimtalk/entry", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone, ticketId: ticket.id, plateNumber, orgId }),
        }).catch(() => {});
      }

      router.push(`/crew/entry/qr?ticketId=${ticket.id}&plate=${encodeURIComponent(plateNumber)}&type=${parkingType}`);
    } catch (err) {
      console.error(err);
      showToast("입차 등록 중 오류가 발생했습니다.", "error");
    } finally {
      setLoading(false);
    }
  };

  const stepLabels = ["번호판", "정보입력", "확인"];

  return (
    <>
      <style>{CSS}</style>
      <div className="entry-page">
        <CrewHeader title="입차 등록" showBack />

        {/* 진행 단계 */}
        <div className="step-indicator">
          {stepLabels.map((label, i) => {
            const num = i + 1;
            const state = num < step ? "done" : num === step ? "active" : "idle";
            return (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 0 }}>
                {i > 0 && <div className={`step-line ${num <= step ? "done" : ""}`} />}
                <div className="step-wrap">
                  <div className={`step-dot ${state}`}>
                    {state === "done" ? "✓" : num}
                  </div>
                  <div className="step-label">{label}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* STEP 1 */}
        {step === 1 && (
          <>
            <div className="entry-section">
              <div className="entry-section-title">🚗 차량 번호판</div>
              <div className="entry-section-body">
                <input
                  className={`plate-input${monthlyInfo ? " monthly" : ""}`}
                  value={plateNumber}
                  onChange={(e) => handlePlateChange(e.target.value)}
                  placeholder="12가 3456"
                  inputMode="text"
                  autoFocus
                  maxLength={10}
                />
                {monthlyChecking && (
                  <div className="monthly-badge no">🔍 월주차 확인 중...</div>
                )}
                {!monthlyChecking && monthlyInfo && (
                  <div className="monthly-badge yes">
                    ✅&nbsp; 월주차 · {monthlyInfo.name}
                    {monthlyInfo.daysLeft <= 7 && (
                      <span style={{ fontSize: 11, color: "#D97706", marginLeft: 6 }}>
                        (D-{monthlyInfo.daysLeft} 만료)
                      </span>
                    )}
                  </div>
                )}
                {!monthlyChecking && plateNumber.length >= 4 && !monthlyInfo && (
                  <div className="monthly-badge no">ℹ️&nbsp; 일반 차량</div>
                )}
              </div>
            </div>
            <div className="entry-footer">
              <button className="btn-secondary" onClick={() => router.back()}>취소</button>
              <button className="btn-primary" onClick={() => setStep(2)} disabled={!plateNumber.trim()}>
                다음 →
              </button>
            </div>
          </>
        )}

        {/* STEP 2 */}
        {step === 2 && (
          <>
            <div className="entry-section">
              <div className="entry-section-title">🅿️ 주차 유형</div>
              <div className="entry-section-body">
                <div className="type-toggle">
                  {[
                    { val: "self", icon: "🏢", label: "자주식", desc: "고객 직접 주차" },
                    { val: "valet", icon: "🔑", label: "발렛", desc: "크루가 주차" },
                  ].map(t => (
                    <div
                      key={t.val}
                      className={`type-btn${parkingType === t.val ? " selected" : ""}`}
                      onClick={() => setParkingType(t.val)}
                    >
                      <div className="type-btn-icon">{t.icon}</div>
                      <div className="type-btn-label">{t.label}</div>
                      <div className="type-btn-desc">{t.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="entry-section">
              <div className="entry-section-title">🏥 방문지 & 주차 위치</div>
              <div className="entry-section-body">
                {visitPlaces.length > 0 && (
                  <div className="form-group">
                    <label className="form-label">방문지 (선택)</label>
                    <select className="form-select" value={visitPlaceId}
                      onChange={(e) => setVisitPlaceId(e.target.value)}>
                      <option value="">방문지 선택 안 함</option>
                      {visitPlaces.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.floor ? `[${p.floor}] ` : ""}{p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {parkingLots.length > 0 && (
                  <div className="form-group">
                    <label className="form-label">주차장 (선택)</label>
                    <select className="form-select" value={parkingLotId}
                      onChange={(e) => setParkingLotId(e.target.value)}>
                      <option value="">주차장 선택 안 함</option>
                      {parkingLots.map(l => (
                        <option key={l.id} value={l.id}>{l.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                {parkingType === "valet" && (
                  <div className="form-group">
                    <label className="form-label">차량 위치 (발렛)</label>
                    <input className="form-input" value={parkingLocation}
                      onChange={(e) => setParkingLocation(e.target.value)}
                      placeholder="예: B1 가-15, 2층 3번" />
                  </div>
                )}
              </div>
            </div>

            <div className="entry-footer">
              <button className="btn-secondary" onClick={() => setStep(1)}>← 이전</button>
              <button className="btn-primary" onClick={() => setStep(3)}>다음 →</button>
            </div>
          </>
        )}

        {/* STEP 3 */}
        {step === 3 && (
          <>
            <div className="entry-section">
              <div className="entry-section-title">📋 입차 정보 확인</div>
              <div className="entry-section-body">
                <div className="plate-badge">{plateNumber}</div>
                <div className="summary-card">
                  <div className="summary-row">
                    <span className="summary-key">월주차</span>
                    <span className="summary-val" style={{ color: monthlyInfo ? "#16A34A" : "#64748B" }}>
                      {monthlyInfo ? `✅ ${monthlyInfo.name}` : "일반 차량"}
                    </span>
                  </div>
                  <div className="summary-row">
                    <span className="summary-key">주차 유형</span>
                    <span className="summary-val">{parkingType === "valet" ? "🔑 발렛" : "🏢 자주식"}</span>
                  </div>
                  {visitPlaceId && (
                    <div className="summary-row">
                      <span className="summary-key">방문지</span>
                      <span className="summary-val">
                        {visitPlaces.find(p => p.id === visitPlaceId)?.name || "-"}
                      </span>
                    </div>
                  )}
                  {parkingType === "valet" && parkingLocation && (
                    <div className="summary-row">
                      <span className="summary-key">차량 위치</span>
                      <span className="summary-val">{parkingLocation}</span>
                    </div>
                  )}
                  <div className="summary-row">
                    <span className="summary-key">입차 시각</span>
                    <span className="summary-val">
                      {new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="entry-section">
              <div className="entry-section-title">📱 알림톡 (선택)</div>
              <div className="entry-section-body">
                <div className="form-group">
                  <label className="form-label">고객 휴대폰 번호</label>
                  <input className="form-input" value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                    placeholder="010XXXXXXXX" inputMode="numeric" maxLength={11} />
                </div>
                <div className="phone-notice">
                  🔒&nbsp; 전화번호는 알림톡 발송 즉시 삭제되며, 절대 저장되지 않습니다.
                </div>
              </div>
            </div>

            <div className="entry-footer">
              <button className="btn-secondary" onClick={() => setStep(2)}>← 이전</button>
              <button className="btn-primary gold" onClick={handleSubmit} disabled={loading}>
                {loading ? <span className="spinner" /> : "입차 등록 완료"}
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
