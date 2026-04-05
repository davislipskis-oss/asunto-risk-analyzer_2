import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Asunnon remontti- ja riskianalyysi',
  description: 'Laske asunnon tulevat remonttiriskit, oma remonttibudjetti ja kotitalousvähennyksen vaikutus.'
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fi">
      <body>{children}</body>
    </html>
  )
}
