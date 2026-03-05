// @ts-nocheck
/**
 * 솔라피 알림톡 공통 유틸
 * - HMAC-SHA256 인증
 * - 알림톡 발송
 * - 전화번호 마스킹 (DB 저장 금지 원칙)
 * - 발송 로그 저장
 */

import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

// ─────────────────────────────────────────────
// 템플릿 코드 매핑
// ─────────────────────────────────────────────
export const SOLAPI_TEMPLATES = {
  entry:           () => process.env.SOLAPI_TEMPLATE_ENTRY   ?? "",   // 입차확인
  ready:           () => process.env.SOLAPI_TEMPLATE_READY   ?? "",   // 차량준비완료
  monthly_remind:  () => process.env.SOLAPI_TEMPLATE_MONTHLY_REMIND ?? "", // D-7 안내
  monthly_expire:  () => process.env.SOLAPI_TEMPLATE_MONTHLY_EXPIRE ?? "", // 만료 안내
  monthly_renew:   () => process.env.SOLAPI_TEMPLATE_MONTHLY_RENEW  ?? "", // 갱신 완료
} as const;

export type TemplateKey = keyof typeof SOLAPI_TEMPLATES;

// ─────────────────────────────────────────────
// 인증 헤더 생성 (HMAC-SHA256)
// ─────────────────────────────────────────────
function buildAuthHeader(): string {
  const apiKey    = process.env.SOLAPI_API_KEY!;
  const apiSecret = process.env.SOLAPI_API_SECRET!;
  const date      = new Date().toISOString();
  const salt      = Math.random().toString(36).substring(2, 12);
  const signature = crypto
    .createHmac("sha256", apiSecret)
    .update(date + salt)
    .digest("hex");
  return `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`;
}

// ─────────────────────────────────────────────
// 전화번호 마스킹 (010-****-1234)
// ─────────────────────────────────────────────
export function maskPhone(phone: string): string {
  const cleaned = phone.replace(/-/g, "");
  if (cleaned.length < 8) return "***";
  return cleaned.slice(0, 3) + "****" + cleaned.slice(-4);
}

// ─────────────────────────────────────────────
// 알림톡 발송 (단건)
// ─────────────────────────────────────────────
export interface SendAlimtalkParams {
  to: string;                          // 수신번호
  templateKey: TemplateKey;            // 템플릿 종류
  variables: Record<string, string>;   // #{변수명}: 값
}

export interface SendAlimtalkResult {
  success: boolean;
  messageId?: string;
  simulated?: boolean;
  error?: string;
}

export async function sendAlimtalk(params: SendAlimtalkParams): Promise<SendAlimtalkResult> {
  const { to, templateKey, variables } = params;

  const apiKey     = process.env.SOLAPI_API_KEY;
  const apiSecret  = process.env.SOLAPI_API_SECRET;
  const pfId       = process.env.SOLAPI_PF_ID;
  const sender     = process.env.SOLAPI_SENDER_NUMBER ?? "18991871";
  const templateCode = SOLAPI_TEMPLATES[templateKey]();

  // 환경변수 미설정 → 시뮬레이션 모드
  if (!apiKey || !apiSecret || !pfId || !templateCode) {
    const missing = [
      !apiKey       && "SOLAPI_API_KEY",
      !apiSecret    && "SOLAPI_API_SECRET",
      !pfId         && "SOLAPI_PF_ID",
      !templateCode && `SOLAPI_TEMPLATE_${templateKey.toUpperCase()}`,
    ].filter(Boolean).join(", ");
    console.warn(`[Solapi] 시뮬레이션 모드 (미설정: ${missing})`);
    return { success: true, simulated: true, messageId: `SIM_${Date.now()}` };
  }

  const payload = {
    message: {
      to: to.replace(/-/g, ""),
      from: sender,
      kakaoOptions: { pfId, templateId: templateCode, variables },
    },
  };

  try {
    const res  = await fetch("https://api.solapi.com/messages/v4/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: buildAuthHeader(),
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json();

    if (!res.ok || data.errorCode) {
      return { success: false, error: data.errorMessage ?? "알림톡 발송 실패" };
    }
    return { success: true, messageId: data.messageId };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// ─────────────────────────────────────────────
// 발송 로그 저장 (alimtalk_send_logs)
// ─────────────────────────────────────────────
export interface LogAlimtalkParams {
  orgId: string;
  templateType: string;
  phoneMasked: string;
  result: SendAlimtalkResult;
  ticketId?: string;
  monthlyParkingId?: string;
}

export async function logAlimtalk(params: LogAlimtalkParams): Promise<void> {
  const { orgId, templateType, phoneMasked, result, ticketId, monthlyParkingId } = params;

  const supabaseUrl     = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseService = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!supabaseUrl || !supabaseService) return;

  try {
    const supabase = createClient(supabaseUrl, supabaseService);
    await supabase.from("alimtalk_send_logs").insert({
      org_id:              orgId,
      template_type:       templateType,
      phone_masked:        phoneMasked,
      send_status:         result.success ? "success" : "failed",
      message_id:          result.messageId ?? null,
      error_message:       result.error ?? null,
      ticket_id:           ticketId ?? null,
      monthly_parking_id:  monthlyParkingId ?? null,
      sent_at:             new Date().toISOString(),
    });
  } catch (e) {
    // 로그 저장 실패는 무시 (테이블 미생성 등) - 발송 자체에 영향 없음
    console.warn("[Solapi] 로그 저장 실패 (무시):", e);
  }
}
