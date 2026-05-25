-- Tabla de categorías (para el catálogo)
CREATE TABLE IF NOT EXISTS categorias (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL UNIQUE,
    descripcion TEXT,
    padre_id INT REFERENCES categorias(id) ON DELETE SET NULL
);

-- Tabla de productos (esquema flexible mediante JSONB)
CREATE TABLE IF NOT EXISTS productos (
    id SERIAL PRIMARY KEY,
    sku VARCHAR(50) UNIQUE NOT NULL,
    nombre VARCHAR(255) NOT NULL,
    descripcion TEXT,
    categoria_id INT REFERENCES categorias(id),
    precio_base NUMERIC(12,2) NOT NULL,
    precio_descuento NUMERIC(12,2),
    moneda CHAR(3) DEFAULT 'COP',
    atributos JSONB,   -- aquí va el campo "detalles" flexible (ej. procesador, talla, etc.)
    imagen_url TEXT,
    stock_total INT NOT NULL DEFAULT 0,
    creado_en TIMESTAMPTZ DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de usuarios (autenticación y perfil)
CREATE TABLE IF NOT EXISTS usuarios (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    nombre_completo VARCHAR(255),
    pais VARCHAR(100),
    direccion JSONB,   -- flexible para distintos países
    creado_en TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de sesiones (para almacenar sesiones en BD si no se usa Redis)
CREATE TABLE IF NOT EXISTS sesiones (
    id VARCHAR(128) PRIMARY KEY,
    user_id INT REFERENCES usuarios(id) ON DELETE CASCADE,
    payload JSONB,
    ultimo_acceso TIMESTAMPTZ DEFAULT NOW(),
    expira TIMESTAMPTZ
);

-- Tabla carrito (modelado como en Cassandra, pero en PostgreSQL)
CREATE TABLE IF NOT EXISTS carrito (
    usuario_id INT REFERENCES usuarios(id) ON DELETE CASCADE,
    producto_id INT REFERENCES productos(id),
    cantidad INT NOT NULL CHECK (cantidad > 0),
    agregado_en TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (usuario_id, producto_id)
);

-- Tabla pedidos (consistencia ACID)
CREATE TABLE IF NOT EXISTS pedidos (
    id SERIAL PRIMARY KEY,
    usuario_id INT NOT NULL REFERENCES usuarios(id),
    estado VARCHAR(20) NOT NULL CHECK (estado IN ('pendiente','pagado','enviado','entregado','cancelado')),
    total NUMERIC(12,2) NOT NULL,
    moneda CHAR(3) DEFAULT 'COP',
    direccion_entrega JSONB NOT NULL,
    creado_en TIMESTAMPTZ DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla items_pedido
CREATE TABLE IF NOT EXISTS items_pedido (
    id SERIAL PRIMARY KEY,
    pedido_id INT NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
    producto_sku VARCHAR(50) NOT NULL,
    nombre_producto VARCHAR(255) NOT NULL,
    cantidad INT NOT NULL CHECK (cantidad > 0),
    precio_unitario NUMERIC(12,2) NOT NULL
);

-- Tabla pagos
CREATE TABLE IF NOT EXISTS pagos (
    id SERIAL PRIMARY KEY,
    pedido_id INT NOT NULL REFERENCES pedidos(id),
    metodo VARCHAR(30) NOT NULL,
    estado VARCHAR(20) NOT NULL CHECK (estado IN ('aprobado','rechazado','pendiente','reembolsado')),
    referencia VARCHAR(100),
    monto NUMERIC(12,2) NOT NULL,
    procesado_en TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para rendimiento (si no existen)
CREATE INDEX IF NOT EXISTS idx_productos_categoria ON productos(categoria_id);
CREATE INDEX IF NOT EXISTS idx_productos_sku ON productos(sku);
CREATE INDEX IF NOT EXISTS idx_productos_nombre ON productos(nombre);
CREATE INDEX IF NOT EXISTS idx_pedidos_usuario ON pedidos(usuario_id);
CREATE INDEX IF NOT EXISTS idx_carrito_usuario ON carrito(usuario_id);
CREATE INDEX IF NOT EXISTS idx_sesiones_user ON sesiones(user_id);
