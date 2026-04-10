/**
 * GET /api/v1/tickets/:id/fee
 * 고객용 요금 조회 — 실시간 예상 요금
 * 
 * 권한: PUBLIC (고객 티켓 페이지에서 호출)
 * 
 * 내부적으로 /api/v1/fee/calculate 로직과 동일
 * 티켓 정보를 자동으로 조회하여 요금 계산
 */
import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ok, notFound, serverError } from '@/lib/api/response';

interface FeeStructure {
  free_minutes: number;
  base_fee: number;
  base_minutes: number;
  extra_fee: number;
  daily_max: number;
  valet_fee: number;
}

function calculateFee(
  entryTime: Date,
  exitTime: Date,
  fs: FeeStructure,
  isValet: boolean
) {
  const mins = Math.max(0, Math.floor((exitTime.getTime() - entryTime.getTime()) / 60000));
  let parkingFee = 0;
  let dailyMaxApplied = false;

  if (mins > fs.free_minutes) {
    const chargeable = mins - fs.free_minutes;
    if (chargeable <= fs.base_minutes) {
      parkingFee = fs.base_fee;
    } else {
      const extraUnits = Math.ceil((chargeable - fs.base_minutes) / 10);
      parkingFee = fs.base_fee + extraUnits * fs.extra_fee;
    }
    if (fs.daily_max > 0 && parkingFee > fs.daily_max) {
      parkingFee = fs.daily_max;
      dailyMaxApplied = true;
    }
  }

  const valetAmount = isValet ? fs.valet_fee : 0;

  return {
    parking_fee: parkingFee,
    valet_fee: valetAmount,
    total_fee: parkingFee + valetAmount,
    daily_max_applied: dailyMaxApplied,
    elapsed_minutes: mins,
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // 티켓 + 요금체계 조회
    const { data: ticket, error } = await supabase
      .from('mepark_tickets')
      .select(`
        id, entry_at, parking_type, status, is_monthly, is_free,
        paid_amount, visit_place_id, store_id,
        visit_places:visit_place_id(
          free_minutes, base_fee, base_minutes, extra_fee, daily_max, valet_fee
        ),
        stores:store_id(
          free_minutes, base_fee, base_minutes, extra_fee, daily_max, valet_fee
        )
      `)
      .eq('id', id)
      .single();

    if (error || !ticket) {
      return notFound('티켓을 찾을 수 없습니다');
    }

    // 월주차 / 무료 → 0원
    if (ticket.is_monthly || ticket.is_free) {
      return ok({
        total_fee: 0,
        breakdown: { parking_fee: 0, valet_fee: 0, total_fee: 0, daily_max_applied: false },
        is_monthly: !!ticket.is_monthly,
        is_free: true,
        elapsed_minutes: Math.floor((Date.now() - new Date(ticket.entry_at).getTime()) / 60000),
        paid_amount: ticket.paid_amount || 0,
        remaining: 0,
      });
    }

    // 요금체계 (방문지 우선)
    const raw = ticket.visit_places || ticket.stores;
    const fs: FeeStructure = {
      free_minutes: (raw as any)?.free_minutes ?? 30,
      base_fee: (raw as any)?.base_fee ?? 0,
      base_minutes: (raw as any)?.base_minutes ?? 30,
      extra_fee: (raw as any)?.extra_fee ?? 0,
      daily_max: (raw as any)?.daily_max ?? 0,
      valet_fee: (raw as any)?.valet_fee ?? 0,
    };

    const isValet = ticket.parking_type === 'valet';
    const entryTime = new Date(ticket.entry_at);
    const now = new Date();

    const result = calculateFee(entryTime, now, fs, isValet);
    const paidAmount = ticket.paid_amount || 0;
    const remaining = Math.max(0, result.total_fee - paidAmount);

    return ok({
      total_fee: result.total_fee,
      breakdown: result,
      is_monthly: false,
      is_free: result.total_fee === 0,
      elapsed_minutes: result.elapsed_minutes,
      paid_amount: paidAmount,
      remaining,
      fee_structure: fs,
    });
  } catch (err) {
    console.error('[v1/tickets/fee] 서버 오류:', err);
    return serverError('요금 조회 중 오류가 발생했습니다');
  }
}
