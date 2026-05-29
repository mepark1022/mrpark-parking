// @ts-nocheck
"use client";
export const dynamic = "force-dynamic";

/**
 * 직원 관리 v2 — 목록 + 상세 모달(계정/매장배정/역할/제거) (GAP-P0-2a)
 *
 * API (매장배정 1개만 신규, 나머지 전부 기존):
 *   GET    /api/v1/employees?search=&role=&status=&has_account=   목록(퇴사 기본제외)
 *   GET    /api/v1/employees/:id                                   상세(store_members·account 동봉)
 *   PUT    /api/v1/employees/:id   { role }                        역할 변경
 *   DELETE /api/v1/employees/:id                                   제거(soft)
 *   POST   /api/v1/auth/create-account     { employee_id }         계정 생성(crew/field 전용, 초기PW 반환)
 *   POST   /api/v1/auth/reset-password/:id                         비번 리셋(리셋PW 반환)
 *   POST   /api/v1/auth/ban/:id  ·  /api/v1/auth/unban/:id         계정 차단/해제
 *   POST   /api/v1/employees/:id/stores  { store_ids, primary_store_id? }   매장배정(replace-set) 🆕
 *   GET    /api/v1/stores?status=active                            배정용 사업장 목록
 *
 * ⚠️ 관리자(admin/super_admin) 계정 생성은 P0-2a에서 숨김 → P0-2b 후속
 * 레이아웃: /v2/layout.tsx 가 AppLayout(Sidebar+Header+MobileTabBar) 자동 적용
 */

import { useState, useEffect, useCallback } from "react";

const NAVY = "#1428A0";
const GOLD = "#F5B731";

// 역할 표기
const ROLE_META: Record<string, { label: string; bg: string; fg: string }> = {
  super_admin: { label: "최고관리자", bg: "#FEE2E2", fg: "#B91C1C" },
  admin: { label: "관리자", bg: "#FEF3C7", fg: "#92400E" },
  crew: { label: "크루", bg: "#E0E7FF", fg: NAVY },
  field_member: { label: "필드", bg: "#CCFBF1", fg: "#0F766E" },
};
const roleLabel = (r: string) => ROLE_META[r]?.label ?? r ?? "-";
const isAdminRole = (r: string) => r === "admin" || r === "super_admin";

// 재직 상태 표기
const STATUS_META: Record<string, { bg: string; fg: string }> = {
  재직: { bg: "#DCFCE7", fg: "#15803D" },
  수습: { bg: "#FEF9C3", fg: "#A16207" },
  휴직: { bg: "#E2E8F0", fg: "#475569" },
  퇴사: { bg: "#F1F5F9", fg: "#94A3B8" },
};

export default function V2TeamPage() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [accountIds, setAccountIds] = useState<Set<string>>(new Set());
  const [stores, setStores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // 필터
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState(""); // "", crew, field_member, admin
  const [accountFilter, setAccountFilter] = useState(""); // "", true, false
  const [statusFilter, setStatusFilter] = useState(""); // "", 수습, 휴직, 퇴사 (""=퇴사제외 전체)

  // 상세 모달
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState("");
  const [actionErr, setActionErr] = useState("");
  const [busy, setBusy] = useState(false);

  // 매장배정 로컬 선택 상태
  const [assignSel, setAssignSel] = useState<Set<string>>(new Set());
  const [assignPrimary, setAssignPrimary] = useState<string | null>(null);

  // 비번 1회 노출 모달
  const [pwReveal, setPwReveal] = useState<{ title: string; pw: string; sub?: string } | null>(null);

  const storeName = useCallback(
    (id: string) => stores.find((s) => s.id === id)?.name ?? id?.slice(0, 8),
    [stores]
  );

  // ── 사업장 목록 (배정용, 1회 로드) ──
  const loadStores = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/stores?status=active", { credentials: "include" });
      const json = await res.json();
      if (res.ok && json?.success) {
        const arr = Array.isArray(json.data) ? json.data : (json.data?.stores ?? []);
        setStores(arr);
      }
    } catch {
      /* 사업장 로드 실패는 치명적이지 않음 (배정 시 재시도) */
    }
  }, []);

  // ── 직원 목록 로드 + 계정보유 id 집합 ──
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (roleFilter) params.set("role", roleFilter);
      if (statusFilter) params.set("status", statusFilter);
      params.set("limit", "200");

      // 계정필터는 목록 API의 has_account 사용
      if (accountFilter) params.set("has_account", accountFilter);

      const res = await fetch(`/api/v1/employees?${params.toString()}`, { credentials: "include" });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        setError(json?.error?.message || "직원 목록을 불러오지 못했습니다");
        setEmployees([]);
      } else {
        setEmployees(Array.isArray(json.data) ? json.data : (json.data?.employees ?? []));
      }

      // 계정 보유 id 집합 — 카드 배지용 (별도 호출, 동일 필터)
      const accParams = new URLSearchParams(params);
      accParams.set("has_account", "true");
      const accRes = await fetch(`/api/v1/employees?${accParams.toString()}`, { credentials: "include" });
      const accJson = await accRes.json();
      if (accRes.ok && accJson?.success) {
        const accArr = Array.isArray(accJson.data) ? accJson.data : (accJson.data?.employees ?? []);
        setAccountIds(new Set(accArr.map((e: any) => e.id)));
      }
    } catch {
      setError("네트워크 오류가 발생했습니다");
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  }, [search, roleFilter, accountFilter, statusFilter]);

  useEffect(() => {
    loadStores();
  }, [loadStores]);

  // 검색 디바운스
  useEffect(() => {
    const t = setTimeout(() => load(), 300);
    return () => clearTimeout(t);
  }, [load]);

  // ── 상세 열기 ──
  const openDetail = useCallback(async (empId: string) => {
    setDetailId(empId);
    setDetail(null);
    setDetailLoading(true);
    setActionMsg("");
    setActionErr("");
    try {
      const res = await fetch(`/api/v1/employees/${empId}`, { credentials: "include" });
      const json = await res.json();
      if (res.ok && json?.success) {
        setDetail(json.data);
        // 매장배정 초기값 동기화
        const active = (json.data.store_members ?? []).filter((m: any) => m.is_active);
        setAssignSel(new Set(active.map((m: any) => m.store_id)));
        setAssignPrimary(active.find((m: any) => m.is_primary)?.store_id ?? null);
      } else {
        setActionErr(json?.error?.message || "상세 조회 실패");
      }
    } catch {
      setActionErr("네트워크 오류");
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const closeDetail = () => {
    setDetailId(null);
    setDetail(null);
    setActionMsg("");
    setActionErr("");
  };

  const refreshDetail = async () => {
    if (detailId) await openDetail(detailId);
    await load();
  };

  // ── 액션들 ──
  const doCreateAccount = async () => {
    if (!detail) return;
    setBusy(true);
    setActionErr("");
    try {
      const res = await fetch("/api/v1/auth/create-account", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employee_id: detail.id }),
      });
      const json = await res.json();
      if (res.ok && json?.success) {
        setPwReveal({ title: "계정 생성 완료", pw: json.data.initial_password, sub: `${detail.name} · 초기 비밀번호` });
        await refreshDetail();
      } else {
        setActionErr(json?.error?.message || "계정 생성 실패");
      }
    } catch {
      setActionErr("네트워크 오류");
    } finally {
      setBusy(false);
    }
  };

  const doResetPassword = async () => {
    if (!detail) return;
    if (!confirm(`${detail.name}의 비밀번호를 초기화할까요?`)) return;
    setBusy(true);
    setActionErr("");
    try {
      const res = await fetch(`/api/v1/auth/reset-password/${detail.id}`, {
        method: "POST",
        credentials: "include",
      });
      const json = await res.json();
      if (res.ok && json?.success) {
        setPwReveal({ title: "비밀번호 초기화", pw: json.data.masked_password, sub: `${detail.name} · 임시 비밀번호` });
        await refreshDetail();
      } else {
        setActionErr(json?.error?.message || "비번 초기화 실패");
      }
    } catch {
      setActionErr("네트워크 오류");
    } finally {
      setBusy(false);
    }
  };

  const doToggleBan = async (banned: boolean) => {
    if (!detail) return;
    const verb = banned ? "해제" : "차단";
    if (!confirm(`${detail.name}의 계정을 ${verb}할까요?`)) return;
    setBusy(true);
    setActionErr("");
    try {
      const path = banned ? "unban" : "ban";
      const res = await fetch(`/api/v1/auth/${path}/${detail.id}`, {
        method: "POST",
        credentials: "include",
      });
      const json = await res.json();
      if (res.ok && json?.success) {
        setActionMsg(`계정이 ${verb}되었습니다`);
        await refreshDetail();
      } else {
        setActionErr(json?.error?.message || `${verb} 실패`);
      }
    } catch {
      setActionErr("네트워크 오류");
    } finally {
      setBusy(false);
    }
  };

  const doChangeRole = async (newRole: string) => {
    if (!detail || newRole === detail.role) return;
    setBusy(true);
    setActionErr("");
    try {
      const res = await fetch(`/api/v1/employees/${detail.id}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      const json = await res.json();
      if (res.ok && json?.success) {
        setActionMsg(`역할이 '${roleLabel(newRole)}'로 변경되었습니다`);
        await refreshDetail();
      } else {
        setActionErr(json?.error?.message || "역할 변경 실패");
      }
    } catch {
      setActionErr("네트워크 오류");
    } finally {
      setBusy(false);
    }
  };

  const doSaveStores = async () => {
    if (!detail) return;
    const store_ids = Array.from(assignSel);
    const primary = assignPrimary && store_ids.includes(assignPrimary) ? assignPrimary : undefined;
    setBusy(true);
    setActionErr("");
    try {
      const res = await fetch(`/api/v1/employees/${detail.id}/stores`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ store_ids, primary_store_id: primary }),
      });
      const json = await res.json();
      if (res.ok && json?.success) {
        setActionMsg(`매장 배정 저장 완료 (${json.data.assigned}곳)`);
        await refreshDetail();
      } else {
        setActionErr(json?.error?.message || "매장 배정 실패");
      }
    } catch {
      setActionErr("네트워크 오류");
    } finally {
      setBusy(false);
    }
  };

  const doRemove = async () => {
    if (!detail) return;
    if (!confirm(`${detail.name} (${detail.emp_no})을(를) 제거할까요?\n(소프트 삭제 — 복구 가능)`)) return;
    setBusy(true);
    setActionErr("");
    try {
      const res = await fetch(`/api/v1/employees/${detail.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const json = await res.json();
      if (res.ok && json?.success) {
        closeDetail();
        await load();
      } else {
        setActionErr(json?.error?.message || "제거 실패");
      }
    } catch {
      setActionErr("네트워크 오류");
    } finally {
      setBusy(false);
    }
  };

  // 매장 체크박스 토글
  const toggleStore = (id: string) => {
    setAssignSel((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        if (assignPrimary === id) setAssignPrimary(null);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <div style={{ padding: 20, maxWidth: 1400, margin: "0 auto" }}>
      <style>{`
        .v2tm-input { width: 100%; padding: 9px 11px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 14px; box-sizing: border-box; background:#fff; }
        .v2tm-input:focus { outline: none; border-color: ${NAVY}; }
        .v2tm-label { display: block; font-size: 12px; font-weight: 700; color: #475569; margin-bottom: 6px; }
        .v2tm-btn { padding: 9px 16px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; border: none; }
        .v2tm-btn:disabled { opacity: .5; cursor: not-allowed; }
        .v2tm-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; }
        .v2tm-card.click { cursor: pointer; transition: box-shadow .15s, border-color .15s; }
        .v2tm-card.click:hover { border-color: ${NAVY}; box-shadow: 0 4px 14px rgba(20,40,160,.10); }
        .v2tm-badge { font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 999px; display:inline-block; }
        .v2tm-chip { font-size: 12px; font-weight: 600; padding: 3px 9px; border-radius: 7px; background:#F1F5F9; color:#475569; display:inline-block; }
        .v2tm-overlay { position: fixed; inset: 0; background: rgba(15,23,42,.45); display:flex; align-items:center; justify-content:center; z-index: 60; padding: 16px; }
        .v2tm-modal { background:#fff; border-radius:16px; width:100%; max-width: 560px; max-height: 90vh; overflow:auto; }
        .v2tm-section { border-top: 1px solid #eef2f7; padding: 16px 20px; }
        .v2tm-num { font-family: 'Outfit', system-ui, sans-serif; }
      `}</style>

      {/* ── 헤더 ── */}
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "#1A1D2B", margin: 0 }}>직원 관리</h1>
        <p style={{ fontSize: 13, color: "#64748B", margin: "4px 0 0" }}>
          직원 계정 · 매장 배정 · 역할 관리 (관리자 계정 생성은 추후 지원)
        </p>
      </div>

      {/* ── 필터 ── */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <input
          className="v2tm-input"
          style={{ maxWidth: 260 }}
          placeholder="이름 / 사번 검색"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="v2tm-input" style={{ maxWidth: 150 }} value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
          <option value="">전체 역할</option>
          <option value="crew">크루</option>
          <option value="field_member">필드</option>
          <option value="admin">관리자</option>
        </select>
        <select className="v2tm-input" style={{ maxWidth: 150 }} value={accountFilter} onChange={(e) => setAccountFilter(e.target.value)}>
          <option value="">계정 전체</option>
          <option value="true">계정 있음</option>
          <option value="false">계정 없음</option>
        </select>
        <select className="v2tm-input" style={{ maxWidth: 150 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">재직 (퇴사 제외)</option>
          <option value="수습">수습</option>
          <option value="휴직">휴직</option>
          <option value="퇴사">퇴사</option>
        </select>
      </div>

      {/* ── 목록 ── */}
      {loading ? (
        <div style={{ padding: 60, textAlign: "center", color: "#64748B" }}>로딩 중...</div>
      ) : error ? (
        <div className="v2tm-card" style={{ textAlign: "center", color: "#DC2626" }}>
          {error}
          <div style={{ marginTop: 12 }}>
            <button className="v2tm-btn" onClick={() => load()} style={{ background: "#fff", color: "#DC2626", border: "1px solid #FCA5A5" }}>
              다시 시도
            </button>
          </div>
        </div>
      ) : employees.length === 0 ? (
        <div className="v2tm-card" style={{ padding: "50px 20px", textAlign: "center" }}>
          <div style={{ fontSize: 34, marginBottom: 8 }}>👥</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#1A1D2B" }}>조건에 맞는 직원이 없습니다</div>
          <div style={{ fontSize: 13, color: "#64748B", marginTop: 6 }}>직원 등록은 기존 직원관리에서 진행됩니다</div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 }}>
          {employees.map((e) => {
            const rm = ROLE_META[e.role] ?? { bg: "#F1F5F9", fg: "#475569" };
            const sm = STATUS_META[e.status] ?? { bg: "#F1F5F9", fg: "#475569" };
            const hasAccount = accountIds.has(e.id);
            return (
              <div key={e.id} className="v2tm-card click" onClick={() => openDetail(e.id)}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "#1A1D2B", display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                      {e.name}
                      {e.emp_no && (
                        <span className="v2tm-num" style={{ fontSize: 11, fontWeight: 600, color: "#64748B", background: "#F1F5F9", padding: "2px 7px", borderRadius: 5 }}>
                          {e.emp_no}
                        </span>
                      )}
                    </div>
                    {e.position && <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 3 }}>{e.position}</div>}
                  </div>
                  <span className="v2tm-badge" style={{ background: rm.bg, color: rm.fg }}>{roleLabel(e.role)}</span>
                </div>
                <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
                  <span className="v2tm-badge" style={{ background: sm.bg, color: sm.fg }}>{e.status || "재직"}</span>
                  <span
                    className="v2tm-badge"
                    style={{
                      background: hasAccount ? "#DBEAFE" : "#FEF3C7",
                      color: hasAccount ? NAVY : "#92400E",
                    }}
                  >
                    {hasAccount ? "계정 있음" : "계정 없음"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── 상세 모달 ── */}
      {detailId && (
        <div className="v2tm-overlay" onClick={closeDetail}>
          <div className="v2tm-modal" onClick={(e) => e.stopPropagation()}>
            {detailLoading ? (
              <div style={{ padding: 60, textAlign: "center", color: "#64748B" }}>불러오는 중...</div>
            ) : !detail ? (
              <div style={{ padding: 40, textAlign: "center", color: "#DC2626" }}>
                {actionErr || "상세 정보를 불러오지 못했습니다"}
                <div style={{ marginTop: 14 }}>
                  <button className="v2tm-btn" onClick={closeDetail} style={{ background: "#F1F5F9", color: "#475569" }}>닫기</button>
                </div>
              </div>
            ) : (
              <>
                {/* 헤더 */}
                <div style={{ background: NAVY, color: "#fff", padding: "18px 20px", borderRadius: "16px 16px 0 0", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontSize: 19, fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}>
                      {detail.name}
                      <span className="v2tm-badge" style={{ background: "rgba(255,255,255,.2)", color: "#fff" }}>{roleLabel(detail.role)}</span>
                    </div>
                    <div className="v2tm-num" style={{ fontSize: 12, opacity: 0.85, marginTop: 4 }}>
                      {detail.emp_no} {detail.phone ? `· ${detail.phone}` : ""}
                    </div>
                  </div>
                  <button onClick={closeDetail} style={{ background: "transparent", border: "none", color: "#fff", fontSize: 22, cursor: "pointer", lineHeight: 1 }}>×</button>
                </div>

                {/* 알림 메시지 */}
                {(actionMsg || actionErr) && (
                  <div style={{ padding: "10px 20px", background: actionErr ? "#FEF2F2" : "#F0FDF4", color: actionErr ? "#B91C1C" : "#15803D", fontSize: 13, fontWeight: 600 }}>
                    {actionErr || actionMsg}
                  </div>
                )}

                {/* 계정 섹션 */}
                <div className="v2tm-section">
                  <div className="v2tm-label">계정</div>
                  {detail.account ? (
                    <>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                        <span className="v2tm-chip" style={{ background: "#DBEAFE", color: NAVY }}>계정 있음</span>
                        {detail.account.is_locked && <span className="v2tm-chip" style={{ background: "#FEE2E2", color: "#B91C1C" }}>🔒 잠금/차단</span>}
                        {!detail.account.password_changed && <span className="v2tm-chip" style={{ background: "#FEF3C7", color: "#92400E" }}>초기 비번 미변경</span>}
                        {detail.account.last_login_at && (
                          <span className="v2tm-chip">최근 로그인 {new Date(detail.account.last_login_at).toLocaleDateString("ko-KR")}</span>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button className="v2tm-btn" disabled={busy} onClick={doResetPassword} style={{ background: "#fff", color: NAVY, border: `1px solid ${NAVY}` }}>비번 리셋</button>
                        {detail.account.is_locked ? (
                          <button className="v2tm-btn" disabled={busy} onClick={() => doToggleBan(true)} style={{ background: "#DCFCE7", color: "#15803D" }}>차단 해제</button>
                        ) : (
                          <button className="v2tm-btn" disabled={busy} onClick={() => doToggleBan(false)} style={{ background: "#FEE2E2", color: "#B91C1C" }}>계정 차단</button>
                        )}
                      </div>
                    </>
                  ) : isAdminRole(detail.role) ? (
                    <div style={{ fontSize: 13, color: "#92400E", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 9, padding: "10px 12px" }}>
                      ⚠️ 관리자 계정 생성은 실제 이메일이 필요하여 추후 지원됩니다 (P0-2b).
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontSize: 13, color: "#64748B", marginBottom: 10 }}>아직 로그인 계정이 없습니다. 생성 시 초기 비밀번호가 1회 표시됩니다.</div>
                      <button className="v2tm-btn" disabled={busy} onClick={doCreateAccount} style={{ background: NAVY, color: "#fff" }}>계정 생성</button>
                    </div>
                  )}
                </div>

                {/* 역할 변경 섹션 */}
                <div className="v2tm-section">
                  <div className="v2tm-label">역할</div>
                  {isAdminRole(detail.role) ? (
                    <div style={{ fontSize: 13, color: "#64748B" }}>
                      현재 <b style={{ color: "#1A1D2B" }}>{roleLabel(detail.role)}</b> — 관리자 역할 변경은 본 화면에서 지원하지 않습니다.
                    </div>
                  ) : (
                    <select
                      className="v2tm-input"
                      style={{ maxWidth: 220 }}
                      value={detail.role}
                      disabled={busy}
                      onChange={(e) => doChangeRole(e.target.value)}
                    >
                      <option value="crew">크루</option>
                      <option value="field_member">필드</option>
                    </select>
                  )}
                </div>

                {/* 매장 배정 섹션 */}
                <div className="v2tm-section">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <div className="v2tm-label" style={{ marginBottom: 0 }}>매장 배정</div>
                    <span style={{ fontSize: 12, color: "#94A3B8" }}>{assignSel.size}곳 선택</span>
                  </div>
                  {stores.length === 0 ? (
                    <div style={{ fontSize: 13, color: "#94A3B8" }}>등록된 사업장이 없습니다</div>
                  ) : (
                    <>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 200, overflow: "auto", marginBottom: 10 }}>
                        {stores.map((s) => {
                          const checked = assignSel.has(s.id);
                          return (
                            <div
                              key={s.id}
                              style={{
                                display: "flex", alignItems: "center", justifyContent: "space-between",
                                gap: 8, padding: "8px 10px", borderRadius: 8,
                                border: `1px solid ${checked ? NAVY : "#e2e8f0"}`,
                                background: checked ? "#F5F7FF" : "#fff",
                              }}
                            >
                              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", flex: 1, minWidth: 0 }}>
                                <input type="checkbox" checked={checked} onChange={() => toggleStore(s.id)} />
                                <span style={{ fontSize: 14, fontWeight: 600, color: "#1A1D2B", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</span>
                                {s.site_code && <span className="v2tm-num" style={{ fontSize: 11, color: "#94A3B8" }}>{s.site_code}</span>}
                              </label>
                              {checked && (
                                <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 600, color: assignPrimary === s.id ? GOLD : "#94A3B8", cursor: "pointer", whiteSpace: "nowrap" }}>
                                  <input type="radio" name="primaryStore" checked={assignPrimary === s.id} onChange={() => setAssignPrimary(s.id)} />
                                  주
                                </label>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      <button className="v2tm-btn" disabled={busy} onClick={doSaveStores} style={{ background: NAVY, color: "#fff" }}>매장 배정 저장</button>
                    </>
                  )}
                </div>

                {/* 제거 섹션 */}
                <div className="v2tm-section" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#B91C1C" }}>직원 제거</div>
                    <div style={{ fontSize: 12, color: "#94A3B8" }}>소프트 삭제 — 복구 가능</div>
                  </div>
                  <button className="v2tm-btn" disabled={busy} onClick={doRemove} style={{ background: "#fff", color: "#B91C1C", border: "1px solid #FCA5A5" }}>제거</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── 비번 1회 노출 모달 ── */}
      {pwReveal && (
        <div className="v2tm-overlay" style={{ zIndex: 70 }} onClick={() => setPwReveal(null)}>
          <div className="v2tm-modal" style={{ maxWidth: 380, textAlign: "center", padding: 28 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#1A1D2B" }}>{pwReveal.title}</div>
            {pwReveal.sub && <div style={{ fontSize: 13, color: "#64748B", marginTop: 4 }}>{pwReveal.sub}</div>}
            <div className="v2tm-num" style={{ fontSize: 30, fontWeight: 800, color: NAVY, letterSpacing: 2, margin: "18px 0", background: "#F5F7FF", borderRadius: 12, padding: "16px 0" }}>
              {pwReveal.pw}
            </div>
            <div style={{ fontSize: 12, color: "#94A3B8", marginBottom: 16 }}>
              ⚠️ 이 비밀번호는 다시 표시되지 않습니다. 직원에게 전달 후 변경을 안내하세요.
            </div>
            <button className="v2tm-btn" onClick={() => setPwReveal(null)} style={{ background: NAVY, color: "#fff", width: "100%" }}>확인</button>
          </div>
        </div>
      )}
    </div>
  );
}
