// @ts-nocheck
"use client";
export const dynamic = 'force-dynamic';
import AppLayout from "@/components/layout/AppLayout";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { getOrgId } from "@/lib/utils/org";
import { showToast } from "@/lib/utils/toast";

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────
interface Store {
  id: string;
  name: string;
  region_city?: string;
  region_district?: string;
  road_address?: string;
  manager_name?: string;
  status?: string;
}
interface ParkingLot {
  id: string;
  store_id: string;
  name: string;
  lot_type: string; // internal/external
  parking_type: string[];
  road_address?: string;
  self_spaces: number;
  mechanical_normal: number;
  mechanical_suv: number;
  operating_days?: Record<string, boolean>;
  open_time?: string;
  close_time?: string;
}
interface VisitPlace {
  id: string;
  store_id: string;
  name: string;
  floor?: string;
  free_minutes: number;
  base_fee: number;
  base_minutes: number;
  extra_fee: number;
  daily_max: number;
  valet_fee: number;
  monthly_fee: number;
}
interface OperatingHours {
  id?: string;
  store_id: string;
  day_category: string;
  open_time: string;
  close_time: string;
}
interface Shift {
  id?: string;
  store_id: string;
  name: string;
  start_time: string;
  end_time: string;
  members?: string;
}
interface LateRule {
  id?: string;
  store_id: string;
  late_minutes: number;
  absent_minutes: number;
}

// ──────────────────────────────────────────────
// v3 색상 팔레트
// ──────────────────────────────────────────────
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
  bgPage: "#f8f9fb",
  bgCard: "#f4f5f7",
  bgHover: "#ecedf0",
  border: "#e2e4e9",
  borderLight: "#eef0f3",
  textPrimary: "#1a1d26",
  textSecondary: "#5c6370",
  textMuted: "#8b919d",
};

// ──────────────────────────────────────────────
// 공통 컴포넌트
// ──────────────────────────────────────────────
const Card = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
  <div style={{
    background: "#fff",
    borderRadius: 16,
    border: `1px solid ${C.borderLight}`,
    boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
    marginBottom: 20,
    ...style,
  }}>
    {children}
  </div>
);

const CardHeader = ({ children }: { children: React.ReactNode }) => (
  <div style={{
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 10,
    padding: "16px 20px",
    borderBottom: `1px solid ${C.borderLight}`,
  }}>
    {children}
  </div>
);

const CardTitle = ({ icon, children }: { icon: string; children: React.ReactNode }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 16, fontWeight: 700 }}>
    <span>{icon}</span>
    {children}
  </div>
);

const CardBody = ({ children, style, className }: { children: React.ReactNode; style?: React.CSSProperties; className?: string }) => (
  <div style={{ padding: "20px 24px", ...style }} className={className}>{children}</div>
);

const BtnPrimary = ({ onClick, children, style }: { onClick?: () => void; children: React.ReactNode; style?: React.CSSProperties }) => (
  <button
    onClick={onClick}
    style={{
      display: "inline-flex", alignItems: "center", gap: 8,
      padding: "10px 20px", borderRadius: 10, fontSize: 14, fontWeight: 600,
      background: C.navy, color: "#fff", border: "none", cursor: "pointer",
      ...style,
    }}
  >
    {children}
  </button>
);

const BtnGhost = ({ onClick, children, style }: { onClick?: () => void; children: React.ReactNode; style?: React.CSSProperties }) => (
  <button
    onClick={onClick}
    style={{
      display: "inline-flex", alignItems: "center", gap: 8,
      padding: "8px 14px", borderRadius: 8, fontSize: 13, fontWeight: 500,
      background: "transparent", color: C.textSecondary,
      border: `1px solid ${C.border}`, cursor: "pointer", whiteSpace: "nowrap",
      ...style,
    }}
  >
    {children}
  </button>
);

const BtnGold = ({ onClick, children, style }: { onClick?: () => void; children: React.ReactNode; style?: React.CSSProperties }) => (
  <button
    onClick={onClick}
    style={{
      display: "inline-flex", alignItems: "center", gap: 8,
      padding: "10px 20px", borderRadius: 10, fontSize: 14, fontWeight: 600,
      background: C.gold, color: C.navyDark, border: "none", cursor: "pointer",
      ...style,
    }}
  >
    {children}
  </button>
);

const Badge = ({
  children, variant = "default",
}: { children: React.ReactNode; variant?: "success" | "warning" | "error" | "muted" | "navy" | "default" }) => {
  const styles: Record<string, React.CSSProperties> = {
    success: { background: C.successBg, color: C.success },
    warning: { background: C.warningBg, color: C.warning },
    error: { background: C.errorBg, color: C.error },
    muted: { background: C.bgCard, color: C.textMuted },
    navy: { background: C.navy, color: "#fff" },
    default: { background: C.bgCard, color: C.textSecondary },
  };
  return (
    <span style={{
      display: "inline-flex", padding: "4px 12px", borderRadius: 6,
      fontSize: 12, fontWeight: 600, ...styles[variant],
    }}>
      {children}
    </span>
  );
};

const FormGroup = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div style={{ marginBottom: 20 }}>
    <label style={{ display: "block", fontSize: 14, fontWeight: 600, color: C.textPrimary, marginBottom: 8 }}>
      {label}
    </label>
    {children}
  </div>
);

const Input = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input
    {...props}
    style={{
      width: "100%", padding: "12px 16px", border: `1px solid ${C.border}`,
      borderRadius: 10, fontSize: 14, background: "#fff", outline: "none",
      ...props.style,
    }}
  />
);

const Select = (props: React.SelectHTMLAttributes<HTMLSelectElement>) => (
  <select
    {...props}
    style={{
      width: "100%", padding: "12px 16px", border: `1px solid ${C.border}`,
      borderRadius: 10, fontSize: 14, background: "#fff", outline: "none",
      ...props.style,
    }}
  />
);

const Table = ({ children }: { children: React.ReactNode }) => (
  <div style={{ overflowX: "auto" }}>
    <table style={{ width: "100%", borderCollapse: "collapse" }}>{children}</table>
  </div>
);

const Th = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
  <th style={{
    padding: "14px 16px", textAlign: "left",
    borderBottom: `1px solid ${C.borderLight}`,
    fontSize: 13, fontWeight: 600, color: C.textSecondary,
    background: C.bgCard, ...style,
  }}>
    {children}
  </th>
);

const Td = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
  <td style={{
    padding: "14px 16px", textAlign: "left",
    borderBottom: `1px solid ${C.borderLight}`,
    fontSize: 14, ...style,
  }}>
    {children}
  </td>
);

// ──────────────────────────────────────────────
// 섹션 헤더 컬러바
// ──────────────────────────────────────────────
const SectionHeader = ({
  icon, title, color = C.navy, actions,
}: { icon: string; title: string; color?: string; actions?: React.ReactNode }) => (
  <div style={{
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "14px 20px", borderLeft: `4px solid ${color}`,
    background: "#fff", borderRadius: "12px 12px 0 0",
    borderBottom: `1px solid ${C.borderLight}`,
  }}>
    <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 15, fontWeight: 700 }}>
      <span>{icon}</span> {title}
    </div>
    {actions && <div style={{ display: "flex", gap: 8 }}>{actions}</div>}
  </div>
);

// 주차장 필수 배너
const ParkingRequiredBanner = ({ onAdd }: { onAdd: () => void }) => (
  <div style={{
    background: `linear-gradient(135deg, ${C.navy} 0%, ${C.navyDark} 100%)`,
    borderRadius: 12, padding: "16px 20px", marginBottom: 16,
    display: "flex", alignItems: "center", justifyContent: "space-between",
  }}>
    <div style={{ display: "flex", alignItems: "center", gap: 12, color: "#fff" }}>
      <span style={{ fontSize: 24 }}>🅿️</span>
      <div>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>주차장을 등록해주세요!</div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.75)" }}>
          주차장이 없으면 대시보드 현황이 연동되지 않습니다
        </div>
      </div>
    </div>
    <button
      onClick={onAdd}
      style={{
        background: C.gold, color: C.navyDark, border: "none",
        borderRadius: 8, padding: "10px 20px", fontSize: 14, fontWeight: 700, cursor: "pointer",
      }}
    >
      + 주차장 추가
    </button>
  </div>
);

// ──────────────────────────────────────────────
// Modal
// ──────────────────────────────────────────────
const Modal = ({
  title, onClose, children, width = 560,
}: { title: string; onClose: () => void; children: React.ReactNode; width?: number }) => (
  <div style={{
    position: "fixed", inset: 0, zIndex: 1000,
    background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center",
  }}>
    <div style={{
      background: "#fff", borderRadius: 20, width, maxWidth: "95vw",
      maxHeight: "90vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
    }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "20px 24px", borderBottom: `1px solid ${C.borderLight}`,
      }}>
        <span style={{ fontSize: 17, fontWeight: 700 }}>{title}</span>
        <button
          onClick={onClose}
          style={{ border: "none", background: "none", fontSize: 20, cursor: "pointer", color: C.textMuted }}
        >
          ✕
        </button>
      </div>
      <div style={{ padding: 24 }}>{children}</div>
    </div>
  </div>
);

// ──────────────────────────────────────────────
// 메인 페이지
// ──────────────────────────────────────────────
export default function StoresPage() {
  const supabase = createClient();

  // 반응형 - CSS 클래스 기반으로 hydration 에러 방지
  // isMobile JS state 제거 → 아래 <style> CSS media query로 처리
  const [mounted, setMounted] = useState(false);

  // 탭
  const [mainTab, setMainTab] = useState<"list" | "hours" | "shifts" | "late-check">("list");

  // 모달 내 지역 선택 (early return 이전에 선언 - Rules of Hooks 준수)
  const [regionCity, setRegionCity] = useState("");

  // 데이터
  const [stores, setStores] = useState<Store[]>([]);
  const [parkingLots, setParkingLots] = useState<Record<string, ParkingLot[]>>({});
  const [visitPlaces, setVisitPlaces] = useState<Record<string, VisitPlace[]>>({});
  const [operatingHours, setOperatingHours] = useState<Record<string, OperatingHours[]>>({});
  const [shifts, setShifts] = useState<Record<string, Shift[]>>({});
  const [lateRules, setLateRules] = useState<Record<string, LateRule>>({});

  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [expandedStore, setExpandedStore] = useState<string | null>(null);
  const [expandedSection, setExpandedSection] = useState<Record<string, "visit" | "lot" | null>>({});
  const [loading, setLoading] = useState(true);

  // Modal 상태
  const [modalType, setModalType] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<Record<string, unknown> | null>(null);
  const [storeForAction, setStoreForAction] = useState<string | null>(null);

  // Form 상태
  const [storeForm, setStoreForm] = useState({
    name: "", region_city: "", region_district: "", road_address: "", manager_name: ""
  });
  const [lotForm, setLotForm] = useState({
    name: "", lot_type: "internal", parking_type: ["self"],
    road_address: "", self_spaces: 0, mechanical_normal: 0, mechanical_suv: 0
  });
  const [visitForm, setVisitForm] = useState({
    name: "", floor: "", free_minutes: 30, base_fee: 1000, base_minutes: 30,
    extra_fee: 500, daily_max: 0, valet_fee: 3000, monthly_fee: 150000
  });
  const [hourForm, setHourForm] = useState({ day_category: "weekday", open_time: "08:00", close_time: "22:00" });
  const [shiftForm, setShiftForm] = useState({ name: "오전조", start_time: "08:00", end_time: "14:00" });
  const [lateForm, setLateForm] = useState({ late_minutes: 5, absent_minutes: 30 });

  // 카카오 주소 API 스크립트 로드
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";
    script.async = true;
    document.head.appendChild(script);
    return () => { try { document.head.removeChild(script); } catch(e) {} };
  }, []);

  // 카카오 주소 검색 팝업
  const openAddressSearch = () => {
    if (!(window as any).daum?.Postcode) {
      alert("주소 검색 로딩 중입니다. 잠시 후 다시 시도해주세요.");
      return;
    }
    new (window as any).daum.Postcode({
      oncomplete: (data: any) => {
        const fullAddr = data.roadAddress || data.jibunAddress;
        const parts = fullAddr.split(" ");
        let city = parts[0] ?? "";
        const cityMap: Record<string, string> = {
          "서울특별시": "서울", "서울시": "서울",
          "인천광역시": "인천", "인천시": "인천",
          "경기도": "경기",
          "부산광역시": "부산", "대구광역시": "대구",
          "광주광역시": "광주", "대전광역시": "대전",
          "울산광역시": "울산", "세종특별자치시": "세종",
          "강원도": "강원", "강원특별자치도": "강원",
          "충청북도": "충북", "충청남도": "충남",
          "전라북도": "전북", "전북특별자치도": "전북",
          "전라남도": "전남", "경상북도": "경북",
          "경상남도": "경남", "제주특별자치도": "제주",
        };
        city = cityMap[city] ?? city;
        let district = "";
        for (let i = 1; i < parts.length; i++) {
          if (parts[i].endsWith("구") || parts[i].endsWith("군") ||
              (parts[i].endsWith("시") && i > 1)) {
            district = parts[i];
            break;
          }
        }
        setStoreForm(f => ({
          ...f,
          road_address: fullAddr,
          region_city: city,
          region_district: district,
        }));
      },
    }).open();
  };

  // ── 데이터 로드 ──
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => { loadData(); }, []);

  // 정상출근체크 폼 초기화: selectedStoreId 바뀔 때 (early return 이전에 선언 - Rules of Hooks 준수)
  useEffect(() => {
    if (!selectedStoreId) return;
    const rule = lateRules[selectedStoreId];
    if (rule) {
      setLateForm({ late_minutes: rule.late_minutes, absent_minutes: rule.absent_minutes });
    } else {
      setLateForm({ late_minutes: 5, absent_minutes: 30 });
    }
  }, [selectedStoreId, lateRules]);

  async function loadData() {
    setLoading(true);
    try {
    const oid = await getOrgId();

    const { data: storeData } = await supabase
      .from("stores").select("*").eq("org_id", oid).order("name");

    if (storeData) {
      setStores(storeData);
      if (storeData.length > 0 && !selectedStoreId) {
        setSelectedStoreId(storeData[0].id);
      }

      const storeIds = storeData.map((s: Store) => s.id);

      // 5개 테이블 병렬 조회
      const [
        { data: lotData },
        { data: visitData },
        { data: hourData },
        { data: shiftData },
        { data: ruleData },
      ] = await Promise.all([
        supabase.from("parking_lots").select("*").in("store_id", storeIds).order("name"),
        supabase.from("visit_places").select("*").in("store_id", storeIds).order("name"),
        supabase.from("store_operating_hours").select("*").in("store_id", storeIds),
        supabase.from("store_shifts").select("*").in("store_id", storeIds),
        supabase.from("store_late_rules").select("*").in("store_id", storeIds),
      ]);

      if (lotData) {
        const grouped: Record<string, ParkingLot[]> = {};
        lotData.forEach((lot: ParkingLot) => {
          if (!grouped[lot.store_id]) grouped[lot.store_id] = [];
          grouped[lot.store_id].push(lot);
        });
        setParkingLots(grouped);
      }

      if (visitData) {
        const grouped: Record<string, VisitPlace[]> = {};
        visitData.forEach((vp: VisitPlace) => {
          if (!grouped[vp.store_id]) grouped[vp.store_id] = [];
          grouped[vp.store_id].push(vp);
        });
        setVisitPlaces(grouped);
      }

      if (hourData) {
        const grouped: Record<string, OperatingHours[]> = {};
        hourData.forEach((h: OperatingHours) => {
          if (!grouped[h.store_id]) grouped[h.store_id] = [];
          grouped[h.store_id].push(h);
        });
        setOperatingHours(grouped);
      }

      if (shiftData) {
        const grouped: Record<string, Shift[]> = {};
        shiftData.forEach((sh: Shift) => {
          if (!grouped[sh.store_id]) grouped[sh.store_id] = [];
          grouped[sh.store_id].push(sh);
        });
        setShifts(grouped);
      }

      if (ruleData) {
        const mapped: Record<string, LateRule> = {};
        ruleData.forEach((r: LateRule) => { mapped[r.store_id] = r; });
        setLateRules(mapped);
      }
    }
    } catch (err) {
      console.error("[StoresPage] loadData 에러:", err);
    } finally {
      setLoading(false);
    }
  }
  // ── CRUD 핸들러 ──
  async function saveStore() {
    if (!storeForm.name.trim()) { alert("매장명을 입력해주세요."); return; }
    const oid = await getOrgId();
    if (!oid) { alert("로그인 정보를 불러오지 못했습니다. 새로고침 후 다시 시도해주세요."); return; }
    if (editingItem?.id) {
      const { error } = await supabase.from("stores").update({ ...storeForm }).eq("id", editingItem.id);
      if (error) { alert("수정 실패: " + error.message); return; }
    } else {
      const payload = { ...storeForm, org_id: oid };
      const { data, error } = await supabase.from("stores").insert(payload).select();
      if (error) { alert("저장 실패: " + error.message); return; }
      if (!data || data.length === 0) {
        alert("저장에 실패했습니다. (RLS 권한 오류)\norg_id: " + oid + "\n매장명: " + storeForm.name);
        return;
      }
    }
    showToast(editingItem?.id ? "✅ 매장이 수정되었습니다" : "✅ 매장이 추가되었습니다");
    setModalType(null);
    loadData();
  }

  async function deleteStore(id: string) {
    const lotsCount = parkingLots[id]?.length ?? 0;
    const msg = lotsCount > 0
      ? `${stores.find(s => s.id === id)?.name} 매장을 삭제하면 주차장 ${lotsCount}개도 함께 삭제됩니다. 계속하시겠습니까?`
      : `${stores.find(s => s.id === id)?.name} 매장을 삭제하시겠습니까?`;
    if (!confirm(msg)) return;
    const { error } = await supabase.from("stores").delete().eq("id", id);
    if (error) { alert("삭제 실패: " + error.message); return; }
    showToast("🗑️ 매장이 삭제되었습니다");
    loadData();
  }

  async function saveLot() {
    if (!lotForm.name.trim()) { alert("주차장명을 입력해주세요."); return; }
    const oid = await getOrgId();
    if (!oid) { alert("로그인 정보를 불러오지 못했습니다. 새로고침 후 다시 시도해주세요."); return; }
    if (editingItem?.id) {
      const { error } = await supabase.from("parking_lots").update({ ...lotForm }).eq("id", editingItem.id);
      if (error) { alert("수정 실패: " + error.message); return; }
    } else {
      const payload = { ...lotForm, store_id: storeForAction, org_id: oid };
      const { data, error } = await supabase.from("parking_lots").insert(payload).select();
      if (error) { alert("저장 실패: " + error.message); return; }
      if (!data || data.length === 0) {
        alert("저장에 실패했습니다. (RLS 권한 오류)\norg_id: " + oid + "\nstore_id: " + storeForAction);
        return;
      }
    }
    showToast(editingItem?.id ? "✅ 주차장이 수정되었습니다" : "✅ 주차장이 추가되었습니다");
    setModalType(null);
    loadData();
  }

  async function deleteLot(lotId: string, storeId: string) {
    const lotsForStore = parkingLots[storeId] ?? [];
    if (lotsForStore.length <= 1) {
      if (!confirm("마지막 주차장을 삭제하면 대시보드 주차장 현황이 표시되지 않습니다. 계속하시겠습니까?")) return;
    } else {
      if (!confirm("주차장을 삭제하시겠습니까?")) return;
    }
    const { error } = await supabase.from("parking_lots").delete().eq("id", lotId);
    if (error) { alert("삭제 실패: " + error.message); return; }
    showToast("🗑️ 주차장이 삭제되었습니다");
    loadData();
  }

  async function saveVisit() {
    const oid = await getOrgId();
    if (!oid) { alert("로그인 정보를 불러오지 못했습니다. 새로고침 후 다시 시도해주세요."); return; }
    let error: any;
    if (editingItem?.id) {
      ({ error } = await supabase.from("visit_places").update({ ...visitForm }).eq("id", editingItem.id));
    } else {
      ({ error } = await supabase.from("visit_places").insert({ ...visitForm, store_id: storeForAction, org_id: oid }));
    }
    if (error) { alert("저장 실패: " + error.message); return; }
    showToast(editingItem?.id ? "✅ 방문지가 수정되었습니다" : "✅ 방문지가 추가되었습니다");
    setModalType(null);
    loadData();
  }

  async function saveHours() {
    const oid = await getOrgId();
    if (!oid) { alert("로그인 정보를 불러오지 못했습니다. 새로고침 후 다시 시도해주세요."); return; }
    let error: any;
    if (editingItem?.id) {
      ({ error } = await supabase.from("store_operating_hours").update({ ...hourForm }).eq("id", editingItem.id));
    } else {
      ({ error } = await supabase.from("store_operating_hours").insert({ ...hourForm, store_id: selectedStoreId, org_id: oid }));
    }
    if (error) { alert("저장 실패: " + error.message); return; }
    showToast(editingItem?.id ? "✅ 운영시간이 수정되었습니다" : "✅ 운영시간이 추가되었습니다");
    setModalType(null);
    loadData();
  }

  async function saveShift() {
    const oid = await getOrgId();
    if (!oid) { alert("로그인 정보를 불러오지 못했습니다. 새로고침 후 다시 시도해주세요."); return; }
    let error: any;
    if (editingItem?.id) {
      ({ error } = await supabase.from("store_shifts").update({ ...shiftForm }).eq("id", editingItem.id));
    } else {
      ({ error } = await supabase.from("store_shifts").insert({ ...shiftForm, store_id: selectedStoreId, org_id: oid }));
    }
    if (error) { alert("저장 실패: " + error.message); return; }
    showToast(editingItem?.id ? "✅ 근무조가 수정되었습니다" : "✅ 근무조가 추가되었습니다");
    setModalType(null);
    loadData();
  }

  async function saveLateRule() {
    const oid = await getOrgId();
    if (!oid) { alert("로그인 정보를 불러오지 못했습니다. 새로고침 후 다시 시도해주세요."); return; }
    const existing = lateRules[selectedStoreId!];
    let error: any;
    if (existing?.id) {
      ({ error } = await supabase.from("store_late_rules").update({ ...lateForm }).eq("id", existing.id));
    } else {
      ({ error } = await supabase.from("store_late_rules").insert({ ...lateForm, store_id: selectedStoreId, org_id: oid }));
    }
    if (error) { alert("저장 실패: " + error.message); return; }
    showToast("✅ 정상출근 규칙이 저장되었습니다");
    setModalType(null);
    loadData();
  }

  // 주차장 총면수
  const totalSpaces = (lot: ParkingLot) =>
    (lot.self_spaces || 0) + (lot.mechanical_normal || 0) + (lot.mechanical_suv || 0);

  const LOT_TYPE_LABEL: Record<string, string> = { internal: "본관", external: "외부" };
  const PARKING_TYPE_LABEL: Record<string, string> = { self: "자주식", mechanical: "기계식" };
  const DAY_CAT_LABEL: Record<string, string> = {
    weekday: "평일", weekend: "주말", holiday: "공휴일", all: "전체",
  };
  const SHIFT_COLORS: Record<string, string> = {
    "오전조": C.warning, "오후조": C.success, "야간조": "#6366f1",
  };

  // ── 탭 헤더 ──
  // 매장 선택 드롭다운 (운영시간/근무조/출근체크 공통)
  if (loading) return (
    <AppLayout>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 400 }}>
        <div style={{ fontSize: 16, color: C.textMuted }}>⏳ 로딩 중...</div>
      </div>
    </AppLayout>
  );

  // ════════════════════════════════════════════
  // 탭 1: 매장 목록
  // ════════════════════════════════════════════
  const renderStoreList = () => (
    <>
      <Card>
        <CardHeader>
          <CardTitle icon="🏢">매장 목록 ({stores.length}개)</CardTitle>
          <BtnPrimary onClick={() => {
            setStoreForm({ name: "", region_city: "", region_district: "", road_address: "", manager_name: "" });
            setEditingItem(null);
            setModalType("store");
          }}>
            + 매장 추가
          </BtnPrimary>
        </CardHeader>
        <CardBody style={{ padding: 0 }} className="stores-card-body">
          {/* 모바일 카드 & 데스크톱 테이블 (CSS로 show/hide) */}
          <div className="stores-mobile-view" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {stores.map(store => {
                const lots = parkingLots[store.id] ?? [];
                const visits = visitPlaces[store.id] ?? [];
                const isExpanded = expandedStore === store.id;
                return (
                  <div key={store.id} style={{
                    background: "#fff", borderRadius: 20, boxShadow: "0 2px 12px rgba(20,40,160,0.07)",
                    overflow: "hidden",
                  }}>
                    <div
                      style={{ padding: "14px 16px", cursor: "pointer" }}
                      onClick={() => setExpandedStore(isExpanded ? null : store.id)}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
                            <span style={{ fontSize: 15, fontWeight: 700, color: C.textPrimary }}>{store.name}</span>
                            {lots.length === 0 && (
                              <span style={{
                                background: C.errorBg, color: C.error,
                                fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 4,
                              }}>⚠️ 주차장 필수</span>
                            )}
                          </div>
                          <div style={{ fontSize: 12, color: C.textSecondary, marginBottom: 4 }}>
                            {[store.region_city, store.region_district].filter(Boolean).join(" ") || "-"}
                            {store.road_address && <span style={{ marginLeft: 6 }}>· {store.road_address}</span>}
                          </div>
                          <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                            {lots.length > 0
                              ? <Badge variant="navy">🅿️ {lots.length}개</Badge>
                              : <Badge variant="error">⚠️ 주차장 미등록</Badge>}
                            {visits.length > 0 && <Badge variant="default">방문지 {visits.length}개</Badge>}
                            {store.manager_name && (
                              <span style={{ fontSize: 12, color: C.textMuted }}>👤 {store.manager_name}</span>
                            )}
                          </div>
                        </div>
                        <span style={{ fontSize: 18, color: C.textMuted, marginLeft: 8 }}>{isExpanded ? "▲" : "▼"}</span>
                      </div>
                    </div>
                    {/* 모바일 확장 액션 영역 */}
                    <div style={{
                      display: "flex", gap: 8, padding: "10px 16px 14px",
                      borderTop: `1px solid ${C.borderLight}`, background: "#fff",
                    }}>
                      <BtnGhost onClick={() => {
                        setStoreForm({
                          name: store.name, region_city: store.region_city ?? "",
                          region_district: store.region_district ?? "",
                          road_address: store.road_address ?? "", manager_name: store.manager_name ?? "",
                        });
                        setEditingItem(store as unknown as Record<string, unknown>);
                        setModalType("store");
                      }} style={{ flex: 1, padding: "8px", fontSize: 13 }}>✏️ 수정</BtnGhost>
                      <BtnGhost onClick={() => deleteStore(store.id)}
                        style={{ flex: 1, padding: "8px", fontSize: 13, color: C.error, borderColor: C.error + "44" }}>
                        🗑️ 삭제
                      </BtnGhost>
                    </div>
                  </div>
                );
              })}
            </div>
          <div className="stores-desktop-view">
            <Table>
              <thead>
                <tr>
                  <Th>매장명</Th>
                  <Th>지역</Th>
                  <Th>주소</Th>
                  <Th>담당자</Th>
                  <Th>주차장</Th>
                  <Th>방문지</Th>
                  <Th style={{ width: 120 }}>액션</Th>
                </tr>
              </thead>
              <tbody>
                {stores.map(store => {
                  const lots = parkingLots[store.id] ?? [];
                  const visits = visitPlaces[store.id] ?? [];
                  return (
                    <tr key={store.id} style={{ cursor: "pointer" }} onClick={() =>
                      setExpandedStore(expandedStore === store.id ? null : store.id)
                    }>
                      <Td>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <strong>{store.name}</strong>
                          {lots.length === 0 && (
                            <span style={{
                              background: C.errorBg, color: C.error,
                              fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 4,
                              border: `1px solid ${C.error}22`
                            }}>
                              ⚠️ 주차장 필수
                            </span>
                          )}
                        </div>
                      </Td>
                      <Td style={{ color: C.textSecondary }}>
                        {[store.region_city, store.region_district].filter(Boolean).join(" ") || "-"}
                      </Td>
                      <Td style={{ color: C.textSecondary, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {store.road_address || "-"}
                      </Td>
                      <Td>{store.manager_name || "-"}</Td>
                      <Td>
                        {lots.length > 0
                          ? <Badge variant="navy">🅿️ {lots.length}개</Badge>
                          : <Badge variant="error">⚠️ 미등록</Badge>}
                      </Td>
                      <Td>
                        {visits.length > 0
                          ? <Badge variant="default">{visits.length}개</Badge>
                          : <span style={{ color: C.textMuted }}>-</span>}
                      </Td>
                      <Td onClick={e => e.stopPropagation()}>
                        <div style={{ display: "flex", gap: 6 }}>
                          <BtnGhost onClick={() => {
                            setStoreForm({
                              name: store.name, region_city: store.region_city ?? "",
                              region_district: store.region_district ?? "",
                              road_address: store.road_address ?? "", manager_name: store.manager_name ?? "",
                            });
                            setEditingItem(store as unknown as Record<string, unknown>);
                            setModalType("store");
                          }} style={{ padding: "6px 14px", whiteSpace: "nowrap" }}>수정</BtnGhost>
                          <BtnGhost onClick={() => deleteStore(store.id)}
                            style={{ padding: "6px 14px", whiteSpace: "nowrap", color: C.error, borderColor: C.error + "44" }}>삭제</BtnGhost>
                        </div>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
            </div>
        </CardBody>
      </Card>

      {/* 확장: 매장 상세 (방문지 + 주차장) */}
      {stores.map(store => expandedStore === store.id && (
        <div key={`detail-${store.id}`} className="stores-detail-wrap">
          {/* 주차장 섹션 */}
          <div style={{ background: "#fff", borderRadius: 16, border: `1px solid ${C.borderLight}`, marginBottom: 16, overflow: "hidden" }}>
            <SectionHeader
              icon="🅿️" title={`주차장 관리 — ${store.name}`}
              color={C.gold}
              actions={
                <BtnGold onClick={() => {
                  setLotForm({ name: "", lot_type: "internal", parking_type: ["self"], road_address: store.road_address ?? "", self_spaces: 0, mechanical_normal: 0, mechanical_suv: 0 });
                  setEditingItem(null);
                  setStoreForAction(store.id);
                  setModalType("lot");
                }}>
                  + 주차장 추가
                </BtnGold>
              }
            />
            <div className="stores-section-pad">
              {(parkingLots[store.id]?.length ?? 0) === 0 && (
                <ParkingRequiredBanner onAdd={() => {
                  setLotForm({ name: "", lot_type: "internal", parking_type: ["self"], road_address: store.road_address ?? "", self_spaces: 0, mechanical_normal: 0, mechanical_suv: 0 });
                  setEditingItem(null);
                  setStoreForAction(store.id);
                  setModalType("lot");
                }} />
              )}
              {(parkingLots[store.id] ?? []).length > 0 && (
                <div className="stores-grid-auto" style={{ display: "grid", gap: 14 }}>
                  {( parkingLots[store.id] ?? [] ).map(lot => (
                    <div key={lot.id} style={{
                      background: C.bgCard, borderRadius: 12, padding: "16px 18px",
                      border: `1px solid ${C.borderLight}`, position: "relative",
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                        <div>
                          <div style={{ fontSize: 15, fontWeight: 700 }}>{lot.name}</div>
                          <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>
                            {LOT_TYPE_LABEL[lot.lot_type]} · {(lot.parking_type ?? []).map(t => PARKING_TYPE_LABEL[t]).join("+")}
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 4 }}>
                          <BtnGhost onClick={() => {
                            setLotForm({
                              name: lot.name, lot_type: lot.lot_type,
                              parking_type: lot.parking_type ?? ["self"],
                              road_address: lot.road_address ?? "",
                              self_spaces: lot.self_spaces, mechanical_normal: lot.mechanical_normal, mechanical_suv: lot.mechanical_suv,
                            });
                            setEditingItem(lot as unknown as Record<string, unknown>);
                            setStoreForAction(store.id);
                            setModalType("lot");
                          }} style={{ padding: "5px 8px", fontSize: 12 }}>수정</BtnGhost>
                          <BtnGhost onClick={() => deleteLot(lot.id, store.id)}
                            style={{ padding: "5px 8px", fontSize: 12, color: C.error }}>삭제</BtnGhost>
                        </div>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                        {[
                          { label: "자주식", value: lot.self_spaces },
                          { label: "일반기계", value: lot.mechanical_normal },
                          { label: "SUV기계", value: lot.mechanical_suv },
                        ].map(item => (
                          <div key={item.label} style={{ background: "#fff", borderRadius: 8, padding: "10px", textAlign: "center" }}>
                            <div style={{ fontSize: 20, fontWeight: 800, color: C.navy }}>{item.value}</div>
                            <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{item.label}</div>
                          </div>
                        ))}
                      </div>
                      <div style={{ marginTop: 10, textAlign: "right", fontSize: 13, fontWeight: 600, color: C.navy }}>
                        총 {totalSpaces(lot)}면
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 방문지 섹션 */}
          <div style={{ background: "#fff", borderRadius: 16, border: `1px solid ${C.borderLight}`, overflow: "hidden" }}>
            <SectionHeader
              icon="🏥" title={`방문지 관리 — ${store.name}`}
              color={C.navy}
              actions={
                <BtnPrimary onClick={() => {
                  setVisitForm({ name: "", floor: "", free_minutes: 30, base_fee: 1000, base_minutes: 30, extra_fee: 500, daily_max: 0, valet_fee: 3000, monthly_fee: 150000 });
                  setEditingItem(null);
                  setStoreForAction(store.id);
                  setModalType("visit");
                }}>
                  + 방문지 추가
                </BtnPrimary>
              }
            />
            <div className="stores-section-pad">
              {(visitPlaces[store.id] ?? []).length === 0 ? (
                <div style={{ textAlign: "center", color: C.textMuted, padding: "30px 0", fontSize: 14 }}>
                  등록된 방문지가 없습니다
                </div>
              ) : (<>
                {/* 모바일 카드 & 데스크톱 테이블 (CSS로 show/hide) */}
                <div className="stores-mobile-view" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {( visitPlaces[store.id] ?? [] ).map(vp => (
                    <div key={vp.id} style={{
                      background: "#fff", borderRadius: 18, padding: 16, boxShadow: "0 2px 10px rgba(20,40,160,0.07)",
                      borderLeft: `4px solid ${C.navy}`,
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                        <div>
                          <div style={{ fontSize: 15, fontWeight: 700, color: C.textPrimary }}>{vp.name}</div>
                          {vp.floor && <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>{vp.floor}</div>}
                        </div>
                        <div style={{ display: "flex", gap: 6 }}>
                          <BtnGhost onClick={() => {
                            setVisitForm({
                              name: vp.name, floor: vp.floor ?? "", free_minutes: vp.free_minutes,
                              base_fee: vp.base_fee, base_minutes: vp.base_minutes, extra_fee: vp.extra_fee,
                              daily_max: vp.daily_max, valet_fee: vp.valet_fee, monthly_fee: vp.monthly_fee,
                            });
                            setEditingItem(vp as unknown as Record<string, unknown>);
                            setStoreForAction(store.id);
                            setModalType("visit");
                          }} style={{ padding: "5px 10px", fontSize: 12 }}>수정</BtnGhost>
                          <BtnGhost onClick={async () => {
                            if (!confirm("방문지를 삭제하시겠습니까?")) return;
                            await supabase.from("visit_places").delete().eq("id", vp.id);
                            loadData();
                          }} style={{ padding: "5px 10px", fontSize: 12, color: C.error }}>삭제</BtnGhost>
                        </div>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        {[
                          { label: "무료", value: `${vp.free_minutes}분` },
                          { label: "기본요금", value: `₩${vp.base_fee.toLocaleString()}/${vp.base_minutes}분` },
                          { label: "추가요금", value: `₩${vp.extra_fee.toLocaleString()}/10분` },
                          { label: "발렛요금", value: `₩${vp.valet_fee.toLocaleString()}` },
                          { label: "월정기", value: `₩${vp.monthly_fee.toLocaleString()}` },
                          { label: "일일최대", value: vp.daily_max > 0 ? `₩${vp.daily_max.toLocaleString()}` : "제한없음" },
                        ].map(item => (
                          <div key={item.label} style={{ background: "#fff", borderRadius: 8, padding: "8px 12px" }}>
                            <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 2 }}>{item.label}</div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: C.textPrimary }}>{item.value}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="stores-desktop-view"><Table>
                  <thead>
                    <tr>
                      <Th>방문지명</Th>
                      <Th>층</Th>
                      <Th>무료(분)</Th>
                      <Th>기본요금</Th>
                      <Th>추가요금</Th>
                      <Th>발렛요금</Th>
                      <Th>월정기</Th>
                      <Th style={{ width: 100 }}>액션</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {( visitPlaces[store.id] ?? [] ).map(vp => (
                      <tr key={vp.id}>
                        <Td><strong>{vp.name}</strong></Td>
                        <Td style={{ color: C.textSecondary }}>{vp.floor || "-"}</Td>
                        <Td>{vp.free_minutes}분</Td>
                        <Td>₩{vp.base_fee.toLocaleString()} / {vp.base_minutes}분</Td>
                        <Td>₩{vp.extra_fee.toLocaleString()}</Td>
                        <Td>₩{vp.valet_fee.toLocaleString()}</Td>
                        <Td>₩{vp.monthly_fee.toLocaleString()}</Td>
                        <Td>
                          <div style={{ display: "flex", gap: 6 }}>
                            <BtnGhost onClick={() => {
                              setVisitForm({
                                name: vp.name, floor: vp.floor ?? "", free_minutes: vp.free_minutes,
                                base_fee: vp.base_fee, base_minutes: vp.base_minutes, extra_fee: vp.extra_fee,
                                daily_max: vp.daily_max, valet_fee: vp.valet_fee, monthly_fee: vp.monthly_fee,
                              });
                              setEditingItem(vp as unknown as Record<string, unknown>);
                              setStoreForAction(store.id);
                              setModalType("visit");
                            }} style={{ padding: "5px 8px", fontSize: 12 }}>수정</BtnGhost>
                            <BtnGhost onClick={async () => {
                              if (!confirm("방문지를 삭제하시겠습니까?")) return;
                              await supabase.from("visit_places").delete().eq("id", vp.id);
                              loadData();
                            }} style={{ padding: "5px 8px", fontSize: 12, color: C.error }}>삭제</BtnGhost>
                          </div>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </Table></div>
                </>)}
            </div>
          </div>
        </div>
      ))}
    </>
  );

  // ════════════════════════════════════════════
  // 탭 2: 운영시간
  // ════════════════════════════════════════════
  const renderHours = () => {
    const storeHours = operatingHours[selectedStoreId!] ?? [];
    return (
      <Card>
        <CardHeader>
          <CardTitle icon="🕐">운영시간 설정</CardTitle>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <select
              value={selectedStoreId ?? ""}
              onChange={e => setSelectedStoreId(e.target.value)}
              style={{
                padding: "8px 12px", border: `1px solid ${C.border}`,
                borderRadius: 8, fontSize: 14, background: "#fff",
                flex: "1 1 auto", maxWidth: "100%",
              }}
            >
              {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <BtnPrimary onClick={() => {
              setHourForm({ day_category: "weekday", open_time: "08:00", close_time: "22:00" });
              setEditingItem(null);
              setModalType("hours");
            }} style={{ whiteSpace: "nowrap", flexShrink: 0 }}>
              + 추가
            </BtnPrimary>
          </div>
        </CardHeader>
        <CardBody>
          {storeHours.length === 0 ? (
            <div style={{ textAlign: "center", color: C.textMuted, padding: "40px 0", fontSize: 14 }}>
              등록된 운영시간이 없습니다
            </div>
          ) : (
            <div className="stores-grid-auto" style={{ display: "grid", gap: 16 }}>
              {storeHours.map(h => (
                <div key={h.id} style={{
                  background: C.bgCard, borderRadius: 14, padding: 20,
                  borderLeft: `4px solid ${C.navy}`,
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>{DAY_CAT_LABEL[h.day_category]}</div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <BtnGhost onClick={() => {
                        setHourForm({ day_category: h.day_category, open_time: h.open_time, close_time: h.close_time });
                        setEditingItem(h as unknown as Record<string, unknown>);
                        setModalType("hours");
                      }} style={{ padding: "5px 8px", fontSize: 12 }}>수정</BtnGhost>
                      <BtnGhost onClick={async () => {
                        if (!confirm("삭제하시겠습니까?")) return;
                        await supabase.from("store_operating_hours").delete().eq("id", h.id);
                        loadData();
                      }} style={{ padding: "5px 8px", fontSize: 12, color: C.error }}>삭제</BtnGhost>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 10 }}>
                    {[
                      { label: "오픈", value: h.open_time, icon: "🌅" },
                      { label: "마감", value: h.close_time, icon: "🌙" },
                    ].map(item => (
                      <div key={item.label} style={{ flex: 1, background: "#fff", borderRadius: 10, padding: "12px", textAlign: "center" }}>
                        <div style={{ fontSize: 20 }}>{item.icon}</div>
                        <div style={{ fontSize: 20, fontWeight: 800, color: C.navy, marginTop: 4 }}>{item.value}</div>
                        <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{item.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    );
  };

  // ════════════════════════════════════════════
  // 탭 3: 근무조
  // ════════════════════════════════════════════
  const renderShifts = () => {
    const storeShifts = shifts[selectedStoreId!] ?? [];
    return (
      <Card>
        <CardHeader>
          <CardTitle icon="👷">근무조 설정</CardTitle>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <select
              value={selectedStoreId ?? ""}
              onChange={e => setSelectedStoreId(e.target.value)}
              style={{
                padding: "8px 12px", border: `1px solid ${C.border}`,
                borderRadius: 8, fontSize: 14, background: "#fff",
                maxWidth: "100%", flex: "1 1 auto",
              }}
            >
              {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <BtnPrimary onClick={() => {
              setShiftForm({ name: "오전조", start_time: "08:00", end_time: "14:00" });
              setEditingItem(null);
              setModalType("shifts");
            }} style={{ whiteSpace: "nowrap", flexShrink: 0 }}>
              + 근무조 추가
            </BtnPrimary>
          </div>
        </CardHeader>
        <CardBody>
          {storeShifts.length === 0 ? (
            <div style={{ textAlign: "center", color: C.textMuted, padding: "40px 0", fontSize: 14 }}>
              등록된 근무조가 없습니다
            </div>
          ) : (
            <div className="stores-grid-3col" style={{ display: "grid", gap: 16 }}>
              {storeShifts.map(sh => (
                <div key={sh.id} style={{
                  background: C.bgCard, borderRadius: 14, padding: 20,
                  borderLeft: `4px solid ${SHIFT_COLORS[sh.name] ?? C.navy}`,
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                    <div style={{ fontSize: 17, fontWeight: 700 }}>{sh.name}</div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <BtnGhost onClick={() => {
                        setShiftForm({ name: sh.name, start_time: sh.start_time, end_time: sh.end_time });
                        setEditingItem(sh as unknown as Record<string, unknown>);
                        setModalType("shifts");
                      }} style={{ padding: "5px 8px", fontSize: 12 }}>수정</BtnGhost>
                      <BtnGhost onClick={async () => {
                        if (!confirm("삭제하시겠습니까?")) return;
                        await supabase.from("store_shifts").delete().eq("id", sh.id);
                        loadData();
                      }} style={{ padding: "5px 8px", fontSize: 12, color: C.error }}>삭제</BtnGhost>
                    </div>
                  </div>
                  <div style={{ fontSize: 18, color: C.textSecondary, marginBottom: 10 }}>
                    🕐 {sh.start_time} ~ {sh.end_time}
                  </div>
                  {sh.members && (
                    <div style={{ fontSize: 13, color: C.textMuted }}>👤 {sh.members}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    );
  };

  // ════════════════════════════════════════════
  // 탭 4: 정상출근체크
  // ════════════════════════════════════════════
  const renderLateCheck = () => {
    const rule = lateRules[selectedStoreId!];
    const currentLate = rule?.late_minutes ?? 5;
    const currentAbsent = rule?.absent_minutes ?? 30;
    return (
      <Card>
        <CardHeader>
          <CardTitle icon="⏰">정상출근 체크 규칙</CardTitle>
          <select
            value={selectedStoreId ?? ""}
            onChange={e => setSelectedStoreId(e.target.value)}
            style={{
              padding: "8px 12px", border: `1px solid ${C.border}`,
              borderRadius: 8, fontSize: 14, background: "#fff",
              flex: "1 1 auto", maxWidth: "100%",
            }}
          >
            {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </CardHeader>
        <CardBody>
          <div style={{ maxWidth: 520 }}>
            <FormGroup label="지각 기준 (분)">
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <Input
                  type="number" value={lateForm.late_minutes}
                  onChange={e => setLateForm(f => ({ ...f, late_minutes: Number(e.target.value) }))}
                  style={{ width: 120 }}
                />
                <span style={{ fontSize: 13, color: C.textMuted }}>
                  출근시간 기준 {lateForm.late_minutes}분 후부터 지각 처리
                </span>
              </div>
            </FormGroup>
            <FormGroup label="결근 처리 시간 (분)">
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <Input
                  type="number" value={lateForm.absent_minutes}
                  onChange={e => setLateForm(f => ({ ...f, absent_minutes: Number(e.target.value) }))}
                  style={{ width: 120 }}
                />
                <span style={{ fontSize: 13, color: C.textMuted }}>
                  출근시간 기준 {lateForm.absent_minutes}분 후 출근기록 없으면 결근
                </span>
              </div>
            </FormGroup>

            {rule && (
              <div style={{
                background: C.bgCard, borderRadius: 12, padding: 16, marginBottom: 20,
                fontSize: 13, color: C.textSecondary,
              }}>
                <div style={{ fontWeight: 600, marginBottom: 8, color: C.textPrimary }}>📋 현재 저장된 설정</div>
                <div>지각 기준: <strong>{currentLate}분</strong></div>
                <div>결근 기준: <strong>{currentAbsent}분</strong></div>
              </div>
            )}

            <BtnPrimary onClick={() => {
              if (!selectedStoreId) return;
              saveLateRule();
            }}>
              💾 설정 저장
            </BtnPrimary>
          </div>
        </CardBody>
      </Card>
    );
  };

  // ════════════════════════════════════════════
  // Modals
  // ════════════════════════════════════════════
  const REGIONS: Record<string, string[]> = {
    "서울": ["강남구", "강서구", "송파구", "마포구", "서초구", "강동구", "영등포구", "중구", "종로구"],
    "인천": ["부평구", "남동구", "연수구", "서구", "계양구", "미추홀구", "중구", "강화군"],
    "경기": ["수원시", "성남시", "고양시", "용인시", "부천시", "안산시", "안양시", "남양주시"],
  };

  const renderModal = () => {
    if (!modalType) return null;

    if (modalType === "store") return (
      <Modal title={editingItem ? "매장 수정" : "매장 추가"} onClose={() => setModalType(null)}>
        <div className="stores-grid-2col" style={{ display: "grid", gap: 16 }}>
          <FormGroup label="매장명">
            <Input value={storeForm.name} onChange={e => setStoreForm(f => ({ ...f, name: e.target.value }))} />
          </FormGroup>
          <FormGroup label="담당자">
            <Input value={storeForm.manager_name} onChange={e => setStoreForm(f => ({ ...f, manager_name: e.target.value }))} />
          </FormGroup>
        </div>
        <FormGroup label="도로명주소">
          <div style={{ display: "flex", gap: 8 }}>
            <input
              readOnly
              value={storeForm.road_address}
              placeholder="🔍 아래 버튼으로 주소를 검색해주세요"
              onClick={openAddressSearch}
              style={{
                flex: 1, padding: "10px 14px", border: `1.5px solid ${C.border}`,
                borderRadius: 8, fontSize: 14, background: "#f8f9fc",
                cursor: "pointer", color: storeForm.road_address ? C.textPrimary : C.textMuted,
                outline: "none",
              }}
            />
            <button
              type="button"
              onClick={openAddressSearch}
              style={{
                padding: "10px 16px", background: C.navy, color: "#fff",
                border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700,
                cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
              }}
            >
              주소 검색
            </button>
          </div>
        </FormGroup>
        <div className="stores-grid-2col" style={{ display: "grid", gap: 16 }}>
          <FormGroup label="시/도">
            <div style={{
              padding: "10px 14px", border: `1.5px solid ${C.borderLight}`,
              borderRadius: 8, fontSize: 14, background: "#f0f2f8",
              color: storeForm.region_city ? C.textPrimary : C.textMuted,
              minHeight: 42,
            }}>
              {storeForm.region_city || "주소 검색 시 자동입력"}
            </div>
          </FormGroup>
          <FormGroup label="구/시">
            <div style={{
              padding: "10px 14px", border: `1.5px solid ${C.borderLight}`,
              borderRadius: 8, fontSize: 14, background: "#f0f2f8",
              color: storeForm.region_district ? C.textPrimary : C.textMuted,
              minHeight: 42,
            }}>
              {storeForm.region_district || "주소 검색 시 자동입력"}
            </div>
          </FormGroup>
        </div>
        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 8 }}>
          <BtnGhost onClick={() => setModalType(null)}>취소</BtnGhost>
          <BtnPrimary onClick={saveStore}>
            {editingItem ? "수정 완료" : "매장 추가"}
          </BtnPrimary>
        </div>
      </Modal>
    );

    if (modalType === "lot") return (
      <Modal title={editingItem ? "주차장 수정" : "주차장 추가"} onClose={() => setModalType(null)}>
        <FormGroup label="주차장명">
          <Input value={lotForm.name} onChange={e => setLotForm(f => ({ ...f, name: e.target.value }))} placeholder="예: 본관 지하 1층" />
        </FormGroup>
        <div className="stores-grid-2col" style={{ display: "grid", gap: 16 }}>
          <FormGroup label="위치 구분">
            <Select value={lotForm.lot_type} onChange={e => setLotForm(f => ({ ...f, lot_type: e.target.value }))}>
              <option value="internal">본관</option>
              <option value="external">외부</option>
            </Select>
          </FormGroup>
          <FormGroup label="주차 방식">
            <div style={{ display: "flex", gap: 16, marginTop: 4 }}>
              {["self", "mechanical"].map(pt => (
                <label key={pt} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={lotForm.parking_type.includes(pt)}
                    onChange={e => {
                      setLotForm(f => ({
                        ...f,
                        parking_type: e.target.checked
                          ? [...f.parking_type, pt]
                          : f.parking_type.filter(t => t !== pt),
                      }));
                    }}
                  />
                  {PARKING_TYPE_LABEL[pt]}
                </label>
              ))}
            </div>
          </FormGroup>
        </div>
        <FormGroup label="주소">
          <Input value={lotForm.road_address} onChange={e => setLotForm(f => ({ ...f, road_address: e.target.value }))} />
        </FormGroup>
        <div className="stores-grid-3col" style={{ display: "grid", gap: 12 }}>
          <FormGroup label="자주식 (면)">
            <Input type="number" value={lotForm.self_spaces}
              onChange={e => setLotForm(f => ({ ...f, self_spaces: Number(e.target.value) }))} />
          </FormGroup>
          <FormGroup label="기계식 일반 (면)">
            <Input type="number" value={lotForm.mechanical_normal}
              onChange={e => setLotForm(f => ({ ...f, mechanical_normal: Number(e.target.value) }))} />
          </FormGroup>
          <FormGroup label="기계식 SUV (면)">
            <Input type="number" value={lotForm.mechanical_suv}
              onChange={e => setLotForm(f => ({ ...f, mechanical_suv: Number(e.target.value) }))} />
          </FormGroup>
        </div>
        <div style={{
          background: C.bgCard, borderRadius: 10, padding: "12px 16px",
          fontSize: 13, color: C.textSecondary, marginBottom: 20,
        }}>
          총면수: <strong style={{ color: C.navy, fontSize: 16 }}>
            {lotForm.self_spaces + lotForm.mechanical_normal + lotForm.mechanical_suv}면
          </strong>
        </div>
        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
          <BtnGhost onClick={() => setModalType(null)}>취소</BtnGhost>
          <BtnPrimary onClick={saveLot}>{editingItem ? "수정 완료" : "주차장 추가"}</BtnPrimary>
        </div>
      </Modal>
    );

    if (modalType === "visit") return (
      <Modal title={editingItem ? "방문지 수정" : "방문지 추가"} onClose={() => setModalType(null)}>
        <div className="stores-grid-2col" style={{ display: "grid", gap: 16 }}>
          <FormGroup label="방문지명">
            <Input value={visitForm.name} onChange={e => setVisitForm(f => ({ ...f, name: e.target.value }))} placeholder="예: 1층 내과" />
          </FormGroup>
          <FormGroup label="층">
            <Input value={visitForm.floor} onChange={e => setVisitForm(f => ({ ...f, floor: e.target.value }))} placeholder="예: B1, 1F" />
          </FormGroup>
        </div>
        <div className="stores-grid-2col" style={{ display: "grid", gap: 16 }}>
          <FormGroup label="무료 주차 (분)">
            <Input type="number" value={visitForm.free_minutes}
              onChange={e => setVisitForm(f => ({ ...f, free_minutes: Number(e.target.value) }))} />
          </FormGroup>
          <FormGroup label="기본 요금 (원)">
            <Input type="number" value={visitForm.base_fee}
              onChange={e => setVisitForm(f => ({ ...f, base_fee: Number(e.target.value) }))} />
          </FormGroup>
          <FormGroup label="기본 시간 (분)">
            <Input type="number" value={visitForm.base_minutes}
              onChange={e => setVisitForm(f => ({ ...f, base_minutes: Number(e.target.value) }))} />
          </FormGroup>
          <FormGroup label="추가 요금 (원/분)">
            <Input type="number" value={visitForm.extra_fee}
              onChange={e => setVisitForm(f => ({ ...f, extra_fee: Number(e.target.value) }))} />
          </FormGroup>
          <FormGroup label="일 최대 요금 (0=무제한)">
            <Input type="number" value={visitForm.daily_max}
              onChange={e => setVisitForm(f => ({ ...f, daily_max: Number(e.target.value) }))} />
          </FormGroup>
          <FormGroup label="발렛 요금 (원)">
            <Input type="number" value={visitForm.valet_fee}
              onChange={e => setVisitForm(f => ({ ...f, valet_fee: Number(e.target.value) }))} />
          </FormGroup>
        </div>
        <FormGroup label="월정기 요금 (원)">
          <Input type="number" value={visitForm.monthly_fee}
            onChange={e => setVisitForm(f => ({ ...f, monthly_fee: Number(e.target.value) }))} />
        </FormGroup>
        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
          <BtnGhost onClick={() => setModalType(null)}>취소</BtnGhost>
          <BtnPrimary onClick={saveVisit}>{editingItem ? "수정 완료" : "방문지 추가"}</BtnPrimary>
        </div>
      </Modal>
    );

    if (modalType === "hours") return (
      <Modal title={editingItem ? "운영시간 수정" : "운영시간 추가"} onClose={() => setModalType(null)} width={420}>
        <FormGroup label="요일 구분">
          <Select value={hourForm.day_category} onChange={e => setHourForm(f => ({ ...f, day_category: e.target.value }))}>
            <option value="weekday">평일</option>
            <option value="weekend">주말</option>
            <option value="holiday">공휴일</option>
            <option value="all">전체</option>
          </Select>
        </FormGroup>
        <div className="stores-grid-2col" style={{ display: "grid", gap: 16 }}>
          <FormGroup label="오픈 시간">
            <Input type="time" value={hourForm.open_time} onChange={e => setHourForm(f => ({ ...f, open_time: e.target.value }))} />
          </FormGroup>
          <FormGroup label="마감 시간">
            <Input type="time" value={hourForm.close_time} onChange={e => setHourForm(f => ({ ...f, close_time: e.target.value }))} />
          </FormGroup>
        </div>
        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
          <BtnGhost onClick={() => setModalType(null)}>취소</BtnGhost>
          <BtnPrimary onClick={saveHours}>{editingItem ? "수정 완료" : "추가"}</BtnPrimary>
        </div>
      </Modal>
    );

    if (modalType === "shifts") return (
      <Modal title={editingItem ? "근무조 수정" : "근무조 추가"} onClose={() => setModalType(null)} width={420}>
        <FormGroup label="근무조 이름">
          <Input value={shiftForm.name} onChange={e => setShiftForm(f => ({ ...f, name: e.target.value }))} placeholder="예: 오전조, 오후조, 야간조" />
        </FormGroup>
        <div className="stores-grid-2col" style={{ display: "grid", gap: 16 }}>
          <FormGroup label="시작 시간">
            <Input type="time" value={shiftForm.start_time} onChange={e => setShiftForm(f => ({ ...f, start_time: e.target.value }))} />
          </FormGroup>
          <FormGroup label="종료 시간">
            <Input type="time" value={shiftForm.end_time} onChange={e => setShiftForm(f => ({ ...f, end_time: e.target.value }))} />
          </FormGroup>
        </div>
        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
          <BtnGhost onClick={() => setModalType(null)}>취소</BtnGhost>
          <BtnPrimary onClick={saveShift}>{editingItem ? "수정 완료" : "추가"}</BtnPrimary>
        </div>
      </Modal>
    );

    return null;
  };

  // ════════════════════════════════════════════
  // Render
  // ════════════════════════════════════════════
  return (
    <AppLayout>
    <style>{`
      .stores-tab-bar {
        display: flex; gap: 4px; background: ${C.bgCard}; padding: 4px;
        border-radius: 10px; margin-bottom: 24px;
        width: fit-content; overflow-x: visible;
      }
      .stores-tab-btn {
        padding: 10px 16px; border-radius: 8px; font-size: 13px; font-weight: 500;
        border: none; cursor: pointer; transition: background 0.15s, color 0.15s, box-shadow 0.15s;
        white-space: nowrap; flex-shrink: 0;
      }
      .stores-tab-btn:hover:not(.active) {
        background: rgba(20, 40, 160, 0.07) !important;
        color: ${C.navy} !important;
      }
      .stores-tab-btn:active:not(.active) {
        background: rgba(20, 40, 160, 0.14) !important;
        transform: scale(0.97);
      }
      .stores-tab-btn.active {
        background: #fff; color: ${C.textPrimary};
        box-shadow: 0 1px 2px rgba(0,0,0,0.04);
        font-weight: 700;
      }
      .stores-card-body > div { padding: 0; }
      .stores-mobile-view { display: none !important; }
      .stores-desktop-view { display: block; }
      .stores-detail-wrap { margin-top: -8px; margin-bottom: 20px; }
      .stores-section-pad { padding: 20px 24px; }
      .stores-grid-auto { grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); }
      .stores-grid-2col { grid-template-columns: 1fr 1fr; }
      .stores-grid-3col { grid-template-columns: repeat(3, 1fr); }
      @media (max-width: 767px) {
        .stores-tab-bar { width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch; }
        .stores-card-body > div { padding: 16px; }
        .stores-mobile-view { display: flex !important; }
        .stores-desktop-view { display: none !important; }
        .stores-detail-wrap { margin-top: 8px; }
        .stores-section-pad { padding: 16px; }
        .stores-grid-auto { grid-template-columns: 1fr; }
        .stores-grid-2col { grid-template-columns: 1fr; }
        .stores-grid-3col { grid-template-columns: 1fr; }
      }
    `}</style>
    <div style={{ background: C.bgPage, minHeight: "100vh" }}>
      <div className="stores-tab-bar">
        {[
          { id: "list", label: "매장 목록" },
          { id: "hours", label: "운영시간" },
          { id: "shifts", label: "근무조" },
          { id: "late-check", label: "정상출근체크" },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setMainTab(t.id as typeof mainTab)}
            className={`stores-tab-btn${mainTab === t.id ? " active" : ""}`}
            style={{
              color: mainTab === t.id ? C.textPrimary : C.textSecondary,
              background: mainTab === t.id ? "#fff" : "transparent",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
      {mainTab === "list" && renderStoreList()}
      {mainTab === "hours" && renderHours()}
      {mainTab === "shifts" && renderShifts()}
      {mainTab === "late-check" && renderLateCheck()}
      {renderModal()}
    </div>
    </AppLayout>
  );
}