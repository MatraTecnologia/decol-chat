export type AppMessages = Record<string, string>

export const appMessages: Record<string, AppMessages> = {
  'pt-BR': {
    NOT_FOUND: 'Recurso não encontrado',
    FORBIDDEN: 'Acesso negado',
    UNAUTHORIZED: 'Não autenticado',
    ROLE_NOT_AUTHORIZED: 'Você não tem permissão para realizar esta ação',
    PERMISSION_DENIED: 'Permissão negada',
  },
  en: {
    NOT_FOUND: 'Resource not found',
    FORBIDDEN: 'Access denied',
    UNAUTHORIZED: 'Not authenticated',
    ROLE_NOT_AUTHORIZED: 'You do not have permission to perform this action',
    PERMISSION_DENIED: 'Permission denied',
  },
}
