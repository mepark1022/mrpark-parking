import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

// Vercel Cron: 매일 오전 10시 (KST = UTC+9 → UTC 01:00)
// vercel.json에 설정 필요

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function getSolapiSignature(apiKey: string, apiSecret: string) {
  const date = new Date().toISOString();
  const salt = Math.random().toString(36).substring(2, 12);
  const signature = crypto
    .createHmac("sha256", apiSecret)
    .update(date + salt)
    .digest("hex");
  return { date, salt, signature };
}

function maskPhone(phone: string): string {
  const cleaned = phone.replace(/-/g, "");
  if (cleaned.length < 8) return "***";
  return cleaned.slice(0, 3) + "****" + cleaned.slice(-4);
}

export async function GET(req: NextRequest) {
  // Vercel Cron 인증 (CRON_SECRET 환경변수)
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // D-7 날짜 계산 (오늘 + 7일)
    const today = new Date();
    const d7Date = new Date(today);
    d7Date.setDate(d7Date.getDate() + 7);
    const d7Str = d7Date.toISOString().slice(0, 10);

    // D-7 만료 예정 + 아직 알림 미발송 계약 조회
    const { data: contracts, error: fetchError } = await supabase
      .from("monthly_parking")
      .select("*, stores(name)")
      .eq("contract_status", "active")
      .eq("end_date", d7Str)
      .eq("d7_alimtalk_sent", false);

    if (fetchError) {
      console.error("[Cron] 조회 오류:", fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!contracts || contracts.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: "D-7 만료 예정 계약 없음",
        date: d7Str,
        count: 0 
      });
    }

    const apiKey = process.env.SOLAPI_API_KEY;
    const apiSecret = process.env.SOLAPI_API_SECRET;
    const pfId = process.env.SOLAPI_PF_ID;
    const senderNumber = process.env.SOLAPI_SENDER_NUMBER || "18991871";
    const templateCode = process.env.SOLAPI_TEMPLATE_MONTHLY_REMIND || "TMPL_MONTHLY_REMIND";

    const results: Array<{ id: string; vehicleNumber: string; success: boolean; error?: string }> = [];

    for (const contract of contracts) {
      const { id, org_id, customer_name, customer_phone, vehicle_number, end_date, monthly_fee, stores } = contract;
      const storeName = stores?.name || "";

      // 환경변수 미설정 시 시뮬레이션
      if (!apiKey || !apiSecret || !pfId) {
        console.log(`[Cron-Sim] D-7 알림: ${customer_name} (${vehicle_number}) → ${customer_phone}`);
        
        // 발송 완료 처리 (시뮬레이션)
        await supabase.from("monthly_parking").update({
          d7_alimtalk_sent: true,
          d7_alimtalk_sent_at: new Date().toISOString()
        }).eq("id", id);

        // 로그 저장
        await supabase.from("alimtalk_send_logs").insert({
          org_id,
          monthly_parking_id: id,
          template_type: "d7_auto_remind",
          phone_masked: maskPhone(customer_phone),
          send_status: "success",
          message_id: `SIM_${Date.now()}`,
        });

        results.push({ id, vehicleNumber: vehicle_number, success: true });
        continue;
      }

      // 실제 솔라피 발송
      try {
        const { date, salt, signature } = getSolapiSignature(apiKey, apiSecret);

        const variables: Record<string, string> = {
          "#{고객명}": customer_name,
          "#{차량번호}": vehicle_number,
          "#{매장명}": storeName,
          "#{만료일}": end_date,
          "#{월요금}": `${Number(monthly_fee).toLocaleString()}원`,
        };

        const payload = {
          message: {
            to: customer_phone.replace(/-/g, ""),
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

        if (resp.ok && !result.errorCode) {
          // 발송 성공
          await supabase.from("monthly_parking").update({
            d7_alimtalk_sent: true,
            d7_alimtalk_sent_at: new Date().toISOString()
          }).eq("id", id);

          await supabase.from("alimtalk_send_logs").insert({
            org_id,
            monthly_parking_id: id,
            template_type: "d7_auto_remind",
            phone_masked: maskPhone(customer_phone),
            send_status: "success",
            message_id: result.messageId,
          });

          results.push({ id, vehicleNumber: vehicle_number, success: true });
        } else {
          // 발송 실패
          await supabase.from("alimtalk_send_logs").insert({
            org_id,
            monthly_parking_id: id,
            template_type: "d7_auto_remind",
            phone_masked: maskPhone(customer_phone),
            send_status: "failed",
            error_message: result.errorMessage || "Unknown error",
          });

          results.push({ id, vehicleNumber: vehicle_number, success: false, error: result.errorMessage });
        }
      } catch (err) {
        console.error(`[Cron] 발송 오류 (${vehicle_number}):`, err);
        results.push({ id, vehicleNumber: vehicle_number, success: false, error: String(err) });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    return NextResponse.json({
      success: true,
      date: d7Str,
      total: contracts.length,
      sent: successCount,
      failed: failCount,
      results,
    });

  } catch (err) {
    console.error("[Cron] 서버 오류:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
