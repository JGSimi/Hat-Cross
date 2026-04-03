import { useEffect } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import QuickInputPanel from '../components/QuickInput/QuickInputPanel';

export default function QuickInputPage() {
  useEffect(() => {
    const appWindow = getCurrentWindow();
    const unlisten = appWindow.onFocusChanged(({ payload: focused }) => {
      if (!focused) {
        appWindow.hide();
      }
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        background: 'transparent',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <QuickInputPanel />
    </div>
  );
}
