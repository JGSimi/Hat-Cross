import { memo, useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { MessageCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useConversationStore } from '../../stores/conversationStore';
import { formatTimestamp, truncate } from '../../utils/markdown';

const MAX = 3;

/**
 * Returning-user greeting: shows the 3 most recently updated conversations
 * below the SuggestionGrid on the empty-chat home. Only renders when there
 * is at least one conversation. Hidden in popover (via EmptyState's
 * `compact` prop, same gate as SuggestionGrid) because the popover is
 * stealth-focused and chat history has no business there.
 *
 * Click picks the conversation (setActiveConversation) — MainLayout's
 * existing useEffect picks the change up and calls loadFromConversation.
 */
function RecentConversations() {
  const { t } = useTranslation('chat');
  const conversations = useConversationStore((s) => s.conversations);
  const setActiveConversation = useConversationStore(
    (s) => s.setActiveConversation,
  );
  const reduced = useReducedMotion();

  const recent = useMemo(
    () =>
      [...conversations]
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, MAX),
    [conversations],
  );

  if (recent.length === 0) return null;

  return (
    <div
      role="group"
      aria-label={t('recents.label', { defaultValue: 'Conversas recentes' })}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        width: '100%',
        maxWidth: 520,
        margin: '8px auto 0',
      }}
    >
      <div
        style={{
          fontSize: 10.5,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: 0.7,
          color: 'var(--text-muted)',
          margin: '0 4px 2px',
        }}
      >
        {t('recents.heading', { defaultValue: 'Recentes' })}
      </div>
      {recent.map((conv, i) => {
        // Find the last non-system message for the preview. Fall back to
        // the first message if we only have a system notice.
        const previewSource =
          [...conv.messages].reverse().find(
            (m) =>
              !(
                !m.isUser &&
                m.content.startsWith('**Nova conversa criada automaticamente')
              ),
          ) ?? conv.messages[0];
        const previewText = previewSource
          ? truncate(previewSource.content.replace(/\s+/g, ' ').trim(), 72)
          : t('recents.empty', { defaultValue: 'Sem mensagens' });

        return (
          <motion.button
            type="button"
            key={conv.id}
            onClick={() => setActiveConversation(conv.id)}
            initial={
              reduced ? { opacity: 0 } : { opacity: 0, y: 6 }
            }
            animate={{ opacity: 1, y: 0 }}
            transition={{
              delay: 0.7 + i * 0.05,
              type: 'spring',
              stiffness: 280,
              damping: 24,
            }}
            whileHover={reduced ? undefined : { x: 2 }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 12px',
              borderRadius: 10,
              background: 'transparent',
              border: '0.5px solid var(--border-subtle)',
              cursor: 'pointer',
              textAlign: 'left',
              fontFamily: 'inherit',
              transition: 'background 0.15s ease, border-color 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background =
                'color-mix(in srgb, var(--color-accent) 6%, transparent)';
              e.currentTarget.style.borderColor =
                'color-mix(in srgb, var(--color-accent) 25%, transparent)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.borderColor = 'var(--border-subtle)';
            }}
          >
            <span
              aria-hidden
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 22,
                height: 22,
                borderRadius: 6,
                background: 'color-mix(in srgb, var(--color-accent) 10%, transparent)',
                color: 'var(--color-accent)',
                flexShrink: 0,
              }}
            >
              <MessageCircle size={12} strokeWidth={1.85} />
            </span>
            <span
              style={{
                flex: 1,
                minWidth: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
              }}
            >
              <span
                style={{
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {conv.title}
              </span>
              <span
                style={{
                  fontSize: 11,
                  color: 'var(--text-muted)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {previewText}
              </span>
            </span>
            <span
              style={{
                fontSize: 10.5,
                color: 'var(--text-muted)',
                flexShrink: 0,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {formatTimestamp(conv.updatedAt)}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}

export default memo(RecentConversations);
