import { useMemo, useState } from 'react';
import { DoorOpen } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import RoomConsensusPanel from '../components/Rooms/RoomConsensusPanel';
import RoomFeedPanel from '../components/Rooms/RoomFeedPanel';
import RoomHeader from '../components/Rooms/RoomHeader';
import RoomJoinModal from '../components/Rooms/RoomJoinModal';
import RoomList from '../components/Rooms/RoomList';
import RoomNotifications from '../components/Rooms/RoomNotifications';
import State from '../components/Shared/State';
import {
  RoomApiError,
  createRoom as apiCreateRoom,
  joinRoom as apiJoinRoom,
  leaveRoom as apiLeaveRoom,
} from '../services/rooms/client';
import { useAuthStore } from '../stores/authStore';
import { useCreditsStore } from '../stores/creditsStore';
import { useRoomStore } from '../stores/roomStore';
import { useToastStore } from '../stores/toastStore';

export default function RoomsPage() {
  const { t } = useTranslation('rooms');
  const user = useAuthStore((s) => s.user);
  const credits = useCreditsStore((s) => s.credits);
  const rooms = useRoomStore((s) => s.rooms);
  const activeRoomId = useRoomStore((s) => s.activeRoomId);
  const members = useRoomStore((s) => s.members);
  const entries = useRoomStore((s) => s.entries);
  const clusters = useRoomStore((s) => s.clusters);
  const notifications = useRoomStore((s) => s.notifications);
  const setActiveRoom = useRoomStore((s) => s.setActiveRoom);
  const markNotificationRead = useRoomStore((s) => s.markNotificationRead);
  const clearRoomData = useRoomStore((s) => s.clearRoomData);
  const [joinOpen, setJoinOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const activeRoom = useMemo(
    () => rooms.find((room) => room.id === activeRoomId) ?? null,
    [activeRoomId, rooms],
  );
  const visibleMemberCount = members.length || activeRoom?.memberCount || 0;
  const openJoin = () => {
    if (activeRoom) {
      useToastStore.getState().showToast(t('toast.errors.activeRoom'), 'error');
      return;
    }
    setJoinOpen(true);
  };

  const handleCreate = async (title: string) => {
    setBusy(true);
    try {
      const result = await apiCreateRoom(title.trim());
      setActiveRoom(result.roomId);
      setJoinOpen(false);
      useToastStore.getState().showToast(t('toast.created'), 'success');
    } catch (err) {
      useToastStore.getState().showToast(roomErrorMessage(err, t), 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleJoin = async (roomId: string) => {
    setBusy(true);
    try {
      const result = await apiJoinRoom(roomId);
      setActiveRoom(result.roomId);
      setJoinOpen(false);
      useToastStore.getState().showToast(
        result.charged ? t('toast.joinedCharged') : t('toast.joinedAgain'),
        'success',
      );
    } catch (err) {
      useToastStore.getState().showToast(roomErrorMessage(err, t), 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleLeave = async () => {
    if (!activeRoom) return;
    setBusy(true);
    try {
      await apiLeaveRoom(activeRoom.id);
      setActiveRoom(null);
      clearRoomData();
      useToastStore.getState().showToast(t('toast.left'), 'success');
    } catch (err) {
      useToastStore.getState().showToast(roomErrorMessage(err, t), 'error');
    } finally {
      setBusy(false);
    }
  };

  if (!user) {
    return (
      <div style={{ height: '100%', display: 'grid', placeItems: 'center', padding: 24 }}>
        <State
          variant="empty"
          icon={<DoorOpen size={22} />}
          title={t('signedOut.title')}
          body={t('signedOut.body')}
        />
      </div>
    );
  }

  return (
    <div className="rooms-page">
      <RoomJoinModal
        open={joinOpen}
        credits={credits}
        busy={busy}
        onClose={() => setJoinOpen(false)}
        onCreate={handleCreate}
        onJoin={handleJoin}
      />

      <aside className="rooms-list-pane">
        <div style={{ marginBottom: 12 }}>
          <h1 style={{ margin: 0, color: 'var(--text-strong)', fontSize: 18 }}>{t('title')}</h1>
          <p style={{ margin: '5px 0 0', color: 'var(--text-muted)', fontSize: 12 }}>
            {t('subtitle')}
          </p>
        </div>
        <RoomList
          rooms={rooms}
          activeRoomId={activeRoomId}
          onSelect={setActiveRoom}
          onOpenJoin={openJoin}
          joinDisabled={Boolean(activeRoom)}
        />
      </aside>

      <main className="rooms-main-pane">
        {!activeRoom ? (
          <div style={{ height: '100%', display: 'grid', placeItems: 'center', padding: 24 }}>
            <State
              variant="empty"
              icon={<DoorOpen size={22} />}
              title={t('emptyActive.title')}
              body={t('emptyActive.body')}
              action={{ label: t('list.openJoin'), onClick: openJoin }}
            />
          </div>
        ) : (
          <>
            <RoomHeader
              room={{ ...activeRoom, memberCount: visibleMemberCount }}
              leaving={busy}
              onLeave={handleLeave}
            />
            <div className="rooms-workspace">
              <RoomFeedPanel entries={entries} />
              <section className="rooms-consensus-panel rooms-consensus-panel--wide">
                <RoomNotifications notifications={notifications} onRead={markNotificationRead} />
                <RoomConsensusPanel clusters={clusters} entries={entries} />
              </section>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function roomErrorMessage(error: unknown, t: TFunction<'rooms'>): string {
  if (error instanceof RoomApiError) return t(`toast.errors.${error.code}`);
  return t('toast.errors.generic');
}
