import React from 'react';
import { AppView } from '../types';

interface MobileBottomNavProps {
  currentView: AppView;
  onNavigate: (view: AppView) => void;
}

interface NavItem {
  view: AppView;
  icon: React.ReactNode;
  isCenter?: boolean;
  onClick?: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  currentView,
  onNavigate
}) => {
  const navItems: NavItem[] = [
    {
      view: AppView.TODAY,
      icon: (
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
          <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"></path>
        </svg>
      )
    },
    {
      view: AppView.ANALYTICS,
      icon: (
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
          <path d="M10,2C9.4,2,9,2.4,9,3c0,0,0,0,0,0v18c0,0.6,0.4,1,1,1s1-0.4,1-1V3C11,2.4,10.6,2,10,2C10,2,10,2,10,2z M5,12c-0.6,0-1,0.4-1,1c0,0,0,0,0,0v8c0,0.6,0.4,1,1,1s1-0.4,1-1v-8C6,12.4,5.6,12,5,12C5,12,5,12,5,12z M15,8c-0.6,0-1,0.4-1,1c0,0,0,0,0,0v12c0,0.6,0.4,1,1,1s1-0.4,1-1V9C16,8.4,15.6,8,15,8C15,8,15,8,15,8z M20,16c-0.6,0-1,0.4-1,1c0,0,0,0,0,0v4c0,0.6,0.4,1,1,1s1-0.4,1-1v-4C21,16.4,20.6,16,20,16C20,16,20,16,20,16z" />
        </svg>
      )
    },
    {
      view: AppView.PLANNER,
      icon: (
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24" version="1.1" id="XMLID_124_" xmlns="http://www.w3.org/2000/svg" xmlSpace="preserve">
          <g id="plan">
            <g>
              <path d="M24,24H0V3h5V0h2v3h10V0h2v3h5V24z M2,22h20V5H2v3h20v2H2V22z M19,19H9v-2h10V19z M7,19H5v-2h2V19z M19,15H9v-2h10V15z
                M7,15H5v-2h2V15z"/>
            </g>
          </g>
        </svg>
      )
    },
    {
      view: AppView.RECIPES,
      icon: (
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
          <path d="M7 4.5c-.3 0-.5.3-.5.5v2.5h-1V5c0-.3-.2-.5-.5-.5s-.5.3-.5.5v2.5h-1V5c0-.3-.2-.5-.5-.5s-.5.3-.5.5v3.3c0 .9.7 1.6 1.5 1.7v7c0 .6.4 1 1 1s1-.4 1-1v-7c.8-.1 1.5-.8 1.5-1.7V5c0-.2-.2-.5-.5-.5zM9 5v6h1v6c0 .6.4 1 1 1s1-.4 1-1V2c-1.7 0-3 1.3-3 3zm7-1c-1.4 0-2.5 1.5-2.5 3.3-.1 1.2.5 2.3 1.5 3V17c0 .6.4 1 1 1s1-.4 1-1v-6.7c1-.7 1.6-1.8 1.5-3C18.5 5.5 17.4 4 16 4z" />
        </svg>
      )
    },
    {
      view: AppView.SHOPPING,
      icon: (
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 76 76">
          <path d="M 28.5,60L 22,55.25L 22,25L 27,25L 26.9167,22.1667C 26.9167,17.7944 30.4611,14.25 34.8333,14.25C 38.1014,14.25 40.907,16.2303 42.1156,19.0563C 46.0405,19.5251 49,22.6989 49,26.75L 49,29L 50.75,30L 54,30L 54,60L 28.5,60 Z M 25.3333,32.0625L 27.9583,30.4271L 27.9583,57.25L 28.5,57.7917L 28.5,30.0834L 33,30L 33,27L 24,27L 25.3333,32.0625 Z M 36,27L 36,30L 46,30L 46,28.75L 44,27L 36,27 Z M 43,25L 45.5,25C 45.023,23.6504 44.3496,22.977 43,22.5L 43,25 Z M 30.0833,22.1667L 30,25L 33.25,25C 33.8179,22.2022 36.0197,20.2735 38.6911,19.3948C 37.8287,18.1968 36.4221,17.4167 34.8333,17.4167C 32.21,17.4167 30.0833,19.5433 30.0833,22.1667 Z M 39.75,25L 39.75,22.5C 38.4003,22.977 37.477,23.6503 37,25L 39.75,25 Z " />
        </svg>
      )
    }
  ];

  return (
    <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-md glass-card rounded-3xl p-3 flex justify-around items-center z-50 transition-all duration-300">
      {navItems.map((item) => {
        if (item.isCenter) {
          return (
            <button
              key={`center-${item.view}`}
              onClick={item.onClick || (() => onNavigate(item.view))}
              className="w-14 h-14 bg-hearth rounded-full flex items-center justify-center text-white shadow-lg shadow-hearth/30 -mt-12 border-4 border-stone transition-transform active:scale-95"
            >
              {item.icon}
            </button>
          );
        }
        return (
          <button
            key={item.view}
            onClick={() => onNavigate(item.view)}
            className={`p-4 transition-colors ${currentView === item.view ? 'text-hearth' : 'text-charcoal/30 hover:text-charcoal/60'
              }`}
          >
            {item.icon}
          </button>
        );
      })}
    </nav>
  );
};
