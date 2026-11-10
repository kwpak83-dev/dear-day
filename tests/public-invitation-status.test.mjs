import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";

test("public invitations resolve missing slugs before a route loading fallback can stream", () => {
  for (const segment of ["app", "app/invite", "app/invite/[slug]"]) {
    for (const ext of ["js", "jsx", "ts", "tsx"]) {
      const file = new URL(`../${segment}/loading.${ext}`, import.meta.url);
      assert.equal(existsSync(file), false, `${segment}/loading.${ext} can turn a 404 into a streamed 200`);
    }
  }
});
