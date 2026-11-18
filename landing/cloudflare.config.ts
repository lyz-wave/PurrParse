import { defineConfig } from "cf/config";

export default defineConfig({
  accountId: "914c319398577d90ff5c17817e08353d",
  worker: {
    name: "purrparse",
    compatibilityDate: "2026-11-17",
    assets: {
      htmlHandling: "auto-trailing-slash",
      notFoundHandling: "404-page",
    },
  },
});
