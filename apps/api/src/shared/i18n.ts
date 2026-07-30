import type { TranslationDictionary } from '@better-auth/i18n'

export const en: TranslationDictionary = {
  // ── Base error codes ──
  USER_NOT_FOUND: 'User not found',
  FAILED_TO_CREATE_USER: 'Failed to create user',
  FAILED_TO_CREATE_SESSION: 'Failed to create session',
  FAILED_TO_UPDATE_USER: 'Failed to update user',
  FAILED_TO_GET_SESSION: 'Failed to get session',
  INVALID_PASSWORD: 'Invalid password',
  INVALID_EMAIL: 'Invalid email',
  INVALID_EMAIL_OR_PASSWORD: 'Invalid email or password',
  INVALID_USER: 'Invalid user',
  SOCIAL_ACCOUNT_ALREADY_LINKED: 'Social account already linked',
  PROVIDER_NOT_FOUND: 'Provider not found',
  INVALID_TOKEN: 'Invalid token',
  TOKEN_EXPIRED: 'Token expired',
  ID_TOKEN_NOT_SUPPORTED: 'id_token not supported',
  FAILED_TO_GET_USER_INFO: 'Failed to get user info',
  USER_EMAIL_NOT_FOUND: 'User email not found',
  EMAIL_NOT_VERIFIED: 'Email not verified',
  PASSWORD_TOO_SHORT: 'Password too short',
  PASSWORD_TOO_LONG: 'Password too long',
  USER_ALREADY_EXISTS: 'User already exists.',
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL:
    'User already exists. Use another email.',
  EMAIL_CAN_NOT_BE_UPDATED: 'Email cannot be updated',
  CREDENTIAL_ACCOUNT_NOT_FOUND: 'Credential account not found',
  SESSION_EXPIRED:
    'Session expired. Please sign in again to perform this action.',
  FAILED_TO_UNLINK_LAST_ACCOUNT: 'You cannot unlink your last account',
  ACCOUNT_NOT_FOUND: 'Account not found',
  USER_ALREADY_HAS_PASSWORD:
    'User already has a password. Please provide it to delete the account.',
  CROSS_SITE_NAVIGATION_LOGIN_BLOCKED:
    'Cross-site navigation login blocked. This request appears to be a CSRF attack.',
  VERIFICATION_EMAIL_NOT_ENABLED: 'Email verification is not enabled',
  EMAIL_ALREADY_VERIFIED: 'Email already verified',
  EMAIL_MISMATCH: 'Email mismatch',
  SESSION_NOT_FRESH: 'Session is not fresh',
  LINKED_ACCOUNT_ALREADY_EXISTS: 'Linked account already exists',
  INVALID_ORIGIN: 'Invalid origin',
  INVALID_CALLBACK_URL: 'Invalid callback URL',
  INVALID_REDIRECT_URL: 'Invalid redirect URL',
  INVALID_ERROR_CALLBACK_URL: 'Invalid error callback URL',
  INVALID_NEW_USER_CALLBACK_URL: 'Invalid new user callback URL',
  MISSING_OR_NULL_ORIGIN: 'Missing or null origin',
  CALLBACK_URL_REQUIRED: 'Callback URL is required',
  FAILED_TO_CREATE_VERIFICATION: 'Failed to create verification',
  FIELD_NOT_ALLOWED: 'Field not allowed',
  ASYNC_VALIDATION_NOT_SUPPORTED: 'Async validation not supported',
  VALIDATION_ERROR: 'Validation error',
  MISSING_FIELD: 'Required field',
  METHOD_NOT_ALLOWED_DEFER_SESSION_REQUIRED:
    'POST method requires deferSessionRefresh enabled in session configuration',
  BODY_MUST_BE_AN_OBJECT: 'Request body must be an object',
  PASSWORD_ALREADY_SET: 'User already has a password set',

  // ── Admin plugin ──
  YOU_CANNOT_BAN_YOURSELF: 'You cannot ban yourself',
  YOU_ARE_NOT_ALLOWED_TO_CHANGE_USERS_ROLE:
    'You are not allowed to change the user role',
  YOU_ARE_NOT_ALLOWED_TO_CREATE_USERS: 'You are not allowed to create users',
  YOU_ARE_NOT_ALLOWED_TO_LIST_USERS: 'You are not allowed to list users',
  YOU_ARE_NOT_ALLOWED_TO_LIST_USERS_SESSIONS:
    'You are not allowed to list user sessions',
  YOU_ARE_NOT_ALLOWED_TO_BAN_USERS: 'You are not allowed to ban users',
  YOU_ARE_NOT_ALLOWED_TO_IMPERSONATE_USERS:
    'You are not allowed to impersonate users',
  YOU_ARE_NOT_ALLOWED_TO_REVOKE_USERS_SESSIONS:
    'You are not allowed to revoke user sessions',
  YOU_ARE_NOT_ALLOWED_TO_DELETE_USERS: 'You are not allowed to delete users',
  YOU_ARE_NOT_ALLOWED_TO_SET_USERS_PASSWORD:
    'You are not allowed to set user passwords',
  BANNED_USER: 'You have been banned from this application',
  YOU_ARE_NOT_ALLOWED_TO_GET_USER: 'You are not allowed to access this user',
  NO_DATA_TO_UPDATE: 'No data to update',
  YOU_ARE_NOT_ALLOWED_TO_UPDATE_USERS: 'You are not allowed to update users',
  YOU_CANNOT_REMOVE_YOURSELF: 'You cannot remove yourself',
  YOU_ARE_NOT_ALLOWED_TO_SET_NON_EXISTENT_VALUE:
    'You are not allowed to set a non-existent role value',
  YOU_CANNOT_IMPERSONATE_ADMINS: 'You cannot impersonate administrators',
  INVALID_ROLE_TYPE: 'Invalid role type',

  // ── Two-factor plugin ──
  OTP_NOT_ENABLED: 'OTP not enabled',
  OTP_HAS_EXPIRED: 'OTP has expired',
  TOTP_NOT_ENABLED: 'TOTP not enabled',
  TWO_FACTOR_NOT_ENABLED: 'Two-factor authentication is not enabled',
  BACKUP_CODES_NOT_ENABLED: 'Backup codes are not enabled',
  INVALID_BACKUP_CODE: 'Invalid backup code',
  INVALID_CODE: 'Invalid code',
  TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE:
    'Too many attempts. Please request a new code.',
  INVALID_TWO_FACTOR_COOKIE: 'Invalid two-factor authentication cookie',
}

export const ptBR: TranslationDictionary = {
  // ── Base error codes ──
  USER_NOT_FOUND: 'Usuário não encontrado',
  FAILED_TO_CREATE_USER: 'Falha ao criar usuário',
  FAILED_TO_CREATE_SESSION: 'Falha ao criar sessão',
  FAILED_TO_UPDATE_USER: 'Falha ao atualizar usuário',
  FAILED_TO_GET_SESSION: 'Falha ao obter sessão',
  INVALID_PASSWORD: 'Senha inválida',
  INVALID_EMAIL: 'Email inválido',
  INVALID_EMAIL_OR_PASSWORD: 'Email ou senha inválidos',
  INVALID_USER: 'Usuário inválido',
  SOCIAL_ACCOUNT_ALREADY_LINKED: 'Conta social já vinculada',
  PROVIDER_NOT_FOUND: 'Provedor não encontrado',
  INVALID_TOKEN: 'Token inválido',
  TOKEN_EXPIRED: 'Token expirado',
  ID_TOKEN_NOT_SUPPORTED: 'id_token não suportado',
  FAILED_TO_GET_USER_INFO: 'Falha ao obter informações do usuário',
  USER_EMAIL_NOT_FOUND: 'Email do usuário não encontrado',
  EMAIL_NOT_VERIFIED: 'Email não verificado',
  PASSWORD_TOO_SHORT: 'Senha muito curta',
  PASSWORD_TOO_LONG: 'Senha muito longa',
  USER_ALREADY_EXISTS: 'Usuário já existe.',
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: 'Usuário já existe. Use outro email.',
  EMAIL_CAN_NOT_BE_UPDATED: 'O email não pode ser alterado',
  CREDENTIAL_ACCOUNT_NOT_FOUND: 'Conta de credencial não encontrada',
  SESSION_EXPIRED:
    'Sessão expirada. Por favor, faça login novamente para continuar.',
  FAILED_TO_UNLINK_LAST_ACCOUNT: 'Você não pode desvincular sua última conta',
  ACCOUNT_NOT_FOUND: 'Conta não encontrada',
  USER_ALREADY_HAS_PASSWORD:
    'O usuário já possui uma senha. Por favor, informe-a para excluir a conta.',
  CROSS_SITE_NAVIGATION_LOGIN_BLOCKED:
    'Login bloqueado por navegação entre sites. Esta requisição parece ser um ataque CSRF.',
  VERIFICATION_EMAIL_NOT_ENABLED: 'Verificação de email não está habilitada',
  EMAIL_ALREADY_VERIFIED: 'Email já verificado',
  EMAIL_MISMATCH: 'Email não corresponde',
  SESSION_NOT_FRESH: 'Sessão não é recente',
  LINKED_ACCOUNT_ALREADY_EXISTS: 'Conta vinculada já existe',
  INVALID_ORIGIN: 'Origem inválida',
  INVALID_CALLBACK_URL: 'URL de callback inválida',
  INVALID_REDIRECT_URL: 'URL de redirecionamento inválida',
  INVALID_ERROR_CALLBACK_URL: 'URL de callback de erro inválida',
  INVALID_NEW_USER_CALLBACK_URL: 'URL de callback de novo usuário inválida',
  MISSING_OR_NULL_ORIGIN: 'Origem ausente ou nula',
  CALLBACK_URL_REQUIRED: 'URL de callback é obrigatória',
  FAILED_TO_CREATE_VERIFICATION: 'Falha ao criar verificação',
  FIELD_NOT_ALLOWED: 'Campo não permitido',
  ASYNC_VALIDATION_NOT_SUPPORTED: 'Validação assíncrona não suportada',
  VALIDATION_ERROR: 'Erro de validação',
  MISSING_FIELD: 'Campo obrigatório',
  METHOD_NOT_ALLOWED_DEFER_SESSION_REQUIRED:
    'O método POST requer deferSessionRefresh habilitado na configuração de sessão',
  BODY_MUST_BE_AN_OBJECT: 'O corpo da requisição deve ser um objeto',
  PASSWORD_ALREADY_SET: 'O usuário já possui uma senha definida',

  // ── Admin plugin ──
  YOU_CANNOT_BAN_YOURSELF: 'Você não pode banir a si mesmo',
  YOU_ARE_NOT_ALLOWED_TO_CHANGE_USERS_ROLE:
    'Você não tem permissão para alterar o papel do usuário',
  YOU_ARE_NOT_ALLOWED_TO_CREATE_USERS:
    'Você não tem permissão para criar usuários',
  YOU_ARE_NOT_ALLOWED_TO_LIST_USERS:
    'Você não tem permissão para listar usuários',
  YOU_ARE_NOT_ALLOWED_TO_LIST_USERS_SESSIONS:
    'Você não tem permissão para listar sessões de usuários',
  YOU_ARE_NOT_ALLOWED_TO_BAN_USERS:
    'Você não tem permissão para banir usuários',
  YOU_ARE_NOT_ALLOWED_TO_IMPERSONATE_USERS:
    'Você não tem permissão para impersonar usuários',
  YOU_ARE_NOT_ALLOWED_TO_REVOKE_USERS_SESSIONS:
    'Você não tem permissão para revogar sessões de usuários',
  YOU_ARE_NOT_ALLOWED_TO_DELETE_USERS:
    'Você não tem permissão para excluir usuários',
  YOU_ARE_NOT_ALLOWED_TO_SET_USERS_PASSWORD:
    'Você não tem permissão para definir senhas de usuários',
  BANNED_USER: 'Você foi banido desta aplicação',
  YOU_ARE_NOT_ALLOWED_TO_GET_USER:
    'Você não tem permissão para acessar este usuário',
  NO_DATA_TO_UPDATE: 'Nenhum dado para atualizar',
  YOU_ARE_NOT_ALLOWED_TO_UPDATE_USERS:
    'Você não tem permissão para atualizar usuários',
  YOU_CANNOT_REMOVE_YOURSELF: 'Você não pode remover a si mesmo',
  YOU_ARE_NOT_ALLOWED_TO_SET_NON_EXISTENT_VALUE:
    'Você não tem permissão para definir um valor de papel inexistente',
  YOU_CANNOT_IMPERSONATE_ADMINS: 'Você não pode impersonar administradores',
  INVALID_ROLE_TYPE: 'Tipo de papel inválido',

  // ── Two-factor plugin ──
  OTP_NOT_ENABLED: 'OTP não habilitado',
  OTP_HAS_EXPIRED: 'OTP expirou',
  TOTP_NOT_ENABLED: 'TOTP não habilitado',
  TWO_FACTOR_NOT_ENABLED: 'Autenticação de dois fatores não está habilitada',
  BACKUP_CODES_NOT_ENABLED: 'Códigos de backup não estão habilitados',
  INVALID_BACKUP_CODE: 'Código de backup inválido',
  INVALID_CODE: 'Código inválido',
  TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE:
    'Muitas tentativas. Por favor, solicite um novo código.',
  INVALID_TWO_FACTOR_COOKIE: 'Cookie de autenticação de dois fatores inválido',
}
