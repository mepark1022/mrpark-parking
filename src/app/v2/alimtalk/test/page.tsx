// @ts-nocheck
/**
 * 미팍 통합앱 v2 — 알림톡 테스트 발송 페이지 (Part 19D)
 *
 * 경로: /v2/alimtalk/test
 *
 * 기능:
 *   - 템플릿 5종 라디오 선택
 *   - 수신번호 입력 (기본: 대표 번호 빈칸 — 직접 입력)
 *   - 템플릿별 변수 입력 폼 (자동 생성) + 합리적 기본값 프리필
 *   - dryRun 토글 (켜면 실발송 없이 payload preview)
 *   - 발송 확인 모달 (실발송 시 한 번 더 확인)
 *   - 결과 표시 (messageId, error 등)
 *
 * API: POST /api/v1/alimtalk/test-send
 */
"use client";
export const dynamic = "force-dynamic";

import { useState, useMemo } from "react";
import Link from "next/link";

const NAVY = "#1428A0";
const GOLD = "#F5B731";

type TemplateKey = "entry" | "ready" | "monthly_remind" | "monthly_expire" | "monthly_renew";

const TEMPLATES: Array<{
  key: TemplateKey;
  label: string;
  description: string;
  vars: Array<{ name: string; label: string; default: string }>;
}> = [
  {
    key: "entry",
    label: "입차확인",
    description: "고객이 주차장에 입차했을 때 자동 발송되는 안내",
    vars: [
      { name: "#{매장명}", label: "매장명", default: "미팍 테스트 매장" },
      { name: "#{차량번호}", label: "차량번호", default: "123가 4567" },
      { name: "#{입차시간}", label: "입차시간", default: "2026-04-14 15:30" },
      { name: "#{요금안내}", label: "요금안내", default: "아래 버튼에서 확인" },
      { name: "#{티켓ID}", label: "티켓ID", default: "TEST-0001" },
    ],
  },
  {
    key: "ready",
    label: "차량준비완료",
    description: "발렛 주차 차량이 출구에서 준비 완료됐을 때",
    vars: [
      { name: "#{차량번호}", label: "차량번호", default: "123가 4567" },
      { name: "#{출구위치}", label: "출구위치", default: "정문 앞" },
      { name: "#{준비시간}", label: "준비시간", default: "5분 이내" },
      { name: "#{티켓ID}", label: "티켓ID", default: "TEST-0001" },
    ],
  },
  {
    key: "monthly_remind",
    label: "월주차 D-7 만기 안내",
    description: "월주차 계약 만기 7일 전 안내",
    vars: [
      { name: "#{고객명}", label: "고객명", default: "홍길동" },
      { name: "#{차량번호}", label: "차량번호", default: "123가 4567" },
      { name: "#{매장명}", label: "매장명", default: "미팍 테스트 매장" },
      { name: "#{만료일}", label: "만료일", default: "2026-04-21" },
      { name: "#{월요금}", label: "월요금", default: "150,000원" },
    ],
  },
  {
    key: "monthly_expire",
    label: "월주차 만료",
    description: "월주차 계약 만료일 당일 안내",
    vars: [
      { name: "#{고객명}", label: "고객명", default: "홍길동" },
      { name: "#{차량번호}", label: "차량번호", default: "123가 4567" },
      { name: "#{매장명}", label: "매장명", default: "미팍 테스트 매장" },
      { name: "#{만료일}", label: "만료일", default: "2026-04-14" },
    ],
  },
  {
    key: "monthly_renew",
    label: "월주차 갱신완료",
    description: "월주차 계약 갱신 완료 시 발송",
    vars: [
      { name: "#{고객명}", label: "고객명", default: "홍길동" },
      { name: "#{차량번호}", label: "차량번호", default: "123가 4567" },
      { name: "#{매장명}", label: "매장명", default: "미팍 테스트 매장" },
      { name: "#{시작일}", label: "시작일", default: "2026-04-15" },
      { name: "#{만료일}", label: "만료일", default: "2026-05-14" },
      { name: "#{월요금}", label: "월요금", default: "150,000원" },
    ],
  },
];

export default function AlimtalkTestPage() {
  const [templateKey, setTemplateKey] = useState<TemplateKey>("entry");
  const [phone, setPhone] = useState("");
  const [dryRun, setDryRun] = useState(true); // 기본 dryRun ON (안전)
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const currentTpl = useMemo(
    () => TEMPLATES.find((t) => t.key === templateKey)!,
    [templateKey]
  );

  // 변수 상태 — templateKey 바뀌면 default로 초기화
  const [vars, setVars] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    currentTpl.vars.forEach((v) => (initial[v.name] = v.default));
    return initial;
  });

  const handleTemplateChange = (newKey: TemplateKey) => {
    setTemplateKey(newKey);
    const tpl = TEMPLATES.find((t) => t.key === newKey)!;
    const fresh: Record<string, string> = {};
    tpl.vars.forEach((v) => (fresh[v.name] = v.default));
    setVars(fresh);
    setResult(null);
  };

  const handleSend = async () => {
    if (!dryRun) {
      setConfirmOpen(true);
      return;
    }
    await doSend();
  };

  const doSend = async () => {
    setConfirmOpen(false);
    setSending(true);
    setResult(null);
    try {
      const res = await fetch("/api/v1/alimtalk/test-send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          templateKey,
          to: phone,
          variables: vars,
          dryRun,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setResult({ ok: false, error: json?.error?.message ?? `HTTP ${res.status}` });
      } else {
        setResult({ ok: true, data: json.data });
      }
    } catch (e: any) {
      setResult({ ok: false, error: e?.message ?? "네트워크 오류" });
    } finally {
      setSending(false);
    }
  };

  const canSend = phone.replace(/-/g, "").length >= 10 && !sending;

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      {/* ── 헤더 ── */}
      <h1 style={{ fontSize: 22, fontWeight: 800, color: NAVY, margin: "0 0 16px 0" }}>
        알림톡 테스트 발송
      </h1>

      {/* ── 탭 ── */}
      <div style={{ display: "flex", gap: 4, borderBottom: "1px solid #E5E7EB", marginBottom: 20 }}>
        <Link href="/v2/alimtalk" style={tabStyle(false)}>로그</Link>
        <Link href="/v2/alimtalk/health" style={tabStyle(false)}>환경 상태</Link>
        <Link href="/v2/alimtalk/test" style={tabStyle(true)}>테스트 발송</Link>
      </div>

      {/* ── 경고 배너 ── */}
      <div style={{
        padding: 14,
        background: dryRun ? "#FEF3C7" : "#FEE2E2",
        border: `1px solid ${dryRun ? "#F59E0B" : "#DC2626"}`,
        borderRadius: 8,
        marginBottom: 20,
        fontSize: 13,
        color: dryRun ? "#92400E" : "#991B1B",
      }}>
        {dryRun
          ? "🧪 DryRun 모드: 실제 발송 없이 payload만 검증합니다 (비용 0)."
          : "⚠️ 실발송 모드: Solapi를 통해 실제 카카오톡이 발송되며 비용이 발생합니다."}
      </div>

      {/* ── 템플릿 선택 ── */}
      <div style={box}>
        <label style={labelStyle}>1. 템플릿 선택</label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 8, marginTop: 10 }}>
          {TEMPLATES.map((t) => (
            <label key={t.key} style={{
              padding: 12,
              border: `1.5px solid ${templateKey === t.key ? NAVY : "#E5E7EB"}`,
              background: templateKey === t.key ? "#EFF6FF" : "#fff",
              borderRadius: 8,
              cursor: "pointer",
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
            }}>
              <input
                type="radio"
                name="template"
                value={t.key}
                checked={templateKey === t.key}
                onChange={() => handleTemplateChange(t.key)}
                style={{ marginTop: 3 }}
              />
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: NAVY }}>{t.label}</div>
                <div style={{ fontSize: 11, color: "#6B7280", marginTop: 2 }}>{t.description}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* ── 수신번호 ── */}
      <div style={box}>
        <label style={labelStyle}>2. 수신번호</label>
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value.replace(/[^\d-]/g, ""))}
          placeholder="01012345678 (하이픈 자동 제거)"
          style={inputStyle}
        />
        <div style={{ fontSize: 11, color: "#6B7280", marginTop: 4 }}>
          테스트용 번호 (대표님 휴대폰 등). DB에 저장되지 않으며 마스킹 로그만 기록됩니다.
        </div>
      </div>

      {/* ── 변수 입력 ── */}
      <div style={box}>
        <label style={labelStyle}>3. 템플릿 변수</label>
        <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
          {currentTpl.vars.map((v) => (
            <div key={v.name} style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 10, alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>{v.label}</div>
                <div style={{ fontSize: 10, color: "#9CA3AF", fontFamily: "monospace" }}>{v.name}</div>
              </div>
              <input
                type="text"
                value={vars[v.name] ?? ""}
                onChange={(e) => setVars({ ...vars, [v.name]: e.target.value })}
                style={inputStyle}
              />
            </div>
          ))}
        </div>
      </div>

      {/* ── DryRun 토글 + 발송 버튼 ── */}
      <div style={{ ...box, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={dryRun}
            onChange={(e) => setDryRun(e.target.checked)}
            style={{ width: 18, height: 18 }}
          />
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#374151" }}>DryRun 모드</div>
            <div style={{ fontSize: 11, color: "#6B7280" }}>실제 발송 없이 payload만 검증</div>
          </div>
        </label>
        <button
          onClick={handleSend}
          disabled={!canSend}
          style={{
            padding: "12px 28px",
            background: canSend ? (dryRun ? NAVY : "#DC2626") : "#D1D5DB",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 700,
            cursor: canSend ? "pointer" : "not-allowed",
          }}
        >
          {sending ? "전송 중..." : dryRun ? "🧪 DryRun 실행" : "🚀 실제 발송"}
        </button>
      </div>

      {/* ── 결과 ── */}
      {result && (
        <div style={{
          padding: 16,
          background: result.ok ? "#F0FDF4" : "#FEF2F2",
          border: `1px solid ${result.ok ? "#BBF7D0" : "#FECACA"}`,
          borderRadius: 10,
          marginTop: 16,
        }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: result.ok ? "#065F46" : "#991B1B", marginBottom: 10 }}>
            {result.ok ? "✅ 성공" : "❌ 실패"}
          </div>
          <pre style={{
            fontSize: 11,
            fontFamily: "monospace",
            background: "#fff",
            padding: 12,
            borderRadius: 6,
            overflow: "auto",
            maxHeight: 400,
            margin: 0,
            color: "#374151",
          }}>
            {JSON.stringify(result.ok ? result.data : { error: result.error }, null, 2)}
          </pre>
        </div>
      )}

      {/* ── 확인 모달 (실발송) ── */}
      {confirmOpen && (
        <div
          onClick={() => setConfirmOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: "#fff", padding: 24, borderRadius: 12, maxWidth: 420, width: "90%" }}
          >
            <h3 style={{ fontSize: 16, fontWeight: 800, color: "#DC2626", margin: "0 0 12px 0" }}>
              ⚠️ 실제 발송 확인
            </h3>
            <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.6, marginBottom: 16 }}>
              <strong>{phone.replace(/(\d{3})(\d{4})(\d{4})/, "$1-$2-$3")}</strong> 번호로<br />
              <strong>{currentTpl.label}</strong> 템플릿 알림톡을 실제로 발송합니다.<br /><br />
              Solapi 잔액에서 비용이 차감되며, 수신자에게 카카오톡이 전송됩니다. 계속하시겠습니까?
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setConfirmOpen(false)} style={btnSecondary}>취소</button>
              <button onClick={doSend} style={btnDanger}>발송</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── 스타일 ──
const box = {
  padding: 16,
  background: "#fff",
  border: "1px solid #E5E7EB",
  borderRadius: 10,
  marginBottom: 16,
};
const labelStyle = { fontSize: 13, fontWeight: 700, color: "#374151" };
const inputStyle: any = {
  width: "100%",
  padding: "8px 12px",
  border: "1px solid #D1D5DB",
  borderRadius: 6,
  fontSize: 13,
  fontFamily: "monospace",
  boxSizing: "border-box",
};
const btnSecondary: any = {
  padding: "8px 16px",
  background: "#fff",
  border: "1px solid #D1D5DB",
  color: "#374151",
  borderRadius: 6,
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 600,
};
const btnDanger: any = {
  padding: "8px 16px",
  background: "#DC2626",
  border: "1px solid #DC2626",
  color: "#fff",
  borderRadius: 6,
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 700,
};

function tabStyle(active: boolean): any {
  return {
    padding: "10px 18px",
    fontSize: 13,
    fontWeight: 600,
    color: active ? NAVY : "#6B7280",
    borderBottom: active ? `2px solid ${NAVY}` : "2px solid transparent",
    textDecoration: "none",
    marginBottom: -1,
  };
}
