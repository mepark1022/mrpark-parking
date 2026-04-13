// @ts-nocheck
/**
 * 미팍 통합앱 v2 — 현장일보 결제매출 입력 (Part 13B)
 *
 * 행 단위 입력:
 *   결제수단 / 금액 / 건수 / 메모 / 삭제
 *
 * 결제수단 7종:
 *   card(카드), cash(현금), valet_fee(발렛비), monthly(월정액),
 *   free(무료), transfer(계좌이체), other(기타)
 *
 * valet_fee의 count는 마스터의 valet_count로 자동 반영됨 (서버에서 처리)
 */
"use client";

const PAYMENT_OPTIONS = [
  { value: "card",      label: "💳 카드",       color: "#1428A0" },
  { value: "cash",      label: "💵 현금",       color: "#15803d" },
  { value: "valet_fee", label: "🚗 발렛비",     color: "#F5B731" },
  { value: "monthly",   label: "📅 월정액",     color: "#7c3aed" },
  { value: "transfer",  label: "🏦 계좌이체",   color: "#0891b2" },
  { value: "free",      label: "🆓 무료",       color: "#94a3b8" },
  { value: "other",     label: "📝 기타",       color: "#64748b" },
];

interface Props {
  paymentList: any[];
  onChange: (next: any[]) => void;
}

export default function PaymentSection({ paymentList, onChange }: Props) {
  // 자주 쓰는 항목 빠른 추가
  function addRow(method: string = "") {
    onChange([
      ...paymentList,
      {
        method,
        amount: "",
        count: method === "valet_fee" ? "" : "",
        memo: "",
      },
    ]);
  }

  function removeRow(idx: number) {
    onChange(paymentList.filter((_, i) => i !== idx));
  }

  function updateRow(idx: number, patch: Partial<any>) {
    onChange(paymentList.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  }

  // 이미 사용된 결제수단 (같은 결제수단 중복 등록 가능 — 서버는 막지 않으므로 UI도 자유)
  const usedMethods = new Set(paymentList.map((p) => p.method).filter(Boolean));

  return (
    <div>
      {paymentList.length === 0 ? (
        <div style={{
          padding: 30, textAlign: "center", color: "#94a3b8",
          background: "#f8fafc", borderRadius: 8, fontSize: 13,
          marginBottom: 12,
        }}>
          아직 등록된 결제내역이 없습니다
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#f8fafc" }}>
                <Th width={140}>결제수단</Th>
                <Th width={140}>금액 (원)</Th>
                <Th width={90}>건수</Th>
                <Th>메모</Th>
                <Th width={50}></Th>
              </tr>
            </thead>
            <tbody>
              {paymentList.map((p, idx) => {
                const opt = PAYMENT_OPTIONS.find((o) => o.value === p.method);
                return (
                  <tr key={idx} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <Td>
                      <select
                        value={p.method}
                        onChange={(e) => updateRow(idx, { method: e.target.value })}
                        style={{
                          ...cellInput,
                          fontWeight: 700,
                          color: opt?.color || "#0f172a",
                        }}
                      >
                        <option value="">선택</option>
                        {PAYMENT_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </Td>
                    <Td>
                      <input
                        type="number"
                        value={p.amount}
                        onChange={(e) => updateRow(idx, { amount: e.target.value })}
                        placeholder="0"
                        min={0}
                        step={100}
                        style={{
                          ...cellInput, textAlign: "right",
                          fontWeight: 700, fontSize: 14,
                        }}
                      />
                    </Td>
                    <Td>
                      <input
                        type="number"
                        value={p.count}
                        onChange={(e) => updateRow(idx, { count: e.target.value })}
                        placeholder="0"
                        min={0}
                        style={{ ...cellInput, textAlign: "right" }}
                      />
                    </Td>
                    <Td>
                      <input
                        type="text"
                        value={p.memo}
                        onChange={(e) => updateRow(idx, { memo: e.target.value })}
                        placeholder="(선택)"
                        style={cellInput}
                      />
                    </Td>
                    <Td>
                      <button
                        onClick={() => removeRow(idx)}
                        title="삭제"
                        style={{
                          width: 32, height: 32, borderRadius: 6,
                          background: "#fef2f2", color: "#dc2626",
                          border: "1px solid #fecaca",
                          fontSize: 14, cursor: "pointer",
                        }}
                      >
                        ✕
                      </button>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 빠른 추가 버튼 */}
      <div style={{ marginTop: 12, display: "flex", gap: 6, flexWrap: "wrap" }}>
        {PAYMENT_OPTIONS.map((opt) => {
          const used = usedMethods.has(opt.value);
          return (
            <button
              key={opt.value}
              onClick={() => addRow(opt.value)}
              title={used ? "이미 추가됨 (재추가 가능)" : "추가"}
              style={{
                height: 34, padding: "0 12px", borderRadius: 6,
                background: used ? "#f1f5f9" : "#fff",
                color: opt.color,
                border: `1.5px ${used ? "solid" : "dashed"} ${opt.color}`,
                fontWeight: 700, fontSize: 12, cursor: "pointer",
                opacity: used ? 0.7 : 1,
              }}
            >
              + {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Th({ children, width }: { children?: React.ReactNode; width?: number }) {
  return (
    <th style={{
      padding: "10px 8px",
      textAlign: "left", fontSize: 12, fontWeight: 700, color: "#475569",
      borderBottom: "1px solid #e2e8f0",
      width,
    }}>{children}</th>
  );
}
function Td({ children }: { children: React.ReactNode }) {
  return <td style={{ padding: "8px" }}>{children}</td>;
}
const cellInput: React.CSSProperties = {
  width: "100%", height: 34, padding: "0 8px",
  borderRadius: 6, border: "1px solid #e2e8f0",
  fontSize: 13, color: "#0f172a", background: "#fff",
  boxSizing: "border-box",
};
