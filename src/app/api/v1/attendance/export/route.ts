/**
 * 미팍 통합앱 v2 — 근태 Excel 내보내기 (Part 11B)
 * GET /api/v1/attendance/export?year=&month=&store_id=
 *
 * 권한: MANAGE
 *
 * 3시트 구성:
 *   1. 월매트릭스 — 행: 직원, 열: 일자(1~말일) + 집계
 *      상태코드: 출(present) / 지(late) / 피(peak) / 지원(support) / 추(additional)
 *                연차(leave) / 휴(off) / 결(absent)
 *   2. 월집계 — 직원별 집계 요약
 *   3. 상세dump — 직원×날짜 row (store, check_in/out, hours, reason 포함)
 *
 * 데이터 소스: daily_reports + attendance_overrides (override 병합)
 */
import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { createClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/api/auth-middleware';
import { badRequest, serverError } from '@/lib/api/response';
import { ErrorCodes } from '@/lib/api/errors';
import { getQueryParam } from '@/lib/api/helpers';
import {
  judgeAttendanceStatus,
  mergeByPriority,
  isInEmploymentPeriod,
  buildSummary,
  monthRange,
  validateYearMonth,
  applyOverrides,
  type AttendanceRow,
  type StaffType,
  type AttendanceOverrideRow,
} from '@/lib/api/attendance';
import type { AttendanceStatus } from '@/lib/api/types';

// 상태 → 한글 1~2자 코드
const STATUS_CODE: Record<AttendanceStatus, string> = {
  present:    '출',
  late:       '지',
  peak:       '피',
  support:    '지원',
  additional: '추',
  leave:      '연차',
  off:        '휴',
  absent:     '결',
};

function sendXlsx(wb: XLSX.WorkBook, filename: string): NextResponse {
  const buffer: Buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, 'MANAGE');
  if (auth.error) return auth.error;
  const { ctx } = auth;

  try {
    const yearStr = getQueryParam(request, 'year');
    const monthStr = getQueryParam(request, 'month');
    const storeId = getQueryParam(request, 'store_id');

    const ym = validateYearMonth(yearStr, monthStr);
    if (!ym.valid) return badRequest(ErrorCodes.VALIDATION_ERROR, ym.message);
    const { year, month } = ym;
    const { from, to } = monthRange(year, month);

    const supabase = await createClient();

    // ── 1. 직원 목록 ──
    const { data: employees, error: empErr } = await supabase
      .from('employees')
      .select('id, emp_no, name, status, hire_date, resign_date, position')
      .eq('org_id', ctx.orgId)
      .order('emp_no', { ascending: true });
    if (empErr) {
      console.error('[v1/attendance/export] employees:', empErr.message);
      return serverError('직원 조회 중 오류가 발생했습니다');
    }
    const empList = employees ?? [];
    if (empList.length === 0) {
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet([{ 안내: '직원이 없습니다' }]);
      XLSX.utils.book_append_sheet(wb, ws, '월매트릭스');
      return sendXlsx(wb, `attendance_${year}-${String(month).padStart(2,'0')}.xlsx`);
    }
    const empIds = empList.map(e => e.id);

    // ── 2. store_members ──
    const { data: memberships } = await supabase
      .from('store_members')
      .select('employee_id, store_id, is_primary, is_active')
      .eq('org_id', ctx.orgId)
      .in('employee_id', empIds)
      .eq('is_active', true);
    const primaryStoreMap = new Map<string, string>();
    for (const m of memberships ?? []) {
      if (m.is_primary) primaryStoreMap.set(m.employee_id, m.store_id);
    }

    // ── 3. 일보 + staff ──
    let repQ = supabase
      .from('daily_reports')
      .select(
        `id, store_id, report_date, status,
         stores ( id, name ),
         daily_report_staff (
           id, employee_id, staff_type, role,
           check_in, check_out, work_hours
         )`
      )
      .eq('org_id', ctx.orgId)
      .gte('report_date', from)
      .lte('report_date', to)
      .neq('status', 'draft');
    if (storeId) repQ = repQ.eq('store_id', storeId);
    const { data: reports, error: repErr } = await repQ;
    if (repErr) {
      console.error('[v1/attendance/export] reports:', repErr.message);
      return serverError('일보 조회 중 오류가 발생했습니다');
    }

    // ── 4. 일보 기반 매트릭스 생성 ──
    interface RawEntry {
      date: string;
      report_id: string;
      store_id: string;
      store_name: string | null;
      staff_type: StaffType;
      check_in: string | null;
      check_out: string | null;
      work_hours: number | null;
    }
    const rawMap = new Map<string, Map<string, RawEntry[]>>();
    const empIdSet = new Set(empIds);
    const storeNameMap = new Map<string, string>();

    for (const r of reports ?? []) {
      const store = Array.isArray(r.stores) ? r.stores[0] : r.stores;
      if (store?.id && store?.name) storeNameMap.set(store.id, store.name);
      const staffArr = (r.daily_report_staff ?? []) as Array<{
        employee_id: string;
        staff_type: string;
        check_in: string | null;
        check_out: string | null;
        work_hours: number | null;
      }>;
      for (const s of staffArr) {
        if (!empIdSet.has(s.employee_id)) continue;
        const entry: RawEntry = {
          date: r.report_date,
          report_id: r.id,
          store_id: r.store_id,
          store_name: store?.name ?? null,
          staff_type: s.staff_type as StaffType,
          check_in: s.check_in,
          check_out: s.check_out,
          work_hours: s.work_hours,
        };
        if (!rawMap.has(s.employee_id)) rawMap.set(s.employee_id, new Map());
        const byDate = rawMap.get(s.employee_id)!;
        if (!byDate.has(r.report_date)) byDate.set(r.report_date, []);
        byDate.get(r.report_date)!.push(entry);
      }
    }

    const matrix: Record<string, Record<string, AttendanceRow>> = {};
    for (const emp of empList) {
      const primaryStore = primaryStoreMap.get(emp.id) ?? null;
      const empMatrix: Record<string, AttendanceRow> = {};
      const byDate = rawMap.get(emp.id);
      if (byDate) {
        for (const [date, entries] of byDate.entries()) {
          if (!isInEmploymentPeriod(date, emp.hire_date, emp.resign_date)) continue;
          const statuses = entries.map(e =>
            judgeAttendanceStatus(e.staff_type, e.store_id, primaryStore, e.check_in)
          );
          const finalStatus = mergeByPriority(statuses);
          const repIdx = statuses.findIndex(s => s === finalStatus);
          const rep = entries[repIdx >= 0 ? repIdx : 0];
          empMatrix[date] = {
            employee_id: emp.id,
            emp_no: emp.emp_no,
            name: emp.name,
            date,
            status: finalStatus,
            check_in: rep.check_in,
            check_out: rep.check_out,
            report_id: rep.report_id,
            store_id: rep.store_id,
            store_name: rep.store_name,
            work_hours: rep.work_hours,
            staff_type: rep.staff_type,
          };
        }
      }
      matrix[emp.id] = empMatrix;
    }

    // ── 5. override 조회 + 병합 ──
    let ovQ = supabase
      .from('attendance_overrides')
      .select('*')
      .eq('org_id', ctx.orgId)
      .gte('work_date', from)
      .lte('work_date', to)
      .in('employee_id', empIds);
    if (storeId) ovQ = ovQ.eq('store_id', storeId);
    const { data: overrides } = await ovQ;
    const overrideList = (overrides ?? []) as AttendanceOverrideRow[];

    // override에만 있는 store_id 이름 채우기
    const missingStoreIds = new Set<string>();
    for (const ov of overrideList) {
      if (ov.store_id && !storeNameMap.has(ov.store_id)) missingStoreIds.add(ov.store_id);
    }
    if (missingStoreIds.size > 0) {
      const { data: extraStores } = await supabase
        .from('stores')
        .select('id, name')
        .eq('org_id', ctx.orgId)
        .in('id', [...missingStoreIds]);
      for (const s of extraStores ?? []) {
        if (s.id && s.name) storeNameMap.set(s.id, s.name);
      }
    }

    const empMeta = new Map<string, { emp_no: string; name: string }>();
    for (const e of empList) empMeta.set(e.id, { emp_no: e.emp_no, name: e.name });

    const mergedMatrix = applyOverrides(matrix, overrideList, empMeta, storeNameMap);

    // ── 6. Sheet 1: 월매트릭스 ──
    const lastDay = new Date(year, month, 0).getDate();
    const dateList: string[] = [];
    const mm = String(month).padStart(2, '0');
    for (let d = 1; d <= lastDay; d++) {
      dateList.push(`${year}-${mm}-${String(d).padStart(2, '0')}`);
    }

    const sheet1: Array<Record<string, string | number>> = [];
    for (const emp of empList) {
      const row: Record<string, string | number> = {
        사번: emp.emp_no,
        이름: emp.name,
        직책: emp.position ?? '',
      };
      const byDate = mergedMatrix[emp.id] ?? {};
      const rowsForSummary: AttendanceRow[] = [];
      for (const date of dateList) {
        const day = String(parseInt(date.slice(-2), 10));
        if (!isInEmploymentPeriod(date, emp.hire_date, emp.resign_date)) {
          row[day] = '';
          continue;
        }
        const r = byDate[date];
        if (r && r.status) {
          row[day] = STATUS_CODE[r.status];
          rowsForSummary.push(r);
        } else {
          row[day] = '';
        }
      }
      const sum = buildSummary(rowsForSummary);
      row['총출근'] = sum.total;
      row['지각'] = sum.late;
      row['결근'] = sum.absent;
      row['연차'] = sum.leave;
      row['휴무'] = sum.off;
      row['근무시간'] = sum.total_hours;
      sheet1.push(row);
    }

    // ── 7. Sheet 2: 월집계 ──
    const sheet2: Array<Record<string, string | number>> = [];
    for (const emp of empList) {
      const byDate = mergedMatrix[emp.id] ?? {};
      const rowsForSummary = Object.values(byDate).filter(r =>
        isInEmploymentPeriod(r.date, emp.hire_date, emp.resign_date)
      );
      const sum = buildSummary(rowsForSummary);
      sheet2.push({
        사번: emp.emp_no,
        이름: emp.name,
        직책: emp.position ?? '',
        평일출근: sum.weekday,
        주말출근: sum.weekend,
        공휴일: sum.holiday,
        지각: sum.late,
        피크: sum.peak,
        지원: sum.support,
        추가: sum.additional,
        연차: sum.leave,
        휴무: sum.off,
        결근: sum.absent,
        총출근일: sum.total,
        총근무시간: sum.total_hours,
      });
    }

    // ── 8. Sheet 3: 상세 dump ──
    const sheet3: Array<Record<string, string | number>> = [];
    const overrideByEmpDate = new Map<string, AttendanceOverrideRow>();
    for (const ov of overrideList) {
      overrideByEmpDate.set(`${ov.employee_id}|${ov.work_date}`, ov);
    }

    for (const emp of empList) {
      const byDate = mergedMatrix[emp.id] ?? {};
      const sortedDates = Object.keys(byDate).sort();
      for (const date of sortedDates) {
        const r = byDate[date];
        if (!r.status) continue;
        if (!isInEmploymentPeriod(date, emp.hire_date, emp.resign_date)) continue;
        const ov = overrideByEmpDate.get(`${emp.id}|${date}`);
        sheet3.push({
          사번: emp.emp_no,
          이름: emp.name,
          일자: date,
          상태: STATUS_CODE[r.status],
          사업장: r.store_name ?? '',
          출근: r.check_in ?? '',
          퇴근: r.check_out ?? '',
          근무시간: r.work_hours ?? '',
          오버라이드여부: ov ? 'Y' : 'N',
          수정사유: ov?.reason ?? '',
          메모: ov?.memo ?? '',
        });
      }
    }

    // ── 9. Excel 생성 ──
    const wb = XLSX.utils.book_new();
    const ws1 = XLSX.utils.json_to_sheet(
      sheet1.length > 0 ? sheet1 : [{ 사번: '', 이름: '' }]
    );
    const ws2 = XLSX.utils.json_to_sheet(
      sheet2.length > 0 ? sheet2 : [{ 사번: '', 이름: '' }]
    );
    const ws3 = XLSX.utils.json_to_sheet(
      sheet3.length > 0
        ? sheet3
        : [{ 사번: '', 이름: '', 일자: '', 상태: '', 사업장: '', 출근: '', 퇴근: '', 근무시간: '', 오버라이드여부: '', 수정사유: '', 메모: '' }]
    );
    XLSX.utils.book_append_sheet(wb, ws1, '월매트릭스');
    XLSX.utils.book_append_sheet(wb, ws2, '월집계');
    XLSX.utils.book_append_sheet(wb, ws3, '상세');

    const filename = `attendance_${year}-${mm}${storeId ? '_' + storeId.slice(0, 8) : ''}.xlsx`;
    return sendXlsx(wb, filename);
  } catch (err) {
    console.error('[v1/attendance/export] exception:', err);
    return serverError('Excel 내보내기 중 오류가 발생했습니다');
  }
}
