import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';
type AdminLang = 'ar' | 'en';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  adminLang: AdminLang;
  setAdminLang: (lang: AdminLang) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  const [adminLang, setAdminLangState] = useState<AdminLang>(() => {
    const saved = localStorage.getItem('admin_lang');
    return (saved === 'ar' || saved === 'en') ? saved : 'ar';
  });

  const setAdminLang = (lang: AdminLang) => {
    setAdminLangState(lang);
    localStorage.setItem('admin_lang', lang);
  };

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
    localStorage.setItem('theme', theme);

    // Update browser theme-color meta tag for perfect status bar/address bar integration
    const metaThemeColor = window.document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', '#000000');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, adminLang, setAdminLang }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
