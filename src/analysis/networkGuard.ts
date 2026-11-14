/// <reference lib="webworker" />

// Workers in this app may only talk to the app's own origin (to load the
// WASM runtime and model files). This module makes that a property of the
// code rather than a promise: importing it replaces the worker's network
// entry points with versions that refuse any other destination.
//
// Why it exists (docs/adr/0006-no-telemetry.md): newer versions of the
// MediaPipe library send usage metrics to Google from inside the worker, and
// the page's <meta> Content-Security-Policy is not guaranteed to apply to
// workers. Import this first in every worker.

// True when `url` (absolute or relative to `baseUrl`) stays on `origin`, or
// is an in-memory blob:/data: URL.
export function isSameOriginUrl(url: string, baseUrl: string, origin: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url, baseUrl);
  } catch {
    return false;
  }
  if (parsed.protocol === "blob:" || parsed.protocol === "data:") return true;
  return parsed.origin === origin;
}

function blocked(url: string): Error {
  return new Error(`Blocked network request to another origin: ${url}`);
}

function allowed(url: string): boolean {
  return isSameOriginUrl(url, self.location.href, self.location.origin);
}

export function installNetworkGuard(): void {
  const originalFetch = self.fetch.bind(self);
  self.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : String(input);
    return allowed(url) ? originalFetch(input, init) : Promise.reject(blocked(url));
  };

  // `fetch` is the only network API this app and MediaPipe need. The others
  // are removed so that no library can use them to reach a third party.
  for (const name of ["XMLHttpRequest", "WebSocket", "EventSource", "WebTransport"] as const) {
    Reflect.deleteProperty(self, name);
  }
}

// Installed on import. A worker has no `document`; tests import this module
// in Node, where there is nothing to guard.
if (typeof WorkerGlobalScope !== "undefined" && self instanceof WorkerGlobalScope) {
  installNetworkGuard();
}
