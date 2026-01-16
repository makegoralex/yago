import React, { createContext, useContext, useMemo, useState } from 'react';

type Theme = 'light';
type ThemeScope = 'admin' | 'pos';

type ThemeContextValue = {
  theme: Theme;
  scope: ThemeScope;
  setScope: (scope: ThemeScope) => void;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export const ThemeProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [scope, setScope] = useState<ThemeScope>('admin');
  const theme: Theme = 'light';

  const value = useMemo(
    () => ({
      theme,
      scope,
      setScope,
    }),
    [scope, theme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};
