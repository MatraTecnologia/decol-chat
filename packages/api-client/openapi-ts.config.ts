import { defineConfig } from '@hey-api/openapi-ts'

export default defineConfig({
  input: 'http://localhost:3333/docs/openapi.json',
  output: {
    path: 'src',
    // Gera imports sem extensão (idiomático p/ moduleResolution: Bundler) —
    // dispensa o antigo postgenerate com `sed` (que era BSD/macOS-only).
    module: { extension: '' },
    // Formata os arquivos gerados no estilo do repo (menos ruído de diff).
    // `format` foi deprecado no openapi-ts 0.99 em favor de `postProcess`. O preset
    // string `'prettier'` usa um prettier bundlado que ignora o `.prettierrc`; a forma
    // de comando roda o CLI real, respeitando a config do repo (`semi: false` etc.).
    postProcess: [{ command: 'prettier', args: ['--write', '{{path}}'] }],
  },
  plugins: [
    '@hey-api/typescript',
    // `transformer: true` wira o responseTransformer (datas → Date) nas funções do SDK.
    { name: '@hey-api/sdk', transformer: true },
    '@hey-api/client-fetch',
    // Converte campos `format: date-time` (string ISO) em objetos Date no client.
    { name: '@hey-api/transformers', dates: true },
    {
      name: '@tanstack/react-query',
      queryOptions: true,
      mutationOptions: true,
      infiniteQueryOptions: true,
      queryKeys: {
        tags: true,
      },
    },
    // Gera schemas Zod do OpenAPI (disponíveis p/ validar respostas ou reusar em forms).
    'zod',
  ],
})
