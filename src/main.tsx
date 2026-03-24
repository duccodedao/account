import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Anti-inspect features
if (process.env.NODE_ENV === 'production') {
  document.addEventListener('contextmenu', (e) => e.preventDefault());
  
  document.addEventListener('keydown', (e) => {
    if (
      e.key === 'F12' ||
      (e.ctrlKey && e.shiftKey && e.key === 'I') ||
      (e.ctrlKey && e.shiftKey && e.key === 'J') ||
      (e.ctrlKey && e.key === 'U')
    ) {
      e.preventDefault();
    }
  });

  // Basic DevTools detection
  let devtoolsOpen = false;
  const threshold = 160;
  setInterval(() => {
    const widthThreshold = window.outerWidth - window.innerWidth > threshold;
    const heightThreshold = window.outerHeight - window.innerHeight > threshold;
    if (widthThreshold || heightThreshold) {
      if (!devtoolsOpen) {
        console.log('%cSecurity Alert: DevTools Detected', 'color: red; font-size: 20px; font-weight: bold;');
      }
      devtoolsOpen = true;
    } else {
      devtoolsOpen = false;
    }
  }, 1000);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
