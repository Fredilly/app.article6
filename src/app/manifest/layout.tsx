import { Suspense } from 'react';

export default function ManifestLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={null}>{children}</Suspense>;
}
