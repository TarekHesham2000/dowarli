import type { Metadata } from "next";
import { Cairo, Geist, Geist_Mono } from "next/font/google";
import { AppProviders } from "@/components/AppProviders";
import FloatingWhatsAppSupport from "@/components/support/FloatingWhatsAppSupport";
import { getMetadataSiteUrl } from "@/lib/site";
import "./globals.css";

const cairo = Cairo({
  variable: "--font-cairo",
  subsets: ["arabic", "latin"],
  weight: ["400", "600", "700", "800"],
});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = getMetadataSiteUrl();
const defaultTitle = "دورلي | منصتك الذكية للبحث عن سكن وإعلانات العقارات في مصر";
const defaultDescription =
  "دورلي هو مساعدك الذكي المعتمد على الذكاء الاصطناعي لإيجاد أفضل عروض السكن، الشقق، وسكن الطلاب في مصر. ابحث، قارن، وتواصل مع الملاك مباشرة وبسهولة.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: defaultTitle, template: "%s | دورلي" },
  description: defaultDescription,
  alternates: { canonical: siteUrl },
  icons: {
    icon: [
      { url: "/app-icon.png", sizes: "32x32", type: "image/png" },
      { url: "/app-icon.png", sizes: "16x16", type: "image/png" },
    ],
    shortcut: "/app-icon.png",
    apple: [{ url: "/app-icon.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    type: "website",
    locale: "ar_EG",
    url: siteUrl,
    siteName: "دورلي",
    title: defaultTitle,
    description: defaultDescription,
    images: [
      { url: "/app-icon.png", width: 512, height: 512, type: "image/png", alt: "دورلي" },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: defaultTitle,
    description: defaultDescription,
    images: ["/app-icon.png"],
  },
  verification: {
    google: "ggYGI2KOuy-niGIEtgGLsR8P-uvNoMeOaewI7KlflHM",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#00d38d" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="دَورلي" />
      </head>
      <body
        suppressHydrationWarning={true}
        className={`${cairo.variable} ${geistSans.variable} ${geistMono.variable} min-h-full flex flex-col bg-background antialiased`}
      >
        <AppProviders>
          {children}
          <FloatingWhatsAppSupport />
        </AppProviders>
      </body>
    </html>
  );
}