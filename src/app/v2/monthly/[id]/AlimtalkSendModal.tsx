// @ts-nocheck
/**
 * 미팍 통합앱 v2 — 월주차 알림톡 수동 발송 모달 (Part 18C)
 *
 * 3종 템플릿 선택 → 미리보기 → 발송
 *   - renewal_remind  (D-7 만기 안내)
 *   - monthly_expire  (만료 안내)
 *   - renewal_complete (갱신 완료)
 *
 * API: POST /api/alimtalk/monthly
 */
"use client";

import { useState } from "react";

const NAVY = "#1428A0";
const GOLD = "#F5B731";

type TemplateKey = "renewal_remind" | "monthly_expire" | "renewal_complete";

const TEMPLATES: Array<{
  key: TemplateKey;
  label: string;
  description: string;
  variables: string[]; // 표시용
  preview: (m: any) => string;
}> = [
  {
    key: "renewal_remind",
    label: "D-7 만기 안내",
    description: "만료 7일 전 갱신 안내용. 수동으로 아무 때나 발송 가능.",
    variables: ["고객명", "차량번호", "매장명", "만료일", "월요금"],
    preview: (m) =>
      `${m.customer_name || "고객"}님, ${m.stores?.name || "매장"}의 월주차(${m.vehicle_number})가 ${fmtDate(
        m.end_date
      )} 만료 예정입니다. 월요금 ${Number(m.monthly_fee || 0).toLocaleString()}원`,
  },
  {
    key: "monthly_expire",
    label: "만료 안내",
    description: "계약이 만료된(또는 당일 만료) 고객에게 안내.",
    variables: ["고객명", "차량번호", "매장명", "만료일"],
    preview: (m) =>
      `${m.customer_name || "고객"}님, ${m.stores?.name || "매장"}의 월주차(${m.vehicle_number})가 ${fmtDate(
        m.end_date
      )} 만료되었습니다.`,
  },
  {
    key: "renewal_complete",
    label: "갱신 완료",
    description: "갱신 계약 생성 후 재발송용. 일반 갱신은 자동 발송됩니다.",
    variables: ["고객명", "차량번호", "매장명", "시작일", "만료일", "월요금"],
    preview: (m) =>
      `${m.customer_name || "고객"}님, ${m.stores?.name || "매장"} 월주차(${m.vehicle_number})가 ${fmtDate(
        m.start_date
      )} ~ ${fmtDate(m.end_date)}로 갱신되었습니다. 월요금 ${Number(
        m.monthly_fee || 0
      ).toLocaleString()}원`,
  },
];

function fmtDate(s: string | null): string {
  if (!s) return "-";
  return s.replace(/-/g, ".");
}

function maskPhone(p: string): string {
  const d = (p || "").replace(/-/g, "");
  if (d.length < 8) return p;
  return d.slice(0, 3) + "-****-" + d.slice(-4);
}

export default function AlimtalkSendModal({
  monthly,
  orgId,
  onClose,
}: {
  monthly: any;
  orgId: string;
  onClose: () => void;
}) {
  const [selectedKey, setSelectedKey] = useState<TemplateKey>("renewal_remind");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    simulated?: boolean;
  } | null>(null);

  const phone = monthly?.customer_phone || "";
  const phoneValid = phone.replace(/-/g, "").length >= 10;

  const selected = TEMPLATES.find((t) => t.key === selectedKey)!;

  const handleSend = async () => {
    if (!phoneValid) {
      alert("고객 전화번호가 없거나 유효하지 않습니다.");
      return;
    }
    const confirmMsg = `${selected.label} 알림톡을\n${maskPhone(phone)} 으로 발송하시겠습니까?`;
    if (!window.confirm(confirmMsg)) return;

    setSending(true);
    setResult(null);
    try {
      const res = await fetch("/api/alimtalk/monthly", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          phone,
          customerName: monthly.customer_name || "",
          vehicleNumber: monthly.vehicle_number,
          storeName: monthly.stores?.name || "",
          endDate: monthly.end_date,
          startDate: monthly.start_date,
          fee: monthly.monthly_fee || 0,
          templateType: selectedKey,
          contractId: monthly.id,
          orgId,
        }),
      });
      const body = await res.json().catch(() => ({}));

      if (res.ok && body?.success) {
        setResult({
          success: true,
          message: body.simulated
            ? "✅ 시뮬레이션 모드로 발송 완료 (Solapi 키 미설정)"
            : "✅ 알림톡 발송 완료",
          simulated: body.simulated,
        });
      } else {
        setResult({
          success: false,
          message: `❌ 발송 실패: ${body?.error || res.statusText}`,
        });
      }
    } catch (e: any) {
      setResult({ success: false, message: `❌ 오류: ${e?.message || e}` });
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "white",
          borderRadius: 12,
          width: "100%",
          maxWidth: 560,
          maxHeight: "90vh",
          overflow: "auto",
          boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
        }}
      >
        {/* 헤더 */}
        <div
          style={{
            padding: "18px 24px",
            borderBottom: "1px solid #e5e7eb",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <h3
            style={{
              margin: 0,
              fontSize: 17,
              fontWeight: 800,
              color: NAVY,
            }}
          >
            📨 알림톡 수동 발송
          </h3>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              fontSize: 22,
              cursor: "pointer",
              color: "#999",
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        {/* 본문 */}
        <div style={{ padding: 24 }}>
          {/* 수신자 */}
          <div
            style={{
              background: "#f9fafb",
              border: "1px solid #e5e7eb",
              borderRadius: 8,
              padding: 14,
              marginBottom: 16,
              fontSize: 13,
            }}
          >
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              <div>
                <span style={{ color: "#666" }}>고객:</span>{" "}
                <b>{monthly.customer_name || "-"}</b>
              </div>
              <div>
                <span style={{ color: "#666" }}>차량:</span>{" "}
                <b style={{ fontFamily: "monospace" }}>
                  {monthly.vehicle_number}
                </b>
              </div>
              <div>
                <span style={{ color: "#666" }}>수신번호:</span>{" "}
                <b
                  style={{
                    fontFamily: "monospace",
                    color: phoneValid ? "#111" : "#dc2626",
                  }}
                >
                  {phoneValid ? maskPhone(phone) : "(없음/무효)"}
                </b>
              </div>
            </div>
          </div>

          {/* 템플릿 선택 */}
          <div style={{ marginBottom: 14 }}>
            <label
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: NAVY,
                marginBottom: 8,
                display: "block",
              }}
            >
              발송 템플릿
            </label>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {TEMPLATES.map((t) => (
                <label
                  key={t.key}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 10,
                    padding: 12,
                    border:
                      selectedKey === t.key
                        ? `2px solid ${NAVY}`
                        : "1px solid #e5e7eb",
                    borderRadius: 8,
                    cursor: "pointer",
                    background: selectedKey === t.key ? "#f0f4ff" : "white",
                  }}
                >
                  <input
                    type="radio"
                    name="template"
                    value={t.key}
                    checked={selectedKey === t.key}
                    onChange={() => {
                      setSelectedKey(t.key);
                      setResult(null);
                    }}
                    style={{ marginTop: 2 }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>
                      {t.label}
                    </div>
                    <div style={{ fontSize: 12, color: "#666", marginTop: 2 }}>
                      {t.description}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* 미리보기 */}
          <div style={{ marginBottom: 16 }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "#666",
                marginBottom: 6,
              }}
            >
              미리보기 (대략적인 내용)
            </div>
            <div
              style={{
                padding: 14,
                background: "#fef9c3",
                border: `1px solid ${GOLD}`,
                borderRadius: 8,
                fontSize: 13,
                lineHeight: 1.6,
                color: "#111",
                whiteSpace: "pre-wrap",
              }}
            >
              {selected.preview(monthly)}
            </div>
            <div
              style={{
                marginTop: 6,
                fontSize: 11,
                color: "#999",
              }}
            >
              * 실제 전송되는 내용은 카카오 승인 템플릿 원문을 따릅니다.
            </div>
          </div>

          {/* 결과 */}
          {result && (
            <div
              style={{
                padding: 12,
                borderRadius: 8,
                fontSize: 13,
                marginBottom: 12,
                background: result.success ? "#d1fae5" : "#fee2e2",
                color: result.success ? "#065f46" : "#991b1b",
                fontWeight: 600,
              }}
            >
              {result.message}
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div
          style={{
            padding: "14px 24px",
            borderTop: "1px solid #e5e7eb",
            display: "flex",
            gap: 8,
            justifyContent: "flex-end",
            background: "#f9fafb",
          }}
        >
          <button
            onClick={onClose}
            disabled={sending}
            style={{
              padding: "10px 18px",
              background: "white",
              border: "1px solid #d1d5db",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              cursor: sending ? "wait" : "pointer",
            }}
          >
            {result?.success ? "닫기" : "취소"}
          </button>
          {!result?.success && (
            <button
              onClick={handleSend}
              disabled={sending || !phoneValid}
              style={{
                padding: "10px 20px",
                background: phoneValid && !sending ? NAVY : "#ccc",
                color: "white",
                border: "none",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 700,
                cursor: phoneValid && !sending ? "pointer" : "not-allowed",
              }}
            >
              {sending ? "발송 중…" : "📨 발송하기"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
