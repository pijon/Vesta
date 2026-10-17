import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import { App } from './App';
// Self-hosted so the service worker precaches them: a Google Fonts <link> in <head>
// blocked the first paint (a white screen before the splash) on a cold launch.
import '@fontsource-variable/dm-sans/opsz.css';
import '@fontsource-variable/bricolage-grotesque/opsz.css';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <BrowserRouter>
      {/* framer-motion skips movement (keeping fades) when the system asks for reduced motion */}
      <MotionConfig reducedMotion="user">
        <App />
      </MotionConfig>
    </BrowserRouter>
  </React.StrictMode>
);