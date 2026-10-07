// Authored by Claude Sonnet 5.5 (Anthropic), with Steven Chock as co-author.
/// <reference types="vite/client" />

/** Everything here is public: Vite bundles `VITE_` variables into the page. Never put a secret in one (decision 0004). */
interface ImportMetaEnv {
  readonly VITE_INTEGRATION?: string
  readonly VITE_API_URL?: string
}
