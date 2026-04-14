// @ts-nocheck
/**
 * 미팍 통합앱 v2 — 대시보드 (Part 17B)
 *
 * 경로: /v2/dashboard
 *
 * 구성:
 *   ① 필터 바: 기간 프리셋(이번달/지난달/최근7일/최근30일) + 직접입력 + 사업장 드롭다운
 *   ② KPI 4카드: 매출·차량·발렛·일보수 (직전 동일기간 대비 증감률) + 활성월주차 서브정보
 *   ③ 일별 추이 차트: AreaChart — 매출(좌축 ₩) + 차량(우축 대)
 *   ④ 결제수단 도넛: PieChart + Legend (7종)
 *   ⑤ 사업장별 테이블: 정렬 토글 (매출/차량/발렛)
 *   ⑥ 입주사별 테이블: 현재 시점 스냅샷 (활성/만료/취소 건수 + 월 잠재매출)
 *
 * API:
 *   GET /api/v1/stats/overview
 *   GET /api/v1/stats/by-store
 *   GET /api/v1/stats/by-tenant
 *   GET /api/v1/stats/by-payment-method
 *   GET /api/v1/stats/daily-trend
 *   GET /api/v1/stores (사업장 필터용)
 *
 * 권한: MANAGE (super_admin/admin). crew/field_member는 ctx.storeIds 서버 강제.
 */
"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  ComposedChart,
  Bar,
} from "recharts";

// ─────────────────────────────────────────────
// 유틸
// ─────────────────────────────────────────────

const NAVY = "#1428A0";
const GOLD = "#F5B731";

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function firstOfMonth(offsetMonths = 0): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + offsetMonths);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function lastOfMonth(offsetMonths = 0): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + offsetMonths + 1);
  d.setDate(0); // 말일
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmtKRW(n: number | null | undefined): string {
  if (n == null || isNaN(n as number)) return "₩0";
  return `₩${Math.round(n as number).toLocaleString("ko-KR")}`;
}

function fmtCount(n: number | null | undefined): string {
  if (n == null || isNaN(n as number)) return "0";
  return Math.round(n as number).toLocaleString("ko-KR");
}

function fmtChange(n: number | null | undefined): { text: string; color: string; arrow: string } {
  if (n == null) return { text: "신규", color: "#64748b", arrow: "•" };
  if (n === 0) return { text: "0.0%", color: "#64748b", arrow: "•" };
  if (n > 0) return { text: `+${n.toFixed(1)}%`, color: "#16a34a", arrow: "▲" };
  return { text: `${n.toFixed(1)}%`, color: "#dc2626", arrow: "▼" };
}

function fmtDateShort(s: string): string {
  if (!s) return "";
  const [y, m, d] = s.split("-");
  return `${m}/${d}`;
}

// ─────────────────────────────────────────────
// 메인
// ─────────────────────────────────────────────

export default function DashboardPage() {
  // 기간/필터
  const [dateFrom, setDateFrom] = useState(firstOfMonth(0));
  const [dateTo, setDateTo] = useState(todayStr());
  const [storeId, setStoreId] = useState<string>("");
  const [preset, setPreset] = useState<string>("thisMonth");

  // 데이터
  const [stores, setStores] = useState<any[]>([]);
  const [overview, setOverview] = useState<any>(null);
  const [byStore, setByStore] = useState<any>(null);
  const [byStoreSort, setByStoreSort] = useState<"revenue" | "cars" | "valet">("revenue");
  const [byTenant, setByTenant] = useState<any>(null);
  const [byPayment, setByPayment] = useState<any>(null);
  const [trend, setTrend] = useState<any>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 사업장 드롭다운 1회 로드
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/v1/stores?limit=200", { credentials: "include" });
        if (res.ok) setStores((await res.json())?.data || []);
      } catch {}
    })();
  }, []);

  // 프리셋 적용
  const applyPreset = (p: string) => {
    setPreset(p);
    if (p === "thisMonth") {
      setDateFrom(firstOfMonth(0));
      setDateTo(todayStr());
    } else if (p === "lastMonth") {
      setDateFrom(firstOfMonth(-1));
      setDateTo(lastOfMonth(-1));
    } else if (p === "last7") {
      setDateFrom(daysAgo(6));
      setDateTo(todayStr());
    } else if (p === "last30") {
      setDateFrom(daysAgo(29));
      setDateTo(todayStr());
    }
    // custom: 아무것도 안함
  };

  // 필터 변경 감지 → 프리셋 해제
  const onDateChange = (setter: (s: string) => void, v: string) => {
    setter(v);
    setPreset("custom");
  };

  // 전체 로드
  const loadAll = useCallback(async () => {
    if (!dateFrom || !dateTo) return;
    if (dateFrom > dateTo) {
      setError("시작일이 종료일보다 늦습니다");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const base = new URLSearchParams();
      base.set("date_from", dateFrom);
      base.set("date_to", dateTo);
      if (storeId) base.set("store_id", storeId);

      const byStoreParams = new URLSearchParams(base);
      byStoreParams.set("sort", byStoreSort);

      const fetchJson = async (url: string) => {
        const res = await fetch(url, { credentials: "include" });
        if (!res.ok) throw new Error(`${url} ${res.status}`);
        const json = await res.json();
        if (!json.success) throw new Error(json.error?.message || "API 오류");
        return json.data;
      };

      // 5개 병렬
      const [ov, bs, bt, bp, tr] = await Promise.all([
        fetchJson(`/api/v1/stats/overview?${base.toString()}`),
        fetchJson(`/api/v1/stats/by-store?${byStoreParams.toString()}`),
        fetchJson(`/api/v1/stats/by-tenant?status=active&sort=revenue`),
        fetchJson(`/api/v1/stats/by-payment-method?${base.toString()}`),
        fetchJson(`/api/v1/stats/daily-trend?${base.toString()}`),
      ]);

      setOverview(ov);
      setByStore(bs);
      setByTenant(bt);
      setByPayment(bp);
      setTrend(tr);
    } catch (e: any) {
      setError(e?.message || "불러오기 실패");
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, storeId, byStoreSort]);

  // 초기 + 필터 변경 시 로드
  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo, storeId]);

  // by-store 정렬만 바뀌면 해당 API만 재조회
  useEffect(() => {
    (async () => {
      if (!dateFrom || !dateTo) return;
      try {
        const p = new URLSearchParams();
        p.set("date_from", dateFrom);
        p.set("date_to", dateTo);
        if (storeId) p.set("store_id", storeId);
        p.set("sort", byStoreSort);
        const res = await fetch(`/api/v1/stats/by-store?${p.toString()}`, { credentials: "include" });
        if (res.ok) setByStore((await res.json())?.data || null);
      } catch {}
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [byStoreSort]);

  // 결제수단 도넛 차트 데이터 (0건 제외하고 표시 but 범례에는 포함)
  const pieData = useMemo(() => {
    if (!byPayment?.items) return [];
    return byPayment.items.filter((x: any) => x.amount > 0);
  }, [byPayment]);

  // 추이차트 데이터 가공
  const trendChartData = useMemo(() => {
    if (!trend?.series) return [];
    return trend.series.map((row: any) => ({
      ...row,
      dateLabel: fmtDateShort(row.date),
    }));
  }, [trend]);

  return (
    <div style={{ padding: 20, maxWidth: 1400, margin: "0 auto" }}>
      {/* ── 헤더 ── */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: NAVY, margin: 0 }}>대시보드</h1>
        <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>
          매출·차량·발렛·입주사 종합 통계 · {dateFrom} ~ {dateTo}
        </div>
      </div>

      {/* ── 필터 바 ── */}
      <div
        style={{
          background: "#fff",
          border: "1px solid #e2e8f0",
          borderRadius: 12,
          padding: 14,
          marginBottom: 16,
          display: "flex",
          flexWrap: "wrap",
          gap: 10,
          alignItems: "center",
        }}
      >
        {/* 프리셋 */}
        <div style={{ display: "flex", gap: 6 }}>
          {[
            { k: "thisMonth", label: "이번달" },
            { k: "lastMonth", label: "지난달" },
            { k: "last7", label: "최근 7일" },
            { k: "last30", label: "최근 30일" },
          ].map((p) => (
            <button
              key={p.k}
              onClick={() => applyPreset(p.k)}
              style={{
                padding: "6px 12px",
                background: preset === p.k ? NAVY : "#f1f5f9",
                color: preset === p.k ? "#fff" : "#334155",
                border: "none",
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div style={{ width: 1, height: 28, background: "#e2e8f0" }} />

        {/* 직접 입력 */}
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => onDateChange(setDateFrom, e.target.value)}
          style={inputDate}
        />
        <span style={{ color: "#94a3b8" }}>~</span>
        <input
          type="date"
          value={dateTo}
          onChange={(e) => onDateChange(setDateTo, e.target.value)}
          style={inputDate}
        />

        <div style={{ width: 1, height: 28, background: "#e2e8f0" }} />

        {/* 사업장 */}
        <select
          value={storeId}
          onChange={(e) => setStoreId(e.target.value)}
          style={{ ...inputDate, minWidth: 180 }}
        >
          <option value="">전체 사업장</option>
          {stores.map((s: any) => (
            <option key={s.id} value={s.id}>
              {s.name}
              {s.site_code ? ` (${s.site_code})` : ""}
            </option>
          ))}
        </select>

        <div style={{ flex: 1 }} />

        <button
          onClick={loadAll}
          disabled={loading}
          style={{
            padding: "8px 16px",
            background: GOLD,
            color: NAVY,
            border: "none",
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 700,
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? "불러오는 중…" : "🔄 새로고침"}
        </button>
      </div>

      {/* ── 에러 ── */}
      {error && (
        <div
          style={{
            background: "#fef2f2",
            border: "1px solid #fecaca",
            color: "#b91c1c",
            padding: 12,
            borderRadius: 8,
            marginBottom: 16,
            fontSize: 13,
          }}
        >
          ⚠️ {error}
        </div>
      )}

      {/* ── ① KPI 4카드 ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 12,
          marginBottom: 16,
        }}
      >
        <KpiCard
          title="총 매출"
          icon="💰"
          value={fmtKRW(overview?.current?.revenue)}
          change={overview?.change?.revenue}
          loading={loading && !overview}
        />
        <KpiCard
          title="총 차량"
          icon="🚗"
          value={`${fmtCount(overview?.current?.total_cars)}대`}
          change={overview?.change?.total_cars}
          loading={loading && !overview}
        />
        <KpiCard
          title="발렛 건수"
          icon="🅿️"
          value={`${fmtCount(overview?.current?.valet_count)}건`}
          change={overview?.change?.valet_count}
          loading={loading && !overview}
        />
        <KpiCard
          title="일보 수"
          icon="📋"
          value={`${fmtCount(overview?.current?.report_count)}건`}
          change={overview?.change?.report_count}
          loading={loading && !overview}
          sub={
            overview?.current?.active_monthly != null
              ? `활성 월주차 ${fmtCount(overview.current.active_monthly)}건`
              : undefined
          }
        />
      </div>

      {/* ── ② 일별 추이 차트 ── */}
      <Section title="일별 추이" subtitle={`${trend?.range?.days ?? 0}일`}>
        {trendChartData.length === 0 ? (
          <EmptyBox text={loading ? "불러오는 중…" : "데이터가 없습니다"} />
        ) : (
          <div style={{ width: "100%", height: 300 }}>
            <ResponsiveContainer>
              <ComposedChart data={trendChartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={NAVY} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={NAVY} stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="dateLabel"
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  interval="preserveStartEnd"
                  minTickGap={20}
                />
                <YAxis
                  yAxisId="left"
                  tickFormatter={(v) => (v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : `${v}`)}
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  width={55}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  width={40}
                />
                <Tooltip
                  contentStyle={{ fontSize: 12, border: "1px solid #e2e8f0", borderRadius: 8 }}
                  formatter={(value: any, name: any) => {
                    if (name === "매출") return [fmtKRW(value), name];
                    return [fmtCount(value), name];
                  }}
                  labelFormatter={(label: any, payload: any) => {
                    const row = payload?.[0]?.payload;
                    if (!row) return label;
                    return `${row.date} (${row.weekday})${row.is_weekend ? " · 주말" : ""}`;
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="revenue"
                  name="매출"
                  stroke={NAVY}
                  strokeWidth={2}
                  fill="url(#revGrad)"
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="total_cars"
                  name="차량"
                  stroke={GOLD}
                  strokeWidth={2}
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </Section>

      {/* ── ③④ 2컬럼 (결제수단 + 사업장별) ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(280px, 1fr) minmax(400px, 1.6fr)",
          gap: 12,
          marginBottom: 16,
        }}
      >
        {/* 결제수단 도넛 */}
        <Section title="결제수단" subtitle={`${fmtCount(byPayment?.totals?.count)}건 · ${fmtKRW(byPayment?.totals?.amount)}`}>
          {!byPayment || pieData.length === 0 ? (
            <EmptyBox text={loading ? "불러오는 중…" : "결제 내역 없음"} />
          ) : (
            <>
              <div style={{ width: "100%", height: 220 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="amount"
                      nameKey="label"
                      innerRadius={50}
                      outerRadius={85}
                      paddingAngle={2}
                    >
                      {pieData.map((entry: any, idx: number) => (
                        <Cell key={idx} fill={entry.color || "#94a3b8"} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v: any, n: any, ctx: any) => {
                        const row = ctx?.payload;
                        return [`${fmtKRW(v)} (${row?.ratio?.toFixed(1) ?? 0}%)`, n];
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 8 }}>
                {byPayment.items.map((it: any) => (
                  <div
                    key={it.method}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "4px 2px",
                      fontSize: 13,
                      opacity: it.amount > 0 ? 1 : 0.45,
                    }}
                  >
                    <span style={{ width: 10, height: 10, background: it.color, borderRadius: 2, display: "inline-block" }} />
                    <span style={{ flex: 1 }}>
                      {it.emoji} {it.label}
                    </span>
                    <span style={{ fontFamily: "monospace", color: "#334155" }}>{fmtKRW(it.amount)}</span>
                    <span style={{ fontFamily: "monospace", color: "#64748b", minWidth: 48, textAlign: "right" }}>
                      {it.ratio?.toFixed(1) ?? 0}%
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </Section>

        {/* 사업장별 테이블 */}
        <Section
          title="사업장별"
          subtitle={`${byStore?.items?.length ?? 0}개 사업장`}
          right={
            <div style={{ display: "flex", gap: 4 }}>
              {[
                { k: "revenue", label: "매출순" },
                { k: "cars", label: "차량순" },
                { k: "valet", label: "발렛순" },
              ].map((s) => (
                <button
                  key={s.k}
                  onClick={() => setByStoreSort(s.k as any)}
                  style={{
                    padding: "4px 10px",
                    background: byStoreSort === s.k ? NAVY : "#f1f5f9",
                    color: byStoreSort === s.k ? "#fff" : "#334155",
                    border: "none",
                    borderRadius: 4,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          }
        >
          {!byStore || byStore.items?.length === 0 ? (
            <EmptyBox text={loading ? "불러오는 중…" : "사업장 데이터 없음"} />
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                    <th style={th}>사업장</th>
                    <th style={{ ...th, textAlign: "right" }}>매출</th>
                    <th style={{ ...th, textAlign: "right" }}>차량</th>
                    <th style={{ ...th, textAlign: "right" }}>발렛</th>
                    <th style={{ ...th, textAlign: "right" }}>일평균</th>
                  </tr>
                </thead>
                <tbody>
                  {byStore.items.map((r: any) => (
                    <tr key={r.store_id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={td}>
                        <div style={{ fontWeight: 600, color: "#0f172a" }}>{r.store_name}</div>
                        {r.site_code && (
                          <div style={{ fontSize: 11, color: "#64748b", fontFamily: "monospace" }}>{r.site_code}</div>
                        )}
                      </td>
                      <td style={{ ...td, textAlign: "right", fontFamily: "monospace", fontWeight: 700, color: NAVY }}>
                        {fmtKRW(r.revenue)}
                      </td>
                      <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{fmtCount(r.total_cars)}</td>
                      <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{fmtCount(r.valet_count)}</td>
                      <td style={{ ...td, textAlign: "right", fontFamily: "monospace", color: "#64748b" }}>
                        {fmtKRW(r.daily_avg_revenue)}
                      </td>
                    </tr>
                  ))}
                  {byStore.totals && (
                    <tr style={{ background: "#f8fafc", fontWeight: 700 }}>
                      <td style={{ ...td, color: NAVY }}>합계</td>
                      <td style={{ ...td, textAlign: "right", fontFamily: "monospace", color: NAVY }}>
                        {fmtKRW(byStore.totals.revenue)}
                      </td>
                      <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>
                        {fmtCount(byStore.totals.total_cars)}
                      </td>
                      <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>
                        {fmtCount(byStore.totals.valet_count)}
                      </td>
                      <td style={{ ...td }}></td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      </div>

      {/* ── ⑤ 입주사별 테이블 ── */}
      <Section
        title="입주사별 활성 월주차"
        subtitle={
          byTenant?.totals
            ? `${byTenant.totals.tenant_count}개사 · 활성 ${byTenant.totals.active_total}건 · 월 잠재 ${fmtKRW(
                byTenant.totals.monthly_revenue_total
              )}`
            : ""
        }
      >
        {!byTenant || byTenant.items?.length === 0 ? (
          <EmptyBox text={loading ? "불러오는 중…" : "입주사 데이터 없음"} />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                  <th style={th}>입주사</th>
                  <th style={{ ...th, textAlign: "center" }}>담당자</th>
                  <th style={{ ...th, textAlign: "right" }}>활성</th>
                  <th style={{ ...th, textAlign: "right" }}>만료</th>
                  <th style={{ ...th, textAlign: "right" }}>취소</th>
                  <th style={{ ...th, textAlign: "right" }}>월 잠재매출</th>
                </tr>
              </thead>
              <tbody>
                {byTenant.items.map((r: any) => (
                  <tr key={r.tenant_id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={td}>
                      <div style={{ fontWeight: 600, color: "#0f172a" }}>{r.tenant_name}</div>
                      {r.status !== "active" && (
                        <span
                          style={{
                            display: "inline-block",
                            marginTop: 2,
                            padding: "1px 6px",
                            background: "#fef3c7",
                            color: "#92400e",
                            fontSize: 10,
                            borderRadius: 3,
                            fontWeight: 600,
                          }}
                        >
                          {r.status}
                        </span>
                      )}
                    </td>
                    <td style={{ ...td, textAlign: "center", fontSize: 12, color: "#64748b" }}>
                      {r.contact_name || "-"}
                    </td>
                    <td style={{ ...td, textAlign: "right", fontFamily: "monospace", fontWeight: 700, color: "#16a34a" }}>
                      {r.active_count}
                    </td>
                    <td style={{ ...td, textAlign: "right", fontFamily: "monospace", color: "#64748b" }}>
                      {r.expired_count}
                    </td>
                    <td style={{ ...td, textAlign: "right", fontFamily: "monospace", color: "#94a3b8" }}>
                      {r.cancelled_count}
                    </td>
                    <td style={{ ...td, textAlign: "right", fontFamily: "monospace", fontWeight: 700, color: NAVY }}>
                      {fmtKRW(r.total_monthly_revenue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* PC↔모바일 반응형 (2컬럼 → 1컬럼) */}
      <style jsx>{`
        @media (max-width: 900px) {
          :global(div[style*="grid-template-columns: minmax(280px, 1fr) minmax(400px, 1.6fr)"]) {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}

// ─────────────────────────────────────────────
// 서브 컴포넌트
// ─────────────────────────────────────────────

function KpiCard({
  title,
  icon,
  value,
  change,
  sub,
  loading,
}: {
  title: string;
  icon: string;
  value: string;
  change?: number | null;
  sub?: string;
  loading?: boolean;
}) {
  const ch = fmtChange(change);
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e2e8f0",
        borderRadius: 12,
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 6,
        minHeight: 110,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 13, color: "#64748b", fontWeight: 600 }}>{title}</span>
        <span style={{ fontSize: 18 }}>{icon}</span>
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color: NAVY, fontFamily: "monospace", lineHeight: 1.2 }}>
        {loading ? "..." : value}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
        <span style={{ color: ch.color, fontWeight: 700 }}>
          {ch.arrow} {ch.text}
        </span>
        <span style={{ color: "#94a3b8" }}>직전 대비</span>
      </div>
      {sub && (
        <div style={{ fontSize: 11, color: GOLD, fontWeight: 700, marginTop: "auto" }}>{sub}</div>
      )}
    </div>
  );
}

function Section({
  title,
  subtitle,
  right,
  children,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e2e8f0",
        borderRadius: 12,
        padding: 16,
        marginBottom: 0,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", margin: 0 }}>{title}</h2>
          {subtitle && <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{subtitle}</div>}
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}

function EmptyBox({ text }: { text: string }) {
  return (
    <div
      style={{
        padding: "40px 12px",
        textAlign: "center",
        color: "#94a3b8",
        fontSize: 13,
        background: "#f8fafc",
        borderRadius: 8,
      }}
    >
      {text}
    </div>
  );
}

// ─────────────────────────────────────────────
// 스타일
// ─────────────────────────────────────────────

const inputDate: React.CSSProperties = {
  padding: "6px 10px",
  border: "1px solid #cbd5e1",
  borderRadius: 6,
  fontSize: 13,
  color: "#0f172a",
  background: "#fff",
};

const th: React.CSSProperties = {
  padding: "8px 10px",
  textAlign: "left",
  fontSize: 12,
  fontWeight: 700,
  color: "#475569",
};

const td: React.CSSProperties = {
  padding: "8px 10px",
  color: "#334155",
};
