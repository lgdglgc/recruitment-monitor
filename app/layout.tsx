import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '招聘信息监控推送系统 - 管理后台',
  description: '轻量级招聘信息自动抓取、关键词过滤与微信推送管理面板',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
