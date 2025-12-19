import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

type Theme = 'light' | 'dark';
type ThemeScope = 'admin' | 'pos';

type ThemeContextValue = {
  theme: Theme;
  scope: ThemeScope;
  setScope: (scope: ThemeScope) => void;
  toggleTheme: () => void;
  setThemeForScope: (scope: ThemeScope, nextTheme: Theme) => void;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const readStoredTheme = (key: string, fallback: Theme): Theme => {
  if (typeof window === 'undefined') {
    return fallback;
  }
  return (localStorage.getItem(key) as Theme) || fallback;
};

export const ThemeProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [adminTheme, setAdminTheme] = useState<Theme>(() => readStoredTheme('yago-theme-admin', 'dark'));
  const [posTheme, setPosTheme] = useState<Theme>(() => readStoredTheme('yago-theme-pos', 'dark'));
  const [scope, setScope] = useState<ThemeScope>('admin');

  const theme = scope === 'pos' ? posTheme : adminTheme;

  useEffect(() => {
    document.documentElement.classList.toggle('light', theme === 'light');
  }, [theme]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('yago-theme-admin', adminTheme);
  }, [adminTheme]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('yago-theme-pos', posTheme);
  }, [posTheme]);

  const value = useMemo(
    () => ({
      theme,
      scope,
      setScope,
      toggleTheme: () => {
        if (scope === 'pos') {
          setPosTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
        } else {
          setAdminTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
        }
      },
      setThemeForScope: (targetScope: ThemeScope, nextTheme: Theme) => {
        if (targetScope === 'pos') {
          setPosTheme(nextTheme);
        } else {
          setAdminTheme(nextTheme);
        }
      },
    }),
    [adminTheme, posTheme, scope, theme]
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
