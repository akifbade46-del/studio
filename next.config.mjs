/** @type {import('next').NextConfig} */
const nextConfig = {
    images: {
        remotePatterns: [
          {
            protocol: 'https',
            hostname: 'qgocargo.com',
            port: '',
            pathname: '/logo.png',
          },
        ],
      },
};

export default nextConfig;
