import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';

interface MarkdownRendererImplProps {
  children: string;
  highlight?: boolean;
}

export default function MarkdownRendererImpl({
  children,
  highlight = true,
}: MarkdownRendererImplProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={highlight ? [rehypeHighlight] : undefined}
    >
      {children}
    </ReactMarkdown>
  );
}
