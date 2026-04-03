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
    <div className="w-screen h-screen overflow-hidden rounded-2xl glass">
      <QuickInputPanel />
    </div>
  );
}
