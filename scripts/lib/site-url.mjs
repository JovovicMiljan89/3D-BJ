// seo.siteUrl is typed by hand in the CMS, so it's normalized before any
// absolute URL (canonical, og:*, JSON-LD, sitemap, robots.txt) is built from
// it: always https://, always exactly one trailing slash. Each fix is
// reported so the build can warn and the CMS value can be corrected.
"use strict";

export function normalizeSiteUrl(raw) {
  const warnings = [];
  let url = String(raw).trim();

  if (/^http:\/\//i.test(url)) {
    url = "https://" + url.slice("http://".length);
    warnings.push(`seo.siteUrl "${raw}" uses http:// — using https:// instead.`);
  } else if (!/^https:\/\//i.test(url)) {
    url = "https://" + url.replace(/^\/+/, "");
    warnings.push(`seo.siteUrl "${raw}" has no https:// — added it.`);
  }

  const trimmed = url.replace(/\/+$/, "");
  if (url !== trimmed + "/") {
    warnings.push(`seo.siteUrl "${raw}" must end with exactly one "/" — fixed.`);
  }
  url = trimmed + "/";

  return { url, warnings };
}

// Joins the normalized site URL with an absolute path ("/assets/x.png").
export function absoluteUrl(siteUrl, absPath) {
  return siteUrl + String(absPath).replace(/^\/+/, "");
}
