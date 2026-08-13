const nextConfig = {
  agentRules: false,
  poweredByHeader: false,
  experimental: { serverActions: { bodySizeLimit: '60mb' } },
};

export default nextConfig;
