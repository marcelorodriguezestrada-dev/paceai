# 🏃 PaceAI — Coach de Running con IA

> El primer sistema de coaching de running con inteligencia artificial para corredores de Buenos Aires.

![PaceAI](https://img.shields.io/badge/PaceAI-v1.0-FF4500?style=flat-square)
![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react)
![Firebase](https://img.shields.io/badge/Firebase-Free-FFCA28?style=flat-square&logo=firebase)
![Claude](https://img.shields.io/badge/Claude-Sonnet_4-8B5CF6?style=flat-square)

---

## ¿Qué hace?

| Funcionalidad | Descripción |
|---|---|
| 📅 **Calendario** | Carreras de Buenos Aires con info de terreno, clima y dificultad |
| 🤖 **PaceAI Coach** | Chat con IA en español rioplatense, adaptado a tu perfil |
| 📋 **Planes IA** | Planes de entrenamiento de 4 semanas generados por Claude |
| 📸 **Post-carrera** | Subís una foto de tu resultado y la IA la analiza |
| 🗺️ **Turismo** | Hoteles, restaurants y logística por sede de carrera |
| 🔥 **Firebase** | Perfil, planes y análisis guardados en la nube (gratis) |

---

## Setup rápido (5 minutos)

```bash
# 1. Clonar
git clone https://github.com/tuuser/paceai.git
cd paceai

# 2. Instalar
npm install

# 3. Configurar Firebase
cp .env.local.example .env.local
# → Editá .env.local con tus credenciales de Firebase

# 4. Correr
npm run dev
```

Abrí [http://localhost:5173](http://localhost:5173) 🎉

> **Guía de setup completa** → ver [SETUP.md](./SETUP.md)

---

## Estructura del proyecto

```
paceai/
├── src/
│   ├── App.jsx              # Componente principal (todas las vistas)
│   ├── main.jsx             # Entry point de React
│   ├── firebase.js          # Firebase REST API helpers
│   ├── components/          # Componentes reutilizables (futuro)
│   ├── hooks/
│   │   ├── useAuth.js       # Autenticación Firebase
│   │   └── useRaces.js      # Carga de carreras (Firebase + fallback)
│   ├── views/               # Vistas separadas (futuro refactor)
│   └── utils/
│       ├── ai.js            # Helpers para Claude API
│       └── data.js          # Datos estáticos y constantes
├── scraper/
│   ├── scraper.js           # Puppeteer scraper → Firebase
│   ├── package.json
│   └── .env.example
├── public/
│   └── favicon.svg
├── .env.local.example       # Template de variables de entorno
├── .gitignore
├── firebase.json            # Configuración de Firebase Hosting
├── vite.config.js
├── package.json
├── SETUP.md                 # Guía de setup detallada
└── README.md
```

---

## Scraper de carreras

```bash
cd scraper
npm install
cp .env.example .env
# → Editá .env con tus credenciales
node scraper.js
```

---

## Deploy

```bash
# Build
npm run build

# Firebase Hosting (gratis)
npm install -g firebase-tools
firebase login
firebase deploy
```

URL: `https://paceai-app.web.app`

---

## Stack tecnológico

- **Frontend**: React 18 + Vite (sin dependencias extra, CSS en JS)
- **IA**: Claude Sonnet 4 via Anthropic API (chat, planes, análisis de fotos)
- **Base de datos**: Firebase Firestore (REST API, sin SDK)
- **Auth**: Firebase Authentication (email/password)
- **Storage**: Firebase Storage (fotos post-carrera)
- **Scraping**: Puppeteer + Node.js
- **Deploy**: Firebase Hosting

---

## Variables de entorno

| Variable | Descripción | Dónde obtenerla |
|---|---|---|
| `VITE_FB_API_KEY` | API Key de Firebase | Firebase Console → Configuración |
| `VITE_FB_PROJECT_ID` | ID del proyecto | Firebase Console → Configuración |
| `VITE_FB_BUCKET` | Bucket de Storage | Firebase Console → Storage |

---

## Roadmap

- [ ] Autenticación con Google
- [ ] Notificaciones push (recordatorios de entrenamiento)
- [ ] Integración con Garmin / Strava API
- [ ] Análisis biomecánico por video
- [ ] Sistema de comunidad entre corredores
- [ ] App móvil (React Native)

---

## Licencia

MIT — Libre para usar y modificar.

*Hecho con ❤️ y muchos kms en Buenos Aires*
