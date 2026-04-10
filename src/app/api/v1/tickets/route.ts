/**
 * POST /api/v1/tickets
 * 입차 등록 — CREW가 차량을 입차 처리
 * 
 * Body: {
 *   store_id, plate_number, plate_last4,
 *   parking_type (valet|self), visit_place_id?, parking_lot_id?,
 *   parking_location?, entry_method?, is_free?, phone?
 * }
 * 
 * 권한: OPERATE (crew 이상, field_member 제외)
 * ⚠️ phone은 알림톡 발송에만 사용, DB 미저장
 */
import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAuth, canAccessStore } from '@/lib/api/auth-middleware';
import { ok, created, badRequest, forbidden, conflict, serverError } from '@/lib/api/response';
import { ErrorCodes } from '@/lib/api/errors';

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, 'OPERATE');
  if (auth.error) return auth.error;
  const { ctx } = auth;

  // field_member 제외
  if (ctx.role === 'field_member') {
    return forbidden('현장요원은 입차 등록 권한이 없습니다');
  }

  try {
    const body = await request.json();
    const {
      store_id,
      plate_number,
      plate_last4,
      parking_type = 'valet',
      visit_place_id,
      parking_lot_id,
      parking_location,
      entry_method = 'ocr',
      is_free = false,
      phone,
    } = body;

    // 필수값 검증
    if (!store_id || !plate_number) {
      return badRequest(ErrorCodes.VALIDATION_ERROR, '사업장 ID와 차량번호는 필수입니다');
    }

    // 사업장 접근 권한 확인
    if (!canAccessStore(ctx, store_id)) {
      return forbidden('해당 사업장에 대한 접근 권한이 없습니다');
    }

    const supabase = await createClient();

    // 중복 차량 체크 (같은 사업장, 미완료 티켓)
    const { data: existing } = await supabase
      .from('mepark_tickets')
      .select('id, plate_number, entry_at, status')
      .eq('store_id', store_id)
      .eq('plate_number', plate_number)
      .neq('status', 'completed')
      .maybeSingle();

    if (existing) {
      return conflict(ErrorCodes.TICKET_OVERDUE, '이미 입차 중인 차량입니다', {
        existing_ticket_id: existing.id,
        entry_at: existing.entry_at,
        status: existing.status,
      });
    }

    // 월주차 조회 (숫자만 비교)
    const digits = plate_number.replace(/[^0-9]/g, '');
    let isMonthly = false;
    let monthlyParkingId: string | null = null;

    if (digits.length >= 4) {
      const { data: monthlyList } = await supabase
        .from('monthly_parking')
        .select('id, vehicle_number, end_date')
        .eq('store_id', store_id)
        .eq('status', 'active');

      if (monthlyList && monthlyList.length > 0) {
        const match = monthlyList.find((m: any) => {
          const mDigits = (m.vehicle_number || '').replace(/[^0-9]/g, '');
          return mDigits === digits;
        });
        if (match) {
          isMonthly = true;
          monthlyParkingId = match.id;
        }
      }
    }

    // 티켓 생성
    const { data: ticket, error: insertError } = await supabase
      .from('mepark_tickets')
      .insert({
        org_id: ctx.orgId,
        store_id,
        plate_number,
        plate_last4: plate_last4 || plate_number.replace(/[^0-9]/g, '').slice(-4),
        parking_type,
        status: 'parking',
        entry_crew_id: ctx.userId,
        is_monthly: isMonthly,
        monthly_parking_id: monthlyParkingId,
        visit_place_id: visit_place_id || null,
        parking_lot_id: parking_lot_id || null,
        parking_location: parking_location || null,
        entry_method,
        is_free: is_free || isMonthly,
        entry_at: new Date().toISOString(),
      })
      .select('id, plate_number, status, entry_at, is_monthly')
      .single();

    if (insertError) {
      console.error('[v1/tickets] 입차 등록 오류:', insertError.message);
      return serverError('입차 등록 중 오류가 발생했습니다');
    }

    // 알림톡 발송 (phone이 있는 경우 — 비동기, 실패해도 입차는 성공)
    if (phone && phone.replace(/-/g, '').length >= 10) {
      try {
        const baseUrl = request.headers.get('origin') || process.env.NEXT_PUBLIC_BASE_URL || '';
        fetch(`${baseUrl}/api/alimtalk/entry`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone,
            ticketId: ticket.id,
            plateNumber: plate_number,
            orgId: ctx.orgId,
          }),
        }).catch(() => {});
      } catch {
        // 알림톡 실패해도 입차는 성공
      }
    }

    return created({
      ticket_id: ticket.id,
      plate_number: ticket.plate_number,
      status: ticket.status,
      entry_at: ticket.entry_at,
      is_monthly: ticket.is_monthly,
      alimtalk_requested: !!phone,
    });
  } catch (err) {
    console.error('[v1/tickets] 서버 오류:', err);
    return serverError('입차 등록 중 오류가 발생했습니다');
  }
}
