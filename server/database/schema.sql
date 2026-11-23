-- ============================================================================
-- ESQUEMA DE BASE DE DATOS: SISTEMA DE COBROS, TANDAS Y GASTOS (PWA)
-- Motor: PostgreSQL 14+ (3ra Forma Normal)
-- ============================================================================

-- Limpieza preventiva en entorno de desarrollo
DROP TABLE IF EXISTS gastos CASCADE;
DROP TABLE IF EXISTS tanda_pagos CASCADE;
DROP TABLE IF EXISTS tanda_participantes CASCADE;
DROP TABLE IF EXISTS tandas CASCADE;
DROP TABLE IF EXISTS abonos CASCADE;
DROP TABLE IF EXISTS ventas_credito CASCADE;
DROP TABLE IF EXISTS clientes CASCADE;
DROP TABLE IF EXISTS usuarios CASCADE;

-- 1. TABLA DE USUARIOS (Administradora del negocio)
CREATE TABLE usuarios (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    email VARCHAR(120) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    negocio_nombre VARCHAR(120) NOT NULL DEFAULT 'Esencias y Hogar',
    creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. TABLA DE CLIENTES (Compradores y participantes de tandas)
CREATE TABLE clientes (
    id SERIAL PRIMARY KEY,
    usuario_id INT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    nombre VARCHAR(120) NOT NULL,
    telefono VARCHAR(15) NOT NULL,
    notas TEXT,
    token_acceso UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. TABLA DE VENTAS A CRÉDITO (Perfumes y productos naturales fiados)
CREATE TABLE ventas_credito (
    id SERIAL PRIMARY KEY,
    cliente_id INT NOT NULL REFERENCES clientes(id) ON DELETE RESTRICT,
    concepto VARCHAR(180) NOT NULL,
    monto_total DECIMAL(10, 2) NOT NULL CHECK (monto_total > 0),
    saldo_pendiente DECIMAL(10, 2) NOT NULL CHECK (saldo_pendiente >= 0),
    estado VARCHAR(15) NOT NULL DEFAULT 'PENDIENTE'
        CHECK (estado IN ('PENDIENTE', 'LIQUIDADO')),
    fecha_venta DATE NOT NULL DEFAULT CURRENT_DATE,
    sync_uuid UUID UNIQUE,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_saldo_no_mayor_total CHECK (saldo_pendiente <= monto_total)
);

-- 4. TABLA DE ABONOS (Pagos parciales o totales a una venta)
CREATE TABLE abonos (
    id SERIAL PRIMARY KEY,
    venta_id INT NOT NULL REFERENCES ventas_credito(id) ON DELETE CASCADE,
    monto DECIMAL(10, 2) NOT NULL CHECK (monto > 0),
    fecha_abono TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    folio VARCHAR(30) NOT NULL UNIQUE,
    notas VARCHAR(200),
    sync_uuid UUID UNIQUE
);

-- 5. TABLA DE TANDAS (Configuración general de cada tanda)
CREATE TABLE tandas (
    id SERIAL PRIMARY KEY,
    usuario_id INT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    nombre VARCHAR(120) NOT NULL,
    monto_aportacion DECIMAL(10, 2) NOT NULL CHECK (monto_aportacion > 0),
    frecuencia VARCHAR(15) NOT NULL CHECK (frecuencia IN ('SEMANAL', 'QUINCENAL')),
    total_rondas INT NOT NULL CHECK (total_rondas >= 2),
    fecha_inicio DATE NOT NULL,
    estado VARCHAR(15) NOT NULL DEFAULT 'ACTIVA'
        CHECK (estado IN ('ACTIVA', 'FINALIZADA')),
    creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 6. TABLA DE PARTICIPANTES DE TANDA (Relación N:M con número de turno)
CREATE TABLE tanda_participantes (
    id SERIAL PRIMARY KEY,
    tanda_id INT NOT NULL REFERENCES tandas(id) ON DELETE CASCADE,
    cliente_id INT NOT NULL REFERENCES clientes(id) ON DELETE RESTRICT,
    numero_turno INT NOT NULL CHECK (numero_turno >= 1),
    fecha_entrega_estimada DATE,
    entregado BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT uq_tanda_turno UNIQUE (tanda_id, numero_turno)
);

-- 7. TABLA DE PAGOS DE TANDA (Aportaciones por ronda de cada participante)
CREATE TABLE tanda_pagos (
    id SERIAL PRIMARY KEY,
    participante_id INT NOT NULL REFERENCES tanda_participantes(id) ON DELETE CASCADE,
    numero_ronda INT NOT NULL CHECK (numero_ronda >= 1),
    monto_pagado DECIMAL(10, 2) NOT NULL CHECK (monto_pagado > 0),
    fecha_pago TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    folio VARCHAR(30) NOT NULL UNIQUE,
    sync_uuid UUID UNIQUE,
    CONSTRAINT uq_participante_ronda UNIQUE (participante_id, numero_ronda)
);

-- 8. TABLA DE GASTOS (Control de egresos del hogar y surtido de mercancía)
CREATE TABLE gastos (
    id SERIAL PRIMARY KEY,
    usuario_id INT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    categoria VARCHAR(20) NOT NULL CHECK (categoria IN ('HOGAR', 'SURTIDO', 'OTROS')),
    descripcion VARCHAR(180) NOT NULL,
    monto DECIMAL(10, 2) NOT NULL CHECK (monto > 0),
    fecha_gasto DATE NOT NULL DEFAULT CURRENT_DATE,
    sync_uuid UUID UNIQUE,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- ÍNDICES DE OPTIMIZACIÓN DE CONSULTAS
-- ============================================================================
CREATE INDEX idx_clientes_usuario ON clientes(usuario_id);
CREATE INDEX idx_clientes_token ON clientes(token_acceso);
CREATE INDEX idx_ventas_cliente_estado ON ventas_credito(cliente_id, estado);
CREATE INDEX idx_abonos_venta ON abonos(venta_id);
CREATE INDEX idx_tanda_participantes_tanda ON tanda_participantes(tanda_id);
CREATE INDEX idx_tanda_pagos_participante ON tanda_pagos(participante_id);
CREATE INDEX idx_gastos_usuario_fecha ON gastos(usuario_id, fecha_gasto);