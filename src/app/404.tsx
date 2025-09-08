'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

export default function NotFound() {
  const pathname = usePathname();

  useEffect(() => {
    // This logic attempts to redirect to the correct page for client-side routing on GitHub Pages.
    // It assumes that the path is meant to be handled by the client-side router.
    // GitHub Pages serves this 404.html for any path that doesn't match a file.
    const path = sessionStorage.getItem('redirectPath');
    sessionStorage.removeItem('redirectPath');
    if (path && path === window.location.pathname) {
      window.location.href = `/studio${path}`;
    }
  }, []);

  useEffect(() => {
    // When a 404 occurs, store the intended path and reload to the root with a hash.
    if (pathname) {
      sessionStorage.setItem('redirectPath', pathname);
      window.location.href = `/studio/?redirect=${encodeURIComponent(pathname)}`;
    }
  }, [pathname]);

  return (
    <div style={{ padding: '2rem', textAlign: 'center', fontFamily: 'sans-serif' }}>
      <h1>Loading...</h1>
      <p>Please wait while we redirect you.</p>
    </div>
  );
}
