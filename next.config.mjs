const nextConfig = {
  allowedDevOrigins: ['172.30.1.12', '172.30.1.26', '172.30.1.150'],
  outputFileTracingIncludes: {
    '/api/preview/share-image-test': ['node_modules/@sparticuz/chromium/bin/**'],
  },
};

export default nextConfig;
