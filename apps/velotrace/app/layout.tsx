import type { Metadata } from 'next';
import '@/public/styles.css';

export const metadata: Metadata = { title: 'VELOTRACE — 让每一次骑行留下痕迹', description: '你的骑行生涯、轨迹与目标。' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
