// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    /** أي quality تُمرَّر لـ <Image> لازم تكون ضمن القائمة (Next 16+) */
    qualities: [70, 72, 75],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "eitefyszeiobxthgtafx.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

module.exports = nextConfig;