# CompraYa (Monolítica Centralizada) ⚡

**CompraYa** es una aplicación web e-commerce de alto rendimiento construida con una arquitectura de monolito centralizado en **Node.js, Express y PostgreSQL**. La aplicación está instrumentada de punta a punta para calcular el tiempo exacto de ejecución de cada consulta a la base de datos (SELECT, INSERT, UPDATE, DELETE) en milisegundos y mostrarlo dinámicamente en una interfaz web de diseño ultra-premium.

Además, cuenta con un desacoplamiento de capas mediante el **patrón Repository (DAO)** y un script de siembra masivo optimizado para cargar **500,000 productos y 100,000 pedidos** en cuestión de segundos.

---

## 🛠️ Tecnologías Utilizadas

*   **Backend:** Node.js + Express
*   **Base de Datos:** PostgreSQL
*   **Diseño UX/UI:** HTML5, CSS3 Vanilla (Glassmorphism, Cosmic Dark Theme, HSL Variables)
*   **Manejo de Estado & Cliente:** Vanilla JS (ES6) Single Page Application (SPA)
*   **Generador de Datos:** `@faker-js/faker`

---

## 🏗️ Patrón de Arquitectura: Repository (DAO)

El código del backend ha sido estructurado siguiendo el **patrón Repository**. Toda la lógica de persistencia está separada de los controladores en la carpeta `/repositories`. 

Esto proporciona un desacoplamiento completo y una excelente mantenibilidad futura:
*   **Migración de Base de Datos:** Si en el futuro se desea cambiar la base de datos de productos de PostgreSQL a **Cassandra** (como se sugiere para soportar alta escalabilidad de inventarios), únicamente se requiere escribir una nueva clase `CassandraProductoRepository` que implemente las firmas de métodos actuales e inyectarla en los controladores, sin tocar una sola línea de lógica web.
*   **Caché Distribuido:** De forma similar, la capa de sesiones en `SesionRepository` utiliza una tabla de base de datos (`sesiones`), pero puede reemplazarse por una implementación de **Redis** en cuestión de minutos alterando el repositorio correspondiente.

---

## 📊 Medición de Latencia SQL en Tiempo Real

1.  **Backend Wrapper (`/database/db.js`):** Cada llamada a la base de datos es envuelta utilizando temporizadores de alta resolución de Node.js (`process.hrtime.bigint()`). Al finalizar la consulta, calculamos la duración exacta en milisegundos.
2.  **API Metadata Integration:** Todas las respuestas JSON del API retornan una sección de metadatos (`meta.queries`) que contiene el listado de sentencias SQL ejecutadas en esa solicitud, su propósito conceptual y su tiempo exacto de ejecución (ej. `Fetch Paginated Products: 14.5ms`).
3.  **Visual Telemetry Panel (Frontend):** 
    *   La interfaz cuenta con una consola interactiva flotante (esquina inferior derecha) llamada **Monitor de Latencia SQL**.
    *   El monitor procesa en tiempo real la telemetría, calcula el promedio de latencia e ilustra un histograma de barras color-codificado (Verde <50ms para óptimo, Amarillo 50ms-200ms para moderado, y Rojo >200ms para consultas lentas).
    *   Al lado de cada componente clave (como los botones de paginación o el botón de pago ACID) se despliega un pequeño badge luminoso con la duración de las consultas involucradas en la acción.

---

## 🚀 Instalación y Ejecución Local

### Prerrequisitos
*   Node.js (versión 18 o superior)
*   NPM (instalado por defecto con Node.js)
*   Acceso a internet (para conectar a la base de datos PostgreSQL remota)

### Paso 1: Clonar e Instalar Dependencias
En la carpeta del proyecto, ejecuta:
```bash
npm install
```

### Paso 2: Configurar Variables de Entorno
Crea un archivo `.env` en la raíz del proyecto (ya pre-configurado para conectarse a la base de datos remota suministrada):
```env
PORT=3000
DB_HOST=100.127.90.69
DB_PORT=5432
DB_DATABASE=compraya
DB_USER=admincompraya
DB_PASSWORD=admincompraya
JWT_SECRET=super_secret_compraya_token_key_2026
SESSION_SECRET=compraya_session_cookie_secret_key_2026
NODE_ENV=development
```

### Paso 3: Sembrar la Base de Datos (500,000 Productos)
El script de siembra está altamente optimizado mediante **inserciones masivas en bloques (lotes de 5,000)** y mapeo de referencias en memoria para evitar colapsar la base de datos a través de la red.

Para ejecutar la inicialización de tablas e inserción masiva de los 500,000 productos y 100,000 pedidos, ejecuta:
```bash
npm run seed
```
*(Este comando creará de forma automatizada las tablas si no existen en el esquema `compraya` y completará la carga masiva en aproximadamente 45 segundos).*

### Paso 4: Iniciar el Servidor
Inicia la aplicación local en modo desarrollo:
```bash
npm start
```
Abre tu navegador e ingresa a: **`http://localhost:3000`**

---

## 🛡️ Credenciales de Prueba

Para probar el catálogo, carrito y checkout transaccional sin necesidad de registrarte, puedes iniciar sesión utilizando las siguientes credenciales generadas por el seeder:
*   **Correo Electrónico:** `usuario0@compraya.com` (disponibles desde `usuario0` hasta `usuario4999`)
*   **Contraseña:** `admin123`

---

## ☁️ Instrucciones para Despliegue en Render (Gratis)

Render es una excelente plataforma para desplegar aplicaciones de Node.js de forma gratuita. Sigue estos pasos para subir CompraYa a producción:

### 1. Preparar el Repositorio
*   Asegúrate de tener tu código fuente en un repositorio de GitHub o GitLab.
*   El archivo `.gitignore` debe excluir `node_modules` y `.env` para evitar fugas de credenciales.

### 2. Crear un Servicio Web en Render
1.  Ingresa a [Render.com](https://render.com/) e inicia sesión.
2.  Haz clic en el botón **New +** y selecciona **Web Service**.
3.  Conecta tu repositorio de GitHub/GitLab.
4.  Configura las siguientes opciones del servicio:
    *   **Name:** `compraya-monolito` (o tu nombre preferido)
    *   **Region:** Selecciona la más cercana a tu ubicación (ej. *Oregon* u *Ohio*)
    *   **Branch:** `main` (o la rama principal de tu repositorio)
    *   **Runtime:** `Node`
    *   **Build Command:** `npm install`
    *   **Start Command:** `npm start`
    *   **Instance Type:** `Free` (Plan Gratis)

### 3. Configurar Variables de Entorno en Render
En la pestaña **Env Groups** o **Environment** de tu servicio web en Render, agrega las siguientes variables para permitir la conexión remota a la base de datos PostgreSQL:

| Key | Value |
| :--- | :--- |
| `NODE_ENV` | `production` |
| `DB_HOST` | `100.127.90.69` *(Asegúrate de que este host/puerto sea públicamente accesible o que tengas configurada una VPN/Tailscale en tu entorno de Render si la IP pertenece a una red privada)* |
| `DB_PORT` | `5432` |
| `DB_DATABASE` | `compraya` |
| `DB_USER` | `admincompraya` |
| `DB_PASSWORD` | `admincompraya` |
| `JWT_SECRET` | `un_hash_muy_seguro_de_produccion_2026` |
| `SESSION_SECRET` | `un_hash_cookie_seguro_de_produccion_2026` |

### 4. Desplegar
*   Haz clic en **Deploy Web Service**.
*   Render compilará e instalará los paquetes y desplegará la URL pública de producción (ej. `https://compraya-monolito.onrender.com`).
*   *(Opcional)* Si deseas ejecutar la siembra en la base de datos directamente desde el contenedor de Render, puedes abrir la **Shell** de tu servicio web en Render y ejecutar `npm run seed`.
