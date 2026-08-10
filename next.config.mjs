import path from "node:path"

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  images: { unoptimized: true },
  turbopack: { root: path.resolve(process.cwd()) },
}

export default nextConfig