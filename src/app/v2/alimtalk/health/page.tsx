// @ts-nocheck
/**
 * 미팍 통합앱 v2 — 알림톡 환경 헬스체크 페이지 (Part 19D)
 *
 * 경로: /v2/alimtalk/health
 *
 * 기능:
 *   - 9개 Solapi 환경변수 설정 여부 ✅/❌
 *   - 민감 키(API_KEY/SECRET)는 길이만 표시, 나머지는 preview 8자
 *   - Solapi 실시간 잔액/포인트 조회
 *   - 시뮬레이션/실발송 모드 뱃지
 *   - 새로고침 버튼
 *
 * API: GET /api/v1/alimtalk/health
 */
"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

const NAVY = "#1428A0";
const GOLD = "#F5B731";

const ENV_LABELS: Record<string, string> = {
  SOLAPI_API_KEY: "API 키",
  SOLAPI_API_SECRET: "API 시크릿",
  SOLAPI_PF_ID: "발신 프로필 ID",
  SOLAPI_SENDER_NUMBER: "발신번호",
  SOLAPI_TEMPLATE_ENTRY: "입차확인 템플릿",
  SOLAPI_TEMPLATE_READY: "차량준비완료 템플릿",
  SOLAPI_TEMPLATE_MONTHLY_REMIND: "월주차 D-7 템플릿",
  SOLAPI_TEMPLATE_MONTHLY_EXPIRE: "월주차 만료 템플릿",
  SOLAPI_TEMPLATE_MONTHLY_RENEW: "월주차 갱신완료 템플릿",
};

const ENV_GROUPS = [
  {
    title: "인증 (필수)",
    keys: ["SOLAPI_API_KEY", "SOLAPI_API_SECRET", "SOLAPI_PF_ID", "SOLAPI_SENDER_NUMBER"],
  },
  {
    title: "템플릿 코드 (5종)",
    keys: [
      "SOLAPI_TEMPLATE_ENTRY",
      "SOLAPI_TEMPLATE_READY",
      "SOLAPI_TEMPLATE_MONTHLY_REMIND",
      "SOLAPI_TEMPLATE_MONTHLY_EXPIRE",
      "SOLAPI_TEMPLATE_MONTHLY_RENEW",
    ],
  },
];

const TEMPLATE_LABELS: Record<string, string> = {
  entry: "입차확인",
  ready: "차량준비완료",
  monthly_remind: "월주차 D-7",
  monthly_expire: "월주차 만료",
  monthly_renew: "월주차 갱신완료",
};

export default function AlimtalkHealthPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/alimtalk/health", {
        credentials: "include",
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json?.error?.message ?? `HTTP ${res.status}`);
      }
      setData(json.data);
    } catch (e: any) {
      setError(e?.message ?? "헬스체크 로드 실패");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
  }, [fetchHealth]);

  const mode = data?.mode; // "live" | "simulation"
  const balance = data?.balance;
  const env = data?.env ?? {};
  const templates = data?.templates ?? {};

  const setCount = Object.values(env).filter((v: any) => v?.set).length;
  const totalCount = Object.keys(ENV_LABELS).length;

  return (
    <div style={{ padding: "24px", maxWidth: 1100, margin: "0 auto" }}>
      {/* ── 헤더 + 탭 ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: NAVY, margin: 0 }}>
          알림톡 환경 상태
        </h1>
        <button
          onClick={fetchHealth}
          disabled={loading}
          style={{
            padding: "8px 16px",
            background: "#fff",
            border: `1px solid ${NAVY}`,
            color: NAVY,
            borderRadius: 6,
            cursor: loading ? "wait" : "pointer",
            fontWeight: 600,
            fontSize: 13,
          }}
        >
          {loading ? "조회 중..." : "🔄 새로고침"}
        </button>
      </div>

      {/* ── 탭 네비 ── */}
      <div style={{ display: "flex", gap: 4, borderBottom: "1px solid #E5E7EB", marginBottom: 20 }}>
        <Link href="/v2/alimtalk" style={tabStyle(false)}>로그</Link>
        <Link href="/v2/alimtalk/health" style={tabStyle(true)}>환경 상태</Link>
        <Link href="/v2/alimtalk/test" style={tabStyle(false)}>테스트 발송</Link>
      </div>

      {error && (
        <div style={{ padding: 14, background: "#FEE2E2", border: "1px solid #FECACA", borderRadius: 8, color: "#991B1B", marginBottom: 16 }}>
          ⚠️ {error}
        </div>
      )}

      {data && (
        <>
          {/* ── 모드 뱃지 ── */}
          <div style={{
            padding: 18,
            background: mode === "live" ? "#ECFDF5" : "#FEF3C7",
            border: `1px solid ${mode === "live" ? "#10B981" : "#F59E0B"}`,
            borderRadius: 10,
            marginBottom: 20,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: mode === "live" ? "#065F46" : "#92400E" }}>
                {mode === "live" ? "✅ 실발송 모드" : "🧪 시뮬레이션 모드"}
              </div>
              <div style={{ fontSize: 13, color: "#4B5563", marginTop: 4 }}>
                {mode === "live"
                  ? "Solapi 핵심 키 3종(API_KEY/SECRET/PF_ID)이 모두 설정되어 실제 알림톡이 발송됩니다."
                  : "핵심 키가 누락되어 모든 발송 요청이 시뮬레이션으로 처리됩니다 (로그만 기록)."}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 11, color: "#6B7280" }}>환경변수</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: NAVY }}>
                {setCount} / {totalCount}
              </div>
            </div>
          </div>

          {/* ── Solapi 잔액 ── */}
          {balance && (
            <div style={{
              padding: 16,
              background: "#fff",
              border: "1px solid #E5E7EB",
              borderRadius: 10,
              marginBottom: 20,
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 10 }}>
                💰 Solapi 잔액
              </div>
              {balance.available ? (
                <div style={{ display: "flex", gap: 32 }}>
                  <div>
                    <div style={{ fontSize: 11, color: "#6B7280" }}>잔액</div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: NAVY, fontFamily: "Outfit, monospace" }}>
                      ₩{(balance.balance ?? 0).toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: "#6B7280" }}>포인트</div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: GOLD, fontFamily: "Outfit, monospace" }}>
                      {(balance.point ?? 0).toLocaleString()}P
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ color: "#DC2626", fontSize: 13 }}>
                  ❌ 잔액 조회 실패: {balance.error ?? "알 수 없는 오류"}
                </div>
              )}
            </div>
          )}

          {/* ── 환경변수 그룹별 상태 ── */}
          {ENV_GROUPS.map((group) => (
            <div key={group.title} style={{
              padding: 16,
              background: "#fff",
              border: "1px solid #E5E7EB",
              borderRadius: 10,
              marginBottom: 16,
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 12 }}>
                {group.title}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 10 }}>
                {group.keys.map((key) => {
                  const v = env[key] ?? { set: false };
                  return (
                    <div key={key} style={{
                      padding: 12,
                      background: v.set ? "#F0FDF4" : "#FEF2F2",
                      border: `1px solid ${v.set ? "#BBF7D0" : "#FECACA"}`,
                      borderRadius: 8,
                    }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#374151" }}>
                          {ENV_LABELS[key]}
                        </div>
                        <div style={{ fontSize: 16 }}>{v.set ? "✅" : "❌"}</div>
                      </div>
                      <div style={{ fontSize: 10, color: "#9CA3AF", marginTop: 4, fontFamily: "monospace" }}>
                        {key}
                      </div>
                      {v.set && (
                        <div style={{ fontSize: 11, color: "#4B5563", marginTop: 6, fontFamily: "monospace" }}>
                          {v.length !== undefined ? `길이: ${v.length}자` : v.preview}
                        </div>
                      )}
                      {!v.set && (
                        <div style={{ fontSize: 11, color: "#DC2626", marginTop: 6 }}>
                          Vercel에 설정 필요
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* ── 템플릿별 ready 여부 ── */}
          <div style={{
            padding: 16,
            background: "#fff",
            border: "1px solid #E5E7EB",
            borderRadius: 10,
            marginBottom: 16,
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 12 }}>
              📨 템플릿별 발송 가능 여부
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
              {Object.entries(templates).map(([key, v]: [string, any]) => (
                <div key={key} style={{
                  padding: 12,
                  background: v.ready ? "#F0FDF4" : "#FEF2F2",
                  border: `1px solid ${v.ready ? "#BBF7D0" : "#FECACA"}`,
                  borderRadius: 8,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>
                    {TEMPLATE_LABELS[key] ?? key}
                  </div>
                  <div style={{ fontSize: 16 }}>{v.ready ? "✅" : "❌"}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ fontSize: 11, color: "#9CA3AF", textAlign: "right", marginTop: 8 }}>
            조회 시각: {new Date(data.checked_at).toLocaleString("ko-KR")}
          </div>
        </>
      )}
    </div>
  );
}

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
