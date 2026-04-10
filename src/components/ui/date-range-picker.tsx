'use client';
import { useState } from 'react';
import styles from './date-range-picker.module.css';

const MONTHS_RU = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
const DAYS_RU = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];

export interface DateRangeValue {
  start: string | null; // YYYY-MM-DD
  end: string | null;   // YYYY-MM-DD
  flex: 0 | 1 | 2;
}

interface Props {
  value: DateRangeValue;
  onChange: (v: DateRangeValue) => void;
  onConfirm: () => void;
}

function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function parseISO(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function addMonths(date: Date, n: number): Date {
  const d = new Date(date.getFullYear(), date.getMonth() + n, 1);
  return d;
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number) {
  const day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1; // 0=Пн
}

function nightsCount(start: string, end: string): number {
  return Math.round((parseISO(end).getTime() - parseISO(start).getTime()) / 86400000);
}

function nightsLabel(n: number): string {
  if (n === 1) return 'ночь';
  if (n >= 2 && n <= 4) return 'ночи';
  return 'ночей';
}

function formatRu(iso: string): string {
  return parseISO(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }).replace(' г.', '');
}

export function DateRangePicker({ value, onChange, onConfirm }: Props) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayISO = toISO(today);

  const [leftMonth, setLeftMonth] = useState<Date>(() => {
    const d = value.start ? parseISO(value.start) : today;
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [hoverDate, setHoverDate] = useState<string | null>(null);

  const rightMonth = addMonths(leftMonth, 1);

  function handleDayClick(iso: string) {
    if (iso < todayISO) return;
    if (!value.start || (value.start && value.end)) {
      onChange({ ...value, start: iso, end: null });
    } else if (value.start && !value.end) {
      if (iso < value.start) {
        onChange({ ...value, start: iso, end: null });
      } else if (iso === value.start) {
        onChange({ ...value, start: null, end: null });
      } else {
        onChange({ ...value, end: iso });
      }
    }
  }

  const nights = value.start && value.end ? nightsCount(value.start, value.end) : null;

  const confirmLabel = value.start && value.end
    ? `${formatRu(value.start)} – ${formatRu(value.end)}, ${nights} ${nightsLabel(nights!)}`
    : 'Выберите даты';

  function renderMonth(monthDate: Date) {
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    const daysCount = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfWeek(year, month);

    const cells: (string | null)[] = [
      ...Array(firstDay).fill(null),
      ...Array.from({ length: daysCount }, (_, i) => toISO(new Date(year, month, i + 1))),
    ];

    // pad to full weeks
    while (cells.length % 7 !== 0) cells.push(null);

    return (
      <div className={styles.month}>
        <div className={styles.monthTitle}>{MONTHS_RU[month]} {year}</div>
        <div className={styles.daysHeader}>
          {DAYS_RU.map(d => (
            <span key={d} className={styles.dayName}>{d}</span>
          ))}
        </div>
        <div className={styles.daysGrid}>
          {cells.map((iso, i) => {
            if (!iso) return <span key={`e${i}`} className={styles.dayEmpty} />;

            const isPast = iso < todayISO;
            const isStart = iso === value.start;
            const isEnd = iso === value.end;
            const effectiveEnd = value.end ?? hoverDate;
            const inRange = !!(value.start && effectiveEnd && iso > value.start && iso < effectiveEnd);
            const dayOfWeek = parseISO(iso).getDay();
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

            return (
              <button
                key={iso}
                type="button"
                disabled={isPast}
                className={[
                  styles.day,
                  isPast ? styles.dayPast : '',
                  isStart ? styles.dayStart : '',
                  isEnd ? styles.dayEnd : '',
                  !isStart && !isEnd && inRange ? styles.dayInRange : '',
                  isWeekend && !isPast && !isStart && !isEnd ? styles.dayWeekend : '',
                ].filter(Boolean).join(' ')}
                onClick={() => handleDayClick(iso)}
                onMouseEnter={() => { if (value.start && !value.end) setHoverDate(iso); }}
                onMouseLeave={() => setHoverDate(null)}
              >
                {parseISO(iso).getDate()}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.picker}>
      {/* Selected dates row */}
      <div className={styles.selectedRow}>
        <span className={styles.selectedChip}>
          {value.start ? formatRu(value.start) : 'Дата вылета'}
          {value.start && (
            <button type="button" className={styles.chipClear}
              onClick={() => onChange({ ...value, start: null, end: null })}>×</button>
          )}
        </span>
        <span className={styles.selectedArrow}>→</span>
        <span className={styles.selectedChip}>
          {value.end ? formatRu(value.end) : 'Дата возврата'}
          {value.end && (
            <button type="button" className={styles.chipClear}
              onClick={() => onChange({ ...value, end: null })}>×</button>
          )}
        </span>
      </div>

      {/* Calendars */}
      <div className={styles.calendars}>
        <button type="button" className={styles.navBtn}
          onClick={() => setLeftMonth(m => addMonths(m, -1))}>‹</button>
        {renderMonth(leftMonth)}
        <div className={styles.secondMonth}>{renderMonth(rightMonth)}</div>
        <button type="button" className={styles.navBtn}
          onClick={() => setLeftMonth(m => addMonths(m, 1))}>›</button>
      </div>

      {/* Footer */}
      <div className={styles.footer}>
        <div className={styles.flexOptions}>
          <button
            type="button"
            className={`${styles.flexBtn} ${value.flex === 0 ? styles.flexBtnActive : ''}`}
            onClick={() => onChange({ ...value, flex: 0 })}
          >Точные даты</button>
          <button
            type="button"
            className={`${styles.flexBtn} ${value.flex === 1 ? styles.flexBtnActive : ''}`}
            onClick={() => onChange({ ...value, flex: 1 })}
          >± 1 день</button>
          <button
            type="button"
            className={`${styles.flexBtn} ${value.flex === 2 ? styles.flexBtnActive : ''}`}
            onClick={() => onChange({ ...value, flex: 2 })}
          >± 2 дня</button>
        </div>
        <button
          type="button"
          className={styles.confirmBtn}
          disabled={!value.start || !value.end}
          onClick={onConfirm}
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  );
}
