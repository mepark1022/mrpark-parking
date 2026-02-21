/**
 * ME.PARK Ticket — 사업계획서 2026–2028
 * Design: "Goldwatch Precision"
 * 
 * Philosophy: Swiss watchmaking meets editorial publishing.
 * Deep navy as the dominant field. Gold as a surgical incision.
 * Typography becomes architecture — numbers at 120pt+ anchor
 * the composition while thin rules organize the grid.
 * Negative space is not empty — it is the breathing of the design.
 * Information lives in form and weight, not in paragraphs.
 */

const pptxgen = require("pptxgenjs");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const sharp = require("sharp");

const {
  FaParking, FaQrcode, FaShieldAlt, FaBolt, FaMoneyBillWave,
  FaMobileAlt, FaLayerGroup, FaChartLine
} = require("react-icons/fa");
const { MdPayments, MdDashboard, MdAutoGraph } = require("react-icons/md");

// ═══════════════════════════════════════════════════════════════
//  BRAND PALETTE — ME.PARK 2.0 OFFICIAL
// ═══════════════════════════════════════════════════════════════
const P = {
  // Primary
  navy:   "1428A0",
  navyD:  "0C1870",
  navyDD: "060E48",
  navyM:  "1E35B8",
  // Accent
  gold:   "F5B731",
  goldD:  "C9900A",
  goldL:  "FEF3D0",
  // Neutral
  white:  "FFFFFF",
  offwht: "F8F9FD",
  dark:   "1A1D2B",
  ink:    "2D3355",
  slate:  "5A6490",
  mist:   "A8B4D8",
  rule:   "DDE3F5",
  // Semantic
  teal:   "0F9ED5",
  green:  "16A34A",
  ember:  "EA580C",
  violet: "7C3AED",
};

// ═══════════════════════════════════════════════════════════════
//  UTILITIES
// ═══════════════════════════════════════════════════════════════
async function renderIcon(IconComp, hexColor = "#FFFFFF", px = 320) {
  const svg = ReactDOMServer.renderToStaticMarkup(
    React.createElement(IconComp, { color: hexColor, size: String(px) })
  );
  const buf = await sharp(Buffer.from(svg)).png().toBuffer();
  return "image/png;base64," + buf.toString("base64");
}

const pres = new pptxgen();
pres.layout  = "LAYOUT_WIDE"; // 13.3 × 7.5 inches
pres.title   = "미팍티켓 사업계획서 2026–2028";
pres.author  = "주식회사 미스터팍";

// Shared thin gold rule
function rule(s, x, y, w, thick = 0.025) {
  s.addShape(pres.shapes.RECTANGLE, {
    x, y, w, h: thick,
    fill: { color: P.gold }, line: { color: P.gold }
  });
}

// Page number — always bottom-right
function pgNum(s, n) {
  s.addText(String(n).padStart(2, "0"), {
    x: 12.5, y: 7.08, w: 0.65, h: 0.26,
    fontSize: 11, bold: true, color: P.gold,
    fontFace: "Outfit", align: "right"
  });
}

// Footer credit line
function credit(s, dark = false) {
  s.addText("주식회사 미스터팍  ·  ME.PARK Ticket  ·  2026 사업계획서", {
    x: 0.5, y: 7.1, w: 11.8, h: 0.22,
    fontSize: 8, color: dark ? P.mist : P.slate,
    fontFace: "Outfit", charSpacing: 0.5
  });
}

// Ghost giant number — visual anchor behind content
function ghost(s, text, x, y, size, col = P.gold, trans = 88) {
  s.addText(text, {
    x, y, w: 8, h: size * 0.016,
    fontSize: size, bold: true, color: col,
    fontFace: "Outfit", transparency: trans
  });
}


// ═══════════════════════════════════════════════════════════════
//  SLIDE 01 — COVER
//  Philosophy: The "P" becomes an architectural monument.
//  Left: Dark field with gold incision. Right: Data as sculpture.
// ═══════════════════════════════════════════════════════════════
async function slide01() {
  const s = pres.addSlide();
  s.background = { color: P.navyDD };

  // ── Left panel (55%) ──────────────────────────────────────
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: 7.3, h: 7.5,
    fill: { color: P.navy }, line: { color: P.navy }
  });

  // Ghost "P" — the building itself
  s.addText("P", {
    x: -0.8, y: -1.0, w: 8.5, h: 9.0,
    fontSize: 600, bold: true, color: P.navyM,
    fontFace: "Outfit", align: "left", transparency: 82
  });

  // Gold vertical spine
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: 0.18, h: 7.5,
    fill: { color: P.gold }, line: { color: P.gold }
  });

  // Logo lockup
  // Icon box — white square with gold bar
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.55, y: 0.62, w: 1.4, h: 1.4,
    fill: { color: P.white }, line: { color: P.white }
  });
  s.addText("P", {
    x: 0.55, y: 0.55, w: 1.4, h: 1.48,
    fontSize: 60, bold: true, fontFace: "Outfit",
    color: P.navy, align: "center", valign: "middle", margin: 0
  });
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.55, y: 1.82, w: 1.4, h: 0.2,
    fill: { color: P.gold }, line: { color: P.gold }
  });

  // Brand text
  s.addText([
    { text: "미팍", options: { bold: true, color: P.white, fontSize: 36, fontFace: "Noto Sans KR" } },
    { text: "Ticket", options: { bold: true, color: P.gold, fontSize: 30, fontFace: "Outfit" } },
  ], { x: 2.2, y: 0.72, w: 4.8, h: 1.3 });

  s.addText("SaaS · 주차 결제 플랫폼", {
    x: 2.2, y: 1.78, w: 4.8, h: 0.38,
    fontSize: 11, color: P.mist, fontFace: "Outfit", charSpacing: 1.5
  });

  // Gold rule
  rule(s, 0.18, 2.38, 7.12);

  // Hero headline
  s.addText("소규모 주차장을\n위한 스마트 결제", {
    x: 0.5, y: 2.55, w: 6.65, h: 2.3,
    fontSize: 44, bold: true, fontFace: "Outfit",
    color: P.white, charSpacing: -0.8, lineSpacingMultiple: 1.1
  });

  // Subtext
  s.addText("QR 기반  ·  설비 투자 0원  ·  D+1 온보딩  ·  2026–2028", {
    x: 0.5, y: 4.98, w: 6.65, h: 0.42,
    fontSize: 11, color: P.mist, fontFace: "Outfit", charSpacing: 0.8
  });

  // Bottom rule
  rule(s, 0.18, 5.55, 7.12);

  // Three headline stats
  const stats = [
    { v: "100사",  l: "1년차 목표 고객" },
    { v: "10억+", l: "3년차 연간 매출" },
    { v: "Q3 흑자", l: "손익분기 전환점" },
  ];
  stats.forEach((st, i) => {
    const y = 5.72 + i * 0.48;
    s.addText(st.v, {
      x: 0.5, y, w: 2.4, h: 0.44,
      fontSize: 22, bold: true, fontFace: "Outfit", color: P.gold
    });
    s.addShape(pres.shapes.LINE, {
      x: 2.95, y: y + 0.21, w: 0, h: 0,
      line: { color: P.slate, width: 0 }
    });
    s.addText(st.l, {
      x: 3.05, y: y + 0.06, w: 3.9, h: 0.32,
      fontSize: 11, color: P.mist, fontFace: "Outfit", valign: "middle"
    });
  });

  // ── Right panel (45%) — KPI monuments ────────────────────
  // Ghost year
  s.addText("2026", {
    x: 7.2, y: 4.5, w: 6.2, h: 3.5,
    fontSize: 200, bold: true, fontFace: "Outfit",
    color: P.navyM, align: "right", transparency: 75
  });

  s.addText("사업계획서", {
    x: 7.5, y: 0.65, w: 5.6, h: 0.65,
    fontSize: 20, bold: true, color: P.white, fontFace: "Outfit"
  });

  rule(s, 7.5, 1.45, 5.6);

  // Three KPI blocks — stacked monuments
  const kpis = [
    { val: "25만+", sub: "국내 소규모 주차장 (50면 이하)", col: P.teal },
    { val: "475억", sub: "3년 누적 GMV (결제처리액)", col: P.gold },
    { val: "30.6%", sub: "3년 평균 영업이익률", col: P.green },
  ];

  kpis.forEach((k, i) => {
    const y = 1.68 + i * 1.72;
    // Left accent stripe
    s.addShape(pres.shapes.RECTANGLE, {
      x: 7.5, y, w: 0.06, h: 1.52,
      fill: { color: k.col }, line: { color: k.col }
    });
    // KPI number
    s.addText(k.val, {
      x: 7.72, y: y + 0.08, w: 4.8, h: 0.88,
      fontSize: 52, bold: true, fontFace: "Outfit", color: k.col
    });
    // Sub label
    s.addText(k.sub, {
      x: 7.72, y: y + 0.98, w: 5.4, h: 0.38,
      fontSize: 11, color: P.mist, fontFace: "Outfit"
    });
    // Rule below (except last)
    if (i < 2) rule(s, 7.5, y + 1.58, 5.65, 0.012);
  });

  // Company credit
  s.addText("주식회사 미스터팍  |  Mr. Park Co., Ltd.", {
    x: 7.5, y: 7.12, w: 5.65, h: 0.22,
    fontSize: 8, color: P.ink, align: "right"
  });
}


// ═══════════════════════════════════════════════════════════════
//  SLIDE 02 — PROBLEM
//  Philosophy: Giant stat numbers ARE the slide.
//  White field. Navy type. Gold is only the rule.
// ═══════════════════════════════════════════════════════════════
async function slide02() {
  const s = pres.addSlide();
  s.background = { color: P.white };

  // Navy top bar
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: 13.3, h: 1.1,
    fill: { color: P.navyDD }, line: { color: P.navyDD }
  });
  // Gold left accent on header
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: 0.18, h: 1.1,
    fill: { color: P.gold }, line: { color: P.gold }
  });
  s.addText("문제 정의", {
    x: 0.42, y: 0, w: 8, h: 1.1,
    fontSize: 28, bold: true, color: P.white,
    fontFace: "Outfit", valign: "middle"
  });
  s.addText("현장이 겪는 3가지 구조적 문제", {
    x: 8.0, y: 0, w: 5.1, h: 1.1,
    fontSize: 11, color: P.mist, fontFace: "Outfit",
    align: "right", valign: "middle"
  });
  pgNum(s, 4);

  // Three problem panels — horizontal split
  const probs = [
    {
      pct: "70%", title: "현금·수기 정산",
      body: "소규모 주차장의 70%가\n아직 현금 정산 운영 중.\n오류·분쟁·투명성 부재.",
      col: "DC2626"
    },
    {
      pct: "0원", title: "도입 불가 솔루션",
      body: "기존 시스템은 게이트·리더기\n필수 구매. 50면 이하에게\n현실적으로 투자 불가.",
      col: P.ember
    },
    {
      pct: "0개", title: "운영 데이터 없음",
      body: "매출·이용률·피크타임을\n파악할 수단 없음. 감에\n의존한 비효율 운영 지속.",
      col: P.violet
    },
  ];

  probs.forEach((p, i) => {
    const x = 0.42 + i * 4.28;

    // Ghost giant stat number — the art
    s.addText(p.pct, {
      x: x - 0.15, y: 0.85, w: 4.5, h: 3.0,
      fontSize: 145, bold: true, fontFace: "Outfit",
      color: p.col, transparency: 88, align: "left"
    });

    // Colored rule
    s.addShape(pres.shapes.RECTANGLE, {
      x, y: 1.2, w: 3.9, h: 0.06,
      fill: { color: p.col }, line: { color: p.col }
    });

    // Stat — real size
    s.addText(p.pct, {
      x, y: 1.38, w: 3.9, h: 1.28,
      fontSize: 80, bold: true, fontFace: "Outfit", color: P.dark
    });

    // Title
    s.addText(p.title, {
      x, y: 2.72, w: 3.9, h: 0.52,
      fontSize: 17, bold: true, color: P.dark, fontFace: "Outfit"
    });

    // Thin rule
    rule(s, x, 3.3, 3.9, 0.015);

    // Body
    s.addText(p.body, {
      x, y: 3.42, w: 3.9, h: 1.2,
      fontSize: 12, color: P.slate, fontFace: "Outfit", lineSpacingMultiple: 1.35
    });

    // Column divider (except last)
    if (i < 2) {
      s.addShape(pres.shapes.LINE, {
        x: x + 4.12, y: 1.1, w: 0, h: 5.85,
        line: { color: P.rule, width: 1 }
      });
    }
  });

  // Bottom opportunity bar
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 5.82, w: 13.3, h: 1.42,
    fill: { color: P.navyDD }, line: { color: P.navyDD }
  });
  rule(s, 0, 5.82, 13.3, 0.06);

  s.addText("시장 기회", {
    x: 0.42, y: 5.92, w: 2.5, h: 0.38,
    fontSize: 11, bold: true, color: P.gold,
    fontFace: "Outfit", charSpacing: 1
  });

  const opps = [
    { v: "25만+",  l: "소규모 주차장" },
    { v: "0.5%",  l: "현재 SaaS 보급률" },
    { v: "56억원", l: "1년차 목표 GMV" },
    { v: "블루오션", l: "초기 시장 선점 기회" },
  ];
  opps.forEach((o, i) => {
    const x = 0.42 + i * 3.2;
    s.addText(o.v, {
      x, y: 6.32, w: 3.0, h: 0.52,
      fontSize: 26, bold: true, fontFace: "Outfit", color: P.gold
    });
    s.addText(o.l, {
      x, y: 6.8, w: 3.0, h: 0.3,
      fontSize: 10, color: P.mist, fontFace: "Outfit"
    });
    if (i < 3) {
      s.addShape(pres.shapes.LINE, {
        x: x + 3.05, y: 6.0, w: 0, h: 1.24,
        line: { color: P.ink, width: 0.8 }
      });
    }
  });

  credit(s);
}


// ═══════════════════════════════════════════════════════════════
//  SLIDE 03 — SERVICE
//  Philosophy: Navy dark field. Flow as geometric rail.
//  Features as minimal icon+text pairs.
// ═══════════════════════════════════════════════════════════════
async function slide03() {
  const s = pres.addSlide();
  s.background = { color: P.navyDD };

  // Header
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: 13.3, h: 1.1,
    fill: { color: P.navy }, line: { color: P.navy }
  });
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: 0.18, h: 1.1,
    fill: { color: P.gold }, line: { color: P.gold }
  });
  s.addText("서비스 개요", {
    x: 0.42, y: 0, w: 8, h: 1.1,
    fontSize: 28, bold: true, color: P.white,
    fontFace: "Outfit", valign: "middle"
  });
  s.addText("QR 스캔 한 번 — 입차부터 정산까지", {
    x: 6.5, y: 0, w: 6.65, h: 1.1,
    fontSize: 11, color: P.mist, fontFace: "Outfit",
    align: "right", valign: "middle"
  });
  pgNum(s, 5);

  // Flow rail — horizontal spine
  const steps = [
    { n: "01", t: "입차", d: "QR 스캔\n번호판 입력" },
    { n: "02", t: "주차", d: "자동 시간\n측정·기록" },
    { n: "03", t: "결제", d: "PG 통합\n간편결제" },
    { n: "04", t: "정산", d: "실시간\n자동 리포트" },
  ];

  // Rail line
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.42, y: 2.35, w: 12.46, h: 0.04,
    fill: { color: P.slate }, line: { color: P.slate }
  });

  steps.forEach((st, i) => {
    const x = 0.42 + i * 3.15;
    const isLast = i === 3;

    // Node circle
    s.addShape(pres.shapes.OVAL, {
      x: x + 0.9, y: 2.12, w: 0.46, h: 0.46,
      fill: { color: isLast ? P.gold : P.navyM },
      line: { color: isLast ? P.gold : P.slate, width: 1.5 }
    });
    // Node step number
    s.addText(st.n, {
      x: x + 0.9, y: 2.12, w: 0.46, h: 0.46,
      fontSize: 9, bold: true, fontFace: "Outfit",
      color: isLast ? P.navyDD : P.gold,
      align: "center", valign: "middle", margin: 0
    });

    // Step title above rail
    s.addText(st.t, {
      x, y: 1.38, w: 3.0, h: 0.58,
      fontSize: 24, bold: true, fontFace: "Outfit",
      color: isLast ? P.gold : P.white, align: "center"
    });

    // Step desc below rail
    s.addText(st.d, {
      x, y: 2.72, w: 3.0, h: 0.72,
      fontSize: 11, color: P.mist, fontFace: "Outfit",
      align: "center", lineSpacingMultiple: 1.3
    });
  });

  // Feature grid — 3 × 2
  const features = [
    { ic: FaQrcode,       t: "QR 발권",          d: "설비 없이 QR만으로 즉시\n입차권 발행. 종이·앱 불필요", col: P.teal },
    { ic: MdPayments,     t: "PG 통합 결제",      d: "카드·카카오·네이버·토스\nPCI-DSS 준수 원클릭 결제",     col: P.gold },
    { ic: MdDashboard,    t: "실시간 대시보드",   d: "매출·이용률·피크 분석\n스마트폰으로 언제 어디서나",    col: P.navyM },
    { ic: FaMoneyBillWave, t: "정기권 관리",       d: "월·주 자동 갱신\n기업 단체권·할인 쿠폰 연동",        col: P.green },
    { ic: FaShieldAlt,    t: "보안·세무",          d: "거래내역 자동 보관\n세금계산서 자동 발행",             col: P.violet },
    { ic: FaBolt,         t: "D+1 온보딩",        d: "계약 다음날 운영 시작\n전담 CS 원격 세팅 지원",        col: P.ember },
  ];

  const icData = await Promise.all(features.map(f => renderIcon(f.ic, "#FFFFFF")));

  // Section label
  rule(s, 0.42, 3.65, 12.46, 0.025);
  s.addText("핵심 기능  6", {
    x: 0.42, y: 3.78, w: 3, h: 0.3,
    fontSize: 9, color: P.gold, fontFace: "Outfit",
    bold: true, charSpacing: 1.5
  });

  features.forEach((f, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = 0.42 + col * 4.3;
    const y = 4.2 + row * 1.35;

    // Left stripe
    s.addShape(pres.shapes.RECTANGLE, {
      x, y, w: 0.06, h: 1.12,
      fill: { color: f.col }, line: { color: f.col }
    });
    // Icon
    s.addImage({ data: icData[i], x: x + 0.18, y: y + 0.25, w: 0.5, h: 0.5 });
    // Title
    s.addText(f.t, {
      x: x + 0.82, y: y + 0.08, w: 3.35, h: 0.38,
      fontSize: 14, bold: true, color: P.white, fontFace: "Outfit"
    });
    // Body
    s.addText(f.d, {
      x: x + 0.82, y: y + 0.46, w: 3.35, h: 0.58,
      fontSize: 10.5, color: P.mist, fontFace: "Outfit",
      lineSpacingMultiple: 1.25
    });
  });

  credit(s, true);
}


// ═══════════════════════════════════════════════════════════════
//  SLIDE 04 — SALES POINTS
//  Philosophy: White ground, 6 large numbered panels.
//  Number as monument. Text minimal.
// ═══════════════════════════════════════════════════════════════
async function slide04() {
  const s = pres.addSlide();
  s.background = { color: P.offwht };

  // Header
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: 13.3, h: 1.1,
    fill: { color: P.navy }, line: { color: P.navy }
  });
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: 0.18, h: 1.1,
    fill: { color: P.gold }, line: { color: P.gold }
  });
  s.addText("핵심 세일즈 포인트", {
    x: 0.42, y: 0, w: 8, h: 1.1,
    fontSize: 28, bold: true, color: P.white,
    fontFace: "Outfit", valign: "middle"
  });
  pgNum(s, 6);

  const pts = [
    {
      n: "01", title: "설비 투자 ZERO",
      sub: "스마트폰 + QR = 완성",
      body: "게이트·리더기 불필요\n기존 폰으로 즉시 운영\n초기 도입비 0원",
      col: P.gold
    },
    {
      n: "02", title: "D+1 온보딩",
      sub: "계약 다음날 운영 시작",
      body: "계약 → QR배포 → 운영 1~2일\n전담 CS 원격 세팅 지원\n교육 영상·매뉴얼 제공",
      col: P.teal
    },
    {
      n: "03", title: "매출 투명화",
      sub: "숫자가 신뢰를 만든다",
      body: "실시간 매출·이용률 대시보드\n자동 세금계산서·정산 보고\n주차장주 신뢰 즉시 확보",
      col: P.green
    },
    {
      n: "04", title: "수익 공유 모델",
      sub: "매출 느는 만큼 함께 성장",
      body: "월정액 + 결제 수수료 구조\n고객 매출↑ = 미팍 수익↑\n이해관계 완전 일치",
      col: "818CF8"
    },
    {
      n: "05", title: "록인 구조",
      sub: "한 번 쓰면 계속 쓴다",
      body: "정기권 고객 데이터 누적\n이탈률 2% 이하 목표\n양방향 앱 생태계 구축",
      col: P.ember
    },
    {
      n: "06", title: "확장성",
      sub: "프랜차이즈·API 연동",
      body: "Enterprise API·화이트라벨\n멀티 주차장 통합 관리\n대형 체인 체계적 공략",
      col: P.violet
    },
  ];

  pts.forEach((p, i) => {
    const c = i % 3;
    const r = Math.floor(i / 3);
    const x = 0.35 + c * 4.3;
    const y = 1.22 + r * 2.98;

    // Card background
    s.addShape(pres.shapes.RECTANGLE, {
      x, y, w: 4.18, h: 2.72,
      fill: { color: P.white }, line: { color: P.rule }
    });

    // Ghost number background art
    s.addText(p.n, {
      x: x + 1.6, y: y - 0.55, w: 2.5, h: 2.2,
      fontSize: 140, bold: true, fontFace: "Outfit",
      color: p.col, transparency: 91
    });

    // Colored top stroke
    s.addShape(pres.shapes.RECTANGLE, {
      x, y, w: 4.18, h: 0.06,
      fill: { color: p.col }, line: { color: p.col }
    });

    // Step number — real
    s.addText(p.n, {
      x: x + 0.22, y: y + 0.15, w: 0.65, h: 0.5,
      fontSize: 13, bold: true, fontFace: "Outfit",
      color: p.col
    });

    // Title
    s.addText(p.title, {
      x: x + 0.22, y: y + 0.6, w: 3.8, h: 0.5,
      fontSize: 18, bold: true, color: P.dark, fontFace: "Outfit"
    });

    // Tag
    s.addText(p.sub, {
      x: x + 0.22, y: y + 1.08, w: 3.8, h: 0.28,
      fontSize: 10, color: p.col, fontFace: "Outfit", bold: true
    });

    // Rule
    rule(s, x + 0.22, y + 1.4, 3.6, 0.012);

    // Body
    s.addText(p.body, {
      x: x + 0.22, y: y + 1.55, w: 3.8, h: 1.0,
      fontSize: 11, color: P.slate, fontFace: "Outfit",
      lineSpacingMultiple: 1.4
    });
  });

  credit(s);
}


// ═══════════════════════════════════════════════════════════════
//  SLIDE 05 — PRICING
//  Philosophy: 4 columns on dark field.
//  Price number as the dominant visual. All else whispers.
// ═══════════════════════════════════════════════════════════════
async function slide05() {
  const s = pres.addSlide();
  s.background = { color: P.navyDD };

  s.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: 13.3, h: 1.1,
    fill: { color: P.navy }, line: { color: P.navy }
  });
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: 0.18, h: 1.1,
    fill: { color: P.gold }, line: { color: P.gold }
  });
  s.addText("요금제 구조", {
    x: 0.42, y: 0, w: 8, h: 1.1,
    fontSize: 28, bold: true, color: P.white,
    fontFace: "Outfit", valign: "middle"
  });
  s.addText("Pricing Tiers", {
    x: 7.5, y: 0, w: 5.65, h: 1.1,
    fontSize: 13, color: P.mist, fontFace: "Outfit",
    align: "right", valign: "middle", charSpacing: 2
  });
  pgNum(s, 7);

  const tiers = [
    {
      name: "Starter",  price: "19,900", fee: "3.5%",
      badge: "무료 체험 후 전환", badgeCol: P.green,
      bg: "0D1B6A", accent: P.green, highlighted: false,
      feats: ["QR 발권 기본", "결제 이력 조회", "기본 CS 지원"]
    },
    {
      name: "Basic",    price: "39,900", fee: "3.3%",
      badge: "가장 인기", badgeCol: P.teal,
      bg: "0D1B6A", accent: P.teal, highlighted: false,
      feats: ["Starter 전체", "정기권 관리", "매출 대시보드", "이메일 알림"]
    },
    {
      name: "Pro",      price: "69,900", fee: "3.0%",
      badge: "추천", badgeCol: P.gold,
      bg: P.navy, accent: P.gold, highlighted: true,
      feats: ["Basic 전체", "멀티 주차장", "쿠폰·할인 관리", "고급 분석 리포트", "우선 CS"]
    },
    {
      name: "Enterprise", price: "협의", fee: "2.8% 협의",
      badge: "대형·프랜차이즈", badgeCol: P.violet,
      bg: "0D1B6A", accent: P.violet, highlighted: false,
      feats: ["Pro 전체", "API·화이트라벨", "SLA 보장", "전담 매니저", "맞춤 개발"]
    },
  ];

  tiers.forEach((t, i) => {
    const x = 0.3 + i * 3.2;
    const isFeatured = t.highlighted;
    const yTop = isFeatured ? 1.18 : 1.38;
    const cardH = isFeatured ? 5.82 : 5.62;

    s.addShape(pres.shapes.RECTANGLE, {
      x, y: yTop, w: 3.05, h: cardH,
      fill: { color: t.bg }, line: { color: isFeatured ? P.gold : P.ink }
    });

    // Gold stripe for featured
    if (isFeatured) {
      s.addShape(pres.shapes.RECTANGLE, {
        x, y: yTop, w: 3.05, h: 0.08,
        fill: { color: P.gold }, line: { color: P.gold }
      });
    }

    // Accent left stripe
    s.addShape(pres.shapes.RECTANGLE, {
      x, y: yTop + (isFeatured ? 0.08 : 0), w: 0.06, h: cardH - 0.08,
      fill: { color: t.accent }, line: { color: t.accent }
    });

    // Ghost price as art
    s.addText(t.price === "협의" ? "∞" : t.price.replace(",", ""), {
      x: x - 0.2, y: yTop + 0.5, w: 3.5, h: 2.5,
      fontSize: 100, bold: true, fontFace: "Outfit",
      color: t.accent, transparency: 89
    });

    // Badge
    s.addShape(pres.shapes.RECTANGLE, {
      x: x + 0.15, y: yTop + 0.22, w: 2.75, h: 0.3,
      fill: { color: t.badgeCol }, line: { color: t.badgeCol }
    });
    s.addText(t.badge, {
      x: x + 0.15, y: yTop + 0.22, w: 2.75, h: 0.3,
      fontSize: 10, bold: true,
      color: t.badgeCol === P.gold ? P.navyDD : P.white,
      align: "center", valign: "middle", margin: 0
    });

    // Tier name
    s.addText(t.name, {
      x: x + 0.15, y: yTop + 0.65, w: 2.75, h: 0.58,
      fontSize: 24, bold: true, fontFace: "Outfit",
      color: P.white, align: "center"
    });

    // Price
    s.addText("₩  " + t.price, {
      x: x + 0.15, y: yTop + 1.2, w: 2.75, h: 0.55,
      fontSize: t.price === "협의" ? 22 : 20,
      bold: true, fontFace: "Outfit",
      color: t.accent, align: "center"
    });
    s.addText("/ 월   수수료 " + t.fee, {
      x: x + 0.15, y: yTop + 1.72, w: 2.75, h: 0.28,
      fontSize: 10, color: P.mist, align: "center", fontFace: "Outfit"
    });

    // Divider
    rule(s, x + 0.15, yTop + 2.08, 2.75, 0.014);

    // Features
    t.feats.forEach((f, j) => {
      s.addText("→  " + f, {
        x: x + 0.2, y: yTop + 2.25 + j * 0.58, w: 2.7, h: 0.5,
        fontSize: 11, color: P.mist, fontFace: "Outfit"
      });
    });
  });

  // Bottom note
  s.addText("※ 수수료 = PG 원가(2.0%) 차감 후 미팍 수취분  ·  1년차 티어 믹스 가정: Starter 30% / Basic 40% / Pro 20% / Enterprise 10%", {
    x: 0.4, y: 7.15, w: 12.5, h: 0.22,
    fontSize: 8, color: P.ink, fontFace: "Outfit"
  });
}


// ═══════════════════════════════════════════════════════════════
//  SLIDE 06 — FINANCIALS
//  Philosophy: Left = KPI monuments on navy.
//  Right = Clean charts on white. The split is the art.
// ═══════════════════════════════════════════════════════════════
async function slide06() {
  const s = pres.addSlide();
  s.background = { color: P.white };

  // Left navy panel
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 5.0, h: 7.5, fill: { color: P.navyDD }, line: { color: P.navyDD } });
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 0.18, h: 7.5, fill: { color: P.gold }, line: { color: P.gold } });

  // Header
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 13.3, h: 1.1, fill: { color: P.navy }, line: { color: P.navy } });
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 0.18, h: 1.1, fill: { color: P.gold }, line: { color: P.gold } });
  s.addText("3개년 재무 시뮬레이션", { x: 0.42, y: 0, w: 8, h: 1.1, fontSize: 28, bold: true, color: P.white, fontFace: "Outfit", valign: "middle" });
  s.addText("알림톡 2회 기준  ·  인건비·마케팅 제외", { x: 8.2, y: 0, w: 4.92, h: 1.1, fontSize: 10, color: P.gold, fontFace: "Outfit", align: "right", valign: "middle" });
  pgNum(s, 8);

  // LEFT: 3년 KPI — 알림톡 2회 절감 반영
  const years = [
    { yr: "1년차", cust: "100사", rev: "1.4억", op: "3,353만", pct: "24.0%", infra: "196만/월", col: P.teal },
    { yr: "2년차", cust: "250사", rev: "4.4억", op: "1.33억",  pct: "30.1%", infra: "459만/월", col: P.navyM },
    { yr: "3년차", cust: "500사", rev: "10.1억",op: "3.95억",  pct: "39.1%", infra: "905만/월", col: P.gold },
  ];
  years.forEach((y, i) => {
    const top = 1.28 + i * 1.9;
    s.addShape(pres.shapes.RECTANGLE, { x: 0.42, y: top, w: 0.06, h: 1.65, fill: { color: y.col }, line: { color: y.col } });
    s.addText(y.yr, { x: 0.65, y: top + 0.06, w: 4.1, h: 0.3, fontSize: 11, bold: true, color: y.col, fontFace: "Outfit", charSpacing: 1 });
    s.addText(y.cust, { x: 0.65, y: top + 0.34, w: 4.1, h: 0.7, fontSize: 40, bold: true, fontFace: "Outfit", color: P.white });
    const micro = [{ l: "매출", v: y.rev }, { l: "영업이익", v: y.op }, { l: "이익률", v: y.pct }];
    micro.forEach((m, j) => {
      const mx = 0.65 + j * 1.42;
      s.addText(m.l, { x: mx, y: top + 1.06, w: 1.4, h: 0.22, fontSize: 8, color: P.mist, fontFace: "Outfit" });
      s.addText(m.v, { x: mx, y: top + 1.26, w: 1.4, h: 0.3, fontSize: 13, bold: true, fontFace: "Outfit", color: y.col === P.gold ? P.goldL : P.white });
    });
    // Infra badge
    s.addText("인프라 " + y.infra, { x: 0.65, y: top + 1.55, w: 4.0, h: 0.2, fontSize: 9, color: y.col, fontFace: "Outfit" });
    if (i < 2) rule(s, 0.42, top + 1.76, 4.3, 0.012);
  });

  // BEP bar
  s.addShape(pres.shapes.RECTANGLE, { x: 0.42, y: 6.9, w: 4.3, h: 0.28, fill: { color: P.gold }, line: { color: P.gold } });
  s.addText("BEP Q3  ·  알림톡 2회 절감 반영  ·  연 절감 최대 4,500만", { x: 0.48, y: 6.9, w: 4.18, h: 0.28, fontSize: 8, bold: true, color: P.navyDD, fontFace: "Outfit", valign: "middle" });

  // RIGHT: 인프라 비용 Breakdown 테이블
  s.addText("📡  인프라 비용 시뮬레이션  (인건비·마케팅 제외)", { x: 5.25, y: 1.18, w: 7.8, h: 0.36, fontSize: 12, bold: true, color: P.dark, fontFace: "Outfit" });
  rule(s, 5.25, 1.56, 7.8, 0.022);

  const tX    = [5.25, 7.35, 9.05, 10.75, 12.45];
  const tCols = [2.1,  1.7,  1.7,  1.7,   0.6];
  const tHdrs = ["항목", "1년차", "2년차", "3년차", "비고"];
  s.addShape(pres.shapes.RECTANGLE, { x: 5.25, y: 1.63, w: 7.8, h: 0.34, fill: { color: P.navyDD }, line: { color: P.navyDD } });
  tHdrs.forEach((h, i) => {
    s.addText(h, { x: tX[i]+0.05, y: 1.63, w: tCols[i]-0.08, h: 0.34, fontSize: 9.5, bold: true, color: P.white, fontFace: "Outfit", valign: "middle", align: i===0?"left":"center" });
  });

  const rows = [
    { item: "카카오 알림톡 (2회/거래)", v: ["1,800만","4,500만","9,000만"], note: "10원×2회", hi: true,  col: P.gold },
    { item: "클라우드 서버 (Vercel)",   v: ["60만",   "120만",  "240만" ], note: "선형↑",   hi: false, col: null },
    { item: "데이터베이스 (Supabase)", v: ["42만",   "84만",   "168만" ], note: "선형↑",   hi: false, col: null },
    { item: "스토리지·CDN (QR이미지)", v: ["24만",   "48만",   "120만" ], note: "선형↑",   hi: false, col: null },
    { item: "모니터링·이메일 등",       v: ["42만",   "66만",   "96만"  ], note: "완만↑",   hi: false, col: null },
    { item: "인프라 합계 (연)",          v: ["1,968만","4,818만","9,624만"], note: "비용↑",   hi: true,  col: P.teal },
    { item: "매출 대비 인프라 비율",    v: ["14.1%", "11.0%", "9.5%"  ], note: "SaaS↓",   hi: true,  col: P.green },
  ];

  rows.forEach((r, i) => {
    const ry = 1.97 + i * 0.37;
    const bg = r.hi
      ? (i === rows.length-1 ? "E8F5E9" : i === rows.length-2 ? "E0F2F7" : "FEF9E7")
      : (i%2===0 ? P.white : P.offwht);
    s.addShape(pres.shapes.RECTANGLE, { x: 5.25, y: ry, w: 7.8, h: 0.37, fill: { color: bg }, line: { color: "E2E4E9", type: "solid", pt: 0.5 } });
    const vals = [r.item, ...r.v, r.note];
    vals.forEach((v, j) => {
      s.addText(v, { x: tX[j]+0.05, y: ry+0.02, w: tCols[j]-0.08, h: 0.33,
        fontSize: j===0 ? 9 : 10, bold: r.hi, color: r.col && j>0 && j<4 ? r.col : P.dark,
        fontFace: "Outfit", valign: "middle", align: j===0 ? "left" : "center" });
    });
  });

  // RIGHT BOTTOM: bar chart
  const chartTop = 1.97 + rows.length * 0.37 + 0.18;
  rule(s, 5.25, chartTop, 7.8, 0.022);

  s.addChart(pres.charts.BAR, [
    { name: "매출 (백만원)",     labels: ["1년차","2년차","3년차"], values: [140, 440, 1010] },
    { name: "영업이익 (백만원)", labels: ["1년차","2년차","3년차"], values: [34,  133,  395] },
  ], {
    x: 5.25, y: chartTop+0.1, w: 7.8, h: 7.5 - chartTop - 0.42,
    barDir: "col", barGrouping: "clustered",
    chartColors: [P.navy, P.gold],
    chartArea: { fill: { color: P.white } }, plotArea: { fill: { color: P.white } },
    catAxisLabelColor: P.grayD, valAxisLabelColor: P.grayD,
    valGridLine: { color: "E2E8F0", size: 0.5 }, catGridLine: { style: "none" },
    showValue: true, dataLabelFontSize: 9, dataLabelColor: P.dark,
    showLegend: true, legendPos: "b", legendFontSize: 9,
    showTitle: true, title: "매출  vs  영업이익 (백만원)  ·  알림톡 2회 절감 반영",
    titleFontSize: 10, titleColor: P.dark
  });

  credit(s);
}


async function slide07() {
  const s = pres.addSlide();
  s.background = { color: P.offwht };

  s.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: 13.3, h: 1.1,
    fill: { color: P.navyDD }, line: { color: P.navyDD }
  });
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: 0.18, h: 1.1,
    fill: { color: P.gold }, line: { color: P.gold }
  });
  s.addText("실행 로드맵", {
    x: 0.42, y: 0, w: 7, h: 1.1,
    fontSize: 28, bold: true, color: P.white,
    fontFace: "Outfit", valign: "middle"
  });
  s.addText("2026  →  2027  →  2028", {
    x: 7.5, y: 0, w: 5.65, h: 1.1,
    fontSize: 13, color: P.mist, fontFace: "Outfit",
    align: "right", valign: "middle", charSpacing: 2
  });
  pgNum(s, 9);

  const years = [
    {
      yr: "1년차", date: "2026", col: P.teal,
      items: [
        "QR 발권 v1.0 출시",
        "파일럿 20개사 → 100개사",
        "PG 3사 연동 완료",
        "기존 미스터팍 시스템 연동",
        "Q3 영업이익 흑자 전환",
      ]
    },
    {
      yr: "2년차", date: "2027", col: P.navyM,
      items: [
        "정기권 고도화",
        "250개사 달성",
        "전담 인력 1명 추가",
        "대시보드 v2.0 출시",
        "영업이익 1.1억 달성",
      ]
    },
    {
      yr: "3년차", date: "2028", col: P.gold,
      items: [
        "Enterprise API 런칭",
        "500개사 달성",
        "MRR 2,200만원/월",
        "프랜차이즈 체인 공략",
        "영업이익률 34.6% 달성",
      ]
    },
  ];

  years.forEach((y, i) => {
    const x = 0.38 + i * 4.32;
    const isGold = y.col === P.gold;

    // Ghost year number as background art
    s.addText(y.date, {
      x: x - 0.2, y: 0.72, w: 4.5, h: 2.8,
      fontSize: 165, bold: true, fontFace: "Outfit",
      color: y.col, transparency: 89
    });

    // Year header
    s.addShape(pres.shapes.RECTANGLE, {
      x, y: 1.18, w: 4.1, h: 0.72,
      fill: { color: y.col }, line: { color: y.col }
    });
    s.addText(y.yr + "  " + y.date, {
      x: x + 0.18, y: 1.18, w: 3.75, h: 0.72,
      fontSize: 20, bold: true, fontFace: "Outfit",
      color: isGold ? P.navyDD : P.white, valign: "middle"
    });

    // Vertical timeline spine
    s.addShape(pres.shapes.RECTANGLE, {
      x: x + 0.32, y: 1.9, w: 0.03, h: 4.82,
      fill: { color: y.col }, line: { color: y.col }
    });

    // Items
    y.items.forEach((it, j) => {
      const iy = 2.08 + j * 0.88;
      // Dot
      s.addShape(pres.shapes.OVAL, {
        x: x + 0.2, y: iy + 0.12, w: 0.26, h: 0.26,
        fill: { color: y.col }, line: { color: y.col }
      });
      // Text
      s.addText(it, {
        x: x + 0.62, y: iy, w: 3.55, h: 0.52,
        fontSize: 12.5, color: P.dark, fontFace: "Outfit"
      });
    });

    // Column separator
    if (i < 2) {
      s.addShape(pres.shapes.LINE, {
        x: x + 4.2, y: 1.18, w: 0, h: 5.74,
        line: { color: P.rule, width: 1.2 }
      });
    }
  });

  // KPI strip bottom — navy background for clarity
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.38, y: 6.68, w: 12.55, h: 0.65,
    fill: { color: P.navyDD }, line: { color: P.navyDD }
  });
  rule(s, 0.38, 6.68, 12.55, 0.04);
  const kpis = [
    { k: "이탈률 목표", v: "≤ 2%" },
    { k: "Basic+ 비율", v: "85%" },
    { k: "Enterprise 비율", v: "20%" },
    { k: "최종 MRR", v: "2,200만/월" },
  ];
  kpis.forEach((k, i) => {
    const x = 0.58 + i * 3.18;
    s.addText(k.k, {
      x, y: 6.73, w: 3.0, h: 0.2,
      fontSize: 8.5, color: P.mist, fontFace: "Outfit"
    });
    s.addText(k.v, {
      x, y: 6.9, w: 3.0, h: 0.32,
      fontSize: 16, bold: true, fontFace: "Outfit", color: P.gold
    });
  });

  credit(s);
}


// ═══════════════════════════════════════════════════════════════
//  SLIDE 08 — CLOSING
//  Philosophy: Return to dark. One thought. One gold strike.
//  Maximum negative space. Minimal words. Maximal impact.
// ═══════════════════════════════════════════════════════════════
async function slide08() {
  const s = pres.addSlide();
  s.background = { color: P.navyDD };

  // Ghost "P" fills the right field
  s.addText("P", {
    x: 5.5, y: -1.8, w: 9, h: 10.5,
    fontSize: 660, bold: true, color: P.navyM,
    fontFace: "Outfit", align: "left", transparency: 88
  });

  // Gold vertical spine — left
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: 0.18, h: 7.5,
    fill: { color: P.gold }, line: { color: P.gold }
  });

  // Top label
  s.addText("왜 미팍티켓인가", {
    x: 0.5, y: 0.52, w: 8, h: 0.48,
    fontSize: 13, color: P.mist, fontFace: "Outfit",
    charSpacing: 2, bold: false
  });

  // Gold rule
  rule(s, 0.5, 1.12, 9.5);

  // Three differentiators — compact horizontal row
  const diffs = [
    { title: "검증된 운영 기반", body: "14억 매출 실운영 노하우  ·  특허 5건", col: P.teal },
    { title: "완벽한 시장 타이밍", body: "디지털 전환 초기  ·  경쟁자 없는 선점", col: P.gold },
    { title: "SaaS 확장성", body: "코드 없이 고객 추가  ·  100→1,000개사", col: P.violet },
  ];

  diffs.forEach((d, i) => {
    const x = 0.5 + i * 4.3;
    s.addShape(pres.shapes.RECTANGLE, {
      x, y: 1.32, w: 4.1, h: 0.05,
      fill: { color: d.col }, line: { color: d.col }
    });
    s.addText(d.title, {
      x, y: 1.48, w: 4.05, h: 0.42,
      fontSize: 16, bold: true, color: P.white, fontFace: "Outfit"
    });
    s.addText(d.body, {
      x, y: 1.9, w: 4.05, h: 0.32,
      fontSize: 11, color: P.mist, fontFace: "Outfit"
    });
  });

  // Gold rule separator
  rule(s, 0.5, 2.38, 12.5);

  // Main statement — reduced font, fits cleanly
  s.addText(
    "미팍티켓은 단순한 주차 결제 앱이 아닙니다.\n" +
    "소규모 주차장 생태계를 디지털로 전환하는 SaaS 플랫폼입니다.\n" +
    "미스터팍의 검증된 운영 기반 위에, 국내 25만 소규모 주차장 시장을 선점할 준비가 완료되었습니다.",
    {
      x: 0.5, y: 2.55, w: 12.5, h: 2.15,
      fontSize: 17.5, color: P.white, fontFace: "Outfit",
      lineSpacingMultiple: 1.6
    }
  );

  // Gold rule above CTA
  rule(s, 0.5, 4.85, 12.5);

  // CTA block — gold
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.5, y: 5.05, w: 12.62, h: 1.32,
    fill: { color: P.gold }, line: { color: P.gold }
  });
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.5, y: 5.05, w: 0.1, h: 1.32,
    fill: { color: P.navyDD }, line: { color: P.navyDD }
  });
  s.addText("지금 시작할 준비가 되어 있습니다", {
    x: 0.78, y: 5.1, w: 12.2, h: 0.62,
    fontSize: 28, bold: true, fontFace: "Outfit", color: P.navyDD
  });
  s.addText(
    "3개년 목표  :  500개사  ·  영업이익 3.5억  ·  MRR 2,200만원  ·  GMV 475억원",
    {
      x: 0.78, y: 5.7, w: 9.0, h: 0.32,
      fontSize: 11, color: P.navyDD, fontFace: "Outfit", bold: true
    }
  );
  s.addText("mepark1022@gmail.com  ·  www.mepark.kr", {
    x: 0.78, y: 5.98, w: 12.2, h: 0.28,
    fontSize: 10, color: "2A3A6A", fontFace: "Outfit"
  });

  s.addText("주식회사 미스터팍  |  Mr. Park Co., Ltd.", {
    x: 0.5, y: 7.18, w: 12.5, h: 0.22,
    fontSize: 8, color: P.ink, fontFace: "Outfit", align: "right"
  });
}


// ═══════════════════════════════════════════════════════════════
//  SLIDE 02 — ME.PARK 1.0 STORY & 3개년 성장
//  Philosophy: The left panel tells the story through timeline.
//  The right panel lets numbers BE the slide. Growth is the art.
// ═══════════════════════════════════════════════════════════════
async function slideA_story() {
  const s = pres.addSlide();
  s.background = { color: P.navyDD };

  // Header
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: 13.3, h: 1.1,
    fill: { color: P.navy }, line: { color: P.navy }
  });
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: 0.18, h: 1.1,
    fill: { color: P.gold }, line: { color: P.gold }
  });
  s.addText("미팍 1.0 스토리  &  3개년 성장 실적", {
    x: 0.42, y: 0, w: 9, h: 1.1,
    fontSize: 26, bold: true, color: P.white,
    fontFace: "Outfit", valign: "middle"
  });
  s.addText("검증된 운영 기반", {
    x: 9.5, y: 0, w: 3.65, h: 1.1,
    fontSize: 11, color: P.gold, fontFace: "Outfit",
    align: "right", valign: "middle", charSpacing: 1.5, bold: true
  });
  pgNum(s, 10);

  // ── LEFT: Company Timeline Story ──────────────────────────
  // Ghost "1.0" art
  s.addText("1.0", {
    x: -0.3, y: 1.0, w: 7, h: 5,
    fontSize: 330, bold: true, fontFace: "Outfit",
    color: P.navyM, transparency: 82
  });

  // Timeline spine
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.78, y: 1.28, w: 0.04, h: 5.62,
    fill: { color: P.gold }, line: { color: P.gold }
  });

  const timeline = [
    {
      yr: "2012", title: "Kings Valet 창업",
      body: "프리미엄 발렛파킹 서비스 시작\n인천·서울 병원·호텔 운영 노하우 축적",
      col: P.mist
    },
    {
      yr: "2017", title: "Valetman 법인 설립",
      body: "발렛·주차 운영 전문 법인화\n체계적 인력 관리 시스템 구축",
      col: P.mist
    },
    {
      yr: "2018", title: "주식회사 미스터팍 설립",
      body: "인천 자회사 설립\n스마트 주차 플랫폼 본격 개발 착수",
      col: P.teal
    },
    {
      yr: "2024", title: "ME.PARK v1.0 출시",
      body: "QR 키오스크 기반 주차 관리 시스템\n특허 5건 확보 · 18명 팀 구성 완료",
      col: P.gold
    },
  ];

  timeline.forEach((t, i) => {
    const y = 1.32 + i * 1.38;
    // Dot
    s.addShape(pres.shapes.OVAL, {
      x: 0.62, y: y + 0.14, w: 0.36, h: 0.36,
      fill: { color: t.col }, line: { color: t.col }
    });
    // Year label
    s.addText(t.yr, {
      x: 1.08, y: y + 0.06, w: 1.1, h: 0.3,
      fontSize: 13, bold: true, fontFace: "Outfit", color: t.col
    });
    // Title
    s.addText(t.title, {
      x: 1.08, y: y + 0.32, w: 5.0, h: 0.36,
      fontSize: 14, bold: true, color: P.white, fontFace: "Outfit"
    });
    // Body
    s.addText(t.body, {
      x: 1.08, y: y + 0.66, w: 5.0, h: 0.55,
      fontSize: 10.5, color: P.mist, fontFace: "Outfit",
      lineSpacingMultiple: 1.25
    });
  });

  // Column divider
  s.addShape(pres.shapes.RECTANGLE, {
    x: 6.55, y: 1.18, w: 0.018, h: 5.92,
    fill: { color: P.ink }, line: { color: P.ink }
  });

  // ── RIGHT: 3개년 성장 실적 — Numbers as monuments ──────────
  s.addText("3개년  성장  실적", {
    x: 6.85, y: 1.22, w: 6.2, h: 0.42,
    fontSize: 11, color: P.gold, bold: true,
    fontFace: "Outfit", charSpacing: 2
  });
  rule(s, 6.85, 1.68, 6.2, 0.025);

  const growth = [
    {
      yr: "2023", rev: "1.8억", yoy: "–",
      label: "키오스크 서비스 개시\n첫 연간 실적 기록",
      col: P.mist, textCol: P.mist
    },
    {
      yr: "2024", rev: "4.7억", yoy: "+161%",
      label: "매장 확대 · PG 연동 고도화\n전년 대비 161% 폭발 성장",
      col: P.teal, textCol: P.teal
    },
    {
      yr: "2025", rev: "13억", yoy: "+177%",
      label: "SaaS 전환 준비 · 특허 5건\n2년 누적 성장률 622%",
      col: P.gold, textCol: P.gold
    },
  ];

  growth.forEach((g, i) => {
    const y = 1.88 + i * 1.72;

    // Left accent bar
    s.addShape(pres.shapes.RECTANGLE, {
      x: 6.85, y, w: 0.06, h: 1.52,
      fill: { color: g.col }, line: { color: g.col }
    });

    // Year
    s.addText(g.yr, {
      x: 7.08, y: y + 0.05, w: 1.1, h: 0.32,
      fontSize: 11, bold: true, fontFace: "Outfit", color: g.textCol, charSpacing: 1
    });

    // Revenue — monument number
    s.addText(g.rev, {
      x: 7.08, y: y + 0.32, w: 3.0, h: 0.88,
      fontSize: 58, bold: true, fontFace: "Outfit", color: P.white
    });

    // YoY badge
    if (g.yoy !== "–") {
      s.addShape(pres.shapes.RECTANGLE, {
        x: 10.1, y: y + 0.38, w: 1.6, h: 0.46,
        fill: { color: g.col }, line: { color: g.col }
      });
      s.addText(g.yoy, {
        x: 10.1, y: y + 0.38, w: 1.6, h: 0.46,
        fontSize: 20, bold: true, fontFace: "Outfit",
        color: g.col === P.gold ? P.navyDD : P.white,
        align: "center", valign: "middle", margin: 0
      });
    }

    // Label
    s.addText(g.label, {
      x: 7.08, y: y + 1.18, w: 5.75, h: 0.3,
      fontSize: 10, color: P.mist, fontFace: "Outfit"
    });

    if (i < 2) rule(s, 6.85, y + 1.58, 6.28, 0.012);
  });

  // Bottom summary bar — 2년 합산
  s.addShape(pres.shapes.RECTANGLE, {
    x: 6.85, y: 7.05, w: 6.28, h: 0.3,
    fill: { color: P.gold }, line: { color: P.gold }
  });
  s.addText("2년 누적 성장  1.8억 → 13억  ·  622% 성장  ·  특허 5건 확보", {
    x: 6.95, y: 7.05, w: 6.08, h: 0.3,
    fontSize: 10, bold: true, color: P.navyDD,
    fontFace: "Outfit", valign: "middle"
  });

  credit(s, true);
}


// ═══════════════════════════════════════════════════════════════
//  SLIDE 03 — 1.0 키오스크 한계 → 2.0 SaaS 성장성
//  Philosophy: Contrast as architecture. Left=constraint, Right=freedom.
//  The dividing line is the business inflection point.
// ═══════════════════════════════════════════════════════════════
async function slideB_transition() {
  const s = pres.addSlide();
  s.background = { color: P.white };

  // Header
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: 13.3, h: 1.1,
    fill: { color: P.navyDD }, line: { color: P.navyDD }
  });
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: 0.18, h: 1.1,
    fill: { color: P.gold }, line: { color: P.gold }
  });
  s.addText("왜 1.0에서 2.0으로?", {
    x: 0.42, y: 0, w: 9, h: 1.1,
    fontSize: 26, bold: true, color: P.white,
    fontFace: "Outfit", valign: "middle"
  });
  s.addText("키오스크 한계  →  SaaS 성장성", {
    x: 7.5, y: 0, w: 5.65, h: 1.1,
    fontSize: 11, color: P.gold, fontFace: "Outfit",
    align: "right", valign: "middle", charSpacing: 1, bold: true
  });
  pgNum(s, 3);

  // ── LEFT: 1.0 키오스크 제약 ──────────────────────────────
  // Navy panel
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 1.1, w: 6.35, h: 6.4,
    fill: { color: P.navyDD }, line: { color: P.navyDD }
  });

  // Ghost "1.0" art
  s.addText("1.0", {
    x: -0.2, y: 1.5, w: 5.5, h: 4.0,
    fontSize: 260, bold: true, fontFace: "Outfit",
    color: P.navyM, transparency: 84
  });

  // Label
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.38, y: 1.28, w: 2.2, h: 0.36,
    fill: { color: "DC2626" }, line: { color: "DC2626" }
  });
  s.addText("ME.PARK 1.0  키오스크", {
    x: 0.38, y: 1.28, w: 2.2, h: 0.36,
    fontSize: 9.5, bold: true, color: P.white,
    align: "center", valign: "middle", margin: 0, fontFace: "Outfit"
  });

  s.addText("구조적 한계", {
    x: 0.38, y: 1.75, w: 5.75, h: 0.52,
    fontSize: 22, bold: true, color: P.white, fontFace: "Outfit"
  });
  rule(s, 0.38, 2.32, 5.75, 0.025);

  const limits = [
    {
      icon: "💴", title: "고정비 부담",
      body: "키오스크 하드웨어 1대 300~500만원\n유지보수 · AS · 소모품 지속 발생\n고객 ROI 회수 기간 12개월 이상"
    },
    {
      icon: "🔧", title: "하드웨어 의존성",
      body: "설치·교체에 현장 방문 필수\n원격 업데이트 제한 · 장애 대응 지연\n고객 1개소당 1개 장비 = 선형 비용"
    },
    {
      icon: "📊", title: "스케일링 한계",
      body: "고객 100개사 → 하드웨어 100대 필요\n운영 인력 비례 증가 · 마진 정체\n데이터 통합 어려움 · 대시보드 부재"
    },
    {
      icon: "🔒", title: "록인 구조 부재",
      body: "하드웨어 교체 시 이탈 가능\n재구매 주기 3~5년 · 이탈률 높음\n고객 생애가치(LTV) 낮음"
    },
  ];

  limits.forEach((l, i) => {
    const y = 2.48 + i * 1.08;
    s.addText(l.icon, {
      x: 0.38, y: y + 0.05, w: 0.45, h: 0.38,
      fontSize: 18
    });
    s.addText(l.title, {
      x: 0.92, y: y + 0.04, w: 5.1, h: 0.36,
      fontSize: 13, bold: true, color: P.white, fontFace: "Outfit"
    });
    s.addText(l.body, {
      x: 0.92, y: y + 0.38, w: 5.1, h: 0.58,
      fontSize: 10.5, color: P.mist, fontFace: "Outfit",
      lineSpacingMultiple: 1.2
    });
  });

  // ── CENTER: Arrow / inflection divider ───────────────────
  // Gold center strike
  s.addShape(pres.shapes.RECTANGLE, {
    x: 6.35, y: 1.1, w: 0.5, h: 6.4,
    fill: { color: P.gold }, line: { color: P.gold }
  });
  s.addText("→", {
    x: 6.22, y: 3.85, w: 0.8, h: 0.62,
    fontSize: 32, bold: true, color: P.navyDD,
    fontFace: "Outfit", align: "center"
  });

  // ── RIGHT: 2.0 SaaS 성장성 ──────────────────────────────
  s.addShape(pres.shapes.RECTANGLE, {
    x: 6.85, y: 1.1, w: 6.45, h: 6.4,
    fill: { color: P.offwht }, line: { color: P.offwht }
  });

  // Ghost "2.0" art
  s.addText("2.0", {
    x: 7.8, y: 1.5, w: 5.5, h: 4.0,
    fontSize: 260, bold: true, fontFace: "Outfit",
    color: P.gold, transparency: 90
  });

  // Label
  s.addShape(pres.shapes.RECTANGLE, {
    x: 7.05, y: 1.28, w: 2.5, h: 0.36,
    fill: { color: P.navy }, line: { color: P.navy }
  });
  s.addText("ME.PARK 2.0  미팍티켓  SaaS", {
    x: 7.05, y: 1.28, w: 2.5, h: 0.36,
    fontSize: 9.5, bold: true, color: P.gold,
    align: "center", valign: "middle", margin: 0, fontFace: "Outfit"
  });

  s.addText("SaaS 성장성", {
    x: 7.05, y: 1.75, w: 5.9, h: 0.52,
    fontSize: 22, bold: true, color: P.navy, fontFace: "Outfit"
  });
  rule(s, 7.05, 2.32, 5.9, 0.025);

  const gains = [
    {
      icon: "🚀", title: "초기 투자 0원",
      body: "스마트폰 + QR = 즉시 운영\n하드웨어 없음 · 설치 없음 · D+1 시작\n고객 진입 장벽 완전 제거",
      col: P.gold
    },
    {
      icon: "📈", title: "수평적 확장",
      body: "고객 100 → 1,000개사, 코드 한 줄 변경 없음\n운영 인력 고정 · 마진 급증 구조\n클라우드 SaaS = 한계비용 0에 수렴",
      col: P.teal
    },
    {
      icon: "🔁", title: "구독 + 수수료 이중 수익",
      body: "월정액 MRR + 결제 GMV 수수료\n고객 매출 성장 = 미팍 수익 자동 증가\n이탈률 2% 이하 목표 · 높은 LTV",
      col: P.green
    },
    {
      icon: "🧠", title: "데이터 기반 성장 엔진",
      body: "전 고객 매출·이용률·피크 데이터 통합\n산업 벤치마크 · 크로스셀 기회 발굴\n AI 요금 최적화 등 부가기능 확장",
      col: P.violet
    },
  ];

  gains.forEach((g, i) => {
    const y = 2.48 + i * 1.08;
    // Colored accent stroke
    s.addShape(pres.shapes.RECTANGLE, {
      x: 7.05, y, w: 0.05, h: 0.92,
      fill: { color: g.col }, line: { color: g.col }
    });
    s.addText(g.icon, {
      x: 7.18, y: y + 0.05, w: 0.42, h: 0.38,
      fontSize: 18
    });
    s.addText(g.title, {
      x: 7.68, y: y + 0.04, w: 4.95, h: 0.36,
      fontSize: 13, bold: true, color: P.dark, fontFace: "Outfit"
    });
    s.addText(g.body, {
      x: 7.68, y: y + 0.38, w: 4.95, h: 0.62,
      fontSize: 10.5, color: P.slate, fontFace: "Outfit",
      lineSpacingMultiple: 1.2
    });
  });

  // Bottom comparison bar
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 7.08, w: 13.3, h: 0.32,
    fill: { color: P.navyDD }, line: { color: P.navyDD }
  });
  s.addText("1.0  :  하드웨어 100대 필요  /  마진 정체  /  이탈 용이", {
    x: 0.38, y: 7.08, w: 6.0, h: 0.32,
    fontSize: 9.5, color: "DC2626", fontFace: "Outfit", valign: "middle"
  });
  s.addText("→", {
    x: 6.35, y: 7.08, w: 0.5, h: 0.32,
    fontSize: 12, bold: true, color: P.gold,
    align: "center", valign: "middle"
  });
  s.addText("2.0  :  고객 무한 추가  /  마진 지속 개선  /  높은 LTV  ·  낮은 이탈률", {
    x: 6.98, y: 7.08, w: 6.14, h: 0.32,
    fontSize: 9.5, color: P.gold, fontFace: "Outfit", valign: "middle", bold: true
  });
}


// ═══════════════════════════════════════════════════════════════
//  BUILD
// ═══════════════════════════════════════════════════════════════
(async () => {
  console.log("Building ME.PARK Ticket v3.1 — with 1.0 Story...");
  await slide01();
  console.log("  01 ✓ Cover");
  await slideA_story();
  console.log("  02 ✓ 1.0 Story & 3Y Growth");
  await slideB_transition();
  console.log("  03 ✓ 1.0→2.0 Transition");
  await slide02();
  console.log("  04 ✓ Problem");
  await slide03();
  console.log("  05 ✓ Service");
  await slide04();
  console.log("  06 ✓ Sales Points");
  await slide05();
  console.log("  07 ✓ Pricing");
  await slide06();
  console.log("  08 ✓ Financials");
  await slide07();
  console.log("  09 ✓ Roadmap");
  await slide08();
  console.log("  10 ✓ Closing");

  await pres.writeFile({ fileName: "/home/claude/mepark_v3.pptx" });
  console.log("Done → mepark_v3.pptx (10 slides)");
})();
