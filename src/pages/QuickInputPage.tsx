import { useEffect } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import QuickInputPanel from '../components/QuickInput/QuickInputPanel';

export default function QuickInputPage() {
  // Close on blur only — the panel itself handles Escape
  useEffect(() => {
    const appWindow = getCurrentWindow();
    const unlisten = appWindow.onFocusChanged(({ payload: focused }) => {
      if (!focused) {
        // Small delay to avoid closing during interactions
        setTimeout(() => {
          appWindow.isVisible().then((visible) => {
            if (visible) appWindow.hide();
          });
        }, 150);
      }
    });
    return () => { unlisten.then((fn) => fn()); };
  }, []);

  return (
    <div style={{
      width: '100vw', height: '100vh',
      overflow: 'hidden', background: '#0e0e12',
    }}>
      <QuickInputPanel />
    </div>
  );
}
