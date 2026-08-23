import { getViteConfig } from "astro/config";

export default getViteConfig({
  test: {
    include: ["tests/**/*.test.js"],
    // Cada archivo declara su entorno con `// @vitest-environment` cuando
    // necesita DOM; el resto corre en node, que es más rápido.
    environment: "node",
    coverage: {
      include: ["src/scripts/**/*.js"],
      reporter: ["text", "html"],
    },
  },
});
