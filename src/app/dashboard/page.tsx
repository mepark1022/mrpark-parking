import AppLayout from "@/components/layout/AppLayout";

export default function DashboardPage() {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <p className="text-sm text-mr-gray">총 입차량</p>
            <p className="text-2xl font-bold text-dark mt-1">-</p>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <p className="text-sm text-mr-gray">총 발렛매출</p>
            <p className="text-2xl font-bold text-dark mt-1">-</p>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <p className="text-sm text-mr-gray">총 근무인원</p>
            <p className="text-2xl font-bold text-dark mt-1">-</p>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <p className="text-sm text-mr-gray">운영 매장수</p>
            <p className="text-2xl font-bold text-dark mt-1">10</p>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-dark mb-4">
            대시보드 준비 중
          </h3>
          <p className="text-mr-gray">
            데이터 입력 후 이곳에 차트와 분석 결과가 표시됩니다.
          </p>
        </div>
      </div>
    </AppLayout>
  );
}