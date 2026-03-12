import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@gsd/events'],
  output: 'standalone',
};

export default nextConfig;
