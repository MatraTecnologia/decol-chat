export const AUTH_COOKIE_PREFIX = 'turboreposaasstarter'
export const SESSION_COOKIE = `${AUTH_COOKIE_PREFIX}.session_token`
export const SECURE_SESSION_COOKIE = `__Secure-${SESSION_COOKIE}`

// Cookie do cookieCache (session.cookieCache no Better Auth) — precisa ser
// expirado junto na rota de recuperação, senão sobra sessão cacheada.
export const SESSION_DATA_COOKIE = `${AUTH_COOKIE_PREFIX}.session_data`
export const SECURE_SESSION_DATA_COOKIE = `__Secure-${SESSION_DATA_COOKIE}`
