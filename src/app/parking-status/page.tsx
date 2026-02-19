// @ts-nocheck
"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { getOrgId, getUserContext } from "@/lib/utils/org";
import AppLayout from "@/components/layout/AppLayout";

export default function ParkingStatusPage() {
  const [stores, setStores] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [orgId, setOrgId] = useState<string | null>(null);

  // Filters
  const [selectedStore, setSelectedStore] = useState("");
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [workerFilter, setWorkerFilter] = useState("");

  useEffect(() => { loadInitial(); }, []);
  useEffect(() => { loadEntries(); }, [selectedStore, selectedDate]);

  const loadInitial = async () => {
    const supabase = createClient();
    const ctx = await getUserContext();
    if (!ctx.orgId) return;
    setOrgId(ctx.orgId);
    let storeQuery = supabase.from("stores").select("id, name, region").eq("org_id", ctx.orgId).eq("is_active", true).order("name");
    if (!ctx.allStores && ctx.storeIds.length > 0) storeQuery = storeQuery.in("id", ctx.storeIds);
    else if (!ctx.allStores) { setStores([]); return; }
    const { data: storeData } = await storeQuery;
    setStores(storeData || []);
    const { data: workerData } = await supabase.from("workers").select("id, name").eq("org_id", ctx.orgId).order("name");
    setWorkers(workerData || []);
    loadEntries();
  };

  const loadEntries = async () => {
    setLoading(true);
    const supabase = createClient();
    const dayStart = `${selectedDate}T00:00:00`;
    const dayEnd = `${selectedDate}T23:59:59`;

    let q = supabase
      .from("parking_entries")
      .select("*, stores(name), workers(name)")
      .gte("entry_time", dayStart)
      .lte("entry_time", dayEnd)
      .order("entry_time", { ascending: false });

    if (selectedStore) q = q.eq("store_id", selectedStore);

    const { data } = await q;
    setEntries(data || []);
    setLoading(false);
  };

  // Filtered entries
  const filtered = useMemo(() => {
    return entries.filter(e => {
      if (typeFilter !== "all" && e.parking_type !== typeFilter) return false;
      if (statusFilter !== "all" && e.status !== statusFilter) return false;
      if (workerFilter && e.worker_id !== workerFilter) return false;
      if (search) {
        const q = search.replace(/\s/g, "").toLowerCase();
        const p = (e.plate_number || "").replace(/\s/g, "").toLowerCase();
        if (!p.includes(q)) return false;
      }
      return true;
    });
  }, [entries, typeFilter, statusFilter, workerFilter, search]);

  // KPI
  const kpi = useMemo(() => ({
    total: filtered.length,
    parked: filtered.filter(e => e.status === "parked").length,
    valet: filtered.filter(e => e.parking_type === "valet").length,
    exited: filtered.filter(e => e.status === "exited").length,
  }), [filtered]);

  // Hourly chart
  const hourlyData = useMemo(() => {
    const hours = {};
    for (let h = 7; h <= 22; h++) hours[h] = 0;
    filtered.forEach(e => {
      const h = new Date(e.entry_time).getHours();
      if (hours[h] !== undefined) hours[h]++;
    });
    return Object.entries(hours).map(([h, count]) => ({ hour: Number(h), count }));
  }, [filtered]);

  const maxHour = Math.max(...hourlyData.map(d => d.count), 1);

  // Workers in current entries (for filter dropdown)
  const entryWorkerIds = [...new Set(entries.map(e => e.worker_id))];
  const entryWorkers = workers.filter(w => entryWorkerIds.includes(w.id));

  const typeStyle = (t) => ({
    normal: { bg: "#1428A010", color: "#1428A0", label: "일반" },
    valet: { bg: "#F5B73125", color: "#92710b", label: "발렛" },
    monthly: { bg: "#ede9fe", color: "#7c3aed", label: "월주차" },
  }[t] || { bg: "#f1f5f9", color: "#475569", label: t });

  const formatTime = (ts) => {
    if (!ts) return "-";
    const d = new Date(ts);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  const highlightPlate = (plate, query) => {
    if (!query) return plate;
    const q = query.replace(/\s/g, "").toLowerCase();
    const p = (plate || "").replace(/\s/g, "").toLowerCase();
    const idx = p.indexOf(q);
    if (idx === -1) return plate;
    let origStart = -1, origEnd = -1, count = 0;
    for (let i = 0; i < plate.length; i++) {
      if (plate[i] !== " ") {
        if (count === idx) origStart = i;
        if (count === idx + q.length - 1) { origEnd = i + 1; break; }
        count++;
      }
    }
    if (origStart === -1) return plate;
    return (
      <span>
        {plate.slice(0, origStart)}
        <span style={{ background: "#FEF08A", borderRadius: 3, padding: "0 2px" }}>{plate.slice(origStart, origEnd)}</span>
        {plate.slice(origEnd)}
      </span>
    );
  };

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-5 pb-24 md:pb-6">
        {/* Filters Row */}
        <div className="flex flex-wrap gap-2 mb-4">
          <select value={selectedStore} onChange={e => setSelectedStore(e.target.value)} style={{ padding: "9px 14px", borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 14, fontWeight: 600, background: "#fff", minWidth: 150 }}>
            <option value="">전체 매장</option>
            {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} style={{ padding: "9px 14px", borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 14, background: "#fff" }} />
          <div className="flex-1" style={{ display: "flex", alignItems: "center", gap: 8, background: "#fff", borderRadius: 10, border: search ? "2px solid #1428A0" : "1px solid #e2e8f0", padding: "0 14px", minWidth: 180, transition: "border-color 0.2s" }}>
            <span style={{ fontSize: 14, color: "#94a3b8" }}>🔍</span>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="차량번호 검색" style={{ flex: 1, border: "none", outline: "none", background: "none", fontSize: 14, fontWeight: 600, padding: "9px 0", color: "#1e293b" }} />
            {search && <button onClick={() => setSearch("")} style={{ border: "none", background: "#fee2e2", borderRadius: 6, width: 22, height: 22, cursor: "pointer", fontSize: 10, color: "#dc2626", fontWeight: 700 }}>✕</button>}
          </div>
          <select value={workerFilter} onChange={e => setWorkerFilter(e.target.value)} style={{ padding: "9px 14px", borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 14, fontWeight: 600, background: "#fff" }}>
            <option value="">전체 등록자</option>
            {entryWorkers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-4 gap-3 mb-4">
          {[
            { label: "총 입차", value: kpi.total, unit: "대", icon: "🚗", color: "#1e293b" },
            { label: "주차중", value: kpi.parked, unit: "대", icon: "🟢", color: "#16a34a" },
            { label: "발렛", value: kpi.valet, unit: "건", icon: "🅿️", color: "#1428A0" },
            { label: "출차", value: kpi.exited, unit: "대", icon: "⚪", color: "#94a3b8" },
          ].map(k => (
            <div key={k.label} style={{ background: "#fff", borderRadius: 14, padding: "12px 14px", border: "1px solid #e2e8f0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 4 }}>
                <span style={{ fontSize: 14 }}>{k.icon}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#94a3b8" }}>{k.label}</span>
              </div>
              <span style={{ fontSize: 22, fontWeight: 900, color: k.color }}>{k.value}</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", marginLeft: 2 }}>{k.unit}</span>
            </div>
          ))}
        </div>

        {/* Type + Status Filters */}
        <div className="flex flex-wrap gap-3 mb-4">
          <div style={{ display: "flex", background: "#fff", borderRadius: 10, padding: 3, border: "1px solid #e2e8f0" }}>
            {[
              { id: "all", label: "전체" },
              { id: "normal", label: "일반" },
              { id: "valet", label: "발렛" },
              { id: "monthly", label: "월주차" },
            ].map(t => (
              <button key={t.id} onClick={() => setTypeFilter(t.id)} className="cursor-pointer" style={{
                padding: "7px 16px", borderRadius: 8, border: "none",
                fontSize: 13, fontWeight: typeFilter === t.id ? 700 : 500,
                background: typeFilter === t.id ? (t.id === "valet" ? "#F5B73120" : t.id === "monthly" ? "#ede9fe" : "#1428A010") : "transparent",
                color: typeFilter === t.id ? (t.id === "valet" ? "#92710b" : t.id === "monthly" ? "#7c3aed" : "#1428A0") : "#94a3b8",
              }}>{t.label}</button>
            ))}
          </div>
          <div style={{ display: "flex", background: "#fff", borderRadius: 10, padding: 3, border: "1px solid #e2e8f0" }}>
            {[
              { id: "all", label: "전체" },
              { id: "parked", label: "🟢 주차중" },
              { id: "exited", label: "⚪ 출차" },
            ].map(s => (
              <button key={s.id} onClick={() => setStatusFilter(s.id)} className="cursor-pointer" style={{
                padding: "7px 16px", borderRadius: 8, border: "none",
                fontSize: 13, fontWeight: statusFilter === s.id ? 700 : 500,
                background: statusFilter === s.id ? "#dcfce710" : "transparent",
                color: statusFilter === s.id ? "#16a34a" : "#94a3b8",
              }}>{s.label}</button>
            ))}
          </div>
          <div style={{ marginLeft: "auto", fontSize: 13, color: "#94a3b8", fontWeight: 600, display: "flex", alignItems: "center" }}>
            검색 결과: <span style={{ fontWeight: 800, color: "#1428A0", marginLeft: 4 }}>{filtered.length}건</span>
          </div>
        </div>

        {/* Hourly Chart */}
        <div style={{ background: "#fff", borderRadius: 14, padding: 16, border: "1px solid #e2e8f0", marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#1e293b", marginBottom: 10 }}>⏰ 시간대별 입차</div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 80 }}>
            {hourlyData.map((d, i) => {
              const h = Math.max((d.count / maxHour) * 100, 4);
              const isPeak = d.count === maxHour && d.count > 0;
              return (
                <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                  <span style={{ fontSize: 9, fontWeight: 700, color: isPeak ? "#1428A0" : "#94a3b8" }}>{d.count || ""}</span>
                  <div style={{ width: "100%", maxWidth: 22, height: `${h}%`, borderRadius: "3px 3px 0 0", background: isPeak ? "#1428A0" : d.count > 0 ? "#1428A050" : "#e2e8f0" }} />
                  <span style={{ fontSize: 9, color: "#94a3b8" }}>{d.hour}시</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Entries Table (PC) */}
        <div className="hidden md:block" style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", overflow: "hidden" }}>
          {loading ? (
            <div className="text-center py-10" style={{ color: "#94a3b8" }}>로딩 중...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <div style={{ fontSize: 40, marginBottom: 8 }}>🔍</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#1e293b" }}>
                {entries.length === 0 ? "입차 데이터가 없습니다" : "검색 결과가 없습니다"}
              </div>
              <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 4 }}>
                {entries.length === 0 ? "크루앱에서 입차를 등록하면 여기에 표시됩니다" : "필터를 변경해 보세요"}
              </div>
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  {["차량번호", "매장", "유형", "입차시간", "출차시간", "위치", "등록자", "상태"].map(h => (
                    <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "#94a3b8", borderBottom: "2px solid #e2e8f0" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 50).map((e, i) => {
                  const ts = typeStyle(e.parking_type);
                  const isParked = e.status === "parked";
                  return (
                    <tr key={e.id} style={{ background: i % 2 === 0 ? "#fff" : "#fafbfc" }}>
                      <td style={{ padding: "10px 14px", fontSize: 15, fontWeight: 800, color: "#1e293b", letterSpacing: 0.3, borderBottom: "1px solid #e2e8f0" }}>
                        {highlightPlate(e.plate_number, search)}
                      </td>
                      <td style={{ padding: "10px 14px", fontSize: 13, fontWeight: 600, color: "#334155", borderBottom: "1px solid #e2e8f0", maxWidth: 140, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.stores?.name || "-"}</td>
                      <td style={{ padding: "10px 14px", borderBottom: "1px solid #e2e8f0" }}>
                        <span style={{ padding: "3px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700, background: ts.bg, color: ts.color }}>{ts.label}</span>
                      </td>
                      <td style={{ padding: "10px 14px", fontSize: 13, fontWeight: 700, color: "#1e293b", borderBottom: "1px solid #e2e8f0" }}>{formatTime(e.entry_time)}</td>
                      <td style={{ padding: "10px 14px", fontSize: 13, fontWeight: 600, color: e.exit_time ? "#334155" : "#94a3b8", borderBottom: "1px solid #e2e8f0" }}>{formatTime(e.exit_time)}</td>
                      <td style={{ padding: "10px 14px", fontSize: 11, fontWeight: 600, color: "#94a3b8", borderBottom: "1px solid #e2e8f0" }}>{e.floor || "-"}</td>
                      <td style={{ padding: "10px 14px", fontSize: 12, fontWeight: 600, color: "#475569", borderBottom: "1px solid #e2e8f0" }}>{e.workers?.name || "-"}</td>
                      <td style={{ padding: "10px 14px", borderBottom: "1px solid #e2e8f0" }}>
                        <span style={{ padding: "3px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700, background: isParked ? "#dcfce7" : "#f1f5f9", color: isParked ? "#15803d" : "#475569" }}>
                          {isParked ? "● 주차중" : "출차"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {filtered.length > 50 && (
            <div style={{ textAlign: "center", padding: "12px 0", borderTop: "1px solid #e2e8f0" }}>
              <span style={{ fontSize: 13, color: "#1428A0", fontWeight: 700 }}>+ {filtered.length - 50}건 더보기</span>
            </div>
          )}
        </div>

        {/* Entries Cards (Mobile) */}
        <div className="md:hidden space-y-2">
          {loading ? (
            <div className="text-center py-10" style={{ color: "#94a3b8" }}>로딩 중...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <div style={{ fontSize: 40, marginBottom: 8 }}>🔍</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#1e293b" }}>
                {entries.length === 0 ? "입차 데이터가 없습니다" : "검색 결과가 없습니다"}
              </div>
            </div>
          ) : filtered.slice(0, 30).map((e, i) => {
            const ts = typeStyle(e.parking_type);
            const isParked = e.status === "parked";
            return (
              <div key={e.id} style={{ background: "#fff", borderRadius: 12, padding: "12px 14px", border: "1px solid #e2e8f0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <span style={{ fontSize: 16, fontWeight: 800, color: "#1e293b", letterSpacing: 0.3 }}>
                    {highlightPlate(e.plate_number, search)}
                  </span>
                  <div style={{ display: "flex", gap: 4 }}>
                    <span style={{ padding: "3px 8px", borderRadius: 5, fontSize: 10, fontWeight: 700, background: ts.bg, color: ts.color }}>{ts.label}</span>
                    <span style={{ padding: "3px 8px", borderRadius: 5, fontSize: 10, fontWeight: 700, background: isParked ? "#dcfce7" : "#f1f5f9", color: isParked ? "#15803d" : "#475569" }}>
                      {isParked ? "● 주차중" : "출차"}
                    </span>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 12, fontSize: 12, color: "#94a3b8" }}>
                  <span>{e.stores?.name || "-"}</span>
                  <span>⏰ {formatTime(e.entry_time)}</span>
                  {e.exit_time && <span>→ {formatTime(e.exit_time)}</span>}
                  <span style={{ marginLeft: "auto" }}>👤 {e.workers?.name || "-"}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}
