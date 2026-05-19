import { lazy, Suspense } from 'react';

const MarkdownRendererImpl = lazy(() => import('./MarkdownRendererImpl'));

interface MarkdownRendererProps {
  children: string;
  highlight?: boolean;
}

export default function MarkdownRenderer({
  children,
  highlight = true,
}: MarkdownRendererProps) {
  return (
    <Suspense fallback={<span style={{ whiteSpace: 'pre-wrap' }}>{children}</span>}>
      <MarkdownRendererImpl highlight={highlight}>{children}</MarkdownRendererImpl>
    </Suspense>
  );
}
