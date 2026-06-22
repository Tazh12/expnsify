import React, { useEffect, useRef, useState } from 'react';
import { Text, TextStyle } from 'react-native';

interface Props {
  value: number;
  duration?: number;
  decimals?: number;
  prefix?: string;
  style?: TextStyle;
}

export function AnimatedNumber({ value, duration = 900, decimals = 2, prefix = '', style }: Props) {
  const [n, setN] = useState(0);
  const fromRef = useRef(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const from = fromRef.current;
    const to = value;
    const start = performance.now();

    const step = (t: number) => {
      const k = Math.min(1, (t - start) / duration);
      const e = 1 - Math.pow(1 - k, 3);
      setN(from + (to - from) * e);
      if (k < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        fromRef.current = to;
      }
    };
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value, duration]);

  const s = n.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return <Text style={style}>{prefix}{s}</Text>;
}
