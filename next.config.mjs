/** @type {import('next').NextConfig} */
const isStaticExport = process.env.BUILD_STATIC_EXPORT === '1';

const nextConfig = {
  ...(isStaticExport ? { output: 'export' } : {}),
  images: { unoptimized: true },
  trailingSlash: true,
};

export default nextConfig;
