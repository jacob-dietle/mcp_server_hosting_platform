import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as SonnerToaster } from '@/components/ui/sonner';
import { Analytics } from '@vercel/analytics/next';
import { Providers } from './providers';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'MCPGTM - Orchestrate Your Entire GTM Stack at the Speed of Thought',
  description: 'Built for Elite Agencies. Stop juggling tools. Start orchestrating your GTM',
  icons: {
    icon: '/orange_icon.svg',
    apple: '/orange_icon.svg',
  },
  openGraph: {
    images: ['/orange_icon.svg'],
  },
};

// Custom font style
const customFontStyle = `
  @font-face {
    font-family: 'VCR OSD Mono';
    src: url('/VCR_OSD_MONO_1.001.ttf') format('truetype');
    font-weight: normal;
    font-style: normal;
    font-display: swap;
  }
`;

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <style dangerouslySetInnerHTML={{ __html: customFontStyle }} />
      </head>
      <body className={inter.className}>
        <Providers>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            {children}
            <Toaster />
            <SonnerToaster />
          </ThemeProvider>
        </Providers>
        <Analytics />
      </body>
    </html>
  );
}