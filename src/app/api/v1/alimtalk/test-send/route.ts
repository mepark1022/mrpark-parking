// @ts-nocheck
/**
 * 미팍 통합앱 v2 — 알림톡 테스트 발송 API (Part 19D)
 *
 * POST /api/v1/alimtalk/test-send
 *
 * 목적:
 *   - 실배포 전 대표님 번호로 5종 템플릿 실발송 검증
 *   - dryRun 모드: 실제 발송 없이 payload preview만 리턴 (Solapi 비용 0)
 *   - 로그는 template_type 앞에 "test_" 접두를 붙여 운영 로그와 구분
 *
 * Body:
 *   {
 *     templateKey: "entry" | "ready" | "monthly_remind" | "monthly_expire" | "monthly_renew",
 *     to: "01012345678",              // 수신번호
 *     variables: { "#{변수명}": "값", ... },
 *     dryRun?: boolean                // true 면 실발송 안 함
 *   }
 *
 * 응답:
 *   {
 *     dryRun: boolean,
 *     simulated: boolean,              // Solapi env 미설정 자동 시뮬레이션 여부
 *     templateKey, templateCode,
 *     to_masked: "010****5678",
 *     variables,                       // 에코
 *     result: { success, messageId?, error? },
 *     logged: boolean                  // alimtalk_send_logs 저장 성공 여부
 *   }
 *
 * 권한: MANAGE
 *
 * 주의:
 *   - 실제 전화번호는 DB에 저장 금지 (마스킹만 로그)
 *   - dryRun=true 면 Solapi 호출도 안 하고 로그도 남기지 않음
 *   - 운영 로그와 섞이지 않도록 template_type = "test_" + templateKey
 */
import { NextRequest } from "next/server";
import {
  requireAuth,
  ok,
  badRequest,
  serverError,
  ErrorCodes,
} from "@/lib/api";
import {
  sendAlimtalk,
  logAlimtalk,
  maskPhone,
  SOLAPI_TEMPLATES,
} from "@/lib/utils/solapi";

export const dynamic = "force-dynamic";

const ALLOWED_TEMPLATE_KEYS = new Set([
  "entry",
  "ready",
  "monthly_remind",
  "monthly_expire",
  "monthly_renew",
]);

// 템플릿별 필수 변수 (미설정 시 공백 기본값 허용하지만 경고용 목록)
const TEMPLATE_REQUIRED_VARS: Record<string, string[]> = {
  entry: ["#{매장명}", "#{차량번호}", "#{입차시간}", "#{요금안내}", "#{티켓ID}"],
  ready: ["#{차량번호}", "#{출구위치}", "#{준비시간}", "#{티켓ID}"],
  monthly_remind: ["#{고객명}", "#{차량번호}", "#{매장명}", "#{만료일}", "#{월요금}"],
  monthly_expire: ["#{고객명}", "#{차량번호}", "#{매장명}", "#{만료일}"],
  monthly_renew: [
    "#{고객명}",
    "#{차량번호}",
    "#{매장명}",
    "#{시작일}",
    "#{만료일}",
    "#{월요금}",
  ],
};

// 전화번호 유효성 (하이픈 허용, 숫자 10자 이상)
function isValidPhone(phone: string): boolean {
  const cleaned = phone.replace(/-/g, "");
  return /^\d{10,11}$/.test(cleaned);
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, "MANAGE");
  if (auth.error) return auth.error;
  const { ctx } = auth;

  try {
    const body = await request.json();
    const {
      templateKey,
      to,
      variables = {},
      dryRun = false,
    } = body ?? {};

    // ── 검증 ──
    if (!templateKey || !ALLOWED_TEMPLATE_KEYS.has(templateKey)) {
      return badRequest(
        ErrorCodes.VALIDATION_ERROR,
        `templateKey는 ${Array.from(ALLOWED_TEMPLATE_KEYS).join("|")} 중 하나여야 합니다`
      );
    }
    if (!to || typeof to !== "string") {
      return badRequest(ErrorCodes.VALIDATION_ERROR, "to(수신번호)가 필요합니다");
    }
    if (!isValidPhone(to)) {
      return badRequest(
        ErrorCodes.VALIDATION_ERROR,
        "수신번호 형식이 올바르지 않습니다 (숫자 10~11자)"
      );
    }

    // 필수 변수 누락 체크 (경고만 — 실제 발송은 진행, 템플릿에서 치환 실패 시 Solapi가 에러)
    const requiredVars = TEMPLATE_REQUIRED_VARS[templateKey] ?? [];
    const missingVars = requiredVars.filter(
      (v) => variables[v] === undefined || variables[v] === null || variables[v] === ""
    );

    const templateCode = SOLAPI_TEMPLATES[templateKey]();
    const phoneMasked = maskPhone(to);

    // ── dryRun: 실발송/로그 생략 ──
    if (dryRun) {
      return ok({
        dryRun: true,
        simulated: !templateCode, // 환경변수 미설정이면 시뮬레이션 모드
        templateKey,
        templateCode: templateCode || null,
        to_masked: phoneMasked,
        variables,
        missing_vars: missingVars,
        result: {
          success: true,
          messageId: `DRYRUN_${Date.now()}`,
          preview: "실발송 없이 payload 확인만 수행했습니다",
        },
        logged: false,
      });
    }

    // ── 실발송 ──
    const result = await sendAlimtalk({
      to,
      templateKey,
      variables,
    });

    // ── 로그 저장 (test_ 접두로 운영 로그와 구분) ──
    let logged = false;
    try {
      await logAlimtalk({
        orgId: ctx.orgId,
        templateType: `test_${templateKey}`, // ⭐ 운영 로그와 구분
        phoneMasked,
        result,
      });
      logged = true;
    } catch (e) {
      console.warn("[test-send] 로그 저장 실패:", e);
    }

    return ok({
      dryRun: false,
      simulated: !!result.simulated,
      templateKey,
      templateCode: templateCode || null,
      to_masked: phoneMasked,
      variables,
      missing_vars: missingVars,
      result: {
        success: result.success,
        messageId: result.messageId ?? null,
        error: result.error ?? null,
      },
      logged,
    });
  } catch (err: any) {
    console.error("[alimtalk/test-send] 서버 오류:", err);
    return serverError("테스트 발송 실패");
  }
}
