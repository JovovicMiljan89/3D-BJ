// Separate, tiny Worker bound only to www.trebami3d.rs (Custom Domain).
// Sends every request to the bare domain with a 301, keeping path and query.
// The site itself (Worker "3d-bj") stays assets-only and never sees www traffic.
"use strict";

export const CANONICAL_ORIGIN = "https://trebami3d.rs";

export function redirectTarget(requestUrl) {
  const { pathname, search } = new URL(requestUrl);
  return CANONICAL_ORIGIN + pathname + search;
}

export default {
  fetch(request) {
    return Response.redirect(redirectTarget(request.url), 301);
  },
};
