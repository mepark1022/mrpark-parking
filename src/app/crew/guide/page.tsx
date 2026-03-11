// @ts-nocheck
"use client";

import CrewHeader from "@/components/crew/CrewHeader";
import CrewBottomNav, { CrewNavSpacer } from "@/components/crew/CrewBottomNav";

const features = [
  { icon: "🏠", title: "홈", desc: "오늘의 주차 현황과 근무 상태를 한눈에 확인합니다.", details: [
    "오늘 입차 · 출차 · 주차중 건수 요약",
    "출퇴근 상태 확인 및 바로가기",
    "최근 입차 차량 리스트",
  ]},
  { icon: "🚗", title: "입차 등록", desc: "카메라 OCR 또는 수기 입력으로 차량을 등록합니다.", details: [
    "카메라 번호판 인식 (OCR) — 자동 촬영 후 번호 추출",
    "수기 입력 — 차량번호 직접 타이핑",
    "발렛 / 일반 주차 유형 선택",
    "방문지(층/호) 선택 시 개별 요금 자동 적용",
    "주차 위치 메모 입력",
    "중복 차량 방지 팝업 (주차중 → 빨강, 출차처리중 → 주황)",
  ]},
  { icon: "📋", title: "입차 현황", desc: "현재 주차 중인 차량 목록과 출차 처리를 합니다.", details: [
    "주차중 · 출차요청 · 출차완료 상태별 필터",
    "차량번호 검색",
    "개별 차량 상세 → 출차 처리",
    "출차요청 실시간 알림 (토스트 + 진동)",
  ]},
  { icon: "📅", title: "월주차 관리", desc: "월정기 주차 계약을 조회하고 신규 등록합니다.", details: [
    "차량번호 · 고객명으로 월주차 검색",
    "신규 월주차 등록 (차량 · 고객정보 · 기간 · 요금)",
    "시작일 선택 시 해당월 말일 자동 세팅",
    "기존 계약 수정 (탭 → 수정하기 버튼)",
    "계약 상태 · 납부 상태 · 잔여일 표시",
  ]},
  { icon: "⏰", title: "출퇴근", desc: "출근 · 퇴근을 기록하고 근무 이력을 확인합니다.", details: [
    "출근 / 퇴근 버튼 터치로 간편 기록",
    "오늘 근무 시간 표시",
    "이번 달 근무일수 · 총 근무시간 요약",
    "근무 이력 상세 조회",
  ]},
  { icon: "🏖️", title: "연차 관리", desc: "연차 잔여일 확인 및 연차를 신청합니다.", details: [
    "총 연차 · 사용 · 잔여일 한눈에 확인",
    "연차 신청 (날짜 선택 → 사유 입력)",
    "승인 대기 · 승인 · 반려 상태 표시",
    "연차 사용 이력 조회",
  ]},
  { icon: "⚠️", title: "사고보고", desc: "주차장 내 사고 발생 시 즉시 보고합니다.", details: [
    "사고 유형 선택 (차량손상, 시설파손, 부상 등)",
    "차량번호, 사고 내용, 위치 입력",
    "사진 촬영 및 첨부",
    "접수 완료 후 관리자에게 자동 전달",
  ]},
  { icon: "⚙️", title: "설정", desc: "내 정보 확인 및 매장 변경을 합니다.", details: [
    "내 이름 · 이메일 · 배정 매장 확인",
    "매장 변경 (복수 매장 배정 시)",
    "로그아웃",
  ]},
];

const CSS = `
  .cguide-page { min-height:100dvh; background:#F8FAFC; }
  .cguide-header-card {
    margin:16px; border-radius:16px; overflow:hidden;
    background:linear-gradient(135deg, #020617 0%, #0a1352 50%, #1428A0 100%);
    padding:24px 20px;
  }
  .cguide-header-icon {
    width:44px; height:44px; border-radius:12px; background:#F5B731;
    display:flex; align-items:center; justify-content:center;
    font-size:22px; flex-shrink:0;
  }
  .cguide-header-title { font-size:18px; font-weight:800; color:#fff; margin-bottom:2px; }
  .cguide-header-sub { font-size:13px; color:rgba(255,255,255,.6); }

  .cguide-list { padding:0 16px 16px; display:flex; flex-direction:column; gap:12px; }
  .cguide-card {
    background:#fff; border-radius:16px; border:1px solid #E2E8F0;
    overflow:hidden; box-shadow:0 1px 4px rgba(20,40,160,.04);
  }
  .cguide-card-inner { padding:16px; }
  .cguide-icon {
    width:40px; height:40px; border-radius:10px; background:#FFF8E7;
    display:flex; align-items:center; justify-content:center;
    font-size:20px; flex-shrink:0;
  }
  .cguide-title { font-size:15px; font-weight:800; color:#1A1D2B; margin-bottom:3px; }
  .cguide-desc { font-size:12px; color:#64748B; margin-bottom:10px; line-height:1.5; }
  .cguide-detail {
    display:flex; align-items:flex-start; gap:6px; margin-bottom:4px;
  }
  .cguide-dot { color:#F5B731; font-size:8px; margin-top:5px; flex-shrink:0; }
  .cguide-detail-text { font-size:12px; color:#64748B; line-height:1.6; }

  .cguide-footer {
    text-align:center; padding:20px 16px 8px; font-size:11px; color:#94A3B8;
  }
`;

export default function CrewGuidePage() {
  return (
    <>
      <style>{CSS}</style>
      <div className="cguide-page">
        <CrewHeader title="기능 안내" showBack />

        {/* 헤더 카드 */}
        <div className="cguide-header-card">
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div className="cguide-header-icon">📖</div>
            <div>
              <div className="cguide-header-title">미팍Ticket CREW 기능 안내</div>
              <div className="cguide-header-sub">크루앱의 모든 기능을 안내합니다</div>
            </div>
          </div>
        </div>

        {/* 기능 카드 리스트 */}
        <div className="cguide-list">
          {features.map((item, i) => (
            <div key={i} className="cguide-card">
              <div className="cguide-card-inner">
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <div className="cguide-icon">{item.icon}</div>
                  <div style={{ flex: 1 }}>
                    <div className="cguide-title">{item.title}</div>
                    <div className="cguide-desc">{item.desc}</div>
                    {item.details.map((d, j) => (
                      <div key={j} className="cguide-detail">
                        <span className="cguide-dot">●</span>
                        <span className="cguide-detail-text">{d}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* 푸터 */}
        <div className="cguide-footer">
          <p>© 주식회사 미스터팍 · 미팍Ticket CREW</p>
          <p style={{ marginTop: 4 }}>문의: mepark1022@gmail.com</p>
        </div>

        <CrewNavSpacer />
      </div>
      <CrewBottomNav />
    </>
  );
}
