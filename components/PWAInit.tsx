'use client';

import { useEffect } from 'react';

export default function PWAInit() {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then((reg) => console.log('PWA Setup Completed!', reg.scope))
        .catch((err) => console.error('PWA Setup Failed!', err));
    }
  }, []);

  return null;
}