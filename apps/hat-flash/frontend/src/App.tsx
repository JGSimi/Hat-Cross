import { useEffect } from 'react';
import { Events, WML } from '@wailsio/runtime';
import { Flash } from './pages/Flash';
import { Main } from './pages/Main';
import { useHatStore } from './stores/hatStore';
import './styles.css';

export default function App() {
  const addStreamChunk = useHatStore((s) => s.addStreamChunk);
  const setFlashPayload = useHatStore((s) => s.setFlashPayload);
  const loadSettings = useHatStore((s) => s.loadSettings);

  useEffect(() => {
    loadSettings();
    Events.On('stream:chunk', (event) => addStreamChunk(event.data));
    Events.On('flash:show', (event) => setFlashPayload(event.data));
    WML.Reload();
  }, [addStreamChunk, loadSettings, setFlashPayload]);

  const path = window.location.pathname;
  if (path === '/flash') return <Flash />;
  return <Main />;
}
