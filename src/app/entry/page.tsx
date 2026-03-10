// @ts-nocheck
"use client";
export const dynamic = 'force-dynamic';

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getOrgId, getUserContext } from "@/lib/utils/org";
import { getDayType, getDayTypeLabel } from "@/utils/holidays";
import AppLayout from "@/components/layout/AppLayout";
import MeParkDatePicker from "@/components/ui/MeParkDatePicker";

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
    boxSizing: "border-box",
    width: "100%",
    ...style,
  }}>
    {children}
  </div>
);

const CardHeader = ({ children, compact }: { children: React.ReactNode; compact?: boolean }) => (
  <div style={{
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: compact ? "12px 14px" : "14px 20px", borderBottom: `1px solid ${C.borderLight}`,
    gap: compact ? 6 : 10, boxSizing: "border-box", width: "100%",
  }}>
    {children}
  </div>
);

const CardTitle = ({ icon, children, compact }: { icon: string; children: React.ReactNode; compact?: boolean }) => (
  <div style={{ display: "flex", alignItems: "center", gap: compact ? 6 : 10, fontSize: compact ? 13 : 16, fontWeight: 700, flexShrink: 1, minWidth: 0 }}>
    <span style={{ flexShrink: 0 }}>{icon}</span><span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{children}</span>
  </div>
);

const CardBody = ({ children, style, compact }: { children: React.ReactNode; style?: React.CSSProperties; compact?: boolean }) => (
  <div style={{ padding: compact ? "14px 14px" : "20px 24px", boxSizing: "border-box", width: "100%", ...style }}>{children}</div>
);

const Input = (props: React.InputHTMLAttributes<HTMLInputElement> & { style?: React.CSSProperties }) => (
  <input
    {...props}
    style={{
      padding: "11px 16px", border: `1px solid ${C.border}`,
      borderRadius: 10, fontSize: 14, background: "#fff",
      outline: "none", transition: "border-color 0.2s",
      boxSizing: "border-box", maxWidth: "100%",
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
      boxSizing: "border-box", maxWidth: "100%",
    }}
  />
);

// ── 토글 버튼 그룹 ──
const TOGGLE_COLORS: Record<string, { activeBg: string; activeShadow: string }> = {
  total:  { activeBg: C.navy, activeShadow: "0 2px 6px rgba(20,40,160,0.25)" },
  hourly: { activeBg: C.gold, activeShadow: "0 2px 6px rgba(245,183,49,0.35)" },
};
const ToggleGroup = ({
  value, options, onChange,
}: { value: string; options: { id: string; label: string }[]; onChange: (v: string) => void }) => (
  <div style={{
    display: "flex", gap: 2, background: C.bgCard,
    padding: 3, borderRadius: 10, flexShrink: 0, flexWrap: "nowrap",
  }}>
    {options.map(opt => {
      const tc = TOGGLE_COLORS[opt.id] ?? TOGGLE_COLORS.total;
      const isActive = value === opt.id;
      return (
        <button
          key={opt.id}
          onClick={() => onChange(opt.id)}
          style={{
            padding: "6px 10px", borderRadius: 8, fontSize: 11, fontWeight: 700,
            border: "none", cursor: "pointer", transition: "all 0.2s",
            whiteSpace: "nowrap", lineHeight: 1,
            background: isActive ? tc.activeBg : "transparent",
            color: isActive ? (opt.id === "hourly" ? C.textPrimary : "#fff") : C.textMuted,
            boxShadow: isActive ? tc.activeShadow : "none",
          }}
        >
          {opt.label}
        </button>
      );
    })}
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
  const router = useRouter();
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
  const [isMobile, setIsMobile] = useState(false);
  const [valetToast, setValetToast] = useState(false);

  const showValetToast = () => {
    setValetToast(true);
    setTimeout(() => setValetToast(false), 3500);
  };

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

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
    // day_category: "weekday" | "weekend" | "holiday"
    // 공휴일은 별도 설정 없으면 평일 운영시간으로 fallback
    const categoryOrder =
      dayType === "holiday" ? ["holiday", "weekday"] :
      dayType === "weekend" ? ["weekend"] :
      ["weekday"];

    for (const cat of categoryOrder) {
      const { data, error } = await supabase
        .from("store_operating_hours").select("open_time, close_time, is_closed")
        .eq("store_id", selectedStore).eq("day_category", cat).maybeSingle();
      if (error) continue;
      if (data) {
        if (data.is_closed) {
          setStoreHours({ open: 7, close: 22 });
        } else {
          setStoreHours({
            open: parseInt(data.open_time?.split(":")[0] || "7"),
            close: parseInt(data.close_time?.split(":")[0] || "22"),
          });
        }
        return;
      }
    }
    setStoreHours({ open: 7, close: 22 });
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
    const { data, error } = await supabase
      .from("default_workers")
      .select("id, worker_id, day_type, display_order, workers(id, name)")
      .eq("store_id", selectedStore)
      .eq("day_type", dayType === "holiday" ? "weekday" : dayType)
      .order("display_order");
    if (error) { setAssignedWorkers([]); return; }
    if (data) {
      setAssignedWorkers(data.map((d: any) => ({
        worker_id: d.worker_id, worker_type: "default" as const, name: d.workers?.name || "",
      })));
    }
  }

  async function loadExistingRecord() {
    const { data } = await supabase
      .from("daily_records").select("id, total_cars, valet_count, valet_revenue, memo")
      .eq("store_id", selectedStore).eq("date", selectedDate).maybeSingle();
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

  // ── 공용 서브 컴포넌트 (입차/발렛/근무자/메모) ──
  const hourlyGrid = (
    <div style={{ maxHeight: isMobile ? undefined : 420, overflowY: isMobile ? undefined : "auto", paddingRight: isMobile ? 0 : 4 }}>
      <div style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "repeat(3, 1fr)" : "repeat(auto-fill, minmax(160px, 1fr))",
        gap: isMobile ? 6 : 10,
      }}>
        {Array.from(
          { length: storeHours.close - storeHours.open + 1 },
          (_, i) => i + storeHours.open
        ).map(hour => (
          <div key={hour} style={{
            display: "flex", alignItems: "center", gap: isMobile ? 4 : 10,
            background: C.bgCard, borderRadius: isMobile ? 8 : 10,
            padding: isMobile ? "8px 8px" : "10px 14px",
          }}>
            <span style={{
              width: isMobile ? 28 : 36, fontSize: isMobile ? 11 : 13, fontWeight: 700,
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
                width: "100%", minWidth: 0, border: `1px solid ${C.border}`, borderRadius: 6,
                padding: isMobile ? "6px 4px" : "8px 10px", textAlign: "center",
                fontSize: isMobile ? 13 : 15, fontWeight: 700, color: C.textPrimary,
                background: "#fff", outline: "none",
              }}
              onFocus={e => (e.target.style.borderColor = C.navy)}
              onBlur={e => (e.target.style.borderColor = C.border)}
            />
          </div>
        ))}
      </div>
    </div>
  );

  const valetCard = currentStore?.has_valet ? (
    <Card>
      <CardHeader compact={isMobile}>
        <CardTitle icon="🚙" compact={isMobile}>발렛 정보</CardTitle>
        <span
          onClick={showValetToast}
          style={{ fontSize: isMobile ? 11 : 12, color: C.navy, background: "#eef1fb", padding: isMobile ? "4px 8px" : "4px 10px", borderRadius: 6, cursor: "pointer", fontWeight: 600, border: "1px solid #d0d8f5", whiteSpace: "nowrap", flexShrink: 0, maxWidth: isMobile ? 120 : undefined, overflow: "hidden", textOverflow: "ellipsis" }}>
          {isMobile ? `₩${(currentStore?.valet_fee || 5000).toLocaleString()}` : `단가 ₩${(currentStore?.valet_fee || 5000).toLocaleString()} ✏️`}
        </span>
      </CardHeader>
      <div style={{ padding: isMobile ? "8px 14px 10px" : "20px 24px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? 8 : 12 }}>
          {[
            { label: "발렛 건수", value: valetCount, unit: "건", setter: (v: number) => { setValetCount(v); setValetRevenue(v * (currentStore?.valet_fee || 5000)); } },
            { label: "발렛 매출", value: valetRevenue, unit: "원", setter: setValetRevenue },
          ].map(item => (
            <div key={item.label} style={{ display: "flex", alignItems: "center", gap: isMobile ? 8 : 12 }}>
              <label style={{ width: isMobile ? 64 : 80, fontSize: isMobile ? 13 : 14, fontWeight: 600, color: C.textPrimary, flexShrink: 0 }}>
                {item.label}
              </label>
              <Input
                type="number" min={0} value={item.value || ""}
                onChange={e => item.setter(Number(e.target.value))}
                placeholder="0"
                style={{ flex: 1, minWidth: 0, textAlign: "center", fontWeight: 700, boxSizing: "border-box", padding: isMobile ? "8px 10px" : "11px 16px" }}
              />
              <span style={{ fontSize: 13, color: C.textMuted, flexShrink: 0, whiteSpace: "nowrap" }}>{item.unit}</span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  ) : null;

  const workerCard = (
    <Card>
      <CardHeader compact={isMobile}>
        <CardTitle icon="👥" compact={isMobile}>근무자 ({dayTypeKo} 기본)</CardTitle>
        <div style={{ display: "flex", gap: isMobile ? 6 : 8, flexShrink: 0 }}>
          <button
            onClick={() => addWorker("substitute")}
            style={{
              padding: isMobile ? "5px 8px" : "6px 12px", borderRadius: 8, fontSize: isMobile ? 11 : 12, fontWeight: 700,
              background: C.warningBg, color: C.warning, border: "none", cursor: "pointer", whiteSpace: "nowrap",
            }}
          >+ 대체</button>
          <button
            onClick={() => addWorker("hq")}
            style={{
              padding: isMobile ? "5px 8px" : "6px 12px", borderRadius: 8, fontSize: isMobile ? 11 : 12, fontWeight: 700,
              background: C.purpleBg, color: C.purple, border: "none", cursor: "pointer", whiteSpace: "nowrap",
            }}
          >+ 본사</button>
        </div>
      </CardHeader>
      <div style={{ padding: isMobile ? "8px 14px 10px" : "20px 24px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {assignedWorkers.length === 0 ? (
            <p style={{ textAlign: "center", color: C.textMuted, padding: isMobile ? "10px 0" : "20px 0", fontSize: isMobile ? 13 : 14 }}>
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
                    flex: 1, padding: isMobile ? "8px 10px" : "9px 12px", border: `1px solid ${C.border}`,
                    borderRadius: 8, fontSize: isMobile ? 13 : 14, background: "#fff", outline: "none",
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
      </div>
    </Card>
  );

  const memoCard = (
    <Card>
      <div style={{ padding: isMobile ? "10px 14px" : "14px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: isMobile ? 6 : 10 }}>
          <span>📝</span>
          <span style={{ fontSize: isMobile ? 13 : 16, fontWeight: 700 }}>메모</span>
        </div>
        <textarea
          value={memo}
          onChange={e => setMemo(e.target.value)}
          rows={isMobile ? 2 : 3}
          placeholder="특이사항 입력..."
          style={{
            width: "100%", padding: isMobile ? "8px 12px" : "12px 14px",
            border: `1px solid ${C.border}`, borderRadius: 10,
            fontSize: 14, resize: "none", outline: "none",
            fontFamily: "inherit", color: C.textPrimary,
            boxSizing: "border-box",
          }}
          onFocus={e => (e.target.style.borderColor = C.navy)}
          onBlur={e => (e.target.style.borderColor = C.border)}
        />
      </div>
    </Card>
  );

  const totalSummary = (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      marginTop: isMobile ? 14 : 20, paddingTop: isMobile ? 12 : 16,
      borderTop: `2px solid ${C.borderLight}`,
    }}>
      <span style={{ fontSize: isMobile ? 14 : 15, fontWeight: 700, color: C.textPrimary }}>총 입차량</span>
      <span style={{ fontSize: isMobile ? 22 : 28, fontWeight: 800, color: C.navy }}>
        {totalCars.toLocaleString()}
        <span style={{ fontSize: isMobile ? 13 : 16, fontWeight: 600, marginLeft: 4 }}>대</span>
      </span>
    </div>
  );

  return (
    <AppLayout>
      {/* ── 발렛 단가 토스트 ── */}
      {valetToast && (
        <div
          style={{
            position: "fixed",
            bottom: isMobile ? 140 : 32,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 9999,
            background: "#1A1D2B",
            color: "#fff",
            borderRadius: 14,
            padding: "14px 20px",
            boxShadow: "0 8px 32px rgba(0,0,0,0.25)",
            display: "flex",
            flexDirection: "column",
            gap: 8,
            minWidth: 280,
            maxWidth: 340,
            animation: "fadeInUp 0.25s ease",
          }}
        >
          <style>{`
            @keyframes fadeInUp {
              from { opacity: 0; transform: translateX(-50%) translateY(12px); }
              to   { opacity: 1; transform: translateX(-50%) translateY(0); }
            }
          `}</style>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 18 }}>💡</span>
            <span style={{ fontSize: 14, fontWeight: 700 }}>발렛 단가 변경 방법</span>
          </div>
          <div style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.6, paddingLeft: 26 }}>
            <b style={{ color: "#F5B731" }}>매장 관리</b> → 해당 매장 선택<br/>
            → <b style={{ color: "#F5B731" }}>방문지 관리</b> 탭 → 발렛비 수정
          </div>
          <button
            onClick={() => { setValetToast(false); router.push("/stores"); }}
            style={{
              marginTop: 4,
              background: "#1428A0",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "9px 0",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              width: "100%",
            }}
          >
            매장 관리로 이동 →
          </button>
        </div>
      )}

      <div style={{ maxWidth: isMobile ? "100%" : 1100, boxSizing: "border-box", width: "100%" }}>

        {/* ══ 모바일 레이아웃 ══ */}
        {isMobile ? (
          <>
            {/* 모바일 필터 바: 매장 + 날짜 + 요일뱃지 세로 배치 */}
            <div style={{
              background: "#fff", borderRadius: 14,
              border: `1px solid ${C.borderLight}`,
              padding: "14px 16px",
              marginBottom: 14,
              boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
            }}>
              {/* 매장 선택 */}
              <div style={{
                display: "flex", alignItems: "center", gap: 10,
                paddingBottom: 12, marginBottom: 12,
                borderBottom: `1px solid ${C.borderLight}`,
              }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: C.textMuted, flexShrink: 0, width: 40 }}>매장</span>
                <select
                  value={selectedStore} onChange={e => setSelectedStore(e.target.value)}
                  style={{
                    flex: 1, minWidth: 0,
                    border: `1px solid ${C.border}`, borderRadius: 10,
                    padding: "10px 14px", fontSize: 14, fontWeight: 600,
                    color: C.textPrimary, background: "#fff",
                    outline: "none", fontFamily: "inherit", cursor: "pointer",
                    overflow: "hidden", textOverflow: "ellipsis",
                  }}
                >
                  {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              {/* 날짜 + 요일 + 수정중 뱃지 */}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: C.textMuted, flexShrink: 0, width: 40 }}>날짜</span>
                <MeParkDatePicker value={selectedDate} onChange={setSelectedDate} compact style={{ flex: "1 1 auto", minWidth: 0, maxWidth: 200 }} />
                <span style={{
                  flexShrink: 0,
                  padding: "6px 12px", borderRadius: 20,
                  fontSize: 12, fontWeight: 700,
                  background: dayLabel.bg, color: dayLabel.color, whiteSpace: "nowrap",
                }}>
                  {dayLabel.label}
                </span>
                {existingRecordId && (
                  <span style={{
                    flexShrink: 0,
                    padding: "6px 10px", borderRadius: 20,
                    background: `${C.navy}10`, border: `1px solid ${C.navy}22`,
                    fontSize: 11, fontWeight: 700, color: C.navy, whiteSpace: "nowrap",
                  }}>
                    📋 수정중
                  </span>
                )}
              </div>
            </div>

            {/* 모바일 카드들: 1열 풀폭 */}
            {/* 입차량 — 헤더+입력 한줄 */}
            <Card style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", gap: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 1, minWidth: 0 }}>
                  <span>🚗</span>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>입차량</span>
                </div>
                <ToggleGroup
                  value={inputMode}
                  options={[{ id: "total", label: "총 대수" }, { id: "hourly", label: "시간대별" }]}
                  onChange={v => setInputMode(v as "total" | "hourly")}
                />
                {inputMode === "total" && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                    <Input
                      type="number" min={0} value={totalCarsOnly || ""}
                      onChange={e => setTotalCarsOnly(Number(e.target.value))}
                      placeholder="0"
                      style={{ width: 64, textAlign: "center", fontSize: 20, fontWeight: 800, color: C.navy, padding: "4px 6px", borderRadius: 8 }}
                    />
                    <span style={{ fontSize: 13, fontWeight: 700, color: C.textSecondary }}>대</span>
                  </div>
                )}
              </div>
              {inputMode === "hourly" && (
                <div style={{ padding: "0 14px 10px" }}>
                  {hourlyGrid}
                  <div style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    marginTop: 8, paddingTop: 8, borderTop: `1px solid ${C.borderLight}`,
                  }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: C.textPrimary }}>합계</span>
                    <span style={{ fontSize: 18, fontWeight: 800, color: C.navy }}>
                      {totalCars.toLocaleString()}<span style={{ fontSize: 12, fontWeight: 600, marginLeft: 3 }}>대</span>
                    </span>
                  </div>
                </div>
              )}
            </Card>

            {/* 발렛 */}
            {valetCard && <div style={{ marginBottom: 10 }}>{valetCard}</div>}

            {/* 근무자 */}
            <div style={{ marginBottom: 10 }}>{workerCard}</div>

            {/* 메모 */}
            <div style={{ marginBottom: 12 }}>{memoCard}</div>

            {/* 저장 버튼 — 인라인 (스크롤 내) */}
            <div style={{ marginBottom: 120 }}>
              <button
                onClick={handleSave} disabled={saving}
                style={{
                  width: "100%", padding: "14px 0", borderRadius: 14,
                  background: saving ? C.textMuted : `linear-gradient(135deg, ${C.navyDark}, ${C.navy})`,
                  color: "#fff", fontSize: 16, fontWeight: 700,
                  border: "none", cursor: saving ? "not-allowed" : "pointer",
                  boxShadow: saving ? "none" : "0 4px 14px rgba(20,40,160,0.25)",
                  letterSpacing: -0.3,
                }}
              >
                {saving ? "⏳ 저장 중..." : existingRecordId ? "✏️ 수정 저장" : "💾 저장"}
              </button>
            </div>
          </>
        ) : (
          /* ══ PC 레이아웃 (기존 유지) ══ */
          <>
            {/* 필터 바 */}
            <Card style={{ marginBottom: 24 }}>
              <CardBody style={{ padding: "16px 24px" }}>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 20 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: C.textMuted, marginBottom: 6 }}>매장 선택</label>
                    <Select value={selectedStore} onChange={e => setSelectedStore(e.target.value)} style={{ minWidth: 160 }}>
                      {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </Select>
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: C.textMuted, marginBottom: 6 }}>날짜</label>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <MeParkDatePicker value={selectedDate} onChange={setSelectedDate} style={{ width: 200 }} />
                      <span style={{ padding: "5px 14px", borderRadius: 20, fontSize: 12, fontWeight: 700, background: dayLabel.bg, color: dayLabel.color, whiteSpace: "nowrap" }}>
                        {dayLabel.label}
                      </span>
                    </div>
                  </div>
                  {existingRecordId && (
                    <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", borderRadius: 10, background: C.navyDark + "10", border: `1px solid ${C.navy}22` }}>
                      <span style={{ fontSize: 14, color: C.navy }}>📋</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: C.navy }}>기존 기록 수정 중</span>
                    </div>
                  )}
                </div>
              </CardBody>
            </Card>

            {/* 2열 그리드 */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 24 }}>
              {/* 입차량 */}
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
                      <label style={{ fontSize: 15, fontWeight: 700, color: C.textPrimary, whiteSpace: "nowrap" }}>총 입차량</label>
                      <Input
                        type="number" min={0} value={totalCarsOnly || ""}
                        onChange={e => setTotalCarsOnly(Number(e.target.value))}
                        placeholder="0"
                        style={{ width: 140, textAlign: "center", fontSize: 28, fontWeight: 800, color: C.navy, padding: "12px 16px" }}
                      />
                      <span style={{ fontSize: 16, fontWeight: 600, color: C.textSecondary }}>대</span>
                    </div>
                  ) : hourlyGrid}
                  {totalSummary}
                </CardBody>
              </Card>

              {/* 오른쪽 */}
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                {valetCard}
                {workerCard}
                {memoCard}
                <button
                  onClick={handleSave} disabled={saving}
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
            </div>
          </>
        )}
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
