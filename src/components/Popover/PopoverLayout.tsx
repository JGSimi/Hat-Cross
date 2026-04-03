import PopoverHeader from './PopoverHeader';
import ChatWindow from '../Chat/ChatWindow';

export default function PopoverLayout() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        width: '100%',
        background: '#0e0e12',
        overflow: 'hidden',
      }}
    >
      <PopoverHeader />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <ChatWindow showScreenCapture compact />
      </div>
    </div>
  );
}
