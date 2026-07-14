import { useState, useEffect, useCallback } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine,
  ResponsiveContainer, CartesianGrid,
} from "recharts";

// ─── 브랜드 컬러 (미팍 2.0) ───
const NAVY = "#1428A0";
const GOLD = "#F5B731";
const STORAGE_KEY = "diet-tracker-data"; // 단일 키 저장

// ─── 안전한 저장소 래퍼 ───
// localStorage 를 우선 사용하되, 접근이 막힌 환경(아티팩트 샌드박스,
// 사파리 프라이빗 모드 등)에서는 메모리에 담아 세션 내에서는 동작하게 한다.
const memoryStore = {};
const safeStorage = {
  get(key) {
    try {
      const v = localStorage.getItem(key);
      if (v != null) return v;
    } catch {
      /* localStorage 접근 불가 → 메모리 폴백 */
    }
    return key in memoryStore ? memoryStore[key] : null;
  },
  set(key, val) {
    memoryStore[key] = val; // 항상 메모리에 보관
    try {
      localStorage.setItem(key, val);
    } catch {
      /* 저장소가 막혀도 메모리에는 남으므로 UI 는 정상 반영 */
    }
    return true;
  },
};

// 날짜 포맷 YYYY-MM-DD (로컬 기준)
const fmtDate = (d) => {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
};
const todayStr = () => fmtDate(new Date());

const emptyForm = (date) => ({
  date: date || todayStr(),
  weight: "", breakfast: "", lunch: "", dinner: "", snack: "", exercise: "", memo: "",
});

// ─── 날짜 유틸 ───
const WEEK = ["일", "월", "화", "수", "목", "금", "토"];
const parseYMD = (s) => {
  const [y, m, d] = s.split("-").map(Number);
  return { y, m: m - 1, d };
};
// 폼에 표시할 한글 날짜 (예: 2026. 7. 15 (수))
const fmtDateKorean = (s) => {
  if (!s) return "";
  const { y, m, d } = parseYMD(s);
  const wd = WEEK[new Date(y, m, d).getDay()];
  return `${y}. ${m + 1}. ${d} (${wd})`;
};

// ─── 커스텀 달력 (미팍 테마) ───
function Calendar({ value, onSelect, onClose }) {
  const init = value ? parseYMD(value) : parseYMD(todayStr());
  const [view, setView] = useState({ y: init.y, m: init.m }); // m: 0~11
  const selected = value;
  const today = todayStr();

  const firstDow = new Date(view.y, view.m, 1).getDay();
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const shiftMonth = (delta) =>
    setView((v) => {
      const total = v.y * 12 + v.m + delta;
      return { y: Math.floor(total / 12), m: ((total % 12) + 12) % 12 };
    });

  const toYMD = (d) =>
    `${view.y}-${String(view.m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const pick = (d) => {
    onSelect(toYMD(d));
    onClose();
  };

  const headLabel = selected ? fmtDateKorean(selected) : "날짜를 선택하세요";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-6"
      onClick={onClose}>
      <div className="w-full max-w-xs bg-white rounded-3xl overflow-hidden shadow-xl"
        onClick={(e) => e.stopPropagation()}>
        {/* 헤더 (네이비) */}
        <div style={{ backgroundColor: NAVY }} className="px-5 py-4">
          <p className="text-white text-xs opacity-70">날짜 선택</p>
          <p className="text-white text-xl font-bold mt-0.5">{headLabel}</p>
        </div>

        {/* 월 이동 */}
        <div className="flex items-center justify-between px-5 pt-4">
          <button type="button" onClick={() => shiftMonth(-1)}
            className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 text-lg">
            ‹
          </button>
          <p className="text-sm font-bold" style={{ color: NAVY }}>
            {view.y}년 {view.m + 1}월
          </p>
          <button type="button" onClick={() => shiftMonth(1)}
            className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 text-lg">
            ›
          </button>
        </div>

        {/* 요일 */}
        <div className="grid grid-cols-7 gap-1 px-4 mt-3">
          {WEEK.map((w, i) => (
            <div key={w} className="text-center text-xs font-semibold py-1"
              style={{ color: i === 0 ? "#DC2626" : i === 6 ? "#2563EB" : "#9ca3af" }}>
              {w}
            </div>
          ))}
        </div>

        {/* 날짜 그리드 */}
        <div className="grid grid-cols-7 gap-1 px-4 pb-3">
          {cells.map((d, i) => {
            if (d == null) return <div key={i} />;
            const ymd = toYMD(d);
            const isSel = ymd === selected;
            const isToday = ymd === today;
            const dow = i % 7;
            return (
              <button key={i} type="button" onClick={() => pick(d)}
                className="aspect-square rounded-full text-sm font-medium flex items-center justify-center transition-colors hover:bg-gray-100"
                style={isSel
                  ? { backgroundColor: NAVY, color: "#fff" }
                  : { color: dow === 0 ? "#DC2626" : dow === 6 ? "#2563EB" : "#374151" }}>
                <span className="relative flex items-center justify-center">
                  {d}
                  {isToday && !isSel && (
                    <span className="absolute -bottom-1.5 w-1 h-1 rounded-full"
                      style={{ backgroundColor: GOLD }} />
                  )}
                </span>
              </button>
            );
          })}
        </div>

        {/* 푸터 */}
        <div className="flex border-t border-gray-100">
          <button type="button"
            onClick={() => { onSelect(today); onClose(); }}
            className="flex-1 py-3 text-sm font-bold" style={{ color: GOLD }}>
            오늘
          </button>
          <button type="button" onClick={onClose}
            className="flex-1 py-3 text-sm font-semibold text-gray-500 border-l border-gray-100">
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DietTracker() {
  const [entries, setEntries] = useState([]);
  const [goalWeight, setGoalWeight] = useState(null);
  const [goalInput, setGoalInput] = useState("");
  const [form, setForm] = useState(emptyForm());
  const [tab, setTab] = useState("today"); // today | chart | list
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null); // {msg, ok}
  const [showCal, setShowCal] = useState(false); // 커스텀 달력 표시

  // ─── 토스트 ───
  const showToast = (msg, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 2200);
  };

  // ─── 최초 로드 ───
  useEffect(() => {
    try {
      const raw = safeStorage.get(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        setEntries(Array.isArray(data.entries) ? data.entries : []);
        if (data.goalWeight != null) {
          setGoalWeight(data.goalWeight);
          setGoalInput(String(data.goalWeight));
        }
      }
    } catch (e) {
      // 키 없음 = 첫 사용 (정상 흐름)
    } finally {
      setLoading(false);
    }
  }, []);

  // ─── 저장 (단일 키) ───
  const persist = useCallback((nextEntries, nextGoal) => {
    return safeStorage.set(
      STORAGE_KEY,
      JSON.stringify({ entries: nextEntries, goalWeight: nextGoal })
    );
  }, []);

  // ─── 기록 저장 (같은 날짜 덮어쓰기) ───
  const saveEntry = () => {
    if (!form.date) return showToast("날짜를 입력해주세요.", false);
    const w = parseFloat(form.weight);
    if (isNaN(w) || w <= 0) return showToast("체중을 올바르게 입력해주세요.", false);
    const next = [...entries.filter((e) => e.date !== form.date), { ...form, weight: w }]
      .sort((a, b) => a.date.localeCompare(b.date));
    const overwritten = entries.some((e) => e.date === form.date);
    if (persist(next, goalWeight)) {
      setEntries(next);
      showToast(overwritten ? "기록을 덮어썼습니다 ✓" : "기록이 저장되었습니다 ✓");
      setForm(emptyForm());
    }
  };

  // ─── 목표 체중 저장 ───
  const saveGoal = () => {
    const g = parseFloat(goalInput);
    if (isNaN(g) || g <= 0) return showToast("목표 체중을 올바르게 입력해주세요.", false);
    if (persist(entries, g)) {
      setGoalWeight(g);
      showToast("목표 체중이 설정되었습니다 ✓");
    }
  };

  // ─── 삭제 ───
  const deleteEntry = (date) => {
    const next = entries.filter((e) => e.date !== date);
    if (persist(next, goalWeight)) {
      setEntries(next);
      showToast("기록이 삭제되었습니다 ✓");
    }
  };

  // ─── 수정: 폼에 불러오기 ───
  const editEntry = (e) => {
    setForm({ ...emptyForm(e.date), ...e, weight: String(e.weight) });
    setTab("today");
  };

  // ─── KPI 계산 ───
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const latest = sorted[sorted.length - 1] || null;
  const currentWeight = latest ? latest.weight : null;
  const remainKg =
    currentWeight != null && goalWeight != null ? currentWeight - goalWeight : null;

  // 7일 변화: 최신 기록 기준 7일 이상 이전 기록과 비교
  let change7 = null;
  if (latest) {
    const base = new Date(latest.date + "T00:00:00");
    base.setDate(base.getDate() - 7);
    const past = [...sorted].reverse().find((e) => e.date <= fmtDate(base));
    if (past) change7 = latest.weight - past.weight;
  }

  // 연속 기록일: 오늘(없으면 어제)부터 거꾸로 카운트
  const dateSet = new Set(entries.map((e) => e.date));
  let streak = 0;
  {
    const cursor = new Date();
    if (!dateSet.has(fmtDate(cursor))) cursor.setDate(cursor.getDate() - 1);
    while (dateSet.has(fmtDate(cursor))) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
  }

  // ─── 차트 데이터 ───
  const chartData = sorted.map((e) => ({
    date: e.date.slice(5).replace("-", "."),
    체중: e.weight,
  }));
  const weights = sorted.map((e) => e.weight).concat(goalWeight != null ? [goalWeight] : []);
  const yMin = weights.length ? Math.floor(Math.min(...weights) - 1) : 0;
  const yMax = weights.length ? Math.ceil(Math.max(...weights) + 1) : 100;
  const fmtDelta = (v) => (v == null ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(1)}kg`);

  const inputCls =
    "w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 bg-white";

  const kpis = [
    { label: "현재 체중", value: currentWeight != null ? `${currentWeight.toFixed(1)}kg` : "—" },
    { label: "목표까지", value: remainKg != null ? `${remainKg.toFixed(1)}kg` : "—", gold: remainKg != null && remainKg <= 0 },
    { label: "7일 변화", value: fmtDelta(change7), gold: change7 != null && change7 < 0 },
    { label: "연속 기록", value: `${streak}일`, gold: streak >= 7 },
  ];

  const tabs = [
    { id: "today", label: "오늘 기록" },
    { id: "chart", label: "체중 추이" },
    { id: "list", label: "전체 기록" },
  ];

  const mealFields = [
    { key: "breakfast", label: "아침", ph: "예: 그릭요거트, 사과 반 개" },
    { key: "lunch", label: "점심", ph: "예: 닭가슴살 샐러드" },
    { key: "dinner", label: "저녁", ph: "예: 현미밥, 된장국" },
    { key: "snack", label: "간식", ph: "예: 아몬드 한 줌" },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center text-gray-400 text-sm">
        데이터 불러오는 중…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 (네이비) */}
      <header style={{ backgroundColor: NAVY }} className="px-4 pt-6 pb-16">
        <div className="max-w-xl mx-auto">
          <div className="flex items-center gap-2">
            <span style={{ backgroundColor: GOLD, color: NAVY }} className="text-xs font-bold px-2 py-0.5 rounded-full">
              DIET
            </span>
            <h1 className="text-white text-lg font-bold">다이어트 일지</h1>
          </div>
          <p className="text-white text-xs mt-1 opacity-70">매일 기록하고 목표까지 함께 가요</p>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-4 -mt-10 pb-24">
        {/* KPI 카드 4개 */}
        <div className="grid grid-cols-2 gap-3">
          {kpis.map((k) => (
            <div key={k.label} className="bg-white rounded-2xl shadow-sm p-4">
              <p className="text-xs text-gray-500">{k.label}</p>
              <p className="text-xl font-bold mt-1" style={{ color: k.gold ? GOLD : NAVY }}>
                {k.value}
              </p>
            </div>
          ))}
        </div>

        {/* 탭 */}
        <div className="flex bg-white rounded-2xl shadow-sm p-1 mt-4">
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className="flex-1 py-2.5 text-sm font-semibold rounded-xl transition-colors"
              style={tab === t.id ? { backgroundColor: NAVY, color: "#fff" } : { color: "#6b7280" }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ① 오늘 기록 */}
        {tab === "today" && (
          <div className="mt-4 space-y-4">
            <div className="bg-white rounded-2xl shadow-sm p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-600">날짜</label>
                  <button type="button" onClick={() => setShowCal(true)}
                    className={inputCls + " mt-1 text-left flex items-center justify-between"}>
                    <span className={form.date ? "" : "text-gray-400"}>
                      {form.date ? fmtDateKorean(form.date) : "날짜 선택"}
                    </span>
                    <span style={{ color: NAVY }}>📅</span>
                  </button>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600">체중 (kg)</label>
                  <input type="number" step="0.1" inputMode="decimal" placeholder="예: 68.5"
                    className={inputCls + " mt-1"} value={form.weight}
                    onChange={(e) => setForm({ ...form, weight: e.target.value })} />
                </div>
              </div>

              {/* 먹은 거 기록 */}
              <div>
                <p className="text-xs font-semibold text-gray-600 mb-2">🍽 먹은 거 기록</p>
                <div className="space-y-2">
                  {mealFields.map((m) => (
                    <div key={m.key} className="flex items-center gap-2">
                      <span className="text-xs font-bold w-10 text-center py-1 rounded-lg shrink-0"
                        style={{ backgroundColor: "#EEF1FB", color: NAVY }}>
                        {m.label}
                      </span>
                      <input className={inputCls} placeholder={m.ph} value={form[m.key]}
                        onChange={(e) => setForm({ ...form, [m.key]: e.target.value })} />
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-600">🏃 운동</label>
                <input className={inputCls + " mt-1"} placeholder="예: 걷기 40분, 스쿼트 3세트"
                  value={form.exercise}
                  onChange={(e) => setForm({ ...form, exercise: e.target.value })} />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-600">📝 메모</label>
                <textarea rows={2} className={inputCls + " mt-1 resize-none"}
                  placeholder="오늘의 컨디션, 느낀 점 등" value={form.memo}
                  onChange={(e) => setForm({ ...form, memo: e.target.value })} />
              </div>

              <button onClick={saveEntry}
                className="w-full py-3 rounded-xl text-sm font-bold text-white active:opacity-80"
                style={{ backgroundColor: NAVY }}>
                기록 저장
              </button>
              <p className="text-xs text-gray-400 text-center">
                같은 날짜에 저장하면 기존 기록을 덮어씁니다
              </p>
            </div>

            {/* 목표 체중 설정 */}
            <div className="bg-white rounded-2xl shadow-sm p-5">
              <p className="text-sm font-bold" style={{ color: NAVY }}>🎯 목표 체중 설정</p>
              <div className="flex gap-2 mt-3">
                <input type="number" step="0.1" inputMode="decimal" placeholder="목표 체중 (kg)"
                  className={inputCls} value={goalInput}
                  onChange={(e) => setGoalInput(e.target.value)} />
                <button onClick={saveGoal} className="px-4 rounded-xl text-sm font-bold shrink-0"
                  style={{ backgroundColor: GOLD, color: NAVY }}>
                  설정
                </button>
              </div>
              {goalWeight != null && (
                <p className="text-xs text-gray-500 mt-2">
                  현재 목표: <b style={{ color: NAVY }}>{goalWeight.toFixed(1)}kg</b>
                </p>
              )}
            </div>
          </div>
        )}

        {/* ② 체중 추이 */}
        {tab === "chart" && (
          <div className="bg-white rounded-2xl shadow-sm p-5 mt-4">
            <p className="text-sm font-bold mb-4" style={{ color: NAVY }}>📈 체중 추이</p>
            {chartData.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-12">
                아직 기록이 없습니다. 첫 기록을 남겨보세요!
              </p>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis domain={[yMin, yMax]} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v) => [`${v}kg`, "체중"]} />
                    {goalWeight != null && (
                      <ReferenceLine y={goalWeight} stroke={GOLD} strokeDasharray="6 4" strokeWidth={2}
                        label={{ value: `목표 ${goalWeight}kg`, fill: GOLD, fontSize: 11, position: "insideTopRight" }} />
                    )}
                    <Line type="monotone" dataKey="체중" stroke={NAVY} strokeWidth={2.5}
                      dot={{ r: 3, fill: NAVY }} activeDot={{ r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}

        {/* ③ 전체 기록 */}
        {tab === "list" && (
          <div className="mt-4 space-y-3">
            {sorted.length === 0 && (
              <div className="bg-white rounded-2xl shadow-sm p-8 text-center text-sm text-gray-400">
                아직 기록이 없습니다.
              </div>
            )}
            {[...sorted].reverse().map((e) => (
              <div key={e.date} className="bg-white rounded-2xl shadow-sm p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold" style={{ color: NAVY }}>{e.date}</span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: "#EEF1FB", color: NAVY }}>
                      {e.weight.toFixed(1)}kg
                    </span>
                  </div>
                  <div className="flex gap-1.5">
                    <button onClick={() => editEntry(e)}
                      className="text-xs font-semibold px-2.5 py-1 rounded-lg"
                      style={{ backgroundColor: "#EEF1FB", color: NAVY }}>
                      수정
                    </button>
                    <button onClick={() => deleteEntry(e.date)}
                      className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-red-50 text-red-500">
                      삭제
                    </button>
                  </div>
                </div>
                {(e.breakfast || e.lunch || e.dinner || e.snack) && (
                  <div className="mt-2 text-xs text-gray-600 space-y-0.5">
                    {e.breakfast && <p>🌅 아침 — {e.breakfast}</p>}
                    {e.lunch && <p>☀️ 점심 — {e.lunch}</p>}
                    {e.dinner && <p>🌙 저녁 — {e.dinner}</p>}
                    {e.snack && <p>🍪 간식 — {e.snack}</p>}
                  </div>
                )}
                {e.exercise && <p className="mt-1.5 text-xs text-gray-600">🏃 {e.exercise}</p>}
                {e.memo && <p className="mt-1.5 text-xs text-gray-400 italic">"{e.memo}"</p>}
              </div>
            ))}
          </div>
        )}
      </main>

      {/* 커스텀 달력 */}
      {showCal && (
        <Calendar
          value={form.date}
          onSelect={(d) => setForm({ ...form, date: d })}
          onClose={() => setShowCal(false)}
        />
      )}

      {/* 토스트 */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white shadow-lg z-50"
          style={{ backgroundColor: toast.ok ? NAVY : "#DC2626" }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
