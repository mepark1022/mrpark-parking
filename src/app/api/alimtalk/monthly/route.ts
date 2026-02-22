import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

// Solapi 알림톡 발송 API
// 환경변수: SOLAPI_API_KEY, SOLAPI_API_SECRET, SOLAPI_PF_ID, SOLAPI_SENDER_NUMBER

function getSolapiSignature(apiKey: string, apiSecret: string) {
  const date = new Date().toISOString();
  const salt = Math.random().toString(36).substring(2, 12);
  const signature = crypto
    .createHmac("sha256", apiSecret)
    .update(date + salt)
    .digest("hex");
  return { date, salt, signature, apiKey };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { phone, customerName, vehicleNumber, storeName, endDate, fee, templateType } = body;

    if (!phone || !customerName || !vehicleNumber || !storeName || !endDate) {
      return NextResponse.json({ error: "필수 파라미터 누락" }, { status: 400 });
    }

    const apiKey = process.env.SOLAPI_API_KEY;
    const apiSecret = process.env.SOLAPI_API_SECRET;
    const pfId = process.env.SOLAPI_PF_ID;
    const senderNumber = process.env.SOLAPI_SENDER_NUMBER || "18991871";

    if (!apiKey || !apiSecret || !pfId) {
      // 환경변수 미설정 시 개발 모드로 처리
      console.warn("[AlimTalk] 환경변수 미설정 - 시뮬레이션 모드");
      return NextResponse.json({ 
        success: true, 
        simulated: true, 
        message: `[시뮬레이션] ${customerName}님(${phone})께 알림톡 발송 완료` 
      });
    }

    // 템플릿 코드 매핑 (솔라피 검수 후 실제 코드로 교체)
    const TEMPLATE_CODES: Record<string, string> = {
      renewal_remind: process.env.SOLAPI_TEMPLATE_MONTHLY_REMIND || "TMPL_MONTHLY_REMIND",
      renewal_complete: process.env.SOLAPI_TEMPLATE_MONTHLY_COMPLETE || "TMPL_MONTHLY_COMPLETE",
    };

    const type = templateType || "renewal_remind";
    const templateCode = TEMPLATE_CODES[type];

    // 템플릿 변수 구성
    const variables: Record<string, string> = {
      "#{고객명}": customerName,
      "#{차량번호}": vehicleNumber,
      "#{매장명}": storeName,
      "#{만료일}": endDate,
      "#{월요금}": `${Number(fee).toLocaleString()}원`,
    };

    const { date, salt, signature } = getSolapiSignature(apiKey, apiSecret);

    const payload = {
      message: {
        to: phone.replace(/-/g, ""),
        from: senderNumber,
        kakaoOptions: {
          pfId,
          templateCode,
          variables,
        },
      },
    };

    const resp = await fetch("https://api.solapi.com/messages/v4/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`,
      },
      body: JSON.stringify(payload),
    });

    const result = await resp.json();

    if (!resp.ok || result.errorCode) {
      console.error("[AlimTalk] 발송 실패:", result);
      return NextResponse.json({ 
        success: false, 
        error: result.errorMessage || "알림톡 발송 실패" 
      }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      messageId: result.messageId,
      message: `${customerName}님께 알림톡을 발송했습니다.`
    });

  } catch (err) {
    console.error("[AlimTalk] 서버 오류:", err);
    return NextResponse.json({ success: false, error: "서버 오류" }, { status: 500 });
  }
}
