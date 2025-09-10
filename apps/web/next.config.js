/** @type {import('next').NextConfig} */
const nextConfig = {
  // Remove deprecated experimental.appDir
  
  // Simplified configuration for deployment
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
          }
        ]
      }
    ];
  },

  // Enable compression
  compress: true,
  
  // Production optimizations
  swcMinify: true,
  
  // Environment variables
  env: {
    MEDICAL_VALIDATION_ENABLED: process.env.MEDICAL_VALIDATION_ENABLED || 'true',
    PERFORMANCE_MONITORING: process.env.PERFORMANCE_MONITORING || 'true',
    EDUCATIONAL_MODE: process.env.EDUCATIONAL_MODE || 'true'
  }
};

module.exports = nextConfig;