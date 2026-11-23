# Gestor Móvil de Cobros, Tandas y Gastos (PWA Offline-First)

Aplicación Web Progresiva (PWA) con arquitectura *Mobile-First* y *Offline-First* diseñada para emprendimientos de venta directa (perfumes y productos naturales), administración de tandas por turnos y control de gastos del hogar.

## Características Principales
- **Operación Offline-First:** Registro de clientes, abonos, pagos de tandas y gastos sin conexión a internet mediante `IndexedDB` (Dexie.js) con sincronización automática al recuperar señal.
- **Cálculo Financiero Automatizado:** Actualización instantánea de saldos pendientes, cambio automático de estado (`PENDIENTE` → `LIQUIDADO`) y tablero de balance neto.
- **Comprobantes PDF y WhatsApp:** Generación local de recibos en PDF (`jsPDF`) sin depender del servidor y envío directo mediante enlaces `wa.me`.
- **Portal Público de Solo Lectura:** Consulta de estado de cuenta para clientes mediante token UUID único sin requerir contraseña.

## Stack Tecnológico
- **Frontend (PWA):** React, Vite, Tailwind CSS, `vite-plugin-pwa`, Dexie.js, jsPDF.
- **Backend (API REST):** Node.js, Express, `jsonwebtoken`, `bcryptjs`, `helmet`, `express-validator`.
- **Base de Datos:** PostgreSQL (esquema normalizado en 3FN con tipos `DECIMAL(10,2)`).

## Instalación y Ejecución Local

### 1. Clonar el repositorio
\`\`\`bash
git clone https://github.com/tu-usuario/gestor-cobros-tandas-pwa.git
cd gestor-cobros-tandas-pwa
\`\`\`

### 2. Configurar la Base de Datos (PostgreSQL)
Crear una base de datos llamada `gestor_cobros_db` y ejecutar los scripts en orden:
\`\`\`bash
psql -U postgres -d gestor_cobros_db -f server/database/schema.sql
psql -U postgres -d gestor_cobros_db -f server/database/seed.sql
\`\`\`

### 3. Instalar y ejecutar el Backend (`/server`)
\`\`\`bash
cd server
cp .env.example .env
npm install
npm run dev
\`\`\`

### 4. Instalar y ejecutar el Frontend PWA (`/client`)
\`\`\`bash
cd ../client
npm install
npm run dev
\`\`\`