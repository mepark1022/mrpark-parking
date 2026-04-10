/**
 * POST /api/v1/fee/calculate
 * 요금 계산 엔진
 * 
 * Body: {
 *   entry_time: string (ISO),       // 입차 시각
 *   exit_time?: string (ISO),       // 출차 시각 (미입력 시 현재 시각)
 *   store_id: string,               // 사업장 ID
 *   visit_place_id?: string,        // 방문지 ID (우선 적용)
 *   is_valet?: boolean,             // 발렛 여부
 *   ticket_id?: string,             // 티켓 ID (월주차 조회용)
 * }
 * 
 * 응답: {
 *   total_fee, breakdown: { base, extra, valet, daily_max_applied },
 *   is_monthly, is_free, elapsed_minutes,
 *   fee_structure: { free_minutes, base_fee, base_minutes, extra_fee, daily_max, valet_fee }
 * }
 * 
 * 권한: PUBLIC (고객 티켓 페이지에서도 호출)
 * 
 * 로직:
 *   1. ticket_id → monthly_parking 확인 → 활성이면 0원
 *   2. visit_place_id → 방문지 요금체계
 *   3. 없으면 → store 기본 요금체계
 *   4. 무료시간 → 기본시간 → 10분 단위 추가 → daily_max
 *   5. 발렛 → valet_fee 추가
 */
import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ok, badRequest, serverError } from '@/lib/api/response';
import { ErrorCodes } from '@/lib/api/errors';

interface FeeStructure {
  free_minutes: number;
  base_fee: number;
  base_minutes: number;
  extra_fee: number;
  daily_max: number;
  valet_fee: number;
}

interface FeeBreakdown {
  parking_fee: number;    // 주차요금 (발렛 제외)
  valet_fee: number;      // 발렛비
  total_fee: number;      // 합계
  daily_max_applied: boolean;
}

/**
 * 요금 계산 핵심 로직
 * 기존 calcFee 클라이언트 로직과 동일한 결과 보장
 */
function calculateFee(
  entryTime: Date,
  exitTime: Date,
  feeStructure: FeeStructure,
  isValet: boolean
): FeeBreakdown {
  const elapsedMs = exitTime.getTime() - entryTime.getTime();
  const mins = Math.max(0, Math.floor(elapsedMs / 60000));

  const {
    free_minutes = 30,
    base_fee = 0,
    base_minutes = 30,
    extra_fee = 0,
    daily_max = 0,
    valet_fee = 0,
  } = feeStructure;

  let parkingFee = 0;
  let dailyMaxApplied = false;

  if (mins > free_minutes) {
    const chargeable = mins - free_minutes;
    if (chargeable <= base_minutes) {
      parkingFee = base_fee;
    } else {
      const extraUnits = Math.ceil((chargeable - base_minutes) / 10);
      parkingFee = base_fee + extraUnits * extra_fee;
    }
    if (daily_max > 0 && parkingFee > daily_max) {
      parkingFee = daily_max;
      dailyMaxApplied = true;
    }
  }

  const valetAmount = isValet ? valet_fee : 0;

  return {
    parking_fee: parkingFee,
    valet_fee: valetAmount,
    total_fee: parkingFee + valetAmount,
    daily_max_applied: dailyMaxApplied,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      entry_time,
      exit_time,
      store_id,
      visit_place_id,
      is_valet = false,
      ticket_id,
    } = body;

    // 필수값 검증
    if (!entry_time || !store_id) {
      return badRequest(ErrorCodes.VALIDATION_ERROR, 'entry_time과 store_id는 필수입니다');
    }

    const entryTime = new Date(entry_time);
    const exitTime = exit_time ? new Date(exit_time) : new Date();

    if (isNaN(entryTime.getTime())) {
      return badRequest(ErrorCodes.VALIDATION_ERROR, '유효하지 않은 entry_time입니다');
    }

    if (exitTime < entryTime) {
      return badRequest(ErrorCodes.VALIDATION_ERROR, 'exit_time이 entry_time보다 이전입니다');
    }

    const supabase = await createClient();

    // ── 1. 월주차 확인 (ticket_id가 있는 경우) ──
    if (ticket_id) {
      const { data: ticket } = await supabase
        .from('mepark_tickets')
        .select('is_monthly, is_free')
        .eq('id', ticket_id)
        .single();

      if (ticket?.is_monthly || ticket?.is_free) {
        return ok({
          total_fee: 0,
          breakdown: { parking_fee: 0, valet_fee: 0, total_fee: 0, daily_max_applied: false },
          is_monthly: !!ticket.is_monthly,
          is_free: true,
          elapsed_minutes: Math.floor((exitTime.getTime() - entryTime.getTime()) / 60000),
          fee_structure: null,
        });
      }
    }

    // ── 2. 요금체계 조회 (방문지 우선 → 매장 기본) ──
    let feeStructure: FeeStructure | null = null;
    let feeSource: string = 'store';

    if (visit_place_id) {
      const { data: vp } = await supabase
        .from('visit_places')
        .select('free_minutes, base_fee, base_minutes, extra_fee, daily_max, valet_fee')
        .eq('id', visit_place_id)
        .single();

      if (vp) {
        feeStructure = {
          free_minutes: vp.free_minutes ?? 30,
          base_fee: vp.base_fee ?? 0,
          base_minutes: vp.base_minutes ?? 30,
          extra_fee: vp.extra_fee ?? 0,
          daily_max: vp.daily_max ?? 0,
          valet_fee: vp.valet_fee ?? 0,
        };
        feeSource = 'visit_place';
      }
    }

    if (!feeStructure) {
      const { data: store } = await supabase
        .from('stores')
        .select('free_minutes, base_fee, base_minutes, extra_fee, daily_max, valet_fee')
        .eq('id', store_id)
        .single();

      if (store) {
        feeStructure = {
          free_minutes: store.free_minutes ?? 30,
          base_fee: store.base_fee ?? 0,
          base_minutes: store.base_minutes ?? 30,
          extra_fee: store.extra_fee ?? 0,
          daily_max: store.daily_max ?? 0,
          valet_fee: store.valet_fee ?? 0,
        };
      }
    }

    // 요금체계 미설정 → 기본값
    if (!feeStructure) {
      feeStructure = {
        free_minutes: 30,
        base_fee: 0,
        base_minutes: 30,
        extra_fee: 0,
        daily_max: 0,
        valet_fee: 0,
      };
      feeSource = 'default';
    }

    // ── 3. 요금 계산 ──
    const elapsed = Math.floor((exitTime.getTime() - entryTime.getTime()) / 60000);
    const breakdown = calculateFee(entryTime, exitTime, feeStructure, is_valet);

    return ok({
      total_fee: breakdown.total_fee,
      breakdown,
      is_monthly: false,
      is_free: breakdown.total_fee === 0,
      elapsed_minutes: elapsed,
      fee_structure: feeStructure,
      fee_source: feeSource,
    });
  } catch (err) {
    console.error('[v1/fee/calculate] 서버 오류:', err);
    return serverError('요금 계산 중 오류가 발생했습니다');
  }
}
