'use client';

import PageClient from "@/components/page-client";
import { Suspense } from 'react';

export default function Home() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <PageClient />
    </Suspense>
  );
}
