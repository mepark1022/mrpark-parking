// @ts-nocheck
"use client";
import LeaveTab from "./LeaveTab";
import ReviewTab from "./ReviewTab";
import ReportTab from "./ReportTab";
import { useState, useEffect } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { createClient } from "@/lib/supabase/client";
import { getOrgId } from "@/lib/utils/org";
import { getDayType, getHolidayName, getDayTypeLabel } from "@/utils/holidays";
import * as XLSX from "xlsx";

const tabs = [
  { id: "attendance", label: "출퇴근" },
  { id: "roster", label: "명부" },
  { id: "schedule", label: "근태" },
  { id: "leave", label: "연차" },
  { id: "review", label: "근무리뷰" },
  { id: "report", label: "시말서" },
];

const statusMap = {
  present: { label: "출근", bg: "#dcfce7", color: "#15803d" },
  late: { label: "지각", bg: "#fff7ed", color: "#ea580c" },
  absent: { label: "결근", bg: "#fee2e2", color: "#dc2626" },
  dayoff: { label: "휴무", bg: "#f1f5f9", color: "#475569" },
  vacation: { label: "연차", bg: "#ede9fe", color: "#7c3aed" },
};

function ScheduleTab() {
  const [workers, setWorkers] = useState([]);
  const [stores, setStores] = useState([]);
  const [records, setRecords] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; });
  const [selectedStore, setSelectedStore] = useState("");
  const [storeWorkers, setStoreWorkers] = useState([]);
  const [orgId, setOrgId] = useState("");
  const [editCell, setEditCell] = useState(null); // {workerId, date}

  useEffect(() => { loadBase(); }, []);
  useEffect(() => { if (selectedStore && selectedMonth) loadAllRecords(); }, [selectedStore, selectedMonth, storeWorkers]);
  useEffect(() => { if (selectedStore && workers.length > 0) loadStoreWorkers(); }, [selectedStore, workers]);

  const loadBase = async () => {
    const oid = await getOrgId();
    setOrgId(oid);
    const supabase = createClient();
    const { data: w } = await supabase.from("workers").select("id, name").eq("org_id", oid).eq("status", "active").order("name");
    const { data: s } = await supabase.from("stores").select("id, name").eq("org_id", oid).eq("is_active", true).order("name");
    if (w) setWorkers(w);
    if (s) { setStores(s); if (s.length > 0) setSelectedStore(s[0].id); }
  };

  const loadStoreWorkers = async () => {
    const supabase = createClient();
    const { data: members } = await supabase.from("store_members").select("user_id").eq("store_id", selectedStore);
    if (members && members.length > 0) {
      const workerIds = members.map(m => m.user_id);
      const filtered = workers.filter(w => workerIds.includes(w.id));
      setStoreWorkers(filtered.length > 0 ? filtered : workers);
    } else {
      setStoreWorkers(workers);
    }
  };

  const loadAllRecords = async () => {
    if (storeWorkers.length === 0) return;
    const [y, m] = selectedMonth.split("-");
    const startDate = `${y}-${m}-01`;
    const endDate = `${y}-${m}-${new Date(Number(y), Number(m), 0).getDate()}`;
    const supabase = createClient();
    const workerIds = storeWorkers.map(w => w.id);
    const { data } = await supabase.from("worker_attendance").select("*").in("worker_id", workerIds).gte("date", startDate).lte("date", endDate).order("date");
    if (data) setRecords(data);
  };

  const setStatus = async (workerId, date, status) => {
    const existing = records.find(r => r.worker_id === workerId && r.date === date);
    const supabase = createClient();
    if (status === "delete") {
      if (existing) await supabase.from("worker_attendance").delete().eq("id", existing.id);
    } else if (existing) {
      await supabase.from("worker_attendance").update({ status }).eq("id", existing.id);
    } else {
      await supabase.from("worker_attendance").insert({ org_id: orgId, worker_id: workerId, date, status, check_in: status === "present" ? "09:00" : null, store_id: selectedStore });
    }
    setEditCell(null);
    loadAllRecords();
  };

  const [y, m] = selectedMonth.split("-");
  const daysInMonth = new Date(Number(y), Number(m), 0).getDate();
  const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
  const today = new Date().toISOString().split("T")[0];

  const getWorkerStats = (workerId) => {
    const wr = records.filter(r => r.worker_id === workerId);
    return {
      present: wr.filter(r => r.status === "present").length,
      late: wr.filter(r => r.status === "late").length,
      absent: wr.filter(r => r.status === "absent").length,
      dayoff: wr.filter(r => r.status === "dayoff").length,
      vacation: wr.filter(r => r.status === "vacation").length,
      total: wr.length,
    };
  };

  const dates = Array.from({ length: daysInMonth }, (_, i) => {
    const date = `${y}-${m}-${String(i + 1).padStart(2, "0")}`;
    const dayOfWeek = new Date(date + "T00:00:00").getDay();
    const holidayName = getHolidayName(date);
    const dtype = getDayType(date);
    return { date, day: i + 1, dayOfWeek, dayName: dayNames[dayOfWeek], holidayName, isSpecial: dtype !== "weekday", isToday: date === today };
  });

  const downloadExcel = () => {
    const storeName = stores.find(s => s.id === selectedStore)?.name || "전체";
    const header = ["근무자", ...dates.map(d => `${d.day}일(${d.dayName})`), "출근", "지각", "결근", "휴무", "연차", "합계"];
    const rows = storeWorkers.map(w => {
      const stats = getWorkerStats(w.id);
      return [
        w.name,
        ...dates.map(d => {
          const rec = records.find(r => r.worker_id === w.id && r.date === d.date);
          return rec ? statusMap[rec.status]?.label || "" : "";
        }),
        stats.present, stats.late, stats.absent, stats.dayoff, stats.vacation, stats.total,
      ];
    });
    const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
    ws["!cols"] = [{ wch: 10 }, ...dates.map(() => ({ wch: 7 })), { wch: 5 }, { wch: 5 }, { wch: 5 }, { wch: 5 }, { wch: 5 }, { wch: 5 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `${storeName}_근태`);
    XLSX.writeFile(wb, `근태현황_${storeName}_${selectedMonth}.xlsx`);
  };

  return (
    <div style={{ background: "#fff", borderRadius: 16, padding: 24, border: "1px solid #e2e8f0" }}>
      <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a", marginBottom: 16 }}>월별 근태 현황</div>

      {/* 매장 선택 + 월 선택 */}
      <div className="flex flex-col md:flex-row gap-4 mb-5">
        <div>
          <label className="block mb-1" style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>매장 선택</label>
          <div className="flex gap-2 flex-wrap">
            {stores.map(s => (
              <button key={s.id} onClick={() => setSelectedStore(s.id)} className="cursor-pointer" style={{
                padding: "8px 16px", borderRadius: 10, fontSize: 13, fontWeight: 700, transition: "all 0.15s",
                border: s.id === selectedStore ? "2px solid #1428A0" : "1px solid #e2e8f0",
                background: s.id === selectedStore ? "#1428A0" : "#fff",
                color: s.id === selectedStore ? "#fff" : "#475569",
              }}>{s.name}</button>
            ))}
          </div>
        </div>
        <div>
          <label className="block mb-1" style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>월 선택</label>
          <div className="flex gap-2 items-center">
            <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14, fontWeight: 600 }} />
            <button onClick={downloadExcel} className="cursor-pointer" style={{ padding: "10px 16px", borderRadius: 8, border: "none", background: "#15803d", color: "#fff", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
              📥 엑셀 다운
            </button>
          </div>
        </div>
      </div>

      {/* 범례 */}
      <div className="flex flex-wrap gap-2 mb-4">
        {Object.entries(statusMap).map(([k, v]) => (
          <div key={k} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <div style={{ width: 14, height: 14, borderRadius: 4, background: v.bg, border: `1px solid ${v.color}30` }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: v.color }}>{v.label}</span>
          </div>
        ))}
        <span style={{ fontSize: 11, color: "#94a3b8", marginLeft: 8 }}>💡 셀 클릭으로 상태 선택</span>
      </div>

      {storeWorkers.length === 0 ? (
        <div style={{ padding: 40, textAlign: "center", color: "#94a3b8", fontSize: 14 }}>배정된 근무자가 없습니다</div>
      ) : (
        <>
          {/* PC: 근무자=행, 날짜=열 매트릭스 */}
          <div className="hidden md:block" style={{ overflowX: "auto", borderRadius: 12, border: "1px solid #e2e8f0" }}>
            <table style={{ borderCollapse: "collapse", minWidth: daysInMonth * 38 + 180 }}>
              <thead>
                {/* 날짜 행 */}
                <tr style={{ background: "#f8fafc" }}>
                  <th style={{ padding: "6px 10px", fontSize: 11, fontWeight: 700, color: "#64748b", textAlign: "left", position: "sticky", left: 0, background: "#f8fafc", zIndex: 3, borderRight: "2px solid #e2e8f0", minWidth: 100 }}>근무자</th>
                  {dates.map(d => (
                    <th key={d.date} style={{ padding: "4px 2px", textAlign: "center", minWidth: 36, borderLeft: "1px solid #f1f5f9", background: d.isToday ? "#1428A015" : d.isSpecial ? "#fefce8" : "#f8fafc" }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#1e293b" }}>{d.day}</div>
                      <div style={{ fontSize: 9, fontWeight: 600, color: d.dayOfWeek === 0 ? "#dc2626" : d.dayOfWeek === 6 ? "#1428A0" : "#94a3b8" }}>{d.dayName}</div>
                      {d.holidayName && <div style={{ fontSize: 7, fontWeight: 700, color: "#dc2626", lineHeight: 1.1 }}>{d.holidayName.length > 3 ? d.holidayName.slice(0, 3) : d.holidayName}</div>}
                    </th>
                  ))}
                  <th style={{ padding: "6px 8px", fontSize: 11, fontWeight: 700, color: "#64748b", textAlign: "center", borderLeft: "2px solid #e2e8f0", minWidth: 60, background: "#f8fafc", position: "sticky", right: 0, zIndex: 3 }}>합계</th>
                </tr>
              </thead>
              <tbody>
                {storeWorkers.map((w, wi) => {
                  const stats = getWorkerStats(w.id);
                  return (
                    <tr key={w.id} style={{ borderTop: "1px solid #f1f5f9", background: wi % 2 === 0 ? "#fff" : "#fafbfc" }}>
                      <td style={{ padding: "8px 10px", fontSize: 13, fontWeight: 700, color: "#1e293b", position: "sticky", left: 0, background: wi % 2 === 0 ? "#fff" : "#fafbfc", zIndex: 2, borderRight: "2px solid #e2e8f0", whiteSpace: "nowrap" }}>{w.name}</td>
                      {dates.map(d => {
                        const rec = records.find(r => r.worker_id === w.id && r.date === d.date);
                        const st = rec ? statusMap[rec.status] : null;
                        const isEditing = editCell?.workerId === w.id && editCell?.date === d.date;
                        return (
                          <td key={d.date} style={{ padding: "3px 1px", textAlign: "center", borderLeft: "1px solid #f1f5f9", background: d.isToday ? "#1428A008" : d.isSpecial ? "#fefce804" : "", position: "relative" }}>
                            {isEditing ? (
                              <div style={{ position: "absolute", top: "100%", left: "50%", transform: "translateX(-50%)", zIndex: 10, background: "#fff", borderRadius: 10, padding: 6, boxShadow: "0 4px 20px rgba(0,0,0,0.15)", border: "1px solid #e2e8f0", display: "flex", flexDirection: "column", gap: 2, minWidth: 70 }}>
                                {Object.entries(statusMap).map(([k, v]) => (
                                  <button key={k} onClick={() => setStatus(w.id, d.date, k)} className="cursor-pointer" style={{ padding: "4px 8px", borderRadius: 6, border: "none", background: v.bg, color: v.color, fontSize: 11, fontWeight: 700, cursor: "pointer", textAlign: "center" }}>{v.label}</button>
                                ))}
                                {rec && <button onClick={() => setStatus(w.id, d.date, "delete")} className="cursor-pointer" style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid #e2e8f0", background: "#fff", color: "#94a3b8", fontSize: 11, fontWeight: 600 }}>삭제</button>}
                                <button onClick={() => setEditCell(null)} className="cursor-pointer" style={{ padding: "3px 8px", borderRadius: 6, border: "none", background: "#f1f5f9", color: "#94a3b8", fontSize: 10, fontWeight: 600 }}>취소</button>
                              </div>
                            ) : null}
                            <div onClick={() => setEditCell(isEditing ? null : { workerId: w.id, date: d.date })} style={{ cursor: "pointer", padding: "4px 2px", borderRadius: 4, transition: "background 0.1s", minHeight: 24, display: "flex", alignItems: "center", justifyContent: "center" }} onMouseEnter={e => e.currentTarget.style.background = "#e0e7ff"} onMouseLeave={e => e.currentTarget.style.background = ""}>
                              {st ? (
                                <span style={{ display: "inline-block", width: 28, height: 20, lineHeight: "20px", borderRadius: 4, fontSize: 9, fontWeight: 700, background: st.bg, color: st.color }}>{st.label}</span>
                              ) : (
                                <span style={{ fontSize: 10, color: "#e2e8f0" }}>·</span>
                              )}
                            </div>
                          </td>
                        );
                      })}
                      <td style={{ padding: "6px 8px", textAlign: "center", borderLeft: "2px solid #e2e8f0", position: "sticky", right: 0, background: wi % 2 === 0 ? "#fff" : "#fafbfc", zIndex: 2 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#15803d" }}>{stats.present}<span style={{ color: "#94a3b8", fontWeight: 400 }}>출</span></div>
                        {stats.late > 0 && <div style={{ fontSize: 10, fontWeight: 700, color: "#ea580c" }}>{stats.late}<span style={{ color: "#94a3b8", fontWeight: 400 }}>지</span></div>}
                        {stats.absent > 0 && <div style={{ fontSize: 10, fontWeight: 700, color: "#dc2626" }}>{stats.absent}<span style={{ color: "#94a3b8", fontWeight: 400 }}>결</span></div>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* 모바일: 근무자별 가로 스크롤 카드 */}
          <div className="md:hidden space-y-3">
            {storeWorkers.map(w => {
              const stats = getWorkerStats(w.id);
              return (
                <div key={w.id} style={{ background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0", overflow: "hidden" }}>
                  <div style={{ padding: "10px 14px", background: "#f8fafc", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e2e8f0" }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "#1e293b" }}>{w.name}</span>
                    <div style={{ display: "flex", gap: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#15803d" }}>{stats.present}출</span>
                      {stats.late > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: "#ea580c" }}>{stats.late}지</span>}
                      {stats.absent > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: "#dc2626" }}>{stats.absent}결</span>}
                    </div>
                  </div>
                  <div style={{ overflowX: "auto", padding: "8px 10px" }}>
                    <div style={{ display: "flex", gap: 4, minWidth: daysInMonth * 36 }}>
                      {dates.map(d => {
                        const rec = records.find(r => r.worker_id === w.id && r.date === d.date);
                        const st = rec ? statusMap[rec.status] : null;
                        const isEditing = editCell?.workerId === w.id && editCell?.date === d.date;
                        return (
                          <div key={d.date} style={{ position: "relative", textAlign: "center", minWidth: 32 }}>
                            <div style={{ fontSize: 9, fontWeight: 600, color: d.dayOfWeek === 0 ? "#dc2626" : d.dayOfWeek === 6 ? "#1428A0" : "#94a3b8" }}>{d.day}{d.dayName}</div>
                            <div onClick={() => setEditCell(isEditing ? null : { workerId: w.id, date: d.date })} style={{ cursor: "pointer", padding: "3px 2px", borderRadius: 4, background: st ? st.bg : d.isSpecial ? "#fefce8" : "#f8fafc", minHeight: 20, display: "flex", alignItems: "center", justifyContent: "center" }}>
                              {st ? <span style={{ fontSize: 8, fontWeight: 700, color: st.color }}>{st.label}</span> : <span style={{ fontSize: 8, color: "#e2e8f0" }}>·</span>}
                            </div>
                            {isEditing && (
                              <div style={{ position: "absolute", top: "100%", left: "50%", transform: "translateX(-50%)", zIndex: 10, background: "#fff", borderRadius: 8, padding: 4, boxShadow: "0 4px 16px rgba(0,0,0,0.15)", border: "1px solid #e2e8f0", display: "flex", flexDirection: "column", gap: 2, minWidth: 60 }}>
                                {Object.entries(statusMap).map(([k, v]) => (
                                  <button key={k} onClick={() => setStatus(w.id, d.date, k)} className="cursor-pointer" style={{ padding: "3px 6px", borderRadius: 4, border: "none", background: v.bg, color: v.color, fontSize: 10, fontWeight: 700 }}>{v.label}</button>
                                ))}
                                {rec && <button onClick={() => setStatus(w.id, d.date, "delete")} className="cursor-pointer" style={{ padding: "3px 6px", borderRadius: 4, border: "1px solid #e2e8f0", background: "#fff", color: "#94a3b8", fontSize: 10 }}>삭제</button>}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

export default function WorkersPage() {
  const [tab, setTab] = useState("roster");
  const [workers, setWorkers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [formData, setFormData] = useState({ name: "", phone: "", region_id: "", district: "" });
  const [regions, setRegions] = useState([]);
  const [message, setMessage] = useState("");

  // 시/도별 구/시 목록
  const districtMap: Record<string, string[]> = {
    "서울": ["강남구","강동구","강북구","강서구","관악구","광진구","구로구","금천구","노원구","도봉구","동대문구","동작구","마포구","서대문구","서초구","성동구","성북구","송파구","양천구","영등포구","용산구","은평구","종로구","중구","중랑구"],
    "경기": ["가평군","고양시","과천시","광명시","광주시","구리시","군포시","김포시","남양주시","동두천시","부천시","성남시","수원시","시흥시","안산시","안성시","안양시","양주시","양평군","여주시","연천군","오산시","용인시","의왕시","의정부시","이천시","파주시","평택시","포천시","하남시","화성시"],
    "부산": ["강서구","금정구","기장군","남구","동구","동래구","부산진구","북구","사상구","사하구","서구","수영구","연제구","영도구","중구","해운대구"],
    "인천": ["강화군","계양구","남동구","동구","미추홀구","부평구","서구","연수구","옹진군","중구"],
    "대구": ["남구","달서구","달성군","동구","북구","서구","수성구","중구"],
    "대전": ["대덕구","동구","서구","유성구","중구"],
    "광주": ["광산구","남구","동구","북구","서구"],
    "울산": ["남구","동구","북구","울주군","중구"],
    "세종": ["세종시"],
    "강원": ["강릉시","고성군","동해시","삼척시","속초시","양구군","양양군","영월군","원주시","인제군","정선군","철원군","춘천시","태백시","평창군","홍천군","화천군","횡성군"],
    "충북": ["괴산군","단양군","보은군","영동군","옥천군","음성군","제천시","증평군","진천군","청주시","충주시"],
    "충남": ["계룡시","공주시","금산군","논산시","당진시","보령시","부여군","서산시","서천군","아산시","예산군","천안시","청양군","태안군","홍성군"],
    "전북": ["고창군","군산시","김제시","남원시","무주군","부안군","순창군","완주군","익산시","임실군","장수군","전주시","정읍시","진안군"],
    "전남": ["강진군","고흥군","곡성군","광양시","구례군","나주시","담양군","목포시","무안군","보성군","순천시","신안군","여수시","영광군","영암군","완도군","장성군","장흥군","진도군","함평군","해남군","화순군"],
    "경북": ["경산시","경주시","고령군","구미시","군위군","김천시","문경시","봉화군","상주시","성주군","안동시","영덕군","영양군","영주시","영천시","예천군","울릉군","울진군","의성군","청도군","청송군","칠곡군","포항시"],
    "경남": ["거제시","거창군","고성군","김해시","남해군","밀양시","사천시","산청군","양산시","의령군","진주시","창녕군","창원시","통영시","하동군","함안군","함양군","합천군"],
    "제주": ["서귀포시","제주시"],
  };

  // 선택된 region 이름 가져오기
  const selectedRegionName = regions.find(r => r.id === formData.region_id)?.name || "";
  const districts = districtMap[selectedRegionName] || [];

  useEffect(() => { loadWorkers(); loadRegions(); }, []);

  const loadWorkers = async () => {
    const supabase = createClient();
    const oid = await getOrgId();
    if (!oid) return;
    const { data } = await supabase.from("workers").select("*, regions(name)").eq("org_id", oid).order("name");
    if (data) setWorkers(data);
  };
  const loadRegions = async () => {
    const supabase = createClient();
    const { data } = await supabase.from("regions").select("*").order("name");
    if (data) setRegions(data);
  };
  const handleSave = async () => {
    if (!formData.name) { setMessage("이름을 입력하세요"); return; }
    const supabase = createClient();
    const oid = await getOrgId();
    if (editItem) {
      const { error } = await supabase.from("workers").update({ name: formData.name, phone: formData.phone || null, region_id: formData.region_id || null, district: formData.district || null }).eq("id", editItem.id);
      if (error) { setMessage(`수정 실패: ${error.message}`); return; }
    } else {
      const { error } = await supabase.from("workers").insert({ name: formData.name, phone: formData.phone || null, region_id: formData.region_id || null, district: formData.district || null, status: "active", org_id: oid });
      if (error) { setMessage(`추가 실패: ${error.message}`); return; }
    }
    setShowForm(false); setEditItem(null); setFormData({ name: "", phone: "", region_id: "", district: "" }); setMessage(""); loadWorkers();
  };
  const toggleStatus = async (worker) => {
    const supabase = createClient();
    await supabase.from("workers").update({ status: worker.status === "active" ? "inactive" : "active" }).eq("id", worker.id);
    loadWorkers();
  };

  const activeWorkers = workers.filter(w => w.status === "active");

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto">
        {/* 탭 - 모바일에서 스크롤 */}
        <div className="flex gap-1 mb-6 overflow-x-auto" style={{ background: "#f8fafc", borderRadius: 12, padding: 4, border: "1px solid #e2e8f0" }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} className="cursor-pointer whitespace-nowrap" style={{
              padding: "10px 16px", borderRadius: 10, border: "none", fontSize: 13,
              fontWeight: tab === t.id ? 700 : 500, background: tab === t.id ? "#fff" : "transparent",
              color: tab === t.id ? "#1428A0" : "#475569", boxShadow: tab === t.id ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
              transition: "all 0.15s", flexShrink: 0,
            }}>{t.label}</button>
          ))}
        </div>

        {/* 출퇴근 */}
        {tab === "attendance" && (
          <div style={{ background: "#fff", borderRadius: 16, padding: 24, border: "1px solid #e2e8f0" }}>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-5 gap-3">
              <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a" }}>오늘의 출퇴근 현황</div>
              <div className="flex gap-2">
                <span style={{ padding: "4px 12px", borderRadius: 8, background: "#dcfce7", color: "#15803d", fontSize: 13, fontWeight: 700 }}>출근 {activeWorkers.length}명</span>
                <span style={{ padding: "4px 12px", borderRadius: 8, background: "#fee2e2", color: "#b91c1c", fontSize: 13, fontWeight: 700 }}>미출근 0명</span>
              </div>
            </div>

            {/* PC: 테이블 */}
            <div className="hidden md:block">
              <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "0 4px" }}>
                <thead><tr>{["이름", "지역", "연락처", "상태"].map(h => (<th key={h} style={{ padding: "10px 16px", fontSize: 13, fontWeight: 700, color: "#94a3b8", textAlign: "left", borderBottom: "2px solid #e2e8f0" }}>{h}</th>))}</tr></thead>
                <tbody>{activeWorkers.map((w, i) => (
                  <tr key={w.id} style={{ background: i % 2 === 0 ? "#f8fafc" : "#fff" }}>
                    <td style={{ padding: "12px 16px", fontSize: 14, fontWeight: 600, color: "#1e293b" }}>{w.name}</td>
                    <td style={{ padding: "12px 16px", fontSize: 13, color: "#475569" }}>{[w.regions?.name, w.district].filter(Boolean).join(" ") || "-"}</td>
                    <td style={{ padding: "12px 16px", fontSize: 13, color: "#475569" }}>{w.phone || "-"}</td>
                    <td style={{ padding: "12px 16px" }}><span style={{ padding: "3px 10px", borderRadius: 6, background: "#dcfce7", color: "#15803d", fontSize: 12, fontWeight: 600 }}>활성</span></td>
                  </tr>))}</tbody>
              </table>
            </div>

            {/* 모바일: 카드형 */}
            <div className="md:hidden space-y-2">
              {activeWorkers.map(w => (
                <div key={w.id} style={{ background: "#f8fafc", borderRadius: 12, padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#1e293b" }}>{w.name}</div>
                    <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>{[w.regions?.name, w.district].filter(Boolean).join(" ") || "-"} · {w.phone || "-"}</div>
                  </div>
                  <span style={{ padding: "3px 10px", borderRadius: 6, background: "#dcfce7", color: "#15803d", fontSize: 12, fontWeight: 600 }}>활성</span>
                </div>
              ))}
            </div>

            {activeWorkers.length === 0 && <div className="text-center py-10" style={{ color: "#94a3b8", fontSize: 14 }}>등록된 근무자가 없습니다</div>}
          </div>
        )}

        {/* 명부 */}
        {tab === "roster" && (
          <div style={{ background: "#fff", borderRadius: 16, padding: 24, border: "1px solid #e2e8f0" }}>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-5 gap-3">
              <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a" }}>근무자 명부 ({workers.length}명)</div>
              <button onClick={() => { setEditItem(null); setFormData({ name: "", phone: "", region_id: "", district: "" }); setShowForm(true); }} className="cursor-pointer" style={{ padding: "10px 20px", borderRadius: 10, border: "none", background: "#1428A0", color: "#fff", fontSize: 14, fontWeight: 700 }}>+ 근무자 추가</button>
            </div>
            {showForm && (
              <div style={{ background: "#f8fafc", borderRadius: 14, padding: 24, marginBottom: 20, border: "1px solid #e2e8f0" }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", marginBottom: 16 }}>{editItem ? "근무자 수정" : "근무자 추가"}</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div><label className="block mb-1" style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>이름 *</label><input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="이름" className="w-full" style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14 }} /></div>
                  <div><label className="block mb-1" style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>연락처</label><input value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} placeholder="010-0000-0000" className="w-full" style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14 }} /></div>
                  <div><label className="block mb-1" style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>시/도</label><select value={formData.region_id} onChange={e => setFormData({ ...formData, region_id: e.target.value, district: "" })} className="w-full" style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14 }}><option value="">선택</option>{regions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></div>
                  <div><label className="block mb-1" style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>구/시</label><select value={formData.district} onChange={e => setFormData({ ...formData, district: e.target.value })} className="w-full" style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14 }} disabled={districts.length === 0}><option value="">선택</option>{districts.map(d => <option key={d} value={d}>{d}</option>)}</select></div>
                </div>
                {message && <p style={{ color: "#dc2626", fontSize: 13, marginBottom: 8 }}>{message}</p>}
                <div className="flex gap-2">
                  <button onClick={handleSave} className="cursor-pointer" style={{ padding: "10px 24px", borderRadius: 8, border: "none", background: "#1428A0", color: "#fff", fontSize: 14, fontWeight: 700 }}>{editItem ? "수정" : "추가"}</button>
                  <button onClick={() => { setShowForm(false); setMessage(""); }} className="cursor-pointer" style={{ padding: "10px 24px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", color: "#475569", fontSize: 14, fontWeight: 600 }}>취소</button>
                </div>
              </div>
            )}

            {/* PC: 테이블 */}
            <div className="hidden md:block">
              <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "0 4px" }}>
                <thead><tr>{["이름", "지역", "연락처", "상태", "관리"].map(h => (<th key={h} style={{ padding: "10px 16px", fontSize: 13, fontWeight: 700, color: "#94a3b8", textAlign: "left", borderBottom: "2px solid #e2e8f0" }}>{h}</th>))}</tr></thead>
                <tbody>{workers.map((w, i) => (
                  <tr key={w.id} style={{ background: i % 2 === 0 ? "#f8fafc" : "#fff" }}>
                    <td style={{ padding: "12px 16px", fontSize: 14, fontWeight: 600, color: "#1e293b" }}>{w.name}</td>
                    <td style={{ padding: "12px 16px", fontSize: 13, color: "#475569" }}>{[w.regions?.name, w.district].filter(Boolean).join(" ") || "-"}</td>
                    <td style={{ padding: "12px 16px", fontSize: 13, color: "#475569" }}>{w.phone || "-"}</td>
                    <td style={{ padding: "12px 16px" }}><span style={{ padding: "3px 10px", borderRadius: 6, fontSize: 12, fontWeight: 600, background: w.status === "active" ? "#dcfce7" : "#fee2e2", color: w.status === "active" ? "#15803d" : "#b91c1c" }}>{w.status === "active" ? "활성" : "비활성"}</span></td>
                    <td style={{ padding: "12px 16px" }}><div className="flex gap-2">
                      <button onClick={() => { setEditItem(w); setFormData({ name: w.name, phone: w.phone || "", region_id: w.region_id || "", district: w.district || "" }); setShowForm(true); }} className="cursor-pointer" style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", fontSize: 12, fontWeight: 600, color: "#475569" }}>수정</button>
                      <button onClick={() => toggleStatus(w)} className="cursor-pointer" style={{ padding: "6px 14px", borderRadius: 8, border: "none", fontSize: 12, fontWeight: 600, background: w.status === "active" ? "#fee2e2" : "#dcfce7", color: w.status === "active" ? "#b91c1c" : "#15803d" }}>{w.status === "active" ? "비활성" : "활성화"}</button>
                    </div></td>
                  </tr>))}</tbody>
              </table>
            </div>

            {/* 모바일: 카드형 */}
            <div className="md:hidden space-y-2">
              {workers.map(w => (
                <div key={w.id} style={{ background: "#f8fafc", borderRadius: 12, padding: "14px", border: "1px solid #e2e8f0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: "#1e293b" }}>{w.name}</span>
                      <span style={{ padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600, background: w.status === "active" ? "#dcfce7" : "#fee2e2", color: w.status === "active" ? "#15803d" : "#b91c1c" }}>{w.status === "active" ? "활성" : "비활성"}</span>
                    </div>
                  </div>
                  <div style={{ fontSize: 13, color: "#475569", marginBottom: 10 }}>
                    {[w.regions?.name, w.district].filter(Boolean).join(" ") || "지역 없음"} · {w.phone || "연락처 없음"}
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => { setEditItem(w); setFormData({ name: w.name, phone: w.phone || "", region_id: w.region_id || "", district: w.district || "" }); setShowForm(true); }} className="cursor-pointer" style={{ flex: 1, padding: "8px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", fontSize: 12, fontWeight: 600, color: "#475569", textAlign: "center" }}>수정</button>
                    <button onClick={() => toggleStatus(w)} className="cursor-pointer" style={{ flex: 1, padding: "8px", borderRadius: 8, border: "none", fontSize: 12, fontWeight: 600, textAlign: "center", background: w.status === "active" ? "#fee2e2" : "#dcfce7", color: w.status === "active" ? "#b91c1c" : "#15803d" }}>{w.status === "active" ? "비활성" : "활성화"}</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "schedule" && <ScheduleTab />}
        {tab === "leave" && <LeaveTab />}
        {tab === "review" && <ReviewTab />}
        {tab === "report" && <ReportTab />}
        {!["attendance", "roster", "schedule", "leave", "review", "report"].includes(tab) && (
          <div style={{ background: "#fff", borderRadius: 16, padding: 64, border: "1px solid #e2e8f0", textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🚧</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#0f172a", marginBottom: 8 }}>{tabs.find(t => t.id === tab)?.label} 관리</div>
            <div style={{ fontSize: 14, color: "#94a3b8" }}>개발 예정입니다</div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
