import { useEffect, useState } from 'react';

export default function TypingText({ text }) {
  const [rendered, setRendered] = useState('');

  useEffect(() => {
    setRendered('');
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setRendered(text.slice(0, i));
      if (i >= text.length) clearInterval(id);
    }, 10);
    return () => clearInterval(id);
  }, [text]);

  return <p className="whitespace-pre-wrap">{rendered}</p>;
}
