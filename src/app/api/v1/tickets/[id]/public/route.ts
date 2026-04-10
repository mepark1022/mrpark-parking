/**
 * GET /api/v1/tickets/:id/public
 * 고객용 티켓 조회 — 민감정보 제외
 * 
 * 권한: PUBLIC (인증 불필요, URL 접근)
 * 
 * 제외 항목: entry_crew_id, exit_crew_id, org_id, is_demo
 * 만료 티켓 → 완료 화면 표시 (에러 아님)
 */
import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ok, notFound, serverError } from '@/lib/api/response';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const { data: ticket, error } = await supabase
      .from('mepark_tickets')
      .select(`
        id, plate_number, plate_last4, parking_type, status,
        entry_at, pre_paid_at, exit_at,
        parking_location, is_monthly, is_free,
        paid_amount, calculated_fee, additional_fee, payment_method,
        store_id, visit_place_id, parking_lot_id,
        stores:store_id(name, road_address),
        parking_lots:parking_lot_id(name),
        visit_places:visit_place_id(
          name, free_minutes, base_fee, base_minutes,
          extra_fee, daily_max, valet_fee
        )
      `)
      .eq('id', id)
      .single();

    if (error || !ticket) {
      return notFound('티켓을 찾을 수 없습니다');
    }

    // 요금체계 결정 (방문지 우선 → 매장 기본)
    const feeStructure = ticket.visit_places || ticket.stores;

    return ok({
      ticket: {
        id: ticket.id,
        plate_number: ticket.plate_number,
        plate_last4: ticket.plate_last4,
        parking_type: ticket.parking_type,
        status: ticket.status,
        entry_at: ticket.entry_at,
        pre_paid_at: ticket.pre_paid_at,
        exit_at: ticket.exit_at,
        parking_location: ticket.parking_location,
        is_monthly: ticket.is_monthly,
        is_free: ticket.is_free,
        paid_amount: ticket.paid_amount,
        calculated_fee: ticket.calculated_fee,
        additional_fee: ticket.additional_fee,
        payment_method: ticket.payment_method,
      },
      store: ticket.stores ? {
        name: (ticket.stores as any).name,
        address: (ticket.stores as any).road_address,
      } : null,
      parking_lot: ticket.parking_lots ? {
        name: (ticket.parking_lots as any).name,
      } : null,
      visit_place: ticket.visit_places ? {
        name: (ticket.visit_places as any).name,
      } : null,
      fee_structure: feeStructure ? {
        free_minutes: (feeStructure as any).free_minutes ?? 30,
        base_fee: (feeStructure as any).base_fee ?? 0,
        base_minutes: (feeStructure as any).base_minutes ?? 30,
        extra_fee: (feeStructure as any).extra_fee ?? 0,
        daily_max: (feeStructure as any).daily_max ?? 0,
        valet_fee: (feeStructure as any).valet_fee ?? 0,
      } : null,
    });
  } catch (err) {
    console.error('[v1/tickets/public] 서버 오류:', err);
    return serverError('티켓 조회 중 오류가 발생했습니다');
  }
}
