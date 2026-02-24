// @ts-nocheck
"use client";

import { usePathname, useRouter } from "next/navigation";

interface NavItem {
  id: string;
  label: string;
  icon: string;
  activeIcon: string;
  path: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: "home", label: "홈", icon: "🏠", activeIcon: "🏠", path: "/crew" },
  { id: "parking", label: "현황", icon: "🚗", activeIcon: "🚗", path: "/crew/parking-list" },
  { id: "attendance", label: "출퇴근", icon: "⏰", activeIcon: "⏰", path: "/crew/attendance" },
  { id: "settings", label: "설정", icon: "⚙️", activeIcon: "⚙️", path: "/crew/settings" },
];

export default function CrewBottomNav() {
  const pathname = usePathname();
  const router = useRouter();

  const isActive = (path: string) => {
    if (path === "/crew") {
      return pathname === "/crew";
    }
    return pathname.startsWith(path);
  };

  return (
    <>
      <style>{`
        .crew-bottom-nav {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          height: 64px;
          background: #fff;
          border-top: 1px solid #E2E8F0;
          display: flex;
          align-items: stretch;
          padding-bottom: env(safe-area-inset-bottom, 0);
          z-index: 100;
        }
        
        .crew-nav-item {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 4px;
          cursor: pointer;
          background: none;
          border: none;
          padding: 0;
          transition: all 0.15s;
        }
        
        .crew-nav-item:active {
          opacity: 0.7;
        }
        
        .crew-nav-icon {
          font-size: 22px;
          line-height: 1;
        }
        
        .crew-nav-label {
          font-size: 11px;
          font-weight: 500;
          color: #94A3B8;
        }
        
        .crew-nav-item.active .crew-nav-label {
          color: #1428A0;
          font-weight: 600;
        }
        
        /* 홈 화면에서 네비 바 공간 확보 */
        .crew-nav-spacer {
          height: calc(64px + env(safe-area-inset-bottom, 0));
        }
      `}</style>

      <nav className="crew-bottom-nav">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.path);
          return (
            <button
              key={item.id}
              className={`crew-nav-item ${active ? "active" : ""}`}
              onClick={() => router.push(item.path)}
            >
              <span className="crew-nav-icon">
                {active ? item.activeIcon : item.icon}
              </span>
              <span className="crew-nav-label">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
}

// 하단 네비 공간 확보용 스페이서
export function CrewNavSpacer() {
  return <div className="crew-nav-spacer" />;
}
