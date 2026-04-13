// @ts-nocheck
/**
 * 미팍 통합앱 v2 — 현장일보 상세 페이지 (Part 13C)
 *
 * 경로: /v2/daily-reports/[id]
 *
 * 영역:
 *   1. 헤더: 사업장+날짜+상태 / 액션(수정이력·확정·해제·삭제)
 *   2. 기본정보: weather/event/memo/total_cars 인라인 편집(MANAGE 또는 본인+미확정)
 *   3. 근무인원 / 결제매출: SectionsEdit 컴포넌트 (view ↔ edit 토글)
 *   4. 사진: PhotoUpload 컴포넌트
 *   5. HistoryDrawer (right slide)
 */
"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import SectionsEdit from "./SectionsEdit";
import PhotoUpload from "./PhotoUpload";
import HistoryDrawer from "./HistoryDrawer";

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  draft:     { bg: "#f1f5f9", color: "#475569", label: "임시저장" },
  submitted: { bg: "#dbeafe", color: "#1d4ed8", label: "제출됨" },
  confirmed: { bg: "#dcfce7", color: "#15803d", label: "확정" },
};

const WEATHER_OPTIONS = ["", "맑음", "흐림", "비", "눈", "안개", "황사"];

export default function DailyReportDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [report, setReport] = useState<any>(null);
  const [me, setMe] = useState<any>(null);
  const [employees, setEmployees] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 마스터 인라인 편집
  const [editing, setEditing] = useState(false);
  const [savingMaster, setSavingMaster] = useState(false);
  const [editWeather, setEditWeather] = useState("");
  const [editEventFlag, setEditEventFlag] = useState(false);
  const [editEventName, setEditEventName] = useState("");
  const [editTotalCars, setEditTotalCars] = useState("");
  const [editMemo, setEditMemo] = useState("");

  // 액션 진행 상태
  const [acting, setActing] = useState(false);

  // 이력 Drawer
  const [historyOpen, setHistoryOpen] = useState(false);

  // ── 일보 + 내 정보 로드 ──
  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rRes, mRes] = await Promise.all([
        fetch(`/api/v1/daily-reports/${id}`, { credentials: "include" }),
        fetch(`/api/v1/auth/me`, { credentials: "include" }),
      ]);

      const rJson = await rRes.json();
      if (!rRes.ok || rJson?.success === false) {
        setError(rJson?.error?.message || `조회 실패 (${rRes.status})`);
        setReport(null);
        return;
      }
      const data = rJson?.data || rJson;
      setReport(data);

      // 인라인 편집 초기값
      setEditWeather(data.weather || "");
      setEditEventFlag(Boolean(data.event_flag));
      setEditEventName(data.event_name || "");
      setEditTotalCars(String(data.total_cars ?? ""));
      setEditMemo(data.memo || "");

      if (mRes.ok) {
        const mJson = await mRes.json();
        setMe(mJson?.data || mJson);
      }

      // 근무인원 수정 모달용 직원 목록
      if (data.store_id) {
        const empRes = await fetch(
          `/api/v1/employees?store_id=${data.store_id}&limit=200`,
          { credentials: "include" }
        );
        if (empRes.ok) {
          const empJson = await empRes.json();
          setEmployees(empJson?.data || []);
        }
      }
    } catch (e: any) {
      setError(e?.message || "네트워크 오류");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { if (id) loadAll(); }, [id, loadAll]);

  if (loading) {
    return (
      <div style={{ padding: 60, textAlign: "center", color: "#64748b" }}>
        불러오는 중...
      </div>
    );
  }
  if (error || !report) {
    return (
      <div style={{ padding: 20 }}>
        <Link href="/v2/daily-reports" style={{ fontSize: 12, color: "#64748b" }}>← 목록으로</Link>
        <div style={{
          marginTop: 14, padding: 30, textAlign: "center",
          background: "#fef2f2", color: "#b91c1c",
          borderRadius: 12, border: "1px solid #fecaca",
          fontWeight: 600,
        }}>
          ⚠ {error || "일보를 찾을 수 없습니다"}
        </div>
      </div>
    );
  }

  // 권한 판정
  const role: string = me?.role || "";
  const myUserId: string = me?.user_id || "";
  const isManage = role === "super_admin" || role === "admin";
  const isOwner = report.created_by === myUserId;
  const isConfirmed = report.status === "confirmed";

  // 마스터 수정 가능: MANAGE 또는 (본인 작성 & 미확정)
  const canEditMaster = isManage || (isOwner && !isConfirmed);
  // staff/payment 수정: MANAGE만
  const canEditChildren = isManage;
  // 확정/해제: MANAGE
  const canConfirm = isManage && !isConfirmed;
  const canUnconfirm = isManage && isConfirmed;

  const sty = STATUS_STYLE[report.status] || STATUS_STYLE.draft;
  const store = report.stores || {};
  const siteCode = store.site_code ? `[${store.site_code}] ` : "";

  // ── 마스터 수정 저장 ──
  async function handleSaveMaster() {
    setSavingMaster(true);
    try {
      const body: any = {
        weather: editWeather || null,
        event_flag: editEventFlag,
        event_name: editEventFlag ? editEventName.trim() || null : null,
        total_cars: Number(editTotalCars || 0),
        memo: editMemo.trim() || null,
      };
      const res = await fetch(`/api/v1/daily-reports/${id}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || json?.success === false) {
        alert(json?.error?.message || `수정 실패 (${res.status})`);
        return;
      }
      setEditing(false);
      await loadAll();
    } catch (e: any) {
      alert(e?.message || "네트워크 오류");
    } finally {
      setSavingMaster(false);
    }
  }

  // ── 확정 ──
  async function handleConfirm() {
    if (!confirm("이 일보를 확정하시겠습니까?\n확정 후에는 작성자가 수정할 수 없습니다.")) return;
    setActing(true);
    try {
      const res = await fetch(`/api/v1/daily-reports/${id}/confirm`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (!res.ok || json?.success === false) {
        alert(json?.error?.message || "확정 실패");
        return;
      }
      alert("✅ 확정 완료");
      await loadAll();
    } finally {
      setActing(false);
    }
  }

  // ── 확정 해제 ──
  async function handleUnconfirm() {
    const reason = prompt("확정 해제 사유를 입력해주세요 (감사 로그 기록용)");
    if (reason === null) return;
    setActing(true);
    try {
      const res = await fetch(`/api/v1/daily-reports/${id}/unconfirm`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() || undefined }),
      });
      const json = await res.json();
      if (!res.ok || json?.success === false) {
        alert(json?.error?.message || "확정 해제 실패");
        return;
      }
      alert("✅ 확정 해제 완료");
      await loadAll();
    } finally {
      setActing(false);
    }
  }

  return (
    <div style={{ padding: "20px 20px 40px", maxWidth: 1100, margin: "0 auto" }}>
      {/* 헤더 */}
      <div style={{
        display: "flex", alignItems: "flex-start", justifyContent: "space-between",
        marginBottom: 18, flexWrap: "wrap", gap: 12,
      }}>
        <div>
          <Link href="/v2/daily-reports" style={{
            fontSize: 12, color: "#64748b", textDecoration: "none",
          }}>
            ← 목록으로
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6 }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: "#0f172a", margin: 0 }}>
              {report.report_date}
            </h1>
            <span style={{
              padding: "3px 10px", borderRadius: 5,
              background: sty.bg, color: sty.color,
              fontSize: 12, fontWeight: 700,
            }}>
              {sty.label}
            </span>
          </div>
          <div style={{ fontSize: 13, color: "#475569", marginTop: 4, fontWeight: 600 }}>
            {siteCode}{store.name || "(사업장 미상)"}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {isManage && (
            <button onClick={() => setHistoryOpen(true)} style={btnGhost("#1428A0")}>
              📝 수정이력
            </button>
          )}
          {canConfirm && (
            <button onClick={handleConfirm} disabled={acting} style={{
              ...btnPrimary("#15803d"),
              opacity: acting ? 0.6 : 1,
            }}>
              ✅ 확정
            </button>
          )}
          {canUnconfirm && (
            <button onClick={handleUnconfirm} disabled={acting} style={{
              ...btnGhost("#dc2626"),
              opacity: acting ? 0.6 : 1,
            }}>
              🔓 확정 해제
            </button>
          )}
        </div>
      </div>

      {/* 1. 기본정보 */}
      <Section
        title="📋 기본정보"
        right={
          canEditMaster && !editing ? (
            <button onClick={() => setEditing(true)} style={btnGhost("#1428A0")}>✏️ 수정</button>
          ) : editing ? (
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => { setEditing(false); loadAll(); }} style={btnGhost("#64748b")}>
                취소
              </button>
              <button onClick={handleSaveMaster} disabled={savingMaster} style={btnPrimary("#1428A0")}>
                {savingMaster ? "저장중..." : "💾 저장"}
              </button>
            </div>
          ) : null
        }
      >
        {!editing ? (
          // 읽기 모드
          <Grid>
            <ReadField label="날씨" value={report.weather || "-"} />
            <ReadField label="총 입차" value={`${report.total_cars ?? 0}대`} />
            <ReadField label="발렛" value={`${report.valet_count ?? 0}대`} />
            <ReadField label="총 매출" value={`${(report.total_revenue ?? 0).toLocaleString("ko-KR")}원`} highlight />
            <ReadField label="행사" value={
              report.event_flag ? `🎉 ${report.event_name || "행사"}` : "-"
            } full />
            <ReadField label="메모" value={report.memo || "-"} full pre />
            <ReadField label="작성자 ID" value={report.created_by || "-"} small />
            <ReadField label="제출일시" value={fmtDateTime(report.submitted_at)} small />
            {report.confirmed_at && (
              <ReadField label="확정일시" value={fmtDateTime(report.confirmed_at)} small />
            )}
          </Grid>
        ) : (
          // 편집 모드
          <Grid>
            <EditField label="날씨">
              <select value={editWeather} onChange={(e) => setEditWeather(e.target.value)} style={inputStyle}>
                {WEATHER_OPTIONS.map((w) => (
                  <option key={w} value={w}>{w || "선택 안 함"}</option>
                ))}
              </select>
            </EditField>
            <EditField label="총 입차 (대)">
              <input
                type="number"
                value={editTotalCars}
                onChange={(e) => setEditTotalCars(e.target.value)}
                min={0}
                style={inputStyle}
              />
            </EditField>
            <EditField label="행사" full>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <label style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  fontSize: 13, padding: "0 10px", height: 38,
                  border: "1px solid #cbd5e1", borderRadius: 8,
                  background: editEventFlag ? "#fef3c7" : "#fff", cursor: "pointer",
                }}>
                  <input
                    type="checkbox"
                    checked={editEventFlag}
                    onChange={(e) => setEditEventFlag(e.target.checked)}
                  />
                  🎉 행사 있음
                </label>
                <input
                  type="text"
                  value={editEventName}
                  onChange={(e) => setEditEventName(e.target.value)}
                  placeholder="행사명"
                  disabled={!editEventFlag}
                  style={{
                    ...inputStyle, flex: 1,
                    background: editEventFlag ? "#fff" : "#f1f5f9",
                  }}
                />
              </div>
            </EditField>
            <EditField label="메모" full>
              <textarea
                value={editMemo}
                onChange={(e) => setEditMemo(e.target.value)}
                rows={3}
                style={{
                  ...inputStyle, height: "auto", padding: "10px 12px",
                  fontFamily: "inherit", resize: "vertical",
                }}
              />
            </EditField>
          </Grid>
        )}
      </Section>

      {/* 2. 근무인원 / 결제매출 (SectionsEdit) */}
      <SectionsEdit
        report={report}
        employees={employees}
        canEdit={canEditChildren}
        onChanged={loadAll}
      />

      {/* 3. 사진 */}
      <Section title="📸 사진">
        <PhotoUpload
          reportId={id}
          orgId={report.org_id}
          extraList={report.extra || []}
          canUpload={isManage || (isOwner && !isConfirmed)}
          onUploaded={loadAll}
        />
      </Section>

      {/* 이력 Drawer */}
      {historyOpen && (
        <HistoryDrawer
          reportId={id}
          open={historyOpen}
          onClose={() => setHistoryOpen(false)}
        />
      )}
    </div>
  );
}

// ── 헬퍼 ──
function fmtDateTime(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "-";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function Section({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{
      background: "#fff", borderRadius: 12,
      border: "1px solid #e2e8f0",
      padding: 20, marginBottom: 16,
    }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 14, paddingBottom: 12,
        borderBottom: "1px solid #f1f5f9",
      }}>
        <h2 style={{ fontSize: 16, fontWeight: 800, color: "#0f172a", margin: 0 }}>{title}</h2>
        {right}
      </div>
      {children}
    </div>
  );
}
function Grid({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
      gap: 14,
    }}>
      {children}
    </div>
  );
}
function ReadField({ label, value, full, highlight, pre, small }: any) {
  return (
    <div style={{ gridColumn: full ? "1 / -1" : "auto" }}>
      <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 700, marginBottom: 4 }}>{label}</div>
      <div style={{
        fontSize: small ? 12 : highlight ? 18 : 14,
        fontWeight: highlight ? 800 : 600,
        color: highlight ? "#1428A0" : "#0f172a",
        whiteSpace: pre ? "pre-wrap" : "normal",
        wordBreak: "break-all",
      }}>
        {value}
      </div>
    </div>
  );
}
function EditField({ label, children, full }: any) {
  return (
    <div style={{ gridColumn: full ? "1 / -1" : "auto" }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  );
}
const inputStyle: React.CSSProperties = {
  width: "100%", height: 38, padding: "0 10px",
  borderRadius: 8, border: "1px solid #cbd5e1",
  background: "#fff", fontSize: 13, color: "#0f172a",
  boxSizing: "border-box",
};
function btnPrimary(color: string): React.CSSProperties {
  return {
    height: 36, padding: "0 14px", borderRadius: 8,
    background: color, color: "#fff", border: "none",
    fontWeight: 700, fontSize: 13, cursor: "pointer",
  };
}
function btnGhost(color: string): React.CSSProperties {
  return {
    height: 36, padding: "0 14px", borderRadius: 8,
    background: "#fff", color, border: `1.5px solid ${color}`,
    fontWeight: 700, fontSize: 13, cursor: "pointer",
  };
}
