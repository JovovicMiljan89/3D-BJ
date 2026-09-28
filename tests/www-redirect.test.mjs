import { test } from "node:test";
import assert from "node:assert/strict";

import worker, { redirectTarget } from "../workers/www-redirect/index.mjs";

test("www redirect keeps path and query", () => {
  assert.equal(redirectTarget("https://www.trebami3d.rs/"), "https://trebami3d.rs/");
  assert.equal(redirectTarget("https://www.trebami3d.rs/?x=1"), "https://trebami3d.rs/?x=1");
  assert.equal(redirectTarget("http://www.trebami3d.rs/sitemap.xml?a=1&b=2"), "https://trebami3d.rs/sitemap.xml?a=1&b=2");
});

test("www redirect Worker answers with a 301 to the bare domain", async () => {
  const res = await worker.fetch(new Request("https://www.trebami3d.rs/assets/x.png?v=2"));
  assert.equal(res.status, 301);
  assert.equal(res.headers.get("location"), "https://trebami3d.rs/assets/x.png?v=2");
});
