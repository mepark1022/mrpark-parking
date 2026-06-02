// @ts-nocheck
"use client";

/**
 * 미팍 통합앱 v2 — 매출 분석 (P1-2 Part 2)
 *
 * 레거시 src/app/analytics/page.tsx(849줄)의 API-first 재구축.
 * Supabase 직접쿼리 전면 제거 → v2 stats API 5종 조합.
 *
 * 데이터 소스(전부 GET, credentials:include):
 *   - /api/v1/stats/overview            → KPI 4카드(전기간대비 %)
 *   - /api/v1/stats/daily-trend         → 매출 추이 AreaChart (서버 제약 최대 92일)
 *   - /api/v1/stats/hourly              → 시간대별 입차 BarChart (P1-2 Part1 신규, peak 강조)
 *   - /api/v1/stats/by-store            → 매장별 비교 Bar + 상세 테이블
 *   - /api/v1/stats/by-payment-method   → 결제수단 비중 도넛
 *   - /api/v1/stores?limit=200          → 사업장 필터
 *
 * 네임스페이스: v2an-*  / 권한: MANAGE(API가 처리) / 레이아웃: /v2/layout.tsx 자동
 * dashboard 차트·필터 패턴 그대로 응용.
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";

// ─────────────────────────────────────────────
// 유틸 (dashboard와 동일 헬퍼)
// ─────────────────────────────────────────────

const NAVY = "#1428A0";
const GOLD = "#F5B731";
const GREEN = "#10b981";
const DAILY_TREND_MAX_DAYS = 92; // daily-trend API 서버 제약

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
  d.setDate(0);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function firstOfYear(): string {
  return `${new Date().getFullYear()}-01-01`;
}
function diffDays(from: string, to: string): number {
  if (!from || !to) return 0;
  const f = new Date(from + "T00:00:00Z");
  const t = new Date(to + "T00:00:00Z");
  return Math.floor((t.getTime() - f.getTime()) / 86400000) + 1;
}
function fmtKRW(n: number | null | undefined): string {
  if (n == null || isNaN(n as number)) return "₩0";
  return `₩${Math.round(n as number).toLocaleString("ko-KR")}`;
}
function fmtKRWShort(n: number): string {
  if (n >= 100000000) return `${(n / 100000000).toFixed(1)}억`;
  if (n >= 10000) return `${Math.round(n / 10000).toLocaleString("ko-KR")}만`;
  return Math.round(n).toLocaleString("ko-KR");
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
  const [, m, d] = s.split("-");
  return `${m}/${d}`;
}
function fmtHour(h: number): string {
  return `${String(h).padStart(2, "0")}시`;
}

// ─────────────────────────────────────────────
// 메인
// ─────────────────────────────────────────────

export default function AnalyticsPage() {
  // 필터 상태
  const [dateFrom, setDateFrom] = useState(firstOfMonth(0));
  const [dateTo, setDateTo] = useState(todayStr());
  const [storeId, setStoreId] = useState<string>("");
  const [preset, setPreset] = useState<string>("thisMonth");

  // 데이터 상태
  const [stores, setStores] = useState<any[]>([]);
  const [overview, setOverview] = useState<any>(null);
  const [trend, setTrend] = useState<any>(null);
  const [trendError, setTrendError] = useState<string | null>(null);
  const [hourly, setHourly] = useState<any>(null);
  const [byStore, setByStore] = useState<any>(null);
  const [byPayment, setByPayment] = useState<any>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 사업장 목록 1회 로드
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/v1/stores?limit=200", { credentials: "include" });
        if (res.ok) setStores((await res.json())?.data || []);
      } catch {
        /* noop */
      }
    })();
  }, []);

  // 프리셋
  const applyPreset = (p: string) => {
    setPreset(p);
    if (p === "thisMonth") {
      setDateFrom(firstOfMonth(0));
      setDateTo(todayStr());
    } else if (p === "lastMonth") {
      setDateFrom(firstOfMonth(-1));
      setDateTo(lastOfMonth(-1));
    } else if (p === "last30") {
      setDateFrom(daysAgo(29));
      setDateTo(todayStr());
    } else if (p === "thisYear") {
      setDateFrom(firstOfYear());
      setDateTo(todayStr());
    }
  };
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
    setTrendError(null);

    const base = new URLSearchParams();
    base.set("date_from", dateFrom);
    base.set("date_to", dateTo);
    if (storeId) base.set("store_id", storeId);

    const fetchData = async (url: string) => {
      const res = await fetch(url, { credentials: "include" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        const msg = json?.error?.message || `요청 실패 (${res.status})`;
        const err: any = new Error(msg);
        err.status = res.status;
        throw err;
      }
      return json.data;
    };

    const span = diffDays(dateFrom, dateTo);

    try {
      // 매출 추이는 92일 제약 → 초과 시 호출 생략하고 안내
      const trendTask =
        span > DAILY_TREND_MAX_DAYS
          ? Promise.resolve(null)
          : fetchData(`/api/v1/stats/daily-trend?${base.toString()}`).catch((e) => {
              setTrendError(e.message);
              return null;
            });

      const [ov, hr, bs, pm, tr] = await Promise.all([
        fetchData(`/api/v1/stats/overview?${base.toString()}`),
        fetchData(`/api/v1/stats/hourly?${base.toString()}`),
        fetchData(`/api/v1/stats/by-store?${base.toString()}&sort=revenue`),
        fetchData(`/api/v1/stats/by-payment-method?${base.toString()}`),
        trendTask,
      ]);

      setOverview(ov);
      setHourly(hr);
      setByStore(bs);
      setByPayment(pm);
      setTrend(tr);
      if (span > DAILY_TREND_MAX_DAYS) {
        setTrendError(`매출 추이는 최대 ${DAILY_TREND_MAX_DAYS}일까지 표시됩니다. 더 짧은 기간을 선택하세요.`);
      }
    } catch (e: any) {
      setError(e.message || "통계를 불러오지 못했습니다");
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, storeId]);

  // 필터 변경 시 자동 로드
  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // ── 파생 차트 데이터 ──────────────────────────
  const trendChartData = useMemo(() => {
    if (!trend?.series) return [];
    return trend.series.map((s: any) => ({
      label: fmtDateShort(s.date),
      매출: s.revenue,
      입차: s.total_cars,
    }));
  }, [trend]);

  const hourlyChartData = useMemo(() => {
    if (!hourly?.hours) return [];
    return hourly.hours.map((h: any) => ({
      hour: h.hour,
      label: fmtHour(h.hour),
      입차: h.total_cars,
    }));
  }, [hourly]);

  const byStoreChartData = useMemo(() => {
    if (!byStore?.items) return [];
    return byStore.items.map((s: any) => ({
      name: s.store_name,
      매출: s.revenue,
      입차: s.total_cars,
    }));
  }, [byStore]);

  const paymentData = useMemo(() => {
    if (!byPayment?.items) return [];
    return byPayment.items.filter((i: any) => i.amount > 0);
  }, [byPayment]);

  const peakHour = hourly?.peak;

  // ── 렌더 ──────────────────────────────────────
  return (
    <div className="v2an-root">
      {/* 헤더 */}
      <div className="v2an-head">
        <h1>매출 분석</h1>
        <div className="v2an-sub">
          매출·시간대·매장별 심층 분석 · {dateFrom} ~ {dateTo}
          {storeId && stores.find((s) => s.id === storeId)
            ? ` · ${stores.find((s) => s.id === storeId).name}`
            : " · 전체 사업장"}
        </div>
      </div>

      {/* 필터 바 */}
      <div className="v2an-filter">
        <div className="v2an-presets">
          {[
            { k: "thisMonth", label: "이번달" },
            { k: "lastMonth", label: "지난달" },
            { k: "last30", label: "최근 30일" },
            { k: "thisYear", label: "올해" },
          ].map((p) => (
            <button
              key={p.k}
              onClick={() => applyPreset(p.k)}
              className={`v2an-preset ${preset === p.k ? "on" : ""}`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="v2an-divider" />
        <input type="date" value={dateFrom} onChange={(e) => onDateChange(setDateFrom, e.target.value)} className="v2an-date" />
        <span className="v2an-tilde">~</span>
        <input type="date" value={dateTo} onChange={(e) => onDateChange(setDateTo, e.target.value)} className="v2an-date" />
        <div className="v2an-divider" />
        <select value={storeId} onChange={(e) => setStoreId(e.target.value)} className="v2an-date v2an-store">
          <option value="">전체 사업장</option>
          {stores.map((s: any) => (
            <option key={s.id} value={s.id}>
              {s.name}
              {s.site_code ? ` (${s.site_code})` : ""}
            </option>
          ))}
        </select>
        <div className="v2an-spacer" />
        <button onClick={loadAll} disabled={loading} className="v2an-refresh">
          {loading ? "불러오는 중…" : "새로고침"}
        </button>
      </div>

      {error && <div className="v2an-error">{error}</div>}

      {/* KPI 4카드 */}
      <div className="v2an-kpis">
        {[
          { label: "총 매출", value: fmtKRW(overview?.current?.revenue), change: overview?.change?.revenue },
          { label: "총 입차", value: fmtCount(overview?.current?.total_cars), change: overview?.change?.total_cars },
          { label: "발렛 건수", value: fmtCount(overview?.current?.valet_count), change: overview?.change?.valet_count },
          { label: "일보 건수", value: fmtCount(overview?.current?.report_count), change: overview?.change?.report_count },
        ].map((k, i) => {
          const ch = fmtChange(k.change);
          return (
            <div key={i} className="v2an-kpi">
              <div className="v2an-kpi-label">{k.label}</div>
              <div className="v2an-kpi-value">{k.value}</div>
              <div className="v2an-kpi-change" style={{ color: ch.color }}>
                {ch.arrow} {ch.text} <span className="v2an-kpi-vs">vs 전기간</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* 매출 추이 */}
      <div className="v2an-card">
        <div className="v2an-card-title">📈 매출 추이</div>
        {trendError ? (
          <div className="v2an-empty">{trendError}</div>
        ) : trendChartData.length === 0 ? (
          <div className="v2an-empty">{loading ? "불러오는 중…" : "데이터가 없습니다"}</div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={trendChartData} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="v2anRev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={NAVY} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={NAVY} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#8b919d" }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(v) => fmtKRWShort(v)} tick={{ fontSize: 11, fill: "#8b919d" }} axisLine={false} tickLine={false} width={48} />
              <Tooltip formatter={(v: any, n: any) => (n === "매출" ? fmtKRW(v) : fmtCount(v))} />
              <Area type="monotone" dataKey="매출" stroke={NAVY} strokeWidth={2} fill="url(#v2anRev)" dot={false} activeDot={{ r: 5, fill: NAVY }} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* 시간대별 입차 (Part1 hourly 신규) */}
      <div className="v2an-card">
        <div className="v2an-card-title">
          ⏰ 시간대별 입차
          {peakHour && (
            <span className="v2an-peak">피크 {fmtHour(peakHour.hour)} · {fmtCount(peakHour.total_cars)}대</span>
          )}
        </div>
        {hourly?.truncated && (
          <div className="v2an-warn">⚠️ 데이터가 많아 일부만 집계됐습니다. 기간을 좁혀주세요.</div>
        )}
        {hourlyChartData.length === 0 ? (
          <div className="v2an-empty">{loading ? "불러오는 중…" : "데이터가 없습니다"}</div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={hourlyChartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="hour" tickFormatter={(h) => String(h)} interval={1} tick={{ fontSize: 10, fill: "#8b919d" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#8b919d" }} axisLine={false} tickLine={false} width={32} />
              <Tooltip formatter={(v: any) => [`${fmtCount(v)}대`, "입차"]} labelFormatter={(h) => fmtHour(Number(h))} />
              <Bar dataKey="입차" radius={[4, 4, 0, 0]}>
                {hourlyChartData.map((h: any) => (
                  <Cell key={h.hour} fill={peakHour && h.hour === peakHour.hour ? GOLD : NAVY} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* 매장별 매출 비교 + 결제수단 비중 (2단) */}
      <div className="v2an-grid2">
        <div className="v2an-card">
          <div className="v2an-card-title">🏢 매장별 매출 비교</div>
          {byStoreChartData.length === 0 ? (
            <div className="v2an-empty">{loading ? "불러오는 중…" : "데이터가 없습니다"}</div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={byStoreChartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#8b919d" }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v) => fmtKRWShort(v)} tick={{ fontSize: 11, fill: "#8b919d" }} axisLine={false} tickLine={false} width={48} />
                <Tooltip formatter={(v: any) => fmtKRW(v)} />
                <Bar dataKey="매출" fill={NAVY} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="v2an-card">
          <div className="v2an-card-title">💳 결제수단 비중</div>
          {paymentData.length === 0 ? (
            <div className="v2an-empty">{loading ? "불러오는 중…" : "데이터가 없습니다"}</div>
          ) : (
            <div className="v2an-pie-wrap">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={paymentData} cx="50%" cy="50%" innerRadius={50} outerRadius={78} paddingAngle={3} dataKey="amount" nameKey="label">
                    {paymentData.map((p: any, i: number) => (
                      <Cell key={i} fill={p.color || [NAVY, GOLD, GREEN, "#8b5cf6", "#ef4444"][i % 5]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: any) => fmtKRW(v)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="v2an-pie-legend">
                {paymentData.map((p: any, i: number) => (
                  <div key={i} className="v2an-pie-row">
                    <span className="v2an-dot" style={{ background: p.color || [NAVY, GOLD, GREEN, "#8b5cf6", "#ef4444"][i % 5] }} />
                    <span className="v2an-pie-label">{p.emoji ? `${p.emoji} ` : ""}{p.label}</span>
                    <span className="v2an-pie-ratio">{p.ratio}%</span>
                    <span className="v2an-pie-amt">{fmtKRW(p.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 매장별 상세 실적 테이블 */}
      <div className="v2an-card">
        <div className="v2an-card-title">매장별 상세 실적</div>
        <div className="v2an-table-wrap">
          <table className="v2an-table">
            <thead>
              <tr>
                <th style={{ textAlign: "left" }}>매장</th>
                <th>매출</th>
                <th>입차</th>
                <th>발렛</th>
                <th>일보</th>
                <th>일평균 매출</th>
              </tr>
            </thead>
            <tbody>
              {byStore?.items?.length ? (
                byStore.items.map((s: any) => (
                  <tr key={s.store_id}>
                    <td style={{ textAlign: "left" }}>
                      {s.store_name}
                      {s.site_code ? <span className="v2an-code"> {s.site_code}</span> : null}
                    </td>
                    <td className="v2an-num strong">{fmtKRW(s.revenue)}</td>
                    <td className="v2an-num">{fmtCount(s.total_cars)}</td>
                    <td className="v2an-num">{fmtCount(s.valet_count)}</td>
                    <td className="v2an-num">{fmtCount(s.report_count)}</td>
                    <td className="v2an-num">{fmtKRW(s.daily_avg_revenue)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="v2an-empty" style={{ padding: 24 }}>
                    {loading ? "불러오는 중…" : "데이터가 없습니다"}
                  </td>
                </tr>
              )}
              {byStore?.totals && byStore?.items?.length ? (
                <tr className="v2an-total-row">
                  <td style={{ textAlign: "left" }}>합계</td>
                  <td className="v2an-num strong">{fmtKRW(byStore.totals.revenue)}</td>
                  <td className="v2an-num">{fmtCount(byStore.totals.total_cars)}</td>
                  <td className="v2an-num">{fmtCount(byStore.totals.valet_count)}</td>
                  <td className="v2an-num">{fmtCount(byStore.totals.report_count)}</td>
                  <td className="v2an-num">—</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <style jsx>{`
        .v2an-root {
          padding: 20px;
          max-width: 1400px;
          margin: 0 auto;
        }
        .v2an-head {
          margin-bottom: 20px;
        }
        .v2an-head h1 {
          font-size: 24px;
          font-weight: 800;
          color: ${NAVY};
          margin: 0;
          font-family: "Outfit", system-ui, sans-serif;
        }
        .v2an-sub {
          font-size: 13px;
          color: #64748b;
          margin-top: 4px;
        }
        .v2an-filter {
          background: #fff;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 14px;
          margin-bottom: 16px;
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          align-items: center;
        }
        .v2an-presets {
          display: flex;
          gap: 6px;
        }
        .v2an-preset {
          padding: 6px 12px;
          background: #f1f5f9;
          color: #334155;
          border: none;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
        }
        .v2an-preset.on {
          background: ${NAVY};
          color: #fff;
        }
        .v2an-divider {
          width: 1px;
          height: 28px;
          background: #e2e8f0;
        }
        .v2an-date {
          padding: 6px 10px;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          font-size: 13px;
          color: #0f172a;
          background: #fff;
        }
        .v2an-store {
          min-width: 180px;
        }
        .v2an-tilde {
          color: #94a3b8;
        }
        .v2an-spacer {
          flex: 1;
        }
        .v2an-refresh {
          padding: 8px 16px;
          background: ${GOLD};
          color: ${NAVY};
          border: none;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
        }
        .v2an-refresh:disabled {
          opacity: 0.6;
          cursor: default;
        }
        .v2an-error {
          background: #fef2f2;
          border: 1px solid #fecaca;
          color: #b91c1c;
          padding: 10px 14px;
          border-radius: 8px;
          font-size: 13px;
          margin-bottom: 16px;
        }
        .v2an-warn {
          background: #fffbeb;
          border: 1px solid #fde68a;
          color: #92400e;
          padding: 8px 12px;
          border-radius: 8px;
          font-size: 12px;
          margin-bottom: 10px;
        }
        .v2an-kpis {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
          margin-bottom: 16px;
        }
        .v2an-kpi {
          background: #fff;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 16px;
        }
        .v2an-kpi-label {
          font-size: 12px;
          color: #64748b;
          font-weight: 600;
        }
        .v2an-kpi-value {
          font-size: 22px;
          font-weight: 800;
          color: ${NAVY};
          margin: 6px 0 4px;
          font-family: "Outfit", system-ui, sans-serif;
        }
        .v2an-kpi-change {
          font-size: 12px;
          font-weight: 700;
        }
        .v2an-kpi-vs {
          color: #94a3b8;
          font-weight: 500;
          margin-left: 2px;
        }
        .v2an-card {
          background: #fff;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 16px;
        }
        .v2an-card-title {
          font-size: 14px;
          font-weight: 800;
          color: #1a1d2b;
          margin-bottom: 12px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .v2an-peak {
          font-size: 11px;
          font-weight: 700;
          color: ${NAVY};
          background: #eef1fb;
          padding: 3px 8px;
          border-radius: 999px;
        }
        .v2an-empty {
          text-align: center;
          color: #94a3b8;
          font-size: 13px;
          padding: 40px 0;
        }
        .v2an-grid2 {
          display: grid;
          grid-template-columns: 1.4fr 1fr;
          gap: 16px;
        }
        .v2an-pie-wrap {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .v2an-pie-legend {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .v2an-pie-row {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
        }
        .v2an-dot {
          width: 10px;
          height: 10px;
          border-radius: 3px;
          flex-shrink: 0;
        }
        .v2an-pie-label {
          color: #334155;
          font-weight: 600;
        }
        .v2an-pie-ratio {
          color: #64748b;
          margin-left: auto;
          font-weight: 700;
        }
        .v2an-pie-amt {
          color: #0f172a;
          font-weight: 700;
          min-width: 90px;
          text-align: right;
          font-family: "Outfit", system-ui, sans-serif;
        }
        .v2an-table-wrap {
          overflow-x: auto;
        }
        .v2an-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }
        .v2an-table th {
          padding: 8px 10px;
          text-align: right;
          font-size: 12px;
          color: #64748b;
          font-weight: 700;
          border-bottom: 2px solid #e2e8f0;
          white-space: nowrap;
        }
        .v2an-table td {
          padding: 10px;
          text-align: right;
          border-bottom: 1px solid #f1f5f9;
          color: #334155;
          white-space: nowrap;
        }
        .v2an-num {
          font-family: "Outfit", system-ui, sans-serif;
        }
        .v2an-num.strong {
          font-weight: 700;
          color: ${NAVY};
        }
        .v2an-code {
          color: #94a3b8;
          font-size: 11px;
        }
        .v2an-total-row td {
          font-weight: 800;
          color: #0f172a;
          border-top: 2px solid #e2e8f0;
          background: #f8fafc;
        }
        @media (max-width: 768px) {
          .v2an-root {
            padding: 14px;
          }
          .v2an-kpis {
            grid-template-columns: repeat(2, 1fr);
          }
          .v2an-grid2 {
            grid-template-columns: 1fr;
          }
          .v2an-pie-amt {
            min-width: 72px;
          }
        }
      `}</style>
    </div>
  );
}
