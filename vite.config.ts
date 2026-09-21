/// <reference types="node" />
import { defineConfig, type Plugin } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

/**
 * מריץ את הפונקציה של שמשון בתוך שרת הפיתוח של Vite.
 *
 * בלי זה `npm run dev` מחזיר את index.html על /api/shimshon, כי Vite לא יודע
 * להריץ Netlify Functions. החלופה היא לדרוש `netlify dev` - עדיף שהפקודה
 * הרגילה פשוט תעבוד.
 *
 * בפרודקשן נטליפיי מריצה את אותו קובץ עצמו, כך שאין כאן כפילות לוגיקה.
 */
function shimshonDevServer(): Plugin {
  return {
    name: 'shimshon-dev-server',
    apply: 'serve',
    configureServer(server) {
      // Vite טוען .env רק ל-import.meta.env ורק עם קידומת VITE_.
      // ה-SDK של Anthropic קורא process.env, ולכן צריך לטעון ידנית.
      // חשוב: המפתח נשאר בצד השרת בלבד ואינו נכנס ל-bundle של הדפדפן.
      if (!process.env['ANTHROPIC_API_KEY']) {
        try {
          process.loadEnvFile('.env')
        } catch {
          // אין .env - שמשון יחזיר שגיאה מסודרת, שאר הכלי עובד.
        }
      }
      if (!process.env['ANTHROPIC_API_KEY']) {
        server.config.logger.warn(
          '[shimshon] חסר ANTHROPIC_API_KEY ב-.env. שמשון לא יעבוד בפיתוח; שאר הכלי תקין.',
        )
      }

      server.middlewares.use('/api/shimshon', (req, res) => {
        void (async () => {
          try {
            const chunks: Buffer[] = []
            for await (const chunk of req) chunks.push(chunk as Buffer)
            const body = Buffer.concat(chunks)

            const { default: handler } = await server.ssrLoadModule(
              '/netlify/functions/shimshon.mts',
            )

            const request = new Request('http://localhost/api/shimshon', {
              method: req.method ?? 'POST',
              headers: new Headers(req.headers as Record<string, string>),
              ...(body.length > 0 ? { body } : {}),
            })

            const response: Response = await handler(request)

            res.statusCode = response.status
            response.headers.forEach((value, key) => res.setHeader(key, value))

            if (response.body) {
              const reader = response.body.getReader()
              for (;;) {
                const { done, value } = await reader.read()
                if (done) break
                res.write(value)
              }
            }
            res.end()
          } catch (err) {
            // שגיאה כאן היא באג בשרת הפיתוח, לא בפונקציה. מדפיסים אותה
            // לקונסולה כדי שלא תיבלע מאחורי הודעה גנרית בממשק.
            console.error('[shimshon dev]', err)
            res.statusCode = 500
            res.setHeader('content-type', 'application/json; charset=utf-8')
            res.end(
              JSON.stringify({
                error:
                  'שגיאה בשרת הפיתוח של שמשון. ראה את הפירוט בטרמינל שבו רץ npm run dev.',
              }),
            )
          }
        })()
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), shimshonDevServer()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    // נכסים גדולים (גרפים, מפה) נטענים בנפרד כדי לשמור על טעינה ראשונית קלה בנייד
    chunkSizeWarningLimit: 300,
  },
  test: {
    environment: 'jsdom',
    globals: true,
  },
})
