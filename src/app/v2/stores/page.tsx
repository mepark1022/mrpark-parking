// @ts-nocheck
"use client";
export const dynamic = "force-dynamic";

/**
 * 사업장 관리 v2 — 목록 + 등록/수정/삭제(soft)/복원 (GAP-P0-1 / 1A)
 *
 * API (모두 기존):
 *   GET    /api/v1/stores?search=&status=&has_valet=&region_city=
 *   POST   /api/v1/stores
 *   PUT    /api/v1/stores/:id
 *   DELETE /api/v1/stores/:id        (soft delete → is_active=false)
 *   POST   /api/v1/stores/:id/restore
 *   GET    /api/geocode/forward?address=  (주소 → 좌표)
 *
 * 레이아웃: /v2/layout.tsx 가 AppLayout(Sidebar+Header+MobileTabBar) 자동 적용
 * 주차장/방문지 관리는 사업장 상세(1B/1C)에서 — 본 파트는 사업장 자체 CRUD
 */

import { useState, useEffect, useCallback } from "react";

const NAVY = "#1428A0";
const GOLD = "#F5B731";

const EMPTY_FORM = {
  name: "", site_code: "", region_city: "", region_district: "",
  road_address: "", address: "", manager_name: "",
  contact_name: "", contact_phone: "",
  latitude: null as number | null, longitude: null as number | null,
  is_free_parking: false, has_valet: false, valet_fee: 0,
  has_kiosk: false, has_toss_kiosk: false,
  grace_period_minutes: 10, gps_radius_meters: 200,
  require_entry_photo: false, enable_plate_search: true,
  enable_valet: false, enable_monthly: true, require_visit_place: false,
};

export default function V2StoresPage() {
  const [stores, setStores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // 필터
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"active" | "deleted">("active");

  // 모달
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any>(null); // null = 신규
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [formError, setFormError] = useState("");

  // ── 목록 로드 ──
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      params.set("status", statusFilter);
      const res = await fetch(`/api/v1/stores?${params.toString()}`, { credentials: "include" });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        setError(json?.error?.message || "사업장 목록을 불러오지 못했습니다");
        setStores([]);
      } else {
        setStores(Array.isArray(json.data) ? json.data : (json.data?.stores ?? []));
      }
    } catch {
      setError("네트워크 오류가 발생했습니다");
      setStores([]);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => { load(); }, [statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps
  // 검색은 디바운스
  useEffect(() => {
    const t = setTimeout(() => load(), 350);
    return () => clearTimeout(t);
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 모달 열기 ──
  const openNew = () => { setEditing(null); setForm({ ...EMPTY_FORM }); setFormError(""); setShowModal(true); };
  const openEdit = (s: any) => {
    setEditing(s);
    setForm({
      name: s.name ?? "", site_code: s.site_code ?? "",
      region_city: s.region_city ?? "", region_district: s.region_district ?? "",
      road_address: s.road_address ?? "", address: s.address ?? "",
      manager_name: s.manager_name ?? "", contact_name: s.contact_name ?? "", contact_phone: s.contact_phone ?? "",
      latitude: s.latitude ?? null, longitude: s.longitude ?? null,
      is_free_parking: !!s.is_free_parking, has_valet: !!s.has_valet, valet_fee: s.valet_fee ?? 0,
      has_kiosk: !!s.has_kiosk, has_toss_kiosk: !!s.has_toss_kiosk,
      grace_period_minutes: s.grace_period_minutes ?? 10, gps_radius_meters: s.gps_radius_meters ?? 200,
      require_entry_photo: !!s.require_entry_photo, enable_plate_search: s.enable_plate_search ?? true,
      enable_valet: !!s.enable_valet, enable_monthly: s.enable_monthly ?? true, require_visit_place: !!s.require_visit_place,
    });
    setFormError("");
    setShowModal(true);
  };

  const setF = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  // ── 주소 → 좌표 ──
  const geocode = async () => {
    if (!form.road_address.trim()) { setFormError("도로명 주소를 입력하세요"); return; }
    setGeocoding(true);
    setFormError("");
    try {
      const res = await fetch(`/api/geocode/forward?address=${encodeURIComponent(form.road_address.trim())}`);
      const d = await res.json();
      if (d.lat && d.lng) {
        setForm(f => ({ ...f, latitude: d.lat, longitude: d.lng }));
      } else {
        setFormError(d.error || "좌표를 찾지 못했습니다");
      }
    } catch {
      setFormError("좌표 검색에 실패했습니다");
    } finally {
      setGeocoding(false);
    }
  };

  // ── 저장 ──
  const save = async () => {
    if (!form.name.trim()) { setFormError("사업장명은 필수입니다"); return; }
    setSaving(true);
    setFormError("");
    try {
      const url = editing ? `/api/v1/stores/${editing.id}` : "/api/v1/stores";
      const method = editing ? "PUT" : "POST";
      const res = await fetch(url, {
        method, credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        setFormError(json?.error?.message || "저장에 실패했습니다");
        return;
      }
      setShowModal(false);
      load();
    } catch {
      setFormError("네트워크 오류가 발생했습니다");
    } finally {
      setSaving(false);
    }
  };

  // ── 삭제(soft) / 복원 ──
  const remove = async (s: any) => {
    if (!confirm(`'${s.name}' 사업장을 삭제하시겠습니까?\n(데이터는 보존되며 '삭제됨'에서 복원할 수 있습니다)`)) return;
    const res = await fetch(`/api/v1/stores/${s.id}`, { method: "DELETE", credentials: "include" });
    const json = await res.json();
    if (!res.ok || !json?.success) { alert(json?.error?.message || "삭제 실패"); return; }
    load();
  };
  const restore = async (s: any) => {
    const res = await fetch(`/api/v1/stores/${s.id}/restore`, { method: "POST", credentials: "include" });
    const json = await res.json();
    if (!res.ok || !json?.success) { alert(json?.error?.message || "복원 실패"); return; }
    load();
  };

  // ── 사업장 배지 ──
  const badges = (s: any) => {
    const arr: { label: string; color: string; bg: string }[] = [];
    if (s.has_valet) arr.push({ label: "발렛", color: NAVY, bg: "#EEF2FF" });
    if (s.has_kiosk || s.has_toss_kiosk) arr.push({ label: "키오스크", color: "#7C3AED", bg: "#F5F3FF" });
    if (s.is_free_parking) arr.push({ label: "무료", color: "#059669", bg: "#ECFDF5" });
    if (s.require_visit_place) arr.push({ label: "방문지필수", color: "#D97706", bg: "#FEF3C7" });
    if (s.enable_monthly) arr.push({ label: "월주차", color: "#0891B2", bg: "#ECFEFF" });
    return arr;
  };

  return (
    <div style={{ padding: 20, maxWidth: 1400, margin: "0 auto" }}>
      <style>{`
        .v2s-input { width: 100%; padding: 9px 11px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 14px; box-sizing: border-box; }
        .v2s-input:focus { outline: none; border-color: ${NAVY}; }
        .v2s-label { display: block; font-size: 12px; font-weight: 600; color: #475569; margin-bottom: 5px; }
        .v2s-toggle { display: flex; align-items: center; justify-content: space-between; padding: 9px 12px; border: 1px solid #e2e8f0; border-radius: 9px; background: #fff; cursor: pointer; }
        .v2s-btn { padding: 9px 16px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; border: none; }
        .v2s-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; }
      `}</style>

      {/* ── 헤더 ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#1A1D2B", margin: 0 }}>사업장 관리</h1>
          <p style={{ fontSize: 13, color: "#64748B", margin: "4px 0 0" }}>사업장 등록·수정 및 주차장/방문지 관리의 기준 정보</p>
        </div>
        <button className="v2s-btn" onClick={openNew} style={{ background: NAVY, color: "#fff" }}>+ 사업장 등록</button>
      </div>

      {/* ── 필터 ── */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <input
          className="v2s-input"
          style={{ maxWidth: 280 }}
          placeholder="사업장명 / 코드 검색"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div style={{ display: "flex", gap: 6 }}>
          {(["active", "deleted"] as const).map(st => (
            <button
              key={st}
              className="v2s-btn"
              onClick={() => setStatusFilter(st)}
              style={{
                background: statusFilter === st ? NAVY : "#fff",
                color: statusFilter === st ? "#fff" : "#64748B",
                border: statusFilter === st ? "none" : "1px solid #cbd5e1",
              }}
            >
              {st === "active" ? "운영중" : "삭제됨"}
            </button>
          ))}
        </div>
      </div>

      {/* ── 목록 ── */}
      {loading ? (
        <div style={{ padding: 60, textAlign: "center", color: "#64748B" }}>로딩 중...</div>
      ) : error ? (
        <div className="v2s-card" style={{ textAlign: "center", color: "#DC2626" }}>
          {error}
          <div style={{ marginTop: 12 }}>
            <button className="v2s-btn" onClick={load} style={{ background: "#fff", color: "#DC2626", border: "1px solid #FCA5A5" }}>다시 시도</button>
          </div>
        </div>
      ) : stores.length === 0 ? (
        <div className="v2s-card" style={{ padding: "50px 20px", textAlign: "center" }}>
          <div style={{ fontSize: 34, marginBottom: 8 }}>🏢</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#1A1D2B" }}>
            {statusFilter === "active" ? "등록된 사업장이 없습니다" : "삭제된 사업장이 없습니다"}
          </div>
          {statusFilter === "active" && (
            <button className="v2s-btn" onClick={openNew} style={{ marginTop: 16, background: NAVY, color: "#fff" }}>+ 첫 사업장 등록</button>
          )}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 12 }}>
          {stores.map(s => (
            <div key={s.id} className="v2s-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "#1A1D2B", display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                    {s.name}
                    {s.site_code && (
                      <span style={{ fontSize: 11, fontWeight: 600, color: "#64748B", background: "#F1F5F9", padding: "2px 7px", borderRadius: 5 }}>
                        {s.site_code}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12.5, color: "#64748B", marginTop: 5 }}>
                    {[s.region_city, s.region_district].filter(Boolean).join(" ") || s.road_address || "주소 미등록"}
                  </div>
                  {s.manager_name && (
                    <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 3 }}>담당: {s.manager_name}</div>
                  )}
                </div>
              </div>

              {/* 배지 */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 11 }}>
                {badges(s).map((b, i) => (
                  <span key={i} style={{ fontSize: 11, fontWeight: 600, color: b.color, background: b.bg, padding: "3px 8px", borderRadius: 6 }}>
                    {b.label}
                  </span>
                ))}
                {s.latitude && s.longitude && (
                  <span style={{ fontSize: 11, fontWeight: 600, color: "#0EA5E9", background: "#E0F2FE", padding: "3px 8px", borderRadius: 6 }}>
                    📍 GPS {s.gps_radius_meters ?? 200}m
                  </span>
                )}
              </div>

              {/* 액션 */}
              <div style={{ display: "flex", gap: 7, marginTop: 14, borderTop: "1px solid #f1f5f9", paddingTop: 12 }}>
                {statusFilter === "active" ? (
                  <>
                    <button className="v2s-btn" onClick={() => openEdit(s)} style={{ flex: 1, background: "#F1F5F9", color: "#334155", fontSize: 13 }}>수정</button>
                    <button className="v2s-btn" onClick={() => remove(s)} style={{ background: "#fff", color: "#DC2626", border: "1px solid #FECACA", fontSize: 13 }}>삭제</button>
                  </>
                ) : (
                  <button className="v2s-btn" onClick={() => restore(s)} style={{ flex: 1, background: "#ECFDF5", color: "#059669", fontSize: 13 }}>복원</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── 등록/수정 모달 ── */}
      {showModal && (
        <div
          onClick={() => !saving && setShowModal(false)}
          style={{
            position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", zIndex: 1000,
            display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "40px 16px", overflowY: "auto",
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 560, padding: 24, boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: "#1A1D2B", margin: 0 }}>
                {editing ? "사업장 수정" : "사업장 등록"}
              </h2>
              <button onClick={() => !saving && setShowModal(false)} style={{ background: "none", border: "none", fontSize: 22, color: "#94A3B8", cursor: "pointer", lineHeight: 1 }}>✕</button>
            </div>

            {/* 기본 정보 */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div style={{ gridColumn: "1 / -1" }}>
                <label className="v2s-label">사업장명 *</label>
                <input className="v2s-input" value={form.name} onChange={e => setF("name", e.target.value)} placeholder="예: 미스터팍 강남점" />
              </div>
              <div>
                <label className="v2s-label">사업장 코드</label>
                <input className="v2s-input" value={form.site_code} onChange={e => setF("site_code", e.target.value)} placeholder="예: GN01" />
              </div>
              <div>
                <label className="v2s-label">담당자명</label>
                <input className="v2s-input" value={form.manager_name} onChange={e => setF("manager_name", e.target.value)} />
              </div>
              <div>
                <label className="v2s-label">시/도</label>
                <input className="v2s-input" value={form.region_city} onChange={e => setF("region_city", e.target.value)} placeholder="서울특별시" />
              </div>
              <div>
                <label className="v2s-label">구/군</label>
                <input className="v2s-input" value={form.region_district} onChange={e => setF("region_district", e.target.value)} placeholder="강남구" />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label className="v2s-label">도로명 주소</label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input className="v2s-input" value={form.road_address} onChange={e => setF("road_address", e.target.value)} placeholder="도로명 주소 입력 후 좌표 검색" />
                  <button className="v2s-btn" onClick={geocode} disabled={geocoding} style={{ background: GOLD, color: "#1A1D2B", whiteSpace: "nowrap", flexShrink: 0 }}>
                    {geocoding ? "검색중" : "좌표검색"}
                  </button>
                </div>
                {form.latitude && form.longitude && (
                  <div style={{ fontSize: 11.5, color: "#059669", marginTop: 5 }}>
                    📍 {Number(form.latitude).toFixed(5)}, {Number(form.longitude).toFixed(5)}
                  </div>
                )}
              </div>
              <div>
                <label className="v2s-label">연락처명</label>
                <input className="v2s-input" value={form.contact_name} onChange={e => setF("contact_name", e.target.value)} />
              </div>
              <div>
                <label className="v2s-label">연락처</label>
                <input className="v2s-input" value={form.contact_phone} onChange={e => setF("contact_phone", e.target.value)} placeholder="02-000-0000" />
              </div>
            </div>

            {/* 수치 설정 */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
              <div>
                <label className="v2s-label">GPS 반경(m)</label>
                <input className="v2s-input" type="number" value={form.gps_radius_meters} onChange={e => setF("gps_radius_meters", Number(e.target.value) || 0)} />
              </div>
              <div>
                <label className="v2s-label">유예시간(분)</label>
                <input className="v2s-input" type="number" value={form.grace_period_minutes} onChange={e => setF("grace_period_minutes", Number(e.target.value) || 0)} />
              </div>
              {form.has_valet && (
                <div>
                  <label className="v2s-label">발렛 요금(원)</label>
                  <input className="v2s-input" type="number" value={form.valet_fee} onChange={e => setF("valet_fee", Number(e.target.value) || 0)} />
                </div>
              )}
            </div>

            {/* 운영 토글 */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
              {[
                { k: "has_valet", l: "발렛 운영" },
                { k: "is_free_parking", l: "무료 주차장" },
                { k: "has_kiosk", l: "키오스크" },
                { k: "has_toss_kiosk", l: "토스 키오스크" },
                { k: "enable_monthly", l: "월주차 사용" },
                { k: "enable_plate_search", l: "번호판 검색" },
                { k: "require_visit_place", l: "방문지 필수" },
                { k: "require_entry_photo", l: "입차사진 필수" },
              ].map(({ k, l }) => (
                <div key={k} className="v2s-toggle" onClick={() => setF(k, !form[k])}>
                  <span style={{ fontSize: 13, color: "#334155" }}>{l}</span>
                  <div style={{
                    width: 38, height: 22, borderRadius: 11, padding: 2,
                    background: form[k] ? NAVY : "#cbd5e1", transition: "all .15s", flexShrink: 0,
                  }}>
                    <div style={{
                      width: 18, height: 18, borderRadius: 9, background: "#fff",
                      transform: form[k] ? "translateX(16px)" : "translateX(0)", transition: "all .15s",
                    }} />
                  </div>
                </div>
              ))}
            </div>

            {formError && (
              <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "9px 12px", color: "#DC2626", fontSize: 13, marginBottom: 14 }}>
                {formError}
              </div>
            )}

            <div style={{ display: "flex", gap: 10 }}>
              <button className="v2s-btn" onClick={() => !saving && setShowModal(false)} style={{ flex: 1, background: "#F1F5F9", color: "#475569" }}>취소</button>
              <button className="v2s-btn" onClick={save} disabled={saving} style={{ flex: 2, background: NAVY, color: "#fff", opacity: saving ? 0.6 : 1 }}>
                {saving ? "저장 중..." : editing ? "수정 저장" : "등록"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
