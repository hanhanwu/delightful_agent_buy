import withMdkCheckout from "@moneydevkit/nextjs/next-plugin";

const nextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: ["*.trycloudflare.com"],
};

export default withMdkCheckout(nextConfig);
