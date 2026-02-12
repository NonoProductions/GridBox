import "./globals.css";
import { Suspense } from "react";
import AuthGate from "@/components/AuthGate";
import AppHeader from "@/components/AppHeader";
import NotificationManager from "@/components/NotificationManager";
import ThemeSync from "@/components/ThemeSync";

export const metadata = { 
  title: "GridBox - Powerbank ausleihen",
  description: "Powerbank ausleihen, jederzeit & überall",
  manifest: '/manifest.webmanifest',
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'GridBox',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5, // Erhöht für bessere Zugänglichkeit
  minimumScale: 1,
  userScalable: true, // Erlaubt Zoomen für bessere Zugänglichkeit
  viewportFit: 'cover',
  themeColor: '#10b981',
};

// Theme script - using dangerouslySetInnerHTML is safe here as content is static
// but we validate localStorage values to prevent XSS
const ThemeScript = () => (
  <script
    dangerouslySetInnerHTML={{
      __html: `
(function(){
  try {
    var q = window.location.search || '';
    var match = /[?&]theme=(light|dark)/i.exec(q);
    var fromUrl = match ? match[1].toLowerCase() : null;
    var useDark;
    if (fromUrl === 'light') { useDark = false; localStorage.setItem('theme','light'); }
    else if (fromUrl === 'dark') { useDark = true; localStorage.setItem('theme','dark'); }
    else {
      var saved = localStorage.getItem('theme');
      var validThemes = ['dark', 'light'];
      var isValidTheme = saved && validThemes.indexOf(saved) !== -1;
      var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      useDark = isValidTheme ? saved === 'dark' : prefersDark;
    }
    document.documentElement.classList.remove('dark');
    if (useDark) document.documentElement.classList.add('dark');
  } catch (_) { /* theme init optional */ }
})();
`,
    }}
  />
);

// Service Worker wird jetzt über NotificationManager verwaltet

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="theme-color" content="#10b981" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="GridBox" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="application-name" content="GridBox" />
        <meta name="msapplication-TileColor" content="#10b981" />
        <meta name="msapplication-tap-highlight" content="no" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
        <ThemeScript />
      </head>
      <body className="bg-slate-50 text-slate-900 dark:bg-[#0f1419] dark:text-slate-100">
        <Suspense fallback={null}>
          <ThemeSync />
        </Suspense>
        <NotificationManager />
        <AppHeader />
        <AuthGate />
        {children}
      </body>
    </html>
  );
}
