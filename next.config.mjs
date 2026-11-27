const privatePageRoutes = [
  "/invite/:path*",
  "/poster/:path*",
  "/create/:path*",
  "/my-invitations/:path*",
  "/guest-management/:path*",
  "/my-profile/:path*",
  "/my-inquiries/:path*",
  "/admin/:path*",
  "/signup/:path*",
  "/dev/:path*"
];

const nextConfig = {
  async headers() {
    return privatePageRoutes.map((source) => ({
      source,
      headers: [{ key: "X-Robots-Tag", value: "noindex" }],
    }));
  },
  allowedDevOrigins: ['172.30.1.12', '172.30.1.26', '172.30.1.150'],
  outputFileTracingIncludes: {
    '/api/preview/share-image-test': ['node_modules/@sparticuz/chromium/bin/**'],
  },
};

export default nextConfig;
