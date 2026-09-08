'use client';

import React, { createContext } from 'react';
import { IGoogleMapsContext, IGoogleMapsProviderProps } from '../../utils/interfaces';

// Kept as "GoogleMapsContext" so every existing consumer keeps working
// unchanged — internally it now backs the free Leaflet/OpenStreetMap map
// stack instead of Google's, which needs no async script load, so
// isLoaded is simply always true.
export const GoogleMapsContext = createContext<IGoogleMapsContext>({
  isLoaded: true,
});

export const GoogleMapsProvider: React.FC<IGoogleMapsProviderProps> = ({
  children,
}) => {
  return (
    <GoogleMapsContext.Provider value={{ isLoaded: true }}>
      {children}
    </GoogleMapsContext.Provider>
  );
};
