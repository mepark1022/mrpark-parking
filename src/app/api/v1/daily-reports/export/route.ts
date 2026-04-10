/**
 * 미팍 통합앱 v2 — 현장일보 Excel 내보내기 (Part 10C)
 * GET /api/v1/daily-reports/export?date_from=&date_to=&store_id=
 *
 * 3시트 구성:
 *   시트1. 일보요약   (일보 마스터 + 총입차/발렛/매출)
 *   시트2. 근무인원   (일보별 staff 상세)
 *   시트3. 결제매출   (일보별 payment 상세)
 *
 * 필터:
 *   date_from (필수, YYYY-MM-DD)
 *   date_to   (필수, YYYY-MM-DD)
 *   store_id  (선택, 특정 사업장)
 *
 * 권한: MANAGE (admin/super_admin)
 *
 * 스코프: org_id 자동 필터
 */
import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { createClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/api/auth-middleware';
import { badRequest, serverError } from '@/lib/api/response';
import { ErrorCodes } from '@/lib/api/errors';
import { getQueryParam } from '@/lib/api/helpers';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, 'MANAGE');
  if (auth.error) return auth.error;
  const { ctx } = auth;

  try {
    const dateFrom = getQueryParam(request, 'date_from');
    const dateTo = getQueryParam(request, 'date_to');
    const storeId = getQueryParam(request, 'store_id');

    if (!dateFrom || !dateTo) {
      return badRequest(
        ErrorCodes.VALIDATION_ERROR,
        'date_from, date_to 파라미터가 필요합니다 (YYYY-MM-DD)'
      );
    }
    if (!DATE_RE.test(dateFrom) || !DATE_RE.test(dateTo)) {
      return badRequest(
        ErrorCodes.VALIDATION_ERROR,
        '날짜 형식이 올바르지 않습니다 (YYYY-MM-DD)'
      );
    }
    if (dateFrom > dateTo) {
      return badRequest(
        ErrorCodes.VALIDATION_ERROR,
        'date_from 이 date_to 보다 이후입니다'
      );
    }

    const supabase = await createClient();

    // ── 1. 일보 마스터 조회 ──
    let q = supabase
      .from('daily_reports')
      .select(`
        id, org_id, store_id, report_date, status,
        weather, event_flag, event_name, memo,
        total_cars, valet_count, total_revenue,
        submitted_at, confirmed_at,
        stores ( id, name )
      `)
      .eq('org_id', ctx.orgId)
      .gte('report_date', dateFrom)
      .lte('report_date', dateTo)
      .order('report_date', { ascending: true });

    if (storeId) q = q.eq('store_id', storeId);

    const { data: reports, error: rErr } = await q;
    if (rErr) {
      console.error('[v1/daily-reports/export] reports:', rErr.message);
      return serverError('일보 조회 중 오류가 발생했습니다');
    }

    const reportIds = (reports ?? []).map(r => r.id);

    // ── 2. 근무인원 조회 ──
    let staffRows: Array<Record<string, unknown>> = [];
    let paymentRows: Array<Record<string, unknown>> = [];

    if (reportIds.length > 0) {
      const { data: staff, error: sErr } = await supabase
        .from('daily_report_staff')
        .select(`
          id, report_id, employee_id, staff_type, role,
          check_in, check_out, work_hours, memo,
          employees ( emp_no, name )
        `)
        .in('report_id', reportIds)
        .eq('org_id', ctx.orgId);

      if (sErr) {
        console.error('[v1/daily-reports/export] staff:', sErr.message);
        return serverError('근무인원 조회 중 오류가 발생했습니다');
      }
      staffRows = staff ?? [];

      // ── 3. 결제매출 조회 ──
      const { data: payments, error: pErr } = await supabase
        .from('daily_report_payment')
        .select('id, report_id, method, amount, count, memo')
        .in('report_id', reportIds)
        .eq('org_id', ctx.orgId);

      if (pErr) {
        console.error('[v1/daily-reports/export] payment:', pErr.message);
        return serverError('결제 조회 중 오류가 발생했습니다');
      }
      paymentRows = payments ?? [];
    }

    // report_id → 기본정보 매핑 (시트2/3에서 날짜·매장명 같이 표시)
    const reportMap = new Map<
      string,
      { report_date: string; store_name: string }
    >();
    for (const r of reports ?? []) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const st: any = (r as any).stores;
      reportMap.set(r.id, {
        report_date: r.report_date,
        store_name: st?.name ?? '',
      });
    }

    // ── 시트1. 일보요약 ──
    const sheet1Data = (reports ?? []).map(r => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const st: any = (r as any).stores;
      return {
        일자: r.report_date,
        사업장: st?.name ?? '',
        상태: r.status,
        날씨: r.weather ?? '',
        행사: r.event_flag ? (r.event_name ?? 'Y') : '',
        총입차: r.total_cars ?? 0,
        발렛건수: r.valet_count ?? 0,
        총매출: r.total_revenue ?? 0,
        제출시각: r.submitted_at ?? '',
        확정시각: r.confirmed_at ?? '',
        메모: r.memo ?? '',
      };
    });

    // ── 시트2. 근무인원 ──
    const staffTypeKo: Record<string, string> = {
      regular: '해당매장',
      peak: '피크',
      support: '본사지원',
      part_time: '알바지원',
      off_duty: '비번투입',
      additional: '추가',
    };
    const sheet2Data = staffRows.map(s => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const emp: any = (s as any).employees;
      const rm = reportMap.get(s.report_id as string);
      return {
        일자: rm?.report_date ?? '',
        사업장: rm?.store_name ?? '',
        사번: emp?.emp_no ?? '',
        이름: emp?.name ?? '',
        근무유형: staffTypeKo[s.staff_type as string] ?? s.staff_type,
        역할: s.role ?? '',
        출근: s.check_in ?? '',
        퇴근: s.check_out ?? '',
        근무시간: s.work_hours ?? '',
        메모: s.memo ?? '',
      };
    });

    // ── 시트3. 결제매출 ──
    const methodKo: Record<string, string> = {
      card: '카드',
      cash: '현금',
      valet_fee: '발렛요금',
      monthly: '월주차',
      free: '무료',
      transfer: '계좌이체',
      other: '기타',
    };
    const sheet3Data = paymentRows.map(p => {
      const rm = reportMap.get(p.report_id as string);
      return {
        일자: rm?.report_date ?? '',
        사업장: rm?.store_name ?? '',
        결제수단: methodKo[p.method as string] ?? p.method,
        건수: p.count ?? 0,
        금액: p.amount ?? 0,
        메모: p.memo ?? '',
      };
    });

    // ── XLSX 생성 ──
    const wb = XLSX.utils.book_new();

    const ws1 = XLSX.utils.json_to_sheet(
      sheet1Data.length > 0
        ? sheet1Data
        : [{ 일자: '', 사업장: '', 상태: '', 날씨: '', 행사: '', 총입차: '', 발렛건수: '', 총매출: '', 제출시각: '', 확정시각: '', 메모: '' }]
    );
    const ws2 = XLSX.utils.json_to_sheet(
      sheet2Data.length > 0
        ? sheet2Data
        : [{ 일자: '', 사업장: '', 사번: '', 이름: '', 근무유형: '', 역할: '', 출근: '', 퇴근: '', 근무시간: '', 메모: '' }]
    );
    const ws3 = XLSX.utils.json_to_sheet(
      sheet3Data.length > 0
        ? sheet3Data
        : [{ 일자: '', 사업장: '', 결제수단: '', 건수: '', 금액: '', 메모: '' }]
    );

    XLSX.utils.book_append_sheet(wb, ws1, '일보요약');
    XLSX.utils.book_append_sheet(wb, ws2, '근무인원');
    XLSX.utils.book_append_sheet(wb, ws3, '결제매출');

    const buffer: Buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const filename = `daily-reports_${dateFrom}_${dateTo}.xlsx`;

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    console.error('[v1/daily-reports/export] 서버 오류:', err);
    return serverError('Excel 내보내기 중 오류가 발생했습니다');
  }
}
