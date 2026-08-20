import type { Metadata, Viewport } from 'next'
import { Manrope, Unbounded } from 'next/font/google'
import { YandexMetrika } from '@/components/YandexMetrika'
import './globals.css'

/**
 * Safari на iOS не даёт iframe внутренний скролл: он растягивает фрейм под
 * высоту контента (замерено 2400px против 812px экрана). Из-за этого 100dvh
 * внутри фрейма равен не экрану, а всему фрейму, и центрированная по вертикали
 * форма входа уезжала на ~1200px вниз — на экране оставалась пустота.
 *
 * Ставим метку синхронно, до разбора body: иначе первая отрисовка успеет
 * пройти по «неврезанным» правилам и форма мигнёт.
 */
const MARK_FRAMED =
  "try{if(window.self!==window.top)document.documentElement.dataset.framed='1'}" +
  "catch(e){document.documentElement.dataset.framed='1'}"

const manrope = Manrope({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-manrope',
  display: 'swap',
})

const unbounded = Unbounded({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-unbounded',
  display: 'swap',
})

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export const metadata: Metadata = {
  title: 'Туры для сотрудников | МОИ ПУТЕШЕСТВИЯ',
  description: 'Специальные условия бронирования туров для сотрудников',
  robots: 'noindex, nofollow',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body className={`${manrope.variable} ${unbounded.variable}`}>
        <script dangerouslySetInnerHTML={{ __html: MARK_FRAMED }} />
        {children}
        <YandexMetrika />
      </body>
    </html>
  )
}
