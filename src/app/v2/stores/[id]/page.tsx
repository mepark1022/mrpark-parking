// @ts-nocheck
"use client";
export const dynamic = "force-dynamic";

/**
 * 사업장 상세 + 주차장(면수) + 방문지 요금표 관리 v2 — GAP-P0-1 / 1B·1C
 *
 * 경로: /v2/stores/[id]
 *
 * API (모두 기존, SQL 변경 없음):
 *   GET    /api/v1/stores/:id                     상세(parking_lots·visit_places·staff_count 동봉)
 *   GET    /api/v1/stores/:id/parking-lots        주차장 목록 + 면수 summary
 *   POST   /api/v1/stores/:id/parking-lots        주차장 등록
 *   PUT    /api/v1/parking-lots/:lotId            주차장 수정
 *   DELETE /api/v1/parking-lots/:lotId            주차장 삭제
 *   GET    /api/v1/stores/:id/visit-places        방문지 목록           ← 1C
 *   POST   /api/v1/stores/:id/visit-places        방문지 등록           ← 1C
 *   PUT    /api/v1/visit-places/:vpId             방문지 수정           ← 1C
 *   DELETE /api/v1/visit-places/:vpId             방문지 삭제           ← 1C
 *
 * ⚠️ 면수 = self_spaces + mechanical_normal + mechanical_suv (stores.total_spaces 사용 금지)
 * 운영시간·근무조·지각규칙은 1D(후순위)에서.
 *
 * 레이아웃: /v2/layout.tsx 가 AppLayout(Sidebar+Header+MobileTabBar) 자동 적용
 */

import { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const NAVY = "#1428A0";
const GOLD = "#F5B731";

// 주차장 폼 기본값
const EMPTY_LOT = {
  name: "",
  lot_type: "internal" as "internal" | "external", // 내부(직영) / 외부(제휴)
  parking_type: ["self"] as string[],              // self(자주식) / mechanical(기계식)
  road_address: "",
  self_spaces: 0,
  mechanical_normal: 0,
  mechanical_suv: 0,
};

// 면수 계산 (단일 주차장)
function lotSpaces(l: any): number {
  return (l.self_spaces || 0) + (l.mechanical_normal || 0) + (l.mechanical_suv || 0);
}

// 방문지 요금 폼 기본값 (레거시 stores 폼과 동일)
const EMPTY_VP = {
  name: "",
  floor: "",
  free_minutes: 30,
  base_fee: 1000,
  base_minutes: 30,
  extra_fee: 500,
  daily_max: 0,
  valet_fee: 3000,
  monthly_fee: 150000,
};

// 원화 표기
function won(n: any): string {
  return `${Number(n || 0).toLocaleString("ko-KR")}원`;
}

export default function StoreDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [store, setStore] = useState<any>(null);
  const [lots, setLots] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // 주차장 모달
  const [showModal, setShowModal] = useState(false);
  const [editingLot, setEditingLot] = useState<any>(null); // null = 신규
  const [form, setForm] = useState({ ...EMPTY_LOT });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // 방문지(visit_places)
  const [vplaces, setVplaces] = useState<any[]>([]);
  const [showVPModal, setShowVPModal] = useState(false);
  const [editingVP, setEditingVP] = useState<any>(null); // null = 신규
  const [vpForm, setVpForm] = useState({ ...EMPTY_VP });
  const [vpSaving, setVpSaving] = useState(false);
  const [vpError, setVpError] = useState("");

  // ── 상세 + 주차장 로드 ──
  const loadStore = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/stores/${id}`, { credentials: "include" });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        setError(json?.error?.message || "사업장 정보를 불러오지 못했습니다");
        return false;
      }
      setStore(json.data);
      return true;
    } catch {
      setError("네트워크 오류가 발생했습니다");
      return false;
    }
  }, [id]);

  const loadLots = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/stores/${id}/parking-lots`, { credentials: "include" });
      const json = await res.json();
      if (res.ok && json?.success) {
        setLots(json.data?.lots ?? []);
        setSummary(json.data?.summary ?? null);
      }
    } catch {
      /* 주차장 조회 실패는 상세 표시를 막지 않음 */
    }
  }, [id]);

  const loadVisitPlaces = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/stores/${id}/visit-places`, { credentials: "include" });
      const json = await res.json();
      if (res.ok && json?.success) {
        setVplaces(Array.isArray(json.data) ? json.data : []);
      }
    } catch {
      /* 방문지 조회 실패는 상세 표시를 막지 않음 */
    }
  }, [id]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError("");
    const okStore = await loadStore();
    if (okStore) {
      await loadLots();
      await loadVisitPlaces();
    }
    setLoading(false);
  }, [loadStore, loadLots, loadVisitPlaces]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── 주차장 모달 ──
  const openNewLot = () => {
    setEditingLot(null);
    setForm({ ...EMPTY_LOT });
    setFormError("");
    setShowModal(true);
  };
  const openEditLot = (l: any) => {
    setEditingLot(l);
    setForm({
      name: l.name ?? "",
      lot_type: l.lot_type === "external" ? "external" : "internal",
      parking_type: Array.isArray(l.parking_type) && l.parking_type.length ? l.parking_type : ["self"],
      road_address: l.road_address ?? "",
      self_spaces: l.self_spaces ?? 0,
      mechanical_normal: l.mechanical_normal ?? 0,
      mechanical_suv: l.mechanical_suv ?? 0,
    });
    setFormError("");
    setShowModal(true);
  };

  const setF = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));
  const toggleType = (t: string) =>
    setForm(f => {
      const has = f.parking_type.includes(t);
      let next = has ? f.parking_type.filter(x => x !== t) : [...f.parking_type, t];
      if (next.length === 0) next = [t]; // 최소 1개 유지
      return { ...f, parking_type: next };
    });

  // ── 저장(등록/수정) ──
  const save = async () => {
    if (!form.name.trim()) { setFormError("주차장 이름을 입력하세요"); return; }
    const isSelf = form.parking_type.includes("self");
    const isMech = form.parking_type.includes("mechanical");
    // 선택 안 한 유형의 면수는 0으로 정리
    const payload = {
      name: form.name.trim(),
      lot_type: form.lot_type,
      parking_type: form.parking_type,
      road_address: form.road_address.trim() || null,
      self_spaces: isSelf ? Number(form.self_spaces) || 0 : 0,
      mechanical_normal: isMech ? Number(form.mechanical_normal) || 0 : 0,
      mechanical_suv: isMech ? Number(form.mechanical_suv) || 0 : 0,
    };

    setSaving(true);
    setFormError("");
    try {
      const url = editingLot
        ? `/api/v1/parking-lots/${editingLot.id}`
        : `/api/v1/stores/${id}/parking-lots`;
      const method = editingLot ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        setFormError(json?.error?.message || "저장에 실패했습니다");
        return;
      }
      setShowModal(false);
      await loadLots();
    } catch {
      setFormError("네트워크 오류가 발생했습니다");
    } finally {
      setSaving(false);
    }
  };

  // ── 삭제 ──
  const removeLot = async (l: any) => {
    if (!confirm(`'${l.name}' 주차장을 삭제할까요?\n등록된 면수 정보가 함께 삭제됩니다.`)) return;
    try {
      const res = await fetch(`/api/v1/parking-lots/${l.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        alert(json?.error?.message || "삭제에 실패했습니다");
        return;
      }
      await loadLots();
    } catch {
      alert("네트워크 오류가 발생했습니다");
    }
  };

  // ── 방문지 모달 ──
  const openNewVP = () => {
    setEditingVP(null);
    setVpForm({ ...EMPTY_VP });
    setVpError("");
    setShowVPModal(true);
  };
  const openEditVP = (vp: any) => {
    setEditingVP(vp);
    setVpForm({
      name: vp.name ?? "",
      floor: vp.floor ?? "",
      free_minutes: vp.free_minutes ?? 0,
      base_fee: vp.base_fee ?? 0,
      base_minutes: vp.base_minutes ?? 0,
      extra_fee: vp.extra_fee ?? 0,
      daily_max: vp.daily_max ?? 0,
      valet_fee: vp.valet_fee ?? 0,
      monthly_fee: vp.monthly_fee ?? 0,
    });
    setVpError("");
    setShowVPModal(true);
  };

  const setVF = (k: string, v: any) => setVpForm(f => ({ ...f, [k]: v }));
  // 숫자 입력 핸들러 (음수 차단)
  const setVFNum = (k: string, raw: string) =>
    setVpForm(f => ({ ...f, [k]: raw === "" ? 0 : Math.max(0, parseInt(raw) || 0) }));

  const saveVP = async () => {
    if (!vpForm.name.trim()) { setVpError("방문지명을 입력하세요"); return; }
    const payload = {
      name: vpForm.name.trim(),
      floor: vpForm.floor.trim() || null,
      free_minutes: Number(vpForm.free_minutes) || 0,
      base_fee: Number(vpForm.base_fee) || 0,
      base_minutes: Number(vpForm.base_minutes) || 0,
      extra_fee: Number(vpForm.extra_fee) || 0,
      daily_max: Number(vpForm.daily_max) || 0,
      valet_fee: Number(vpForm.valet_fee) || 0,
      monthly_fee: Number(vpForm.monthly_fee) || 0,
    };

    setVpSaving(true);
    setVpError("");
    try {
      const url = editingVP
        ? `/api/v1/visit-places/${editingVP.id}`
        : `/api/v1/stores/${id}/visit-places`;
      const method = editingVP ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        setVpError(json?.error?.message || "저장에 실패했습니다");
        return;
      }
      setShowVPModal(false);
      await loadVisitPlaces();
    } catch {
      setVpError("네트워크 오류가 발생했습니다");
    } finally {
      setVpSaving(false);
    }
  };

  const removeVP = async (vp: any) => {
    if (!confirm(`'${vp.name}' 방문지를 삭제할까요?\n등록된 요금표가 함께 삭제됩니다.`)) return;
    try {
      const res = await fetch(`/api/v1/visit-places/${vp.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        alert(json?.error?.message || "삭제에 실패했습니다");
        return;
      }
      await loadVisitPlaces();
    } catch {
      alert("네트워크 오류가 발생했습니다");
    }
  };

  // ── 사업장 정보 배지 ──
  const storeBadges = (s: any) => {
    const arr: { label: string; color: string; bg: string }[] = [];
    if (s.has_valet) arr.push({ label: "발렛", color: NAVY, bg: "#EEF2FF" });
    if (s.has_kiosk || s.has_toss_kiosk) arr.push({ label: "키오스크", color: "#7C3AED", bg: "#F5F3FF" });
    if (s.is_free_parking) arr.push({ label: "무료", color: "#059669", bg: "#ECFDF5" });
    if (s.require_visit_place) arr.push({ label: "방문지필수", color: "#D97706", bg: "#FEF3C7" });
    if (s.enable_monthly) arr.push({ label: "월주차", color: "#0891B2", bg: "#ECFEFF" });
    if (s.enable_plate_search) arr.push({ label: "차량번호검색", color: "#475569", bg: "#F1F5F9" });
    return arr;
  };

  const LOT_TYPE_LABEL: Record<string, string> = { internal: "내부(직영)", external: "외부(제휴)" };
  const PT_LABEL: Record<string, string> = { self: "자주식", mechanical: "기계식" };

  return (
    <div style={{ padding: 20, maxWidth: 1100, margin: "0 auto" }}>
      <style>{`
        .v2d-input { width: 100%; padding: 9px 11px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 14px; box-sizing: border-box; }
        .v2d-input:focus { outline: none; border-color: ${NAVY}; }
        .v2d-label { display: block; font-size: 12px; font-weight: 600; color: #475569; margin-bottom: 5px; }
        .v2d-btn { padding: 9px 16px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; border: none; }
        .v2d-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; }
        .v2d-chip { font-size: 12px; font-weight: 600; padding: 7px 13px; border-radius: 8px; cursor: pointer; border: 1px solid #cbd5e1; background: #fff; color: #64748B; }
        .v2d-chip-on { border-color: ${NAVY}; background: #EEF2FF; color: ${NAVY}; }
      `}</style>

      {/* ── 뒤로가기 ── */}
      <Link href="/v2/stores" style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 13, color: "#64748B", textDecoration: "none", marginBottom: 14 }}>
        ← 사업장 목록
      </Link>

      {loading ? (
        <div style={{ padding: 60, textAlign: "center", color: "#64748B" }}>로딩 중...</div>
      ) : error ? (
        <div className="v2d-card" style={{ textAlign: "center", color: "#DC2626" }}>
          {error}
          <div style={{ marginTop: 12 }}>
            <button className="v2d-btn" onClick={loadAll} style={{ background: "#fff", color: "#DC2626", border: "1px solid #FCA5A5" }}>다시 시도</button>
          </div>
        </div>
      ) : !store ? null : (
        <>
          {/* ── 사업장 헤더 ── */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
                <h1 style={{ fontSize: 22, fontWeight: 800, color: "#1A1D2B", margin: 0 }}>{store.name}</h1>
                {store.site_code && (
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#64748B", background: "#F1F5F9", padding: "3px 9px", borderRadius: 6 }}>
                    {store.site_code}
                  </span>
                )}
                {store.is_active === false && (
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#DC2626", background: "#FEE2E2", padding: "3px 9px", borderRadius: 6 }}>
                    삭제됨
                  </span>
                )}
              </div>
              <div style={{ fontSize: 13, color: "#64748B", marginTop: 6 }}>
                {[store.region_city, store.region_district].filter(Boolean).join(" ")}
                {store.road_address ? `  ·  ${store.road_address}` : ""}
              </div>
            </div>
            <Link href="/v2/stores" className="v2d-btn" style={{ background: "#F1F5F9", color: "#334155", textDecoration: "none" }}>
              사업장 정보 수정 →
            </Link>
          </div>

          {/* ── 사업장 정보 요약 ── */}
          <div className="v2d-card" style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
              {storeBadges(store).map((b, i) => (
                <span key={i} style={{ fontSize: 11.5, fontWeight: 600, color: b.color, background: b.bg, padding: "4px 10px", borderRadius: 7 }}>
                  {b.label}
                </span>
              ))}
              {store.latitude && store.longitude && (
                <span style={{ fontSize: 11.5, fontWeight: 600, color: "#0EA5E9", background: "#E0F2FE", padding: "4px 10px", borderRadius: 7 }}>
                  📍 GPS {store.gps_radius_meters ?? 200}m
                </span>
              )}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12 }}>
              {[
                { k: "담당자", v: store.manager_name || "-" },
                { k: "현장 연락처", v: store.contact_name || "-" },
                { k: "유예시간", v: `${store.grace_period_minutes ?? 0}분` },
                { k: "발렛 요금", v: store.has_valet ? `${Number(store.valet_fee ?? 0).toLocaleString("ko-KR")}원` : "-" },
                { k: "배정 직원", v: `${store.staff_count ?? 0}명` },
              ].map((it, i) => (
                <div key={i}>
                  <div style={{ fontSize: 11.5, color: "#94A3B8", marginBottom: 3 }}>{it.k}</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#1A1D2B" }}>{it.v}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ── 면수 합계 ── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 10, marginBottom: 16 }}>
            {[
              { label: "총 주차면", val: summary?.total_spaces ?? 0, accent: true },
              { label: "자주식", val: summary?.total_self ?? 0 },
              { label: "기계식 일반", val: summary?.total_mechanical_normal ?? 0 },
              { label: "기계식 SUV", val: summary?.total_mechanical_suv ?? 0 },
            ].map((m, i) => (
              <div key={i} className="v2d-card" style={{ padding: 14, textAlign: "center", background: m.accent ? NAVY : "#fff" }}>
                <div style={{ fontSize: 11.5, color: m.accent ? "rgba(255,255,255,0.8)" : "#94A3B8", marginBottom: 5 }}>{m.label}</div>
                <div style={{ fontSize: 24, fontWeight: 800, fontFamily: "Outfit, sans-serif", color: m.accent ? "#fff" : "#1A1D2B" }}>
                  {Number(m.val).toLocaleString("ko-KR")}
                  <span style={{ fontSize: 12, fontWeight: 600, marginLeft: 2, color: m.accent ? "rgba(255,255,255,0.7)" : "#94A3B8" }}>면</span>
                </div>
              </div>
            ))}
          </div>

          {/* ── 주차장 섹션 ── */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h2 style={{ fontSize: 17, fontWeight: 800, color: "#1A1D2B", margin: 0 }}>
              주차장 <span style={{ fontSize: 14, fontWeight: 600, color: "#94A3B8" }}>{lots.length}곳</span>
            </h2>
            <button className="v2d-btn" onClick={openNewLot} style={{ background: NAVY, color: "#fff" }}>+ 주차장 추가</button>
          </div>

          {lots.length === 0 ? (
            <div className="v2d-card" style={{ padding: "44px 20px", textAlign: "center" }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🅿️</div>
              <div style={{ fontSize: 14.5, fontWeight: 700, color: "#1A1D2B" }}>등록된 주차장이 없습니다</div>
              <div style={{ fontSize: 12.5, color: "#94A3B8", marginTop: 4 }}>주차장을 추가하면 면수가 자동 합산됩니다</div>
              <button className="v2d-btn" onClick={openNewLot} style={{ marginTop: 16, background: NAVY, color: "#fff" }}>+ 첫 주차장 등록</button>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 }}>
              {lots.map(l => (
                <div key={l.id} className="v2d-card">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 15.5, fontWeight: 700, color: "#1A1D2B" }}>{l.name}</div>
                      <div style={{ display: "flex", gap: 5, marginTop: 6, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: l.lot_type === "external" ? "#D97706" : NAVY, background: l.lot_type === "external" ? "#FEF3C7" : "#EEF2FF", padding: "2px 8px", borderRadius: 6 }}>
                          {LOT_TYPE_LABEL[l.lot_type] || l.lot_type}
                        </span>
                        {(Array.isArray(l.parking_type) ? l.parking_type : []).map((t: string) => (
                          <span key={t} style={{ fontSize: 11, fontWeight: 600, color: "#475569", background: "#F1F5F9", padding: "2px 8px", borderRadius: 6 }}>
                            {PT_LABEL[t] || t}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontSize: 22, fontWeight: 800, fontFamily: "Outfit, sans-serif", color: NAVY, lineHeight: 1 }}>
                        {lotSpaces(l)}
                      </div>
                      <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 2 }}>총 면수</div>
                    </div>
                  </div>

                  {/* 면수 내역 */}
                  <div style={{ display: "flex", gap: 8, marginTop: 12, fontSize: 12, color: "#64748B", flexWrap: "wrap" }}>
                    {l.self_spaces > 0 && <span>자주식 <b style={{ color: "#334155" }}>{l.self_spaces}</b></span>}
                    {l.mechanical_normal > 0 && <span>기계식일반 <b style={{ color: "#334155" }}>{l.mechanical_normal}</b></span>}
                    {l.mechanical_suv > 0 && <span>기계식SUV <b style={{ color: "#334155" }}>{l.mechanical_suv}</b></span>}
                    {lotSpaces(l) === 0 && <span style={{ color: "#94A3B8" }}>면수 미등록</span>}
                  </div>

                  {l.road_address && (
                    <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 8 }}>📍 {l.road_address}</div>
                  )}

                  {/* 액션 */}
                  <div style={{ display: "flex", gap: 7, marginTop: 13, borderTop: "1px solid #f1f5f9", paddingTop: 12 }}>
                    <button className="v2d-btn" onClick={() => openEditLot(l)} style={{ flex: 1, background: "#F1F5F9", color: "#334155", fontSize: 13 }}>수정</button>
                    <button className="v2d-btn" onClick={() => removeLot(l)} style={{ background: "#fff", color: "#DC2626", border: "1px solid #FECACA", fontSize: 13 }}>삭제</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── 방문지(요금표) 섹션 ── */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "26px 0 12px" }}>
            <h2 style={{ fontSize: 17, fontWeight: 800, color: "#1A1D2B", margin: 0 }}>
              방문지 요금표 <span style={{ fontSize: 14, fontWeight: 600, color: "#94A3B8" }}>{vplaces.length}곳</span>
            </h2>
            <button className="v2d-btn" onClick={openNewVP} style={{ background: NAVY, color: "#fff" }}>+ 방문지 추가</button>
          </div>

          {store.require_visit_place && (
            <div style={{ fontSize: 12.5, color: "#92400E", background: "#FEF3C7", border: "1px solid #FDE68A", borderRadius: 9, padding: "10px 13px", marginBottom: 12 }}>
              ⚠️ 이 사업장은 <b>방문지 필수</b>로 설정되어 있습니다. 입차 시 방문지를 반드시 선택해야 하므로 최소 1곳 이상 등록하세요.
            </div>
          )}

          {vplaces.length === 0 ? (
            <div className="v2d-card" style={{ padding: "44px 20px", textAlign: "center" }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🏥</div>
              <div style={{ fontSize: 14.5, fontWeight: 700, color: "#1A1D2B" }}>등록된 방문지가 없습니다</div>
              <div style={{ fontSize: 12.5, color: "#94A3B8", marginTop: 4 }}>병원·상가 등 방문지별 요금표를 등록할 수 있습니다</div>
              <button className="v2d-btn" onClick={openNewVP} style={{ marginTop: 16, background: NAVY, color: "#fff" }}>+ 첫 방문지 등록</button>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 }}>
              {vplaces.map(vp => (
                <div key={vp.id} className="v2d-card">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 15.5, fontWeight: 700, color: "#1A1D2B" }}>{vp.name}</div>
                      {vp.floor && (
                        <span style={{ display: "inline-block", marginTop: 6, fontSize: 11, fontWeight: 600, color: "#475569", background: "#F1F5F9", padding: "2px 8px", borderRadius: 6 }}>
                          {vp.floor}
                        </span>
                      )}
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontSize: 11, color: "#94A3B8", marginBottom: 2 }}>기본요금</div>
                      <div style={{ fontSize: 20, fontWeight: 800, fontFamily: "Outfit, sans-serif", color: NAVY, lineHeight: 1 }}>
                        {Number(vp.base_fee || 0).toLocaleString("ko-KR")}
                        <span style={{ fontSize: 11, fontWeight: 600, marginLeft: 2, color: "#94A3B8" }}>원</span>
                      </div>
                    </div>
                  </div>

                  {/* 요금 내역 */}
                  <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: "7px 12px", fontSize: 12, color: "#64748B" }}>
                    <span>무료 <b style={{ color: "#334155" }}>{vp.free_minutes ?? 0}분</b></span>
                    <span>기본시간 <b style={{ color: "#334155" }}>{vp.base_minutes ?? 0}분</b></span>
                    <span>추가 <b style={{ color: "#334155" }}>{won(vp.extra_fee)}</b>/분</span>
                    <span>일최대 <b style={{ color: "#334155" }}>{Number(vp.daily_max) > 0 ? won(vp.daily_max) : "무제한"}</b></span>
                    <span>발렛 <b style={{ color: "#334155" }}>{won(vp.valet_fee)}</b></span>
                    <span>월정기 <b style={{ color: "#334155" }}>{won(vp.monthly_fee)}</b></span>
                  </div>

                  {/* 액션 */}
                  <div style={{ display: "flex", gap: 7, marginTop: 13, borderTop: "1px solid #f1f5f9", paddingTop: 12 }}>
                    <button className="v2d-btn" onClick={() => openEditVP(vp)} style={{ flex: 1, background: "#F1F5F9", color: "#334155", fontSize: 13 }}>수정</button>
                    <button className="v2d-btn" onClick={() => removeVP(vp)} style={{ background: "#fff", color: "#DC2626", border: "1px solid #FECACA", fontSize: 13 }}>삭제</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── 주차장 등록/수정 모달 ── */}
      {showModal && (
        <div
          onClick={() => !saving && setShowModal(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", zIndex: 1000, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "40px 16px", overflowY: "auto" }}
        >
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 520, padding: 24, boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: "#1A1D2B", margin: 0 }}>{editingLot ? "주차장 수정" : "주차장 추가"}</h2>
              <button onClick={() => !saving && setShowModal(false)} style={{ background: "none", border: "none", fontSize: 22, color: "#94A3B8", cursor: "pointer", lineHeight: 1 }}>✕</button>
            </div>

            {/* 이름 */}
            <div style={{ marginBottom: 14 }}>
              <label className="v2d-label">주차장 이름 *</label>
              <input className="v2d-input" placeholder="예: 본관 지하주차장" value={form.name} onChange={e => setF("name", e.target.value)} />
            </div>

            {/* 구분 */}
            <div style={{ marginBottom: 14 }}>
              <label className="v2d-label">구분</label>
              <div style={{ display: "flex", gap: 8 }}>
                {(["internal", "external"] as const).map(t => (
                  <button
                    key={t}
                    type="button"
                    className={`v2d-chip ${form.lot_type === t ? "v2d-chip-on" : ""}`}
                    onClick={() => setF("lot_type", t)}
                    style={{ flex: 1 }}
                  >
                    {LOT_TYPE_LABEL[t]}
                  </button>
                ))}
              </div>
            </div>

            {/* 주차 방식 (복수 선택) */}
            <div style={{ marginBottom: 14 }}>
              <label className="v2d-label">주차 방식 (복수 선택)</label>
              <div style={{ display: "flex", gap: 8 }}>
                {(["self", "mechanical"] as const).map(t => (
                  <button
                    key={t}
                    type="button"
                    className={`v2d-chip ${form.parking_type.includes(t) ? "v2d-chip-on" : ""}`}
                    onClick={() => toggleType(t)}
                    style={{ flex: 1 }}
                  >
                    {PT_LABEL[t]}
                  </button>
                ))}
              </div>
            </div>

            {/* 면수 입력 */}
            <div style={{ marginBottom: 14 }}>
              <label className="v2d-label">주차 면수</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                <div>
                  <div style={{ fontSize: 11, color: "#94A3B8", marginBottom: 4 }}>자주식</div>
                  <input
                    className="v2d-input" type="number" min={0} inputMode="numeric"
                    value={form.self_spaces}
                    disabled={!form.parking_type.includes("self")}
                    onChange={e => setF("self_spaces", e.target.value === "" ? 0 : Math.max(0, parseInt(e.target.value) || 0))}
                    style={{ opacity: form.parking_type.includes("self") ? 1 : 0.4 }}
                  />
                </div>
                <div>
                  <div style={{ fontSize: 11, color: "#94A3B8", marginBottom: 4 }}>기계식 일반</div>
                  <input
                    className="v2d-input" type="number" min={0} inputMode="numeric"
                    value={form.mechanical_normal}
                    disabled={!form.parking_type.includes("mechanical")}
                    onChange={e => setF("mechanical_normal", e.target.value === "" ? 0 : Math.max(0, parseInt(e.target.value) || 0))}
                    style={{ opacity: form.parking_type.includes("mechanical") ? 1 : 0.4 }}
                  />
                </div>
                <div>
                  <div style={{ fontSize: 11, color: "#94A3B8", marginBottom: 4 }}>기계식 SUV</div>
                  <input
                    className="v2d-input" type="number" min={0} inputMode="numeric"
                    value={form.mechanical_suv}
                    disabled={!form.parking_type.includes("mechanical")}
                    onChange={e => setF("mechanical_suv", e.target.value === "" ? 0 : Math.max(0, parseInt(e.target.value) || 0))}
                    style={{ opacity: form.parking_type.includes("mechanical") ? 1 : 0.4 }}
                  />
                </div>
              </div>
              <div style={{ fontSize: 12, color: "#64748B", marginTop: 8, textAlign: "right" }}>
                합계 <b style={{ color: NAVY, fontFamily: "Outfit, sans-serif" }}>
                  {(form.parking_type.includes("self") ? Number(form.self_spaces) || 0 : 0) +
                   (form.parking_type.includes("mechanical") ? (Number(form.mechanical_normal) || 0) + (Number(form.mechanical_suv) || 0) : 0)}
                </b> 면
              </div>
            </div>

            {/* 주소 (외부 제휴 시 유용) */}
            <div style={{ marginBottom: 18 }}>
              <label className="v2d-label">주소 (선택)</label>
              <input className="v2d-input" placeholder="외부 제휴 주차장의 도로명 주소" value={form.road_address} onChange={e => setF("road_address", e.target.value)} />
            </div>

            {formError && (
              <div style={{ fontSize: 13, color: "#DC2626", background: "#FEF2F2", padding: "9px 12px", borderRadius: 8, marginBottom: 14 }}>{formError}</div>
            )}

            <div style={{ display: "flex", gap: 8 }}>
              <button className="v2d-btn" onClick={() => !saving && setShowModal(false)} disabled={saving} style={{ flex: 1, background: "#F1F5F9", color: "#475569" }}>취소</button>
              <button className="v2d-btn" onClick={save} disabled={saving} style={{ flex: 2, background: NAVY, color: "#fff", opacity: saving ? 0.6 : 1 }}>
                {saving ? "저장 중..." : editingLot ? "수정 저장" : "주차장 추가"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 방문지 등록/수정 모달 ── */}
      {showVPModal && (
        <div
          onClick={() => !vpSaving && setShowVPModal(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", zIndex: 1000, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "40px 16px", overflowY: "auto" }}
        >
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 520, padding: 24, boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: "#1A1D2B", margin: 0 }}>{editingVP ? "방문지 수정" : "방문지 추가"}</h2>
              <button onClick={() => !vpSaving && setShowVPModal(false)} style={{ background: "none", border: "none", fontSize: 22, color: "#94A3B8", cursor: "pointer", lineHeight: 1 }}>✕</button>
            </div>

            {/* 방문지명 / 층 */}
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 10, marginBottom: 14 }}>
              <div>
                <label className="v2d-label">방문지명 *</label>
                <input className="v2d-input" placeholder="예: 1층 내과" value={vpForm.name} onChange={e => setVF("name", e.target.value)} />
              </div>
              <div>
                <label className="v2d-label">층 (선택)</label>
                <input className="v2d-input" placeholder="예: B1, 1F" value={vpForm.floor} onChange={e => setVF("floor", e.target.value)} />
              </div>
            </div>

            {/* 요금 필드 그리드 */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
              <div>
                <label className="v2d-label">무료 주차 (분)</label>
                <input className="v2d-input" type="number" min={0} inputMode="numeric" value={vpForm.free_minutes} onChange={e => setVFNum("free_minutes", e.target.value)} />
              </div>
              <div>
                <label className="v2d-label">기본 요금 (원)</label>
                <input className="v2d-input" type="number" min={0} inputMode="numeric" value={vpForm.base_fee} onChange={e => setVFNum("base_fee", e.target.value)} />
              </div>
              <div>
                <label className="v2d-label">기본 시간 (분)</label>
                <input className="v2d-input" type="number" min={0} inputMode="numeric" value={vpForm.base_minutes} onChange={e => setVFNum("base_minutes", e.target.value)} />
              </div>
              <div>
                <label className="v2d-label">추가 요금 (원/분)</label>
                <input className="v2d-input" type="number" min={0} inputMode="numeric" value={vpForm.extra_fee} onChange={e => setVFNum("extra_fee", e.target.value)} />
              </div>
              <div>
                <label className="v2d-label">일 최대 (0=무제한)</label>
                <input className="v2d-input" type="number" min={0} inputMode="numeric" value={vpForm.daily_max} onChange={e => setVFNum("daily_max", e.target.value)} />
              </div>
              <div>
                <label className="v2d-label">발렛 요금 (원)</label>
                <input className="v2d-input" type="number" min={0} inputMode="numeric" value={vpForm.valet_fee} onChange={e => setVFNum("valet_fee", e.target.value)} />
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label className="v2d-label">월정기 요금 (원)</label>
              <input className="v2d-input" type="number" min={0} inputMode="numeric" value={vpForm.monthly_fee} onChange={e => setVFNum("monthly_fee", e.target.value)} />
            </div>

            {/* 요금 요약 프리뷰 */}
            <div style={{ fontSize: 12.5, color: "#475569", background: "#F8FAFC", border: "1px solid #e2e8f0", borderRadius: 9, padding: "11px 13px", marginBottom: 16, lineHeight: 1.7 }}>
              <div>✓ 무료 <b>{vpForm.free_minutes || 0}분</b> 후 → 기본 <b style={{ color: NAVY }}>{won(vpForm.base_fee)}</b> ({vpForm.base_minutes || 0}분)</div>
              <div>✓ 이후 <b>1분마다</b> → <b style={{ color: NAVY }}>{won(vpForm.extra_fee)}</b> · 일 최대 <b style={{ color: NAVY }}>{Number(vpForm.daily_max) > 0 ? won(vpForm.daily_max) : "무제한"}</b></div>
            </div>

            {vpError && (
              <div style={{ fontSize: 13, color: "#DC2626", background: "#FEF2F2", padding: "9px 12px", borderRadius: 8, marginBottom: 14 }}>{vpError}</div>
            )}

            <div style={{ display: "flex", gap: 8 }}>
              <button className="v2d-btn" onClick={() => !vpSaving && setShowVPModal(false)} disabled={vpSaving} style={{ flex: 1, background: "#F1F5F9", color: "#475569" }}>취소</button>
              <button className="v2d-btn" onClick={saveVP} disabled={vpSaving} style={{ flex: 2, background: NAVY, color: "#fff", opacity: vpSaving ? 0.6 : 1 }}>
                {vpSaving ? "저장 중..." : editingVP ? "수정 저장" : "방문지 추가"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
