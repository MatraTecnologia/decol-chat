import { env } from './env.js'
import { buildApp } from './server.js'

const app = await buildApp()

await app.listen({ port: env.PORT, host: env.HOST })

app.log.info('---')
app.log.info(`Environment: ${env.NODE_ENV}`)
app.log.info(`Server running at http://localhost:${env.PORT}`)
app.log.info(`Swagger docs at http://localhost:${env.PORT}/docs`)
app.log.info('---')
