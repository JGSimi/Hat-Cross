import { X } from 'lucide-react';
import type { ChatAttachment } from '../../types';

interface Props {
  attachments: ChatAttachment[];
  onRemove: (id: string) => void;
}

export default function AttachmentPreview({ attachments, onRemove }: Props) {
  if (attachments.length === 0) return null;

  return (
    <div className="flex gap-2 px-3 py-2 overflow-x-auto">
      {attachments.map((att) => (
        <div key={att.id} className="relative flex-shrink-0 group">
          {att.isImage && att.data ? (
            <img
              src={`data:image/png;base64,${att.data}`}
              alt={att.name}
              className="w-11 h-11 rounded-lg object-cover border border-[var(--color-border)]"
            />
          ) : (
            <div className="w-11 h-11 rounded-lg bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] flex items-center justify-center text-xs text-[var(--color-text-secondary)]">
              📄
            </div>
          )}
          <button
            onClick={() => onRemove(att.id)}
            className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <X size={10} className="text-white" />
          </button>
        </div>
      ))}
    </div>
  );
}
