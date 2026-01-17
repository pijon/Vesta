import React from 'react';
import { AppView } from '../types';

interface DesktopSidebarProps {
  currentView: AppView;
  onNavigate: (view: AppView) => void;
  onOpenSettings: () => void;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
}

interface NavItem {
  view: AppView;
  label: string;
  icon: React.ReactNode;
  group: 'tracking' | 'planning';
}

const navItems: NavItem[] = [
  {
    view: AppView.TODAY,
    label: 'Today',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="9"></rect>
        <rect x="14" y="3" width="7" height="5"></rect>
        <rect x="14" y="12" width="7" height="9"></rect>
        <rect x="3" y="16" width="7" height="5"></rect>
      </svg>
    ),
    group: 'tracking'
  },
  {
    view: AppView.ANALYTICS,
    label: 'Analytics',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10"></line>
        <line x1="12" y1="20" x2="12" y2="4"></line>
        <line x1="6" y1="20" x2="6" y2="14"></line>
      </svg>
    ),
    group: 'tracking'
  },
  {
    view: AppView.PLANNER,
    label: 'Planner',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
        <line x1="16" y1="2" x2="16" y2="6"></line>
        <line x1="8" y1="2" x2="8" y2="6"></line>
        <line x1="3" y1="10" x2="21" y2="10"></line>
      </svg>
    ),
    group: 'planning'
  },
  {
    view: AppView.RECIPES,
    label: 'Recipes',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
        <polyline points="14 2 14 8 20 8"></polyline>
        <line x1="16" y1="13" x2="8" y2="13"></line>
        <line x1="16" y1="17" x2="8" y2="17"></line>
        <polyline points="10 9 9 9 8 9"></polyline>
      </svg>
    ),
    group: 'planning'
  },
  {
    view: AppView.SHOPPING,
    label: 'Shopping',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="9" cy="21" r="1"></circle>
        <circle cx="20" cy="21" r="1"></circle>
        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
      </svg>
    ),
    group: 'planning'
  }
];

const DarkModeToggleButton: React.FC<{
  isDarkMode: boolean;
  onClick: () => void;
}> = ({ isDarkMode, onClick }) => {
  const [isHovered, setIsHovered] = React.useState(false);

  return (
    <button
      onClick={onClick}
      className="group w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200"
      title={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
      style={isHovered ? {
        color: 'var(--main)',
        backgroundColor: 'var(--background)'
      } : {
        color: 'var(--muted)'
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className="transition-all duration-200"
        style={isHovered ? {
          color: 'var(--icon-color-hover)'
        } : {
          color: 'var(--icon-color)'
        }}
      >
        {isDarkMode ? (
          // Sun icon for light mode
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="5"></circle>
            <line x1="12" y1="1" x2="12" y2="3"></line>
            <line x1="12" y1="21" x2="12" y2="23"></line>
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
            <line x1="1" y1="12" x2="3" y2="12"></line>
            <line x1="21" y1="12" x2="23" y2="12"></line>
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
          </svg>
        ) : (
          // Moon icon for dark mode
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
          </svg>
        )}
      </div>
      <span className="font-medium text-sm">{isDarkMode ? 'Light Mode' : 'Dark Mode'}</span>
    </button>
  );
};

const SettingsButton: React.FC<{
  active: boolean;
  onClick: () => void;
}> = ({ active, onClick }) => {
  const [isHovered, setIsHovered] = React.useState(false);

  return (
    <button
      onClick={onClick}
      className={`group w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200 ${active ? 'text-white' : ''}`}
      style={active ? {
        background: 'linear-gradient(to right, var(--primary), var(--primary-hover))'
      } : isHovered ? {
        color: 'var(--main)',
        backgroundColor: 'var(--background)'
      } : {
        color: 'var(--muted)'
      }}
      onMouseEnter={() => !active && setIsHovered(true)}
      onMouseLeave={() => !active && setIsHovered(false)}
    >
      <div
        className="transition-all duration-200"
        style={active ? {
          color: 'white'
        } : isHovered ? {
          color: 'var(--icon-color-hover)'
        } : {
          color: 'var(--icon-color)'
        }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3"></circle>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
        </svg>
      </div>
      <span className={`font-medium text-sm ${active ? 'text-white' : ''}`}>Settings</span>
    </button>
  );
};

const SidebarNavButton: React.FC<{
  item: NavItem;
  active: boolean;
  onClick: () => void;
}> = ({ item, active, onClick }) => {
  const [isHovered, setIsHovered] = React.useState(false);

  return (
    <button
      onClick={onClick}
      className={`group w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200 ${active
        ? 'text-white'
        : ''
        }`}
      style={active ? {
        background: 'linear-gradient(to right, var(--primary), var(--primary-hover))'
      } : isHovered ? {
        color: 'var(--main)',
        backgroundColor: 'var(--background)'
      } : {
        color: 'var(--muted)'
      }}
      onMouseEnter={() => !active && setIsHovered(true)}
      onMouseLeave={() => !active && setIsHovered(false)}
    >
      <div
        className="transition-all duration-200"
        style={active ? {
          color: 'white'
        } : isHovered ? {
          color: 'var(--icon-color-hover)'
        } : {
          color: 'var(--icon-color)'
        }}
      >
        {item.icon}
      </div>
      <span className={`font-medium text-sm ${active ? 'text-white' : ''}`}>
        {item.label}
      </span>
    </button>
  );
};

export const DesktopSidebar: React.FC<DesktopSidebarProps> = ({
  currentView,
  onNavigate,
  onOpenSettings,
  isDarkMode,
  onToggleDarkMode
}) => {
  const trackingItems = navItems.filter(item => item.group === 'tracking');
  const planningItems = navItems.filter(item => item.group === 'planning');

  return (
    <aside className="hidden md:flex md:flex-col md:fixed md:inset-y-0 md:left-0 md:w-60 md:border-r bg-surface border-border">
      {/* Logo */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-2 cursor-pointer group" onClick={() => onNavigate(AppView.TODAY)}>
          <img src="/resources/800logo.png" alt="Fast800 Logo" className="h-7 w-auto transition-all duration-200 group-hover:scale-105 opacity-90" />
          <h1 className="text-lg font-medium tracking-tight leading-none text-main">
            Fast<span className="font-bold text-primary">800</span>
          </h1>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-8 overflow-y-auto custom-scrollbar">
        {/* Tracking Section */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider px-3 mb-3 text-muted-light opacity-50">
            Tracking
          </p>
          <div className="space-y-1">
            {trackingItems.map(item => (
              <SidebarNavButton
                key={item.view}
                item={item}
                active={currentView === item.view}
                onClick={() => onNavigate(item.view)}
              />
            ))}
          </div>
        </div>

        {/* Planning Section */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider px-3 mb-3 text-muted-light opacity-50">
            Planning
          </p>
          <div className="space-y-1">
            {planningItems.map(item => (
              <SidebarNavButton
                key={item.view}
                item={item}
                active={currentView === item.view}
                onClick={() => onNavigate(item.view)}
              />
            ))}
          </div>
        </div>
      </nav>

      {/* Settings & Dark Mode */}
      <div className="p-4 border-t border-border space-y-1">
        {/* Dark Mode Toggle */}
        <DarkModeToggleButton isDarkMode={isDarkMode} onClick={onToggleDarkMode} />

        {/* Settings */}
        <SettingsButton active={currentView === AppView.SETTINGS} onClick={onOpenSettings} />
      </div>
    </aside>
  );
};
