// @ts-nocheck
/**
 * POST /api/alimtalk/monthly
 * 월주차 알림톡 수동 발송
 *
 * templateType:
 *   "renewal_remind"   → D-7 만기 안내  (SOLAPI_TEMPLATE_MONTHLY_REMIND)
 *   "monthly_expire"   → 만료 안내      (SOLAPI_TEMPLATE_MONTHLY_EXPIRE)
 *   "renewal_complete" → 갱신 완료      (SOLAPI_TEMPLATE_MONTHLY_RENEW)
 */

import { NextRequest, NextResponse } from "next/server";
import { sendAlimtalk, logAlimtalk, maskPhone } from "@/lib/utils/solapi";

const TEMPLATE_MAP = {
  renewal_remind:   "monthly_remind",
  monthly_expire:   "monthly_expire",
  renewal_complete: "monthly_renew",
};

export async function POST(req) {
  try {
    const {
      phone, customerName, vehicleNumber, storeName,
      endDate, startDate, fee,
      templateType = "renewal_remind",
      contractId, orgId,
    } = await req.json();

    if (!phone || !customerName || !vehicleNumber || !storeName || !orgId) {
      return NextResponse.json({ error: "필수 파라미터 누락" }, { status: 400 });
    }

    const templateKey = TEMPLATE_MAP[templateType];
    if (!templateKey) {
      return NextResponse.json({ error: `알 수 없는 templateType: ${templateType}` }, { status: 400 });
    }

    const feeFormatted = `${Number(fee || 0).toLocaleString()}원`;
    let variables = {};

    if (templateType === "renewal_remind") {
      variables = {
        "#{고객명}": customerName, "#{차량번호}": vehicleNumber,
        "#{매장명}": storeName, "#{만료일}": endDate ?? "", "#{월요금}": feeFormatted,
      };
    } else if (templateType === "monthly_expire") {
      variables = {
        "#{고객명}": customerName, "#{차량번호}": vehicleNumber,
        "#{매장명}": storeName, "#{만료일}": endDate ?? "",
      };
    } else if (templateType === "renewal_complete") {
      variables = {
        "#{고객명}": customerName, "#{차량번호}": vehicleNumber,
        "#{매장명}": storeName, "#{시작일}": startDate ?? "",
        "#{만료일}": endDate ?? "", "#{월요금}": feeFormatted,
      };
    }

    const result = await sendAlimtalk({ to: phone, templateKey, variables });

    await logAlimtalk({
      orgId, templateType, phoneMasked: maskPhone(phone),
      result, monthlyParkingId: contractId,
    });

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      success: true, simulated: result.simulated,
      messageId: result.messageId,
      message: `${customerName}님께 알림톡을 발송했습니다.`,
    });

  } catch (err) {
    console.error("[Alimtalk/monthly] 서버 오류:", err);
    return NextResponse.json({ success: false, error: "서버 오류" }, { status: 500 });
  }
}
