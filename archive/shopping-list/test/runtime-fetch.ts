// Capture workerd fetch before the global no-network test stub is installed.
// Tests may use it only with data: URLs; never with remote URLs.
export const workerRuntimeFetch=globalThis.fetch;
