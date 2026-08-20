'use client'

import { useEffect, useState } from 'react'
import styles from '../page.module.css'

// Общие для / и /tours — вынесены отдельно, т.к. App Router не разрешает
// произвольные named-экспорты из файлов page.tsx (раздел 2.2 ТЗ).

/* Кнопка «Выйти» убрана намеренно.
 *
 * Токен сессии анонимный — внутри только { v, exp }, ни почты, ни
 * идентификатора. Гейт проверяет лишь, что адрес заканчивается на mos.ru;
 * пароля нет. Значит выход ничего не защищал: следующий человек вводит любой
 * рабочий адрес и заходит обратно за три секунды. На заявки в Битрикс сессия
 * не влияет (они собираются из формы), в журнал входов почта пишется один раз
 * при входе. В шапке кнопка стояла вплотную к «Войти» родительского сайта и
 * читалась как разрыв логики.
 *
 * Сам эндпоинт DELETE /api/auth оставлен — он рабочий, если выход
 * когда-нибудь понадобится вернуть.
 */

export function BrandLogo() {
  return (
    <div className={styles.brandWrap} aria-label="Мои путешествия">
      <svg
        aria-hidden="true"
        className={styles.brandIcon}
        viewBox="0 0 88 88"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle cx="42" cy="44" r="28" fill="#F5C000" />
        <g transform="rotate(-18,48,50)">
          <polygon points="48,30 66,60 30,60" fill="#FFFFFF" />
        </g>
        <g transform="rotate(-9,44,32)">
          <rect x="2" y="26" width="80" height="12" fill="#1B4FBF" />
        </g>
        <g transform="rotate(16,42,56)">
          <rect x="14" y="51" width="52" height="12" fill="#D42B2B" />
        </g>
      </svg>
      <span className={styles.brandText}>
        <span className={styles.brandTextLine}>Мои</span>
        <span className={styles.brandTextLine}>путешествия</span>
      </span>
    </div>
  )
}

/**
 * Логотип Мосгортура в шапке портала.
 *
 * Во фрейме на online.mosgortur.ru его же показывает шапка родителя прямо
 * над нами — два одинаковых логотипа подряд выглядели случайностью.
 * Поэтому во фрейме бейдж прячем, а отдельно открытый портал показывает
 * его как раньше.
 */
export function MgtBadge() {
  const [framed, setFramed] = useState(false)

  useEffect(() => {
    try { setFramed(window.self !== window.top) } catch { setFramed(true) }
  }, [])

  if (framed) return null

  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src="/mgt_logo.png"
      alt="МОСГОРТУР"
      className={styles.mgtBadgeLogo}
    />
  )
}
