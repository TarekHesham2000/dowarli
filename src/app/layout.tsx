import type { Metadata } from "next";
import { Cairo, Geist, Geist_Mono } from "next/font/google";
import { AppProviders } from "@/components/AppProviders";
import FloatingWhatsAppSupport from "@/components/support/FloatingWhatsAppSupport";
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

const siteUrl = "https://dowarly.com";
const defaultTitle = "دورلي | منصتك الذكية للبحث عن سكن وإعلانات العقارات في مصر";
const defaultDescription =
  "دورلي هو مساعدك الذكي المعتمد على الذكاء الاصطناعي لإيجاد أفضل عروض السكن، الشقق، وسكن الطلاب في مصر. ابحث، قارن، وتواصل مع الملاك مباشرة وبسهولة.";

/** Absolute asset URLs for crawlers (OG / Twitter / JSON-LD). */
const ogImageUrl = `${siteUrl}/images/full-logo.png`;
const organizationLogoUrl = `${siteUrl}/apple-touch-icon.png`;

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "دورلي",
  url: siteUrl,
  logo: {
    "@type": "ImageObject",
    url: organizationLogoUrl,
  },
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: defaultTitle, template: "%s | دورلي" },
  description: defaultDescription,
  alternates: { canonical: siteUrl },
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/app-icon.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    type: "website",
    locale: "ar_EG",
    url: siteUrl,
    siteName: "دورلي",
    title: defaultTitle,
    description: defaultDescription,
    images: [{ url: ogImageUrl, alt: "دورلي — شعار المنصة" }],
  },
  twitter: {
    card: "summary_large_image",
    title: defaultTitle,
    description: defaultDescription,
    images: [ogImageUrl],
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
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
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