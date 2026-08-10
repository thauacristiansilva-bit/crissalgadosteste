import path from "node:path"

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: { unoptimized: true },
  turbopack: { root: path.resolve(process.cwd()) },
}

export default nextConfig
