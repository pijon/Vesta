import React from 'react';

const INLINE = /(\*\*[^*]+\*\*|__[^_]+__|\*[^*\s][^*]*\*|_[^_\s][^_]*_|`[^`]+`)/g;

/** Inline markdown for recipe text: **bold**, *italic* and `code`. Everything else is shown as written. */
export const MarkdownText: React.FC<{ text: string }> = ({ text }) => (
  <>
    {text.split(INLINE).map((part, i) => {
      if (i % 2 === 0) return part;
      if (part.startsWith('**') || part.startsWith('__')) return <strong key={i}>{part.slice(2, -2)}</strong>;
      if (part.startsWith('`')) return <code key={i}>{part.slice(1, -1)}</code>;
      return <em key={i}>{part.slice(1, -1)}</em>;
    })}
  </>
);
