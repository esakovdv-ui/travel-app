'use client';

import { createContext, useContext, useState } from 'react';
import type { AppUser, TravelPackage } from '@/types/travel';

type AppContextValue = {
  user: AppUser | null;
  setUser: (user: AppUser | null) => void;
  packages: TravelPackage[];
  setPackages: (packages: TravelPackage[]) => void;
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({
  children,
  initialPackages
}: {
  children: React.ReactNode;
  initialPackages: TravelPackage[];
}) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [packages, setPackages] = useState<TravelPackage[]>(initialPackages);

  return <AppContext.Provider value={{ user, setUser, packages, setPackages }}>{children}</AppContext.Provider>;
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within AppProvider');
  }
  return context;
}
