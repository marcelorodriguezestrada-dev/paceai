# 🏃 PaceAI — Guía de Setup Completa

## ¿Qué es Firebase y es gratis?

**Sí, es gratis** para proyectos chicos y medianos. El plan **Spark (Free)** incluye:

| Servicio | Límite gratuito | ¿Alcanza? |
|---|---|---|
| **Firestore** (base de datos) | 50.000 lecturas/día · 20.000 escrituras/día · 1GB | ✅ Para miles de usuarios |
| **Authentication** (login) | Usuarios ilimitados | ✅ Siempre gratis |
| **Storage** (fotos) | 5GB almacenamiento · 1GB/día descarga | ✅ Para post-carrera |
| **Hosting** (web) | 10GB · 360MB/día | ✅ Para el MVP |

**Estimación**: Con 500 usuarios activos mensuales el costo es $0. Si llegás a 5.000 usuarios
activos diarios, migrar al plan Blaze (pago por uso) cuesta aproximadamente USD 10-30/mes.

---

## Paso 1 — Crear proyecto en Firebase

1. Entrá a [https://console.firebase.google.com](https://console.firebase.google.com)
2. Hacé click en **"Crear un proyecto"**
3. Nombre: `paceai-app` (o el que prefieras)
4. Desactivar Google Analytics (opcional para el MVP)
5. Click en **"Crear proyecto"**

---

## Paso 2 — Activar Authentication

1. En el panel izquierdo: **Authentication → Comenzar**
2. Ir a la pestaña **"Sign-in method"**
3. Activar **"Correo electrónico/Contraseña"** → Guardar

---

## Paso 3 — Crear base de datos Firestore

1. En el panel: **Firestore Database → Crear base de datos**
2. Elegir **"Comenzar en modo de prueba"** (permite leer/escribir por 30 días)
3. Seleccionar región: `southamerica-east1` (São Paulo, el más cercano a Buenos Aires)
4. Click en **"Listo"**

### Configurar reglas de seguridad (importante)

Ir a **Firestore → Reglas** y pegar esto:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Carreras: cualquiera puede leer, solo admins escriben
    match /races/{document=**} {
      allow read: if true;
      allow write: if request.auth != null && request.auth.token.admin == true;
    }

    // Perfiles: solo el propio usuario
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    // Planes de entrenamiento: solo el propio usuario
    match /plans_{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    // Análisis post-carrera: solo el propio usuario
    match /analyses_{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

Hacer click en **"Publicar"**.

---

## Paso 4 — Activar Firebase Storage

1. En el panel: **Storage → Comenzar**
2. Modo de prueba → Siguiente
3. Misma región: `southamerica-east1`

### Reglas de Storage:

Ir a **Storage → Reglas**:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /photos/{userId}/{allPaths=**} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow write: if request.auth != null
                   && request.auth.uid == userId
                   && request.resource.size < 10 * 1024 * 1024  // máx 10MB
                   && request.resource.contentType.matches('image/.*');
    }
  }
}
```

---

## Paso 5 — Obtener las credenciales

1. Ir a ⚙️ **Configuración del proyecto** (ícono de engranaje)
2. Scroll hasta **"Tus apps"** → Click en **`</>`** (web)
3. Nombre de la app: `paceai-web` → Registrar app
4. Vas a ver algo así:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  authDomain: "paceai-app.firebaseapp.com",
  projectId: "paceai-app",
  storageBucket: "paceai-app.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};
```

---

## Paso 6 — Configurar la app React

Abrí `RunnerAI_v2.jsx` y reemplazá la sección de config al principio:

```javascript
const FB = {
  apiKey: "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",   // ← tu apiKey
  projectId: "paceai-app",                             // ← tu projectId
  bucket: "paceai-app.appspot.com",                   // ← tu storageBucket
};
```

---

## Paso 7 — Correr la app localmente

### Opción A: Con Vite (recomendado)

```bash
# 1. Crear proyecto Vite
npm create vite@latest paceai -- --template react
cd paceai

# 2. Copiar el archivo
cp /ruta/a/RunnerAI_v2.jsx src/App.jsx

# 3. Instalar dependencias
npm install

# 4. Correr
npm run dev
```

Abrí [http://localhost:5173](http://localhost:5173)

### Opción B: Create React App

```bash
npx create-react-app paceai
cd paceai
cp /ruta/a/RunnerAI_v2.jsx src/App.jsx
npm start
```

---

## Paso 8 — Configurar el Scraper

### Instalar dependencias

```bash
mkdir scraper && cd scraper
npm init -y
npm install puppeteer node-fetch@2 dotenv
cp /ruta/a/scraper.js .
```

### Crear archivo .env

```bash
# scraper/.env
FB_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
FB_PROJECT_ID=paceai-app
FB_SERVICE_EMAIL=tuadmin@email.com
FB_SERVICE_PASS=tu_contraseña_admin
```

> ⚠️ **Importante**: Primero creá una cuenta en la app con ese email/contraseña.
> Ese usuario va a ser el que escribe las carreras en Firestore.

### Ejecutar el scraper

```bash
node scraper.js
```

**Si el scraper no encuentra selectores** (el sitio cambió su estructura):

```bash
# Modo visual para ver qué está pasando
node -e "
const puppeteer = require('puppeteer');
(async () => {
  const b = await puppeteer.launch({ headless: false });
  const p = await b.newPage();
  await p.goto('https://ar.dondecorrer.com/', { waitUntil: 'networkidle2' });
  console.log('Página cargada — inspeccioná el DOM en el navegador que se abrió');
  await p.screenshot({ path: 'debug.png' });
  // b.close();  // comentado para que quede abierto
})();
"
```

Luego abrí `debug.png` o inspeccioná el HTML e informale a ChatGPT/Claude el nombre de las
clases CSS para actualizar el selector en `scraper.js`.

### Automatizar el scraper (cron job)

Para que corra todos los lunes a las 6am en un servidor Linux:

```bash
crontab -e
# Agregar esta línea:
0 6 * * 1 cd /ruta/al/scraper && node scraper.js >> logs/scraper.log 2>&1
```

---

## Paso 9 — Cargar carreras desde Firestore en la app

Una vez que el scraper guardó las carreras en Firestore, podés cargarlas dinámicamente
en la app. Reemplazá la constante `RACES` estática por esta función al inicio del componente:

```javascript
// En RunnerAI_v2.jsx — agregar este useEffect
const [races, setRaces] = useState(RACES); // fallback a datos locales

useEffect(() => {
  const loadRaces = async () => {
    try {
      const r = await fetch(
        `https://firestore.googleapis.com/v1/projects/${FB.projectId}/databases/(default)/documents/races?key=${FB.apiKey}&pageSize=50`
      );
      const d = await r.json();
      if (d.documents?.length > 0) {
        const loaded = d.documents.map((doc) => {
          const f = doc.fields;
          const get = (k) => f[k]?.stringValue ?? f[k]?.doubleValue ?? f[k]?.integerValue ?? null;
          return {
            id: doc.name.split("/").pop(),
            name: get("name"), date: get("date"), distance: get("distance"),
            location: get("location"), terrain: get("terrain"), weather: get("weather"),
            difficulty: get("difficulty"), link: get("link"), image: "🏃",
          };
        }).filter(r => r.name && r.date);
        setRaces(loaded);
        console.log(`✅ ${loaded.length} carreras cargadas desde Firebase`);
      }
    } catch (e) {
      console.log("Usando carreras locales:", e.message);
    }
  };
  loadRaces();
}, []);
```

---

## Paso 10 — Deploy a producción

### Firebase Hosting (gratis, recomendado)

```bash
# 1. Instalar Firebase CLI
npm install -g firebase-tools

# 2. Login
firebase login

# 3. En la carpeta de tu proyecto React
cd paceai
npm run build

# 4. Inicializar hosting
firebase init hosting
# - Seleccionar tu proyecto: paceai-app
# - Public directory: dist (para Vite) o build (para CRA)
# - Single page app: Yes
# - Overwrite index.html: No

# 5. Deploy
firebase deploy
```

Tu app queda disponible en: `https://paceai-app.web.app`

### Vercel (alternativa, también gratis)

```bash
npm install -g vercel
vercel
```

---

## Estructura de datos en Firestore

```
paceai-app (proyecto)
│
├── races/                          # Carreras (scrapeadas)
│   ├── maraton-buenos-aires-0/
│   │   ├── name: "Maratón de Buenos Aires"
│   │   ├── date: "2025-10-19"
│   │   ├── distance: "42K"
│   │   ├── location: "Obelisco, CABA"
│   │   ├── terrain: "asfalto urbano"
│   │   ├── weather: "primavera"
│   │   ├── difficulty: "avanzado"
│   │   └── scraped_at: "2025-06-08T..."
│   └── ...
│
├── users/                          # Perfiles de usuarios
│   └── {uid}/
│       ├── name: "Juan Pérez"
│       ├── age: "35"
│       ├── weight: "72"
│       ├── height: "175"
│       ├── level: "moderado"
│       ├── goal: "Terminar mi primera maratón"
│       └── days: "4"
│
├── plans_{uid}/                    # Planes de entrenamiento
│   └── {raceId}_{timestamp}/
│       ├── race: "{JSON}"
│       ├── plan: "{JSON con semanas}"
│       └── createdAt: "..."
│
└── analyses_{uid}/                 # Análisis post-carrera
    └── {timestamp}/
        ├── race: "Maratón de Buenos Aires"
        ├── analysis: "Texto del análisis de IA..."
        ├── photoUrl: "https://firebasestorage..."
        └── createdAt: "..."
```

---

## Variables de entorno para producción

Nunca subas las credenciales al repositorio. Usá variables de entorno:

**Con Vite** — crear archivo `.env.local`:
```
VITE_FB_API_KEY=AIzaSy...
VITE_FB_PROJECT_ID=paceai-app
VITE_FB_BUCKET=paceai-app.appspot.com
```

En el código reemplazar:
```javascript
const FB = {
  apiKey: import.meta.env.VITE_FB_API_KEY,
  projectId: import.meta.env.VITE_FB_PROJECT_ID,
  bucket: import.meta.env.VITE_FB_BUCKET,
};
```

Agregar `.env.local` al `.gitignore`.

---

## Checklist de lanzamiento

- [ ] Proyecto Firebase creado
- [ ] Authentication activado (email/pass)
- [ ] Firestore creado en `southamerica-east1`
- [ ] Reglas de Firestore configuradas
- [ ] Storage activado con reglas
- [ ] Credenciales copiadas en `RunnerAI_v2.jsx`
- [ ] App corriendo localmente (`npm run dev`)
- [ ] Scraper configurado con `.env`
- [ ] Scraper ejecutado → carreras en Firestore
- [ ] App cargando carreras desde Firestore
- [ ] Deploy a Firebase Hosting o Vercel
- [ ] Dominio custom configurado (opcional)

---

## Costos estimados

| Escenario | Costo mensual |
|---|---|
| MVP — hasta 200 usuarios activos | **$0** |
| Crecimiento — hasta 2.000 usuarios activos | **$0 – $5** |
| Tracción — hasta 10.000 usuarios activos | **$15 – $40** |
| Escala — 50.000+ usuarios | **$80 – $200** |

El salto del plan gratis (Spark) al pago (Blaze) es automático y solo cobrás lo que usás.
No hay mínimos mensuales.

---

*PaceAI — Generado con Claude · Documentación v2.0*
