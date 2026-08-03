interface FBLoginResponse {
  authResponse?: { code?: string }
}

interface FBLoginOptions {
  config_id: string
  response_type: string
  override_default_response_type: boolean
  extras: Record<string, unknown>
}

interface FBSdk {
  init: (params: {
    appId: string
    autoLogAppEvents: boolean
    xfbml: boolean
    version: string
  }) => void
  login: (
    callback: (response: FBLoginResponse) => void,
    options: FBLoginOptions,
  ) => void
}

declare global {
  interface Window {
    FB?: FBSdk
    fbAsyncInit?: () => void
  }
}

export {}
