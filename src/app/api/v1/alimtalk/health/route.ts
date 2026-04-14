// @ts-nocheck
/**
 * 미팍 통합앱 v2 — 알림톡 환경 헬스체크 API (Part 19D)
 *
 * GET /api/v1/alimtalk/health
 *
 * 목적:
 *   - Vercel 환경변수 9개 설정 여부 한눈에 확인 (값 노출 X, ✅/❌만)
 *   - Solapi 실시간 잔액/포인트 조회 (키가 설정된 경우)
 *   - 시뮬레이션/실발송 모드 최종 판정
 *
 * 응답:
 *   {
 *     mode: "live" | "simulation",
 *     env: {
 *       SOLAPI_API_KEY:           { set: true,  length: 24 },
 *       SOLAPI_API_SECRET:        { set: true,  length: 64 },
 *       SOLAPI_PF_ID:             { set: true,  preview: "KA01PF..." },
 *       SOLAPI_SENDER_NUMBER:     { set: true,  preview: "18991871" },
 *       SOLAPI_TEMPLATE_ENTRY:    { set: true,  preview: "KA01TP..." },
 *       SOLAPI_TEMPLATE_READY:    { set: true,  preview: "KA01TP..." },
 *       SOLAPI_TEMPLATE_MONTHLY_REMIND:  { set: true, preview: "..." },
 *       SOLAPI_TEMPLATE_MONTHLY_EXPIRE:  { set: true, preview: "..." },
 *       SOLAPI_TEMPLATE_MONTHLY_RENEW:   { set: true, preview: "..." },
 *     },
 *     templates: {
 *       entry:            { ready: true },
 *       ready:            { ready: true },
 *       monthly_remind:   { ready: true },
 *       monthly_expire:   { ready: true },
 *       monthly_renew:    { ready: true },
 *     },
 *     balance: {
 *       available: true,
 *       balance: 12345,
 *       point: 0,
 *       error: null,
 *     } | null,
 *     checked_at: ISO
 *   }
 *
 * 권한: MANAGE
 *
 * 주의:
 *   - API_KEY/SECRET 실제 값은 절대 리턴하지 않음 (set 여부 + length 만)
 *   - PF_ID, SENDER_NUMBER, TEMPLATE_* 는 접두 6자만 preview (식별용)
 */
import { NextRequest } from "next/server";
import crypto from "crypto";
import { requireAuth, ok, serverError } from "@/lib/api";

export const dynamic = "force-dynamic";

// 9개 환경변수 정의
const ENV_KEYS = [
  "SOLAPI_API_KEY",
  "SOLAPI_API_SECRET",
  "SOLAPI_PF_ID",
  "SOLAPI_SENDER_NUMBER",
  "SOLAPI_TEMPLATE_ENTRY",
  "SOLAPI_TEMPLATE_READY",
  "SOLAPI_TEMPLATE_MONTHLY_REMIND",
  "SOLAPI_TEMPLATE_MONTHLY_EXPIRE",
  "SOLAPI_TEMPLATE_MONTHLY_RENEW",
] as const;

// 값 노출 허용 여부 (민감 키는 preview 금지)
const SENSITIVE_KEYS = new Set(["SOLAPI_API_KEY", "SOLAPI_API_SECRET"]);

function buildAuthHeader(apiKey: string, apiSecret: string): string {
  const date = new Date().toISOString();
  const salt = Math.random().toString(36).substring(2, 12);
  const signature = crypto
    .createHmac("sha256", apiSecret)
    .update(date + salt)
    .digest("hex");
  return `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`;
}

// Solapi 잔액 조회 (실패해도 전체 응답은 성공)
async function fetchBalance(apiKey: string, apiSecret: string) {
  try {
    const res = await fetch("https://api.solapi.com/cash/v1/balance", {
      method: "GET",
      headers: { Authorization: buildAuthHeader(apiKey, apiSecret) },
      cache: "no-store",
    });
    const data = await res.json();
    if (!res.ok || data.errorCode) {
      return {
        available: false,
        balance: null,
        point: null,
        error: data.errorMessage ?? `HTTP ${res.status}`,
      };
    }
    return {
      available: true,
      balance: typeof data.balance === "number" ? data.balance : Number(data.balance ?? 0),
      point: typeof data.point === "number" ? data.point : Number(data.point ?? 0),
      error: null,
    };
  } catch (err: any) {
    return {
      available: false,
      balance: null,
      point: null,
      error: String(err?.message ?? err),
    };
  }
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, "MANAGE");
  if (auth.error) return auth.error;

  try {
    // ── 1) 환경변수 상태 수집 ──
    const envStatus: Record<string, { set: boolean; length?: number; preview?: string }> = {};
    for (const key of ENV_KEYS) {
      const v = process.env[key];
      if (!v) {
        envStatus[key] = { set: false };
        continue;
      }
      if (SENSITIVE_KEYS.has(key)) {
        // 민감 키: 길이만
        envStatus[key] = { set: true, length: v.length };
      } else {
        // 비민감 키: 앞 8자 + ... (식별용)
        envStatus[key] = {
          set: true,
          preview: v.length > 8 ? v.slice(0, 8) + "..." : v,
        };
      }
    }

    // ── 2) 템플릿별 ready 여부 (3종 핵심 전제조건 모두 세팅됐는지) ──
    const coreReady =
      envStatus.SOLAPI_API_KEY.set &&
      envStatus.SOLAPI_API_SECRET.set &&
      envStatus.SOLAPI_PF_ID.set;

    const templates = {
      entry: { ready: coreReady && envStatus.SOLAPI_TEMPLATE_ENTRY.set },
      ready: { ready: coreReady && envStatus.SOLAPI_TEMPLATE_READY.set },
      monthly_remind: { ready: coreReady && envStatus.SOLAPI_TEMPLATE_MONTHLY_REMIND.set },
      monthly_expire: { ready: coreReady && envStatus.SOLAPI_TEMPLATE_MONTHLY_EXPIRE.set },
      monthly_renew: { ready: coreReady && envStatus.SOLAPI_TEMPLATE_MONTHLY_RENEW.set },
    };

    // ── 3) 모드 판정 ──
    // live: core(API_KEY + SECRET + PF_ID) 세팅 완료
    // simulation: 그 외
    const mode = coreReady ? "live" : "simulation";

    // ── 4) 잔액 조회 (core 세팅된 경우만) ──
    let balance = null;
    if (coreReady) {
      balance = await fetchBalance(
        process.env.SOLAPI_API_KEY!,
        process.env.SOLAPI_API_SECRET!
      );
    }

    return ok({
      mode,
      env: envStatus,
      templates,
      balance,
      checked_at: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("[alimtalk/health] 서버 오류:", err);
    return serverError("헬스체크 조회 실패");
  }
}
