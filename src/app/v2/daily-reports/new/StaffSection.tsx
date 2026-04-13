// @ts-nocheck
/**
 * 미팍 통합앱 v2 — 현장일보 근무인원 입력 (Part 13B)
 *
 * 행 단위 입력:
 *   직원 / 구분(staff_type) / 출근 / 퇴근 / 근무시간 / 메모 / 삭제
 *
 * staff_type 6종:
 *   regular(정규), peak(피크), support(지원), part_time(파트), off_duty(휴무), additional(추가)
 *
 * 출근/퇴근 입력 시 근무시간 자동 계산 (사용자가 수동 변경 가능)
 */
"use client";

const STAFF_TYPE_OPTIONS = [
  { value: "regular",    label: "정규",  bg: "#dcfce7", color: "#15803d" },
  { value: "peak",       label: "피크",  bg: "#fef3c7", color: "#b45309" },
  { value: "support",    label: "지원",  bg: "#dbeafe", color: "#1d4ed8" },
  { value: "part_time",  label: "파트",  bg: "#e0e7ff", color: "#4338ca" },
  { value: "off_duty",   label: "휴무",  bg: "#f1f5f9", color: "#475569" },
  { value: "additional", label: "추가",  bg: "#ede9fe", color: "#7c3aed" },
];

interface Props {
  staffList: any[];
  employees: any[];
  onChange: (next: any[]) => void;
}

export default function StaffSection({ staffList, employees, onChange }: Props) {
  function addRow() {
    onChange([
      ...staffList,
      {
        employee_id: "",
        staff_type: "regular",
        role: "",
        check_in: "",
        check_out: "",
        work_hours: "",
        memo: "",
      },
    ]);
  }

  function removeRow(idx: number) {
    onChange(staffList.filter((_, i) => i !== idx));
  }

  function updateRow(idx: number, patch: Partial<any>) {
    const next = staffList.map((s, i) => (i === idx ? { ...s, ...patch } : s));

    // check_in/out 변경 시 근무시간 자동 계산 (사용자가 직접 work_hours 수정한 경우 제외)
    if (("check_in" in patch || "check_out" in patch) && !("work_hours" in patch)) {
      const row = next[idx];
      const calc = calcHours(row.check_in, row.check_out);
      if (calc != null) row.work_hours = String(calc);
    }
    onChange(next);
  }

  function calcHours(checkIn: string, checkOut: string): number | null {
    if (!checkIn || !checkOut) return null;
    const [ih, im] = checkIn.split(":").map(Number);
    const [oh, om] = checkOut.split(":").map(Number);
    if ([ih, im, oh, om].some((n) => isNaN(n))) return null;
    let mins = oh * 60 + om - (ih * 60 + im);
    if (mins < 0) mins += 24 * 60; // 야간 근무
    return Math.round((mins / 60) * 100) / 100;
  }

  return (
    <div>
      {staffList.length === 0 ? (
        <div style={{
          padding: 30, textAlign: "center", color: "#94a3b8",
          background: "#f8fafc", borderRadius: 8, fontSize: 13,
          marginBottom: 12,
        }}>
          아직 등록된 근무인원이 없습니다
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#f8fafc" }}>
                <Th>직원</Th>
                <Th>구분</Th>
                <Th width={80}>출근</Th>
                <Th width={80}>퇴근</Th>
                <Th width={90}>근무시간</Th>
                <Th>메모</Th>
                <Th width={50}></Th>
              </tr>
            </thead>
            <tbody>
              {staffList.map((s, idx) => {
                const sty = STAFF_TYPE_OPTIONS.find((o) => o.value === s.staff_type);
                return (
                  <tr key={idx} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <Td>
                      <select
                        value={s.employee_id}
                        onChange={(e) => updateRow(idx, { employee_id: e.target.value })}
                        style={cellInput}
                      >
                        <option value="">직원 선택</option>
                        {employees.map((emp) => (
                          <option key={emp.id} value={emp.id}>
                            {emp.name} ({emp.emp_no})
                          </option>
                        ))}
                      </select>
                    </Td>
                    <Td>
                      <select
                        value={s.staff_type}
                        onChange={(e) => updateRow(idx, { staff_type: e.target.value })}
                        style={{
                          ...cellInput,
                          background: sty?.bg || "#fff",
                          color: sty?.color || "#0f172a",
                          fontWeight: 700,
                        }}
                      >
                        {STAFF_TYPE_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </Td>
                    <Td>
                      <input
                        type="time"
                        value={s.check_in}
                        onChange={(e) => updateRow(idx, { check_in: e.target.value })}
                        style={cellInput}
                      />
                    </Td>
                    <Td>
                      <input
                        type="time"
                        value={s.check_out}
                        onChange={(e) => updateRow(idx, { check_out: e.target.value })}
                        style={cellInput}
                      />
                    </Td>
                    <Td>
                      <input
                        type="number"
                        value={s.work_hours}
                        onChange={(e) => updateRow(idx, { work_hours: e.target.value })}
                        step={0.5}
                        min={0}
                        max={24}
                        placeholder="자동"
                        style={{ ...cellInput, textAlign: "right" }}
                      />
                    </Td>
                    <Td>
                      <input
                        type="text"
                        value={s.memo}
                        onChange={(e) => updateRow(idx, { memo: e.target.value })}
                        placeholder="(선택)"
                        style={cellInput}
                      />
                    </Td>
                    <Td>
                      <button
                        onClick={() => removeRow(idx)}
                        title="삭제"
                        style={{
                          width: 32, height: 32, borderRadius: 6,
                          background: "#fef2f2", color: "#dc2626",
                          border: "1px solid #fecaca",
                          fontSize: 14, cursor: "pointer",
                        }}
                      >
                        ✕
                      </button>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <button
        onClick={addRow}
        style={{
          marginTop: 12, height: 38, padding: "0 16px", borderRadius: 8,
          background: "#fff", color: "#1428A0",
          border: "1.5px dashed #1428A0",
          fontWeight: 700, fontSize: 13, cursor: "pointer",
        }}
      >
        ➕ 직원 추가
      </button>

      {employees.length === 0 && (
        <div style={{ marginTop: 8, fontSize: 12, color: "#dc2626" }}>
          ⚠ 이 사업장에 배정된 직원이 없습니다. 사업장 설정에서 직원을 먼저 배정해주세요.
        </div>
      )}
    </div>
  );
}

function Th({ children, width }: { children?: React.ReactNode; width?: number }) {
  return (
    <th style={{
      padding: "10px 8px",
      textAlign: "left", fontSize: 12, fontWeight: 700, color: "#475569",
      borderBottom: "1px solid #e2e8f0",
      width,
    }}>{children}</th>
  );
}
function Td({ children }: { children: React.ReactNode }) {
  return <td style={{ padding: "8px" }}>{children}</td>;
}
const cellInput: React.CSSProperties = {
  width: "100%", height: 34, padding: "0 8px",
  borderRadius: 6, border: "1px solid #e2e8f0",
  fontSize: 13, color: "#0f172a", background: "#fff",
  boxSizing: "border-box",
};
