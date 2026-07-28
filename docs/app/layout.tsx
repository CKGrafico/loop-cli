import type { Metadata } from 'next'
import { Geist_Mono, Outfit } from 'next/font/google'
import { RootProvider } from 'fumadocs-ui/provider'
import { siteDescription, siteName, siteUrl } from '@/lib/site'
import './global.css'

/* Outfit is the Platform Foundations typeface; it feeds --font-sans, which the
   ui-theme base layer applies to <body>. Mono stays Geist for terminal output. */
const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-sans',
})

const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
})

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  // A template, so every docs page gets "Page · loop-task" without repeating itself.
  title: {
    default: `${siteName}: run anything on a cadence`,
    template: `%s · ${siteName}`,
  },
  description: siteDescription,
  applicationName: siteName,
  openGraph: {
    type: 'website',
    siteName,
    title: `${siteName}: run anything on a cadence`,
    description: siteDescription,
    url: siteUrl,
  },
  twitter: {
    card: 'summary_large_image',
    title: `${siteName}: run anything on a cadence`,
    description: siteDescription,
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="en"
      className={`${outfit.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <body className="font-sans antialiased">
        <RootProvider
          theme={{
            enabled: true,
            defaultTheme: 'system',
          }}
        >
          {children}
        </RootProvider>
      </body>
    </html>
  )
}
