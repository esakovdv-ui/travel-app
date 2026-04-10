'use client';

import type { Icon } from '@phosphor-icons/react';
import {
  SearchIcon, MapPinIcon, CalendarIcon, UsersIcon, AirplaneIcon, GlobeIcon, ClockIcon, SlidersIcon,
  StarIcon, BuildingsIcon, BedIcon, ForkKnifeIcon, TagIcon, HeartIcon, RefreshIcon, TrendUpIcon,
  ArrowRightIcon, ArrowLeftIcon, MenuIcon, CloseIcon, CaretDownIcon, InfoIcon, CheckIcon, WarningIcon,
  UmbrellaIcon, SuitcaseIcon, PassportIcon, AirplaneLandingIcon, AirplaneTakeoffIcon, MapPinPlusIcon, GridIcon,
  CreditCardIcon, TicketIcon, QuestionIcon, MonitorIcon, ExternalLinkIcon,
  TelegramIcon, InstagramIcon, PhoneIcon, EnvelopeIcon,
} from './index';

type IconWeight = 'light' | 'regular' | 'duotone';

const WEIGHTS: IconWeight[] = ['light', 'regular', 'duotone'];

const GROUPS: Array<{ title: string; icons: Array<{ name: string; component: Icon }> }> = [
  {
    title: 'Форма поиска',
    icons: [
      { name: 'SearchIcon', component: SearchIcon },
      { name: 'MapPinIcon', component: MapPinIcon },
      { name: 'CalendarIcon', component: CalendarIcon },
      { name: 'UsersIcon', component: UsersIcon },
      { name: 'AirplaneIcon', component: AirplaneIcon },
      { name: 'GlobeIcon', component: GlobeIcon },
      { name: 'ClockIcon', component: ClockIcon },
      { name: 'SlidersIcon', component: SlidersIcon },
    ],
  },
  {
    title: 'Карточка отеля',
    icons: [
      { name: 'StarIcon', component: StarIcon },
      { name: 'BuildingsIcon', component: BuildingsIcon },
      { name: 'BedIcon', component: BedIcon },
      { name: 'ForkKnifeIcon', component: ForkKnifeIcon },
      { name: 'TagIcon', component: TagIcon },
      { name: 'HeartIcon', component: HeartIcon },
      { name: 'RefreshIcon', component: RefreshIcon },
      { name: 'TrendUpIcon', component: TrendUpIcon },
    ],
  },
  {
    title: 'Навигация и UI',
    icons: [
      { name: 'ArrowRightIcon', component: ArrowRightIcon },
      { name: 'ArrowLeftIcon', component: ArrowLeftIcon },
      { name: 'MenuIcon', component: MenuIcon },
      { name: 'CloseIcon', component: CloseIcon },
      { name: 'CaretDownIcon', component: CaretDownIcon },
      { name: 'InfoIcon', component: InfoIcon },
      { name: 'CheckIcon', component: CheckIcon },
      { name: 'WarningIcon', component: WarningIcon },
    ],
  },
  {
    title: 'Туристические',
    icons: [
      { name: 'UmbrellaIcon', component: UmbrellaIcon },
      { name: 'SuitcaseIcon', component: SuitcaseIcon },
      { name: 'PassportIcon', component: PassportIcon },
      { name: 'AirplaneLandingIcon', component: AirplaneLandingIcon },
      { name: 'AirplaneTakeoffIcon', component: AirplaneTakeoffIcon },
      { name: 'MapPinPlusIcon', component: MapPinPlusIcon },
      { name: 'GridIcon', component: GridIcon },
    ],
  },
  {
    title: 'Бронирование и оплата',
    icons: [
      { name: 'CreditCardIcon', component: CreditCardIcon },
      { name: 'TicketIcon', component: TicketIcon },
      { name: 'QuestionIcon', component: QuestionIcon },
      { name: 'MonitorIcon', component: MonitorIcon },
      { name: 'ExternalLinkIcon', component: ExternalLinkIcon },
    ],
  },
  {
    title: 'Соцсети и контакты',
    icons: [
      { name: 'TelegramIcon', component: TelegramIcon },
      { name: 'InstagramIcon', component: InstagramIcon },
      { name: 'PhoneIcon', component: PhoneIcon },
      { name: 'EnvelopeIcon', component: EnvelopeIcon },
    ],
  },
];

export function IconDemo() {
  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '40px 24px', fontFamily: 'inherit' }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Icon Library</h1>
      <p style={{ color: '#888', marginBottom: 48, fontSize: 14 }}>
        @phosphor-icons/react — три веса: light · regular · duotone
      </p>

      {GROUPS.map(group => (
        <section key={group.title} style={{ marginBottom: 56 }}>
          <h2 style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#aaa', marginBottom: 20 }}>
            {group.title}
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
            {group.icons.map(({ name, component: IconComponent }) => (
              <div key={name} style={{ background: '#f9f9f9', borderRadius: 12, padding: '16px 14px' }}>
                <div style={{ display: 'flex', gap: 16, marginBottom: 10 }}>
                  {WEIGHTS.map(w => (
                    <div key={w} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      <IconComponent weight={w} size={24} color="#1a1a2b" />
                      <span style={{ fontSize: 10, color: '#bbb' }}>{w}</span>
                    </div>
                  ))}
                </div>
                <p style={{ fontSize: 11, color: '#666', fontFamily: 'monospace', margin: 0 }}>{name}</p>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
