import type { NextConfig } from "next";
import path from "path";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  // road_master/frontend and road_master (the NestJS backend) each have their own
  // package-lock.json; without this, Turbopack infers the monorepo root by walking up to the
  // nearest lockfile and picks the backend's, which is wrong for this app's file-watching root.
  turbopack: {
    root: path.join(__dirname),
  },
};

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

export default withNextIntl(nextConfig);
