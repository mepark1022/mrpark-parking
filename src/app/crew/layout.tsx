// @ts-nocheck
import { Metadata, Viewport } from "next";
import { CrewToastProvider } from "@/components/crew/CrewToast";

export const metadata: Metadata = {
  title: "미팍Ticket CREW",
  description: "주차 크루 전용 앱",
  manifest: "/crew/manifest.json",
  icons: {
    apple: "/icons/apple-touch-icon-crew.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "미팍Ticket",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#1428A0",
};

export default function CrewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="crew-app">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@700;800;900&family=Noto+Sans+KR:wght@400;500;600;700;800&display=swap');
        
        .crew-app {
          min-height: 100dvh;
          min-height: 100vh;
          background: #F8FAFC;
          font-family: 'Noto Sans KR', -apple-system, BlinkMacSystemFont, sans-serif;
          -webkit-font-smoothing: antialiased;
        }
        
        /* 기본 색상 변수 */
        :root {
          --crew-navy: #1428A0;
          --crew-gold: #F5B731;
          --crew-dark: #1A1D2B;
          --crew-success: #16A34A;
          --crew-warning: #EA580C;
          --crew-error: #DC2626;
          --crew-gray: #64748B;
          --crew-light: #F8FAFC;
          --crew-border: #E2E8F0;
        }
        
        /* Safe area 지원 */
        .crew-safe-top {
          padding-top: env(safe-area-inset-top, 0);
        }
        .crew-safe-bottom {
          padding-bottom: env(safe-area-inset-bottom, 0);
        }
      `}</style>
      <CrewToastProvider>
        {children}
      </CrewToastProvider>
    </div>
  );
}
