import { useEffect, useMemo, useState } from 'react';
import { DoorOpen } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import RoomChatWindow from '../components/Rooms/RoomChatWindow';
import RoomConsensusPanel from '../components/Rooms/RoomConsensusPanel';
import RoomHeader from '../components/Rooms/RoomHeader';
import RoomJoinModal from '../components/Rooms/RoomJoinModal';
import RoomList from '../components/Rooms/RoomList';
import RoomNotifications from '../components/Rooms/RoomNotifications';
import State from '../components/Shared/State';
import { RoomApiError, createRoom as apiCreateRoom, joinRoom as apiJoinRoom } from '../services/rooms/client';
import { listenRoomData, listenRooms } from '../services/rooms/listeners';
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
  const setRooms = useRoomStore((s) => s.setRooms);
  const setActiveRoom = useRoomStore((s) => s.setActiveRoom);
  const setMembers = useRoomStore((s) => s.setMembers);
  const setEntries = useRoomStore((s) => s.setEntries);
  const setClusters = useRoomStore((s) => s.setClusters);
  const setNotifications = useRoomStore((s) => s.setNotifications);
  const markNotificationRead = useRoomStore((s) => s.markNotificationRead);
  const clearRoomData = useRoomStore((s) => s.clearRoomData);
  const setError = useRoomStore((s) => s.setError);
  const [joinOpen, setJoinOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const activeRoom = useMemo(
    () => rooms.find((room) => room.id === activeRoomId) ?? null,
    [activeRoomId, rooms],
  );

  useEffect(() => {
    if (!user) return;
    return listenRooms(
      user.uid,
      (nextRooms) => setRooms(nextRooms),
      (error) => setError(error.message),
    );
  }, [setError, setRooms, user]);

  useEffect(() => {
    if (!user || !activeRoomId) {
      clearRoomData();
      return;
    }
    return listenRoomData(activeRoomId, user.uid, {
      onRoom: (room) => {
        if (!room) return;
        const current = useRoomStore.getState().rooms.filter((item) => item.id !== room.id);
        useRoomStore.getState().setRooms([room, ...current]);
      },
      onMembers: setMembers,
      onEntries: setEntries,
      onClusters: setClusters,
      onNotifications: setNotifications,
      onError: (error) => setError(error.message),
    });
  }, [
    activeRoomId,
    clearRoomData,
    setClusters,
    setEntries,
    setError,
    setMembers,
    setNotifications,
    user,
  ]);

  const handleCreate = async (title: string) => {
    setBusy(true);
    try {
      const result = await apiCreateRoom(title);
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
          onOpenJoin={() => setJoinOpen(true)}
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
              action={{ label: t('list.openJoin'), onClick: () => setJoinOpen(true) }}
            />
          </div>
        ) : (
          <>
            <RoomHeader room={{ ...activeRoom, memberCount: members.length || activeRoom.memberCount }} />
            <div className="rooms-workspace">
              <section className="rooms-chat-panel">
                <RoomChatWindow key={activeRoom.id} room={activeRoom} />
              </section>
              <aside className="rooms-consensus-panel">
                <RoomNotifications notifications={notifications} onRead={markNotificationRead} />
                <RoomConsensusPanel clusters={clusters} entries={entries} />
              </aside>
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
