import type { Metadata } from 'next'
import { Geist_Mono, Outfit } from 'next/font/google'
import { RootProvider } from 'fumadocs-ui/provider'
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
  metadataBase: new URL('https://plainconceptsplatform.github.io/loop-task'),
  title: 'loop-task: Run anything on a cadence',
  description:
    'A command-first terminal application for running tasks on a cadence. Manage loops, tasks, and projects with keyboard-only navigation.',
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
