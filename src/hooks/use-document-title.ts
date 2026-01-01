'use client';

import { useEffect } from 'react';

export const useDocumentTitle = (title: string, suffix: string = 'Proddy') => {
  useEffect(() => {
    document.title = title ? `${title} | ${suffix}` : suffix;

    return () => {
      document.title = suffix;
    };
  }, [title, suffix]);
};
