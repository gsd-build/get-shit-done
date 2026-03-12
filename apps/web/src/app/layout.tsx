import type { Metadata } from 'next';
import { ThemeProvider } from 'next-themes';
import { AuthGuard } from '@/components/AuthGuard';
import './globals.css';

export const metadata: Metadata = {
  title: 'GSD Dashboard',
  description: 'Get Shit Done - Project Management Dashboard',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <AuthGuard>{children}</AuthGuard>
        </ThemeProvider>
      </body>
    </html>
  );
}
