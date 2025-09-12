import type { NextConfig } from 'next'
import { withContentlayer } from 'next-contentlayer2'

const nextConfig: NextConfig = {
  /* config options here */
  eslint: {
    // Disable ESLint since we're using Biome
    ignoreDuringBuilds: true,
  },
}

export default withContentlayer(nextConfig)
