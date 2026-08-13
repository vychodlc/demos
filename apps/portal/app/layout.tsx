import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Vychod / Demos',
  description: 'Vychod 的公开产品、工具与实验。',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
