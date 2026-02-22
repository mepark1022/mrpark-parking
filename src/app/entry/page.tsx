// @ts-nocheck
"use client";
export const dynamic = 'force-dynamic';

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { getOrgId, getUserContext } from "@/lib/utils/org";
import { getDayType, getDayTypeLabel } from "@/utils/holidays";
import AppLayout from "@/components/layout/AppLayout";

type Store = { id: string; name: string; has_valet: boolean; valet_fee: number };
type Worker = { id: string; name: string };
type AssignedWorker = { worker_id: string; worker_type: "default" | "substitute" | "hq"; name: string };

// ── v3 컬러 팔레트 ──
const C = {
  navy: "#1428A0",
  navyLight: "#2d3a8c",
  navyDark: "#0f1d6b",
  gold: "#F5B731",
  goldLight: "#fef9e7",
  success: "#10b981",
  successBg: "#ecfdf5",
  warning: "#f59e0b",
  warningBg: "#fffbeb",
  error: "#ef4444",
  errorBg: "#fef2f2",
  purple: "#8b5cf6",
  purpleBg: "#f5f3ff",
  bgPage: "#f8f9fb",
  bgCard: "#f4f5f7",
  bgHover: "#ecedf0",
  border: "#e2e4e9",
  borderLight: "#eef0f3",
  textPrimary: "#1a1d26",
  textSecondary: "#5c6370",
  textMuted: "#8b919d",
};

// ── 공통 컴포넌트 ──
const Card = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
  <div style={{
    background: "#fff", borderRadius: 16,
    border: `1px solid ${C.borderLight}`,
    boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
    ...style,
  }}>
    {children}
  </div>
);

const CardHeader = ({ children }: { children: React.ReactNode }) => (
  <div style={{
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "18px 24px", borderBottom: `1px solid ${C.borderLight}`,
  }}>
    {children}
  </div>
);

const CardTitle = ({ icon, children }: { icon: string; children: React.ReactNode }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 16, fontWeight: 700 }}>
    <span>{icon}</span>{children}
  </div>
);

const CardBody = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
  <div style={{ padding: "20px 24px", ...style }}>{children}</div>
);

const Input = (props: React.InputHTMLAttributes<HTMLInputElement> & { style?: React.CSSProperties }) => (
  <input
    {...props}
    style={{
      padding: "11px 16px", border: `1px solid ${C.border}`,
      borderRadius: 10, fontSize: 14, background: "#fff",
      outline: "none", transition: "border-color 0.2s",
      ...props.style,
    }}
    onFocus={e => (e.target.style.borderColor = C.navy)}
    onBlur={e => (e.target.style.borderColor = C.border)}
  />
);

const Select = (props: React.SelectHTMLAttributes<HTMLSelectElement>) => (
  <select
    {...props}
    style={{
      padding: "11px 16px", border: `1px solid ${C.border}`,
      borderRadius: 10, fontSize: 14, background: "#fff",
      outline: "none", cursor: "pointer",
    }}
  />
);

// ── 토글 버튼 그룹 ──
const ToggleGroup = ({
  value, options, onChange,
}: { value: string; options: { id: string; label: string }[]; onChange: (v: string) => void }) => (
  <div style={{
    display: "flex", gap: 4, background: C.bgCard,
    padding: 4, borderRadius: 10,
  }}>
    {options.map(opt => (
      <button
        key={opt.id}
        onClick={() => onChange(opt.id)}
        style={{
          padding: "9px 18px", borderRadius: 8, fontSize: 14, fontWeight: 500,
          border: "none", cursor: "pointer", transition: "all 0.2s",
          background: value === opt.id ? "#fff" : "transparent",
          color: value === opt.id ? C.textPrimary : C.textSecondary,
          boxShadow: value === opt.id ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
        }}
      >
        {opt.label}
      </button>
    ))}
  </div>
);

// ── 근무자 타입 배지 ──
const WorkerTypeBadge = ({ type }: { type: string }) => {
  const styles: Record<string, { bg: string; color: string; label: string }> = {
    default: { bg: C.successBg, color: C.success, label: "기본" },
    substitute: { bg: C.warningBg, color: C.warning, label: "대체" },
    hq: { bg: C.purpleBg, color: C.purple, label: "본사" },
  };
  const s = styles[type] ?? styles.default;
  return (
    <span style={{
      padding: "4px 10px", borderRadius: 6,
      fontSize: 11, fontWeight: 700,
      background: s.bg, color: s.color,
      whiteSpace: "nowrap",
    }}>
      {s.label}
    </span>
  );
};

export default function EntryPage() {
  const supabase = createClient();
  const [stores, setStores] = useState<Store[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [selectedStore, setSelectedStore] = useState("");
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [inputMode, setInputMode] = useState<"total" | "hourly">("total");
  const [hourlyData, setHourlyData] = useState<Record<number, number>>({});
  const [totalCarsOnly, setTotalCarsOnly] = useState(0);
  const [valetCount, setValetCount] = useState(0);
  const [valetRevenue, setValetRevenue] = useState(0);
  const [assignedWorkers, setAssignedWorkers] = useState<AssignedWorker[]>([]);
  const [memo, setMemo] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [existingRecordId, setExistingRecordId] = useState<string | null>(null);
  const [storeHours, setStoreHours] = useState<{ open: number; close: number }>({ open: 7, close: 22 });
  const [oid, setOid] = useState<string | null>(null);

  const dayType = useMemo(() => getDayType(selectedDate), [selectedDate]);
  const dayLabel = useMemo(() => getDayTypeLabel(selectedDate), [selectedDate]);

  const totalCars = useMemo(() => {
    if (inputMode === "total") return totalCarsOnly;
    return Object.values(hourlyData).reduce((s, v) => s + (v || 0), 0);
  }, [inputMode, hourlyData, totalCarsOnly]);

  useEffect(() => { loadStoresAndWorkers(); }, []);
  useEffect(() => {
    if (selectedStore && selectedDate) {
      loadDefaultWorkers(); loadExistingRecord(); loadStoreHours();
    }
  }, [selectedStore, selectedDate]);

  async function loadStoreHours() {
    const d = new Date(selectedDate);
    const dow = d.getDay();
    const { data } = await supabase
      .from("store_operating_hours").select("open_time, close_time, is_closed")
      .eq("store_id", selectedStore).eq("day_of_week", dow).single();
    if (data && !data.is_closed) {
      setStoreHours({
        open: parseInt(data.open_time?.split(":")[0] || "7"),
        close: parseInt(data.close_time?.split(":")[0] || "22"),
      });
    } else {
      setStoreHours({ open: 7, close: 22 });
    }
  }

  async function loadStoresAndWorkers() {
    const ctx = await getUserContext();
    if (!ctx.orgId) return;
    setOid(ctx.orgId);
    let q = supabase.from("stores").select("id, name, has_valet, valet_fee")
      .eq("org_id", ctx.orgId).eq("is_active", true).order("name");
    if (!ctx.allStores && ctx.storeIds.length > 0) q = q.in("id", ctx.storeIds);
    else if (!ctx.allStores) { setStores([]); return; }
    const [storesRes, workersRes] = await Promise.all([
      q,
      supabase.from("workers").select("id, name").eq("org_id", ctx.orgId).eq("status", "active").order("name"),
    ]);
    if (storesRes.data) {
      setStores(storesRes.data);
      if (storesRes.data.length > 0) setSelectedStore(storesRes.data[0].id);
    }
    if (workersRes.data) setWorkers(workersRes.data);
  }

  async function loadDefaultWorkers() {
    const { data } = await supabase
      .from("default_workers")
      .select("id, worker_id, day_type, display_order, workers(id, name)")
      .eq("store_id", selectedStore)
      .eq("day_type", dayType === "holiday" ? "weekday" : dayType)
      .order("display_order");
    if (data) {
      setAssignedWorkers(data.map((d: any) => ({
        worker_id: d.worker_id, worker_type: "default" as const, name: d.workers?.name || "",
      })));
    }
  }

  async function loadExistingRecord() {
    const { data } = await supabase
      .from("daily_records").select("id, total_cars, valet_count, valet_revenue, memo")
      .eq("store_id", selectedStore).eq("date", selectedDate).single();
    if (data) {
      setExistingRecordId(data.id);
      setValetCount(data.valet_count || 0);
      setValetRevenue(data.valet_revenue || 0);
      setMemo(data.memo || "");
      const { data: hData } = await supabase.from("hourly_data").select("hour, car_count").eq("record_id", data.id);
      if (hData && hData.length > 0) {
        const hMap: Record<number, number> = {};
        hData.forEach((h: any) => { hMap[h.hour] = h.car_count; });
        setHourlyData(hMap); setInputMode("hourly"); setTotalCarsOnly(0);
      } else {
        setHourlyData({}); setInputMode("total"); setTotalCarsOnly(data.total_cars || 0);
      }
    } else {
      setExistingRecordId(null); setHourlyData({});
      setTotalCarsOnly(0); setValetCount(0); setValetRevenue(0); setMemo("");
    }
  }

  function addWorker(type: "substitute" | "hq") {
    setAssignedWorkers([...assignedWorkers, { worker_id: "", worker_type: type, name: "" }]);
  }
  function removeWorker(idx: number) {
    setAssignedWorkers(assignedWorkers.filter((_, i) => i !== idx));
  }
  function updateWorker(idx: number, workerId: string) {
    const w = workers.find(w => w.id === workerId);
    const updated = [...assignedWorkers];
    updated[idx] = { ...updated[idx], worker_id: workerId, name: w?.name || "" };
    setAssignedWorkers(updated);
  }

  async function handleSave() {
    if (!selectedStore) return;
    setSaving(true); setMessage("");
    try {
      let recordId = existingRecordId;
      const recordData = {
        store_id: selectedStore, date: selectedDate, total_cars: totalCars,
        valet_count: valetCount, valet_revenue: valetRevenue,
        day_type: dayType, is_holiday: dayType === "holiday", memo: memo || null,
      };
      if (recordId) {
        const { error } = await supabase.from("daily_records").update(recordData).eq("id", recordId);
        if (error) { setMessage(`수정 실패: ${error.message}`); setSaving(false); return; }
        await supabase.from("hourly_data").delete().eq("record_id", recordId);
        await supabase.from("worker_assignments").delete().eq("record_id", recordId);
      } else {
        const { data, error } = await supabase.from("daily_records")
          .insert({ ...recordData, org_id: oid || await getOrgId() }).select("id").single();
        if (error) { setMessage(`저장 실패: ${error.message}`); setSaving(false); return; }
        recordId = data?.id;
      }
      if (recordId && inputMode === "hourly") {
        const inserts = Object.entries(hourlyData).filter(([_, v]) => v > 0)
          .map(([h, v]) => ({ record_id: recordId, hour: Number(h), car_count: v }));
        if (inserts.length > 0) await supabase.from("hourly_data").insert(inserts);
      }
      if (recordId) {
        const wInserts = assignedWorkers.filter(w => w.worker_id)
          .map((w, i) => ({ record_id: recordId, worker_id: w.worker_id, worker_type: w.worker_type, display_order: i + 1 }));
        if (wInserts.length > 0) await supabase.from("worker_assignments").insert(wInserts);
      }
      setExistingRecordId(recordId);
      setMessage("저장 완료!");
      setTimeout(() => setMessage(""), 3000);
    } catch (e: any) {
      setMessage(`저장 실패: ${e?.message || JSON.stringify(e)}`);
    }
    setSaving(false);
  }

  const currentStore = stores.find(s => s.id === selectedStore);
  const dayTypeKo = dayType === "holiday" ? "공휴일" : dayType === "weekday" ? "평일" : "주말";

  return (
    <AppLayout>
      <div style={{ maxWidth: 1100 }}>

        {/* ── 상단 필터 바 ── */}
        <Card style={{ marginBottom: 24 }}>
          <CardBody style={{ padding: "16px 24px" }}>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 20 }}>
              {/* 매장 선택 */}
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: C.textMuted, marginBottom: 6 }}>
                  매장 선택
                </label>
                <Select value={selectedStore} onChange={e => setSelectedStore(e.target.value)} style={{ minWidth: 160 }}>
                  {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </Select>
              </div>

              {/* 날짜 선택 */}
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: C.textMuted, marginBottom: 6 }}>
                  날짜
                </label>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Input
                    type="date" value={selectedDate}
                    onChange={e => setSelectedDate(e.target.value)}
                    style={{ width: 160 }}
                  />
                  <span style={{
                    padding: "5px 14px", borderRadius: 20,
                    fontSize: 12, fontWeight: 700,
                    background: dayLabel.bg, color: dayLabel.color,
                    whiteSpace: "nowrap",
                  }}>
                    {dayLabel.label}
                  </span>
                </div>
              </div>

              {/* 기존 기록 표시 */}
              {existingRecordId && (
                <div style={{
                  marginLeft: "auto", display: "flex", alignItems: "center", gap: 8,
                  padding: "8px 16px", borderRadius: 10,
                  background: C.navyDark + "10", border: `1px solid ${C.navy}22`,
                }}>
                  <span style={{ fontSize: 14, color: C.navy }}>📋</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: C.navy }}>기존 기록 수정 중</span>
                </div>
              )}
            </div>
          </CardBody>
        </Card>

        {/* ── 메인 그리드 ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 24 }}>

          {/* 왼쪽: 입차량 */}
          <Card>
            <CardHeader>
              <CardTitle icon="🚗">입차량 입력</CardTitle>
              <ToggleGroup
                value={inputMode}
                options={[{ id: "total", label: "총 대수만" }, { id: "hourly", label: "시간대별" }]}
                onChange={v => setInputMode(v as "total" | "hourly")}
              />
            </CardHeader>
            <CardBody>
              {inputMode === "total" ? (
                <div style={{ display: "flex", alignItems: "center", gap: 20, padding: "32px 0" }}>
                  <label style={{ fontSize: 15, fontWeight: 700, color: C.textPrimary, whiteSpace: "nowrap" }}>
                    총 입차량
                  </label>
                  <Input
                    type="number" min={0} value={totalCarsOnly || ""}
                    onChange={e => setTotalCarsOnly(Number(e.target.value))}
                    placeholder="0"
                    style={{
                      width: 140, textAlign: "center",
                      fontSize: 28, fontWeight: 800, color: C.navy,
                      padding: "12px 16px",
                    }}
                  />
                  <span style={{ fontSize: 16, fontWeight: 600, color: C.textSecondary }}>대</span>
                </div>
              ) : (
                <div style={{ maxHeight: 420, overflowY: "auto", paddingRight: 4 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10 }}>
                    {Array.from(
                      { length: storeHours.close - storeHours.open + 1 },
                      (_, i) => i + storeHours.open
                    ).map(hour => (
                      <div key={hour} style={{
                        display: "flex", alignItems: "center", gap: 10,
                        background: C.bgCard, borderRadius: 10, padding: "10px 14px",
                      }}>
                        <span style={{
                          width: 36, fontSize: 13, fontWeight: 700,
                          color: C.textSecondary, textAlign: "right", flexShrink: 0,
                        }}>
                          {String(hour).padStart(2, "0")}시
                        </span>
                        <input
                          type="number" min={0}
                          value={hourlyData[hour] || ""}
                          onChange={e => setHourlyData({ ...hourlyData, [hour]: Number(e.target.value) })}
                          placeholder="0"
                          style={{
                            width: "100%", border: `1px solid ${C.border}`, borderRadius: 8,
                            padding: "8px 10px", textAlign: "center",
                            fontSize: 15, fontWeight: 700, color: C.textPrimary,
                            background: "#fff", outline: "none",
                          }}
                          onFocus={e => (e.target.style.borderColor = C.navy)}
                          onBlur={e => (e.target.style.borderColor = C.border)}
                        />
                        <span style={{ fontSize: 12, color: C.textMuted, flexShrink: 0 }}>대</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 총합 표시 */}
              <div style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                marginTop: 20, paddingTop: 16, borderTop: `2px solid ${C.borderLight}`,
              }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: C.textPrimary }}>총 입차량</span>
                <span style={{ fontSize: 28, fontWeight: 800, color: C.navy }}>
                  {totalCars.toLocaleString()}
                  <span style={{ fontSize: 16, fontWeight: 600, marginLeft: 4 }}>대</span>
                </span>
              </div>
            </CardBody>
          </Card>

          {/* 오른쪽: 발렛 + 근무자 + 메모 */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

            {/* 발렛 정보 */}
            {currentStore?.has_valet && (
              <Card>
                <CardHeader>
                  <CardTitle icon="🚙">발렛 정보</CardTitle>
                  <span style={{ fontSize: 12, color: C.textMuted, background: C.bgCard, padding: "4px 10px", borderRadius: 6 }}>
                    단가 ₩{(currentStore?.valet_fee || 5000).toLocaleString()}
                  </span>
                </CardHeader>
                <CardBody>
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    {[
                      { label: "발렛 건수", value: valetCount, unit: "건", setter: (v: number) => { setValetCount(v); setValetRevenue(v * (currentStore?.valet_fee || 5000)); } },
                      { label: "발렛 매출", value: valetRevenue, unit: "원", setter: setValetRevenue },
                    ].map(item => (
                      <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 12, overflow: "visible" }}>
                        <label style={{ width: 80, fontSize: 14, fontWeight: 600, color: C.textPrimary, flexShrink: 0 }}>
                          {item.label}
                        </label>
                        <Input
                          type="number" min={0} value={item.value || ""}
                          onChange={e => item.setter(Number(e.target.value))}
                          placeholder="0"
                          style={{ flex: 1, minWidth: 0, textAlign: "center", fontWeight: 700, boxSizing: "border-box" }}
                        />
                        <span style={{ fontSize: 13, color: C.textMuted, flexShrink: 0, whiteSpace: "nowrap" }}>{item.unit}</span>
                      </div>
                    ))}
                  </div>
                </CardBody>
              </Card>
            )}

            {/* 근무자 */}
            <Card>
              <CardHeader>
                <CardTitle icon="👥">근무자 ({dayTypeKo} 기본)</CardTitle>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => addWorker("substitute")}
                    style={{
                      padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 700,
                      background: C.warningBg, color: C.warning, border: "none", cursor: "pointer",
                    }}
                  >+ 대체</button>
                  <button
                    onClick={() => addWorker("hq")}
                    style={{
                      padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 700,
                      background: C.purpleBg, color: C.purple, border: "none", cursor: "pointer",
                    }}
                  >+ 본사</button>
                </div>
              </CardHeader>
              <CardBody>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {assignedWorkers.length === 0 ? (
                    <p style={{ textAlign: "center", color: C.textMuted, padding: "20px 0", fontSize: 14 }}>
                      배정된 근무자가 없습니다
                    </p>
                  ) : (
                    assignedWorkers.map((w, idx) => (
                      <div key={idx} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <WorkerTypeBadge type={w.worker_type} />
                        <select
                          value={w.worker_id}
                          onChange={e => updateWorker(idx, e.target.value)}
                          style={{
                            flex: 1, padding: "9px 12px", border: `1px solid ${C.border}`,
                            borderRadius: 8, fontSize: 14, background: "#fff", outline: "none",
                          }}
                        >
                          <option value="">선택</option>
                          {workers.map(wk => <option key={wk.id} value={wk.id}>{wk.name}</option>)}
                        </select>
                        {w.worker_type !== "default" && (
                          <button
                            onClick={() => removeWorker(idx)}
                            style={{
                              background: "none", border: "none", cursor: "pointer",
                              color: C.error, fontSize: 18, fontWeight: 700, lineHeight: 1,
                              padding: "0 4px",
                            }}
                          >✕</button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </CardBody>
            </Card>

            {/* 메모 */}
            <Card>
              <CardHeader>
                <CardTitle icon="📝">메모</CardTitle>
              </CardHeader>
              <CardBody>
                <textarea
                  value={memo}
                  onChange={e => setMemo(e.target.value)}
                  rows={3}
                  placeholder="특이사항 입력..."
                  style={{
                    width: "100%", padding: "12px 14px",
                    border: `1px solid ${C.border}`, borderRadius: 10,
                    fontSize: 14, resize: "none", outline: "none",
                    fontFamily: "inherit", color: C.textPrimary,
                  }}
                  onFocus={e => (e.target.style.borderColor = C.navy)}
                  onBlur={e => (e.target.style.borderColor = C.border)}
                />
              </CardBody>
            </Card>

            {/* PC 저장 버튼 */}
            <div className="hidden md:block">
              <button
                onClick={handleSave}
                disabled={saving}
                style={{
                  width: "100%", padding: "16px 0", borderRadius: 14,
                  background: saving ? C.textMuted : C.navy,
                  color: "#fff", fontSize: 16, fontWeight: 700,
                  border: "none", cursor: saving ? "not-allowed" : "pointer",
                  boxShadow: saving ? "none" : "0 4px 12px rgba(20,40,160,0.25)",
                  transition: "all 0.2s",
                }}
              >
                {saving ? "⏳ 저장 중..." : existingRecordId ? "✏️ 수정 저장" : "💾 저장"}
              </button>
            </div>

            {/* 모바일 여백 */}
            <div className="md:hidden" style={{ height: 80 }} />
          </div>
        </div>
      </div>

      {/* 모바일 하단 고정 저장 버튼 */}
      <div
        className="md:hidden"
        style={{
          position: "fixed", bottom: 60, left: 0, right: 0, zIndex: 150,
          padding: "10px 16px", background: "#fff",
          borderTop: `1px solid ${C.borderLight}`,
          boxShadow: "0 -2px 10px rgba(0,0,0,0.06)",
        }}
      >
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            width: "100%", padding: "14px 0", borderRadius: 12,
            background: saving ? C.textMuted : C.navy,
            color: "#fff", fontSize: 16, fontWeight: 700,
            border: "none", cursor: saving ? "not-allowed" : "pointer",
          }}
        >
          {saving ? "⏳ 저장 중..." : existingRecordId ? "✏️ 수정 저장" : "💾 저장"}
        </button>
      </div>

      {/* 토스트 알림 */}
      {message && (
        <div style={{
          position: "fixed", top: 80, left: "50%", transform: "translateX(-50%)",
          zIndex: 9999, padding: "14px 28px", borderRadius: 12,
          background: message.includes("완료") ? C.success : C.error,
          color: "#fff", fontSize: 15, fontWeight: 700,
          boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
          whiteSpace: "nowrap",
        }}>
          {message.includes("완료") ? "✅ " : "❌ "}{message}
        </div>
      )}
    </AppLayout>
  );
}
