/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    appDir: true,
  },
  transpilePackages: [
    '@ekg-sim/medical-types',
    '@ekg-sim/heart-3d', 
    '@ekg-sim/ekg-processor',
    '@ekg-sim/education-engine',
    'three'
  ],
  webpack: (config, { dev, isServer }) => {
    // Handle Three.js and WebGL dependencies
    config.module.rules.push({
      test: /\.(glsl|vs|fs|vert|frag)$/,
      use: ['raw-loader', 'glslify-loader']
    });

    // Optimize for medical visualization performance
    if (!dev && !isServer) {
      config.optimization.splitChunks.cacheGroups.threejs = {
        name: 'threejs',
        test: /[\\/]node_modules[\\/](three|@react-three)[\\/]/,
        chunks: 'all',
        priority: 20,
      };
      
      config.optimization.splitChunks.cacheGroups.medical = {
        name: 'medical',
        test: /[\\/]packages[\\/](@ekg-sim)[\\/]/,
        chunks: 'all',
        priority: 30,
      };
    }

    return config;
  },
  
  // PWA configuration for mobile medical use
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          },
          {
            key: 'X-Content-Type-Options', 
            value: 'nosniff'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          }
        ]
      }
    ];
  },

  // Medical app specific optimizations
  images: {
    domains: ['localhost'],
    formats: ['image/webp', 'image/avif']
  },

  // Enable compression for medical data
  compress: true,
  
  // Production optimizations
  swcMinify: true,
  
  // Medical simulation specific environment
  env: {
    MEDICAL_VALIDATION_ENABLED: process.env.MEDICAL_VALIDATION_ENABLED || 'true',
    PERFORMANCE_MONITORING: process.env.PERFORMANCE_MONITORING || 'true',
    EDUCATIONAL_MODE: process.env.EDUCATIONAL_MODE || 'true'
  }
};

module.exports = nextConfig;