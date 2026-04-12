// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  /** Injected into the client bundle so each deploy gets a distinct Supabase cache key. */
  env: {
    NEXT_PUBLIC_SUPABASE_DATA_VERSION:
      process.env.NEXT_PUBLIC_SUPABASE_DATA_VERSION?.trim() ||
      process.env.VERCEL_DEPLOYMENT_ID ||
      (process.env.VERCEL_GIT_COMMIT_SHA
        ? String(process.env.VERCEL_GIT_COMMIT_SHA).slice(0, 12)
        : "") ||
      "local",
  },
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