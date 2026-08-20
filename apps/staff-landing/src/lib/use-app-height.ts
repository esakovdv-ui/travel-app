'use client'

import { useEffect } from 'react'

/**
 * Высота оболочки приложения.
 *
 * Портал — полноэкранное приложение с внутренним скроллом: `.toursPage`
 * занимает высоту вьюпорта, а кнопки и шторки позиционируются от неё.
 *
 * Внутри iframe вьюпорт равен высоте самого фрейма, а родитель растягивает
 * фрейм под контент (на боевой врезке замерено 2400px против 812px экрана).
 * Плюс над фреймом стоит шапка родителя, поэтому на экране видна только
 * часть фрейма — и низ оболочки вместе с кнопками уезжал под кромку.
 *
 * Меряем ровно то, что видно. IntersectionObserver с `root: null` внутри
 * кросс-доменного фрейма отчитывается относительно вьюпорта верхнего окна —
 * это единственный способ узнать видимую область, не имея доступа к родителю.
 *
 * Вне фрейма ничего не делаем: там 100dvh и так верен.
 */
export function useAppHeight(): void {
  useEffect(() => {
    if (typeof window === 'undefined') return

    let framed = false
    try { framed = window.self !== window.top } catch { framed = true } // кросс-домен

    const root = document.documentElement
    if (!framed) {
      root.style.removeProperty('--app-height')
      root.style.removeProperty('--app-offset')
      return
    }

    // Зонд во всю высоту документа: его пересечение с экраном и есть
    // видимая часть фрейма.
    const probe = document.createElement('div')
    probe.setAttribute('aria-hidden', 'true')
    probe.style.cssText =
      'position:absolute;top:0;left:0;width:1px;height:100%;' +
      'pointer-events:none;visibility:hidden;z-index:-1'
    document.body.appendChild(probe)

    const apply = (entry: IntersectionObserverEntry) => {
      const visible = Math.round(entry.intersectionRect.height)
      // Насколько верх видимой области ушёл от верха фрейма — при прокрутке
      // родителя оболочку надо сдвинуть на столько же, иначе она уползёт.
      const offset = Math.round(entry.intersectionRect.top - entry.boundingClientRect.top)

      // Слишком маленький кусок — фрейм почти ушёл с экрана, дёргать нечего.
      if (visible < 200) return

      root.style.setProperty('--app-height', `${visible}px`)
      root.style.setProperty('--app-offset', `${Math.max(0, offset)}px`)
    }

    // Частые пороги: наблюдатель срабатывает на пересечении каждого из них,
    // поэтому при прокрутке родителя высота пересчитывается плавно.
    const thresholds = Array.from({ length: 101 }, (_, i) => i / 100)
    const io = new IntersectionObserver(entries => apply(entries[entries.length - 1]), { threshold: thresholds })
    io.observe(probe)

    const onResize = () => {
      // Смена ориентации меняет и высоту фрейма, и видимую часть.
      io.unobserve(probe)
      io.observe(probe)
    }
    window.addEventListener('resize', onResize)
    window.addEventListener('orientationchange', onResize)

    return () => {
      io.disconnect()
      window.removeEventListener('resize', onResize)
      window.removeEventListener('orientationchange', onResize)
      probe.remove()
      root.style.removeProperty('--app-height')
      root.style.removeProperty('--app-offset')
    }
  }, [])
}
