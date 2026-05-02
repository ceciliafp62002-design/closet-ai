# ClosetAI — Guía de instalación en iPhone

## Paso 1 — Subir a GitHub

1. Ve a **github.com** → New repository → llámalo `closet-ai` → Create
2. En tu ordenador, abre la terminal en la carpeta del proyecto:

```bash
git init
git add .
git commit -m "ClosetAI v1"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/closet-ai.git
git push -u origin main
```

---

## Paso 2 — Desplegar en Vercel (gratis, 2 minutos)

1. Ve a **vercel.com** → Sign up with GitHub
2. Click **"Add New Project"**
3. Importa el repo `closet-ai`
4. Vercel detecta Vite automáticamente → Click **Deploy**
5. En ~1 minuto tendrás una URL tipo: `https://closet-ai-xxx.vercel.app`

---

## Paso 3 — Instalar en iPhone como app

1. Abre **Safari** en tu iPhone (debe ser Safari, no Chrome)
2. Ve a tu URL de Vercel
3. Toca el botón **Compartir** (cuadrado con flecha ↑)
4. Desplázate y toca **"Añadir a pantalla de inicio"**
5. Ponle el nombre `ClosetAI` → **Añadir**

¡Ya aparece en tu escritorio como app nativa! 🎉

---

## Paso 4 — Configurar Gemini (IA gratuita)

1. Ve a **aistudio.google.com**
2. Sign in con Google
3. Click **"Get API key"** → **"Create API key"**
4. Copia la key (empieza por `AIzaSy...`)
5. En la app → ⚙️ → pega la key → Verificar y guardar

Límite gratuito: **1.500 peticiones/día** con Gemini 1.5 Flash.

---

## Estructura del proyecto

```
closet-ai/
├── public/
│   ├── favicon.svg
│   ├── apple-touch-icon.png     ← Icono en pantalla de inicio iPhone
│   ├── icons/
│   │   ├── icon-192.png
│   │   └── icon-512.png
│   └── splash/                  ← Pantallas de carga iPhone
│       ├── splash-1179x2556.png (iPhone 16 Pro)
│       ├── splash-1290x2796.png (iPhone 16 Pro Max)
│       └── splash-1170x2532.png (iPhone 13/14)
├── src/
│   ├── main.jsx                 ← Entry point React
│   └── App.jsx                  ← Toda la lógica de la app
├── index.html                   ← Meta tags iOS PWA
├── vite.config.js               ← Config Vite + PWA plugin
├── package.json
└── vercel.json
```

---

## Comandos útiles

```bash
npm install          # instalar dependencias (primera vez)
npm run dev          # desarrollo local en localhost:5173
npm run build        # compilar para producción → carpeta dist/
npm run preview      # previsualizar el build
```

---

## Limitaciones de la PWA vs app nativa

| Funcionalidad | PWA | App nativa |
|---|---|---|
| Icono en escritorio | ✅ | ✅ |
| Funciona offline | ✅ (datos cached) | ✅ |
| Acceso a cámara | ✅ | ✅ |
| Notificaciones push | ❌ en iOS | ✅ |
| Actualización automática | ✅ | Manual (App Store) |
| Coste | Gratis | 99€/año Apple |

---

## Próximos pasos sugeridos

- [ ] Conectar Supabase para datos en la nube (multi-dispositivo)
- [ ] Supabase Auth real (en vez de localStorage)
- [ ] Subir imágenes a Supabase Storage (en vez de base64 en localStorage)
- [ ] Notificaciones con Supabase Edge Functions
