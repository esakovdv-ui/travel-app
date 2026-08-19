'use client'

import { useEffect } from 'react'

/**
 * Сообщает странице-родителю высоту документа через postMessage.
 *
 * У iframe на online.mosgortur.ru не задана CSS-высота, поэтому он рендерится
 * с высотой 0 и контент не виден. Отправляем { type: 'staff-resize', height }
 * при каждом изменении размера документа — raduga-parent-bridge.js на родителе
 * перехватывает это и выставляет iframe.style.height.
 *
 * Работает только внутри iframe: вне фрейма postMessage к top не отправляется.
 */
export function useFrameResize(): void {
  useEffect(() => {
    if (typeof window === 'undefined') return

    let framed = false
    try { framed = window.self !== window.top } catch { framed = true }
    if (!framed) return

    function sendHeight() {
      const height = document.documentElement.scrollHeight
      try {
        window.parent.postMessage({ type: 'staff-resize', height }, '*')
      } catch {
        // кросс-домен postMessage с '*' всегда разрешён, но на всякий случай
      }
    }

    sendHeight()

    const ro = new ResizeObserver(sendHeight)
    ro.observe(document.documentElement)

    window.addEventListener('resize', sendHeight)

    return () => {
      ro.disconnect()
      window.removeEventListener('resize', sendHeight)
    }
  }, [])
}
