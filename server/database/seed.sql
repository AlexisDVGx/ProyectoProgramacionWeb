-- ============================================================================
-- DATOS SEMILLA DE PRUEBA
-- Nota: El hash corresponde a la contraseña de prueba 'Admin1234*' (bcrypt)
-- ============================================================================

INSERT INTO usuarios (nombre, email, password_hash, negocio_nombre)
VALUES (
    'Elena Morales',
    'elena@negocio.local',
    '$2b$10$CwTycUXWue0Thq9StjUM0uJ8.jZ2X1u5N6qR9yK8vL3pM4wQ7sT2a',
    'Aromas y Bienestar Elena'
);

-- Clientes de prueba (con tokens deterministas para pruebas de vista pública)
INSERT INTO clientes (usuario_id, nombre, telefono, notas, token_acceso) VALUES
(1, 'Sofía Ramírez', '7821001122', 'Prefiere perfumes florales, paga los viernes', '11111111-1111-4111-8111-111111111111'),
(1, 'Carmen Ortiz', '7821003344', 'Clienta frecuente de productos naturales', '22222222-2222-4222-8222-222222222222'),
(1, 'Laura Méndez', '7821005566', 'Vecina, participa en tanda quincenal', '33333333-3333-4333-8333-333333333333');

-- Ventas a crédito
INSERT INTO ventas_credito (cliente_id, concepto, monto_total, saldo_pendiente, estado, fecha_venta) VALUES
(1, 'Perfume Carolina Herrera 100ml', 1200.00, 700.00, 'PENDIENTE', CURRENT_DATE - INTERVAL '10 days'),
(2, 'Kit Aceites Esenciales + Crema', 650.00, 650.00, 'PENDIENTE', CURRENT_DATE - INTERVAL '3 days');

-- Abono parcial registrado a la venta 1 ($1200 - $500 = $700 pendiente)
INSERT INTO abonos (venta_id, monto, folio, notas) VALUES
(1, 500.00, 'ABN-2026-0001', 'Primer abono en efectivo');

-- Tanda activa de 3 turnos ($500 quincenales)
INSERT INTO tandas (usuario_id, nombre, monto_aportacion, frecuencia, total_rondas, fecha_inicio, estado) VALUES
(1, 'Tanda Quincenal Otoño', 500.00, 'QUINCENAL', 3, CURRENT_DATE - INTERVAL '15 days', 'ACTIVA');

INSERT INTO tanda_participantes (tanda_id, cliente_id, numero_turno, fecha_entrega_estimada, entregado) VALUES
(1, 1, 1, CURRENT_DATE - INTERVAL '15 days', TRUE),
(1, 2, 2, CURRENT_DATE, FALSE),
(1, 3, 3, CURRENT_DATE + INTERVAL '15 days', FALSE);

-- Pagos de la Ronda 1 de la tanda
INSERT INTO tanda_pagos (participante_id, numero_ronda, monto_pagado, folio) VALUES
(1, 1, 500.00, 'TND-2026-0001'),
(2, 1, 500.00, 'TND-2026-0002'),
(3, 1, 500.00, 'TND-2026-0003');

-- Gastos separados por categoría
INSERT INTO gastos (usuario_id, categoria, descripcion, monto, fecha_gasto) VALUES
(1, 'SURTIDO', 'Compra de lote de 4 perfumes con proveedor', 1800.00, CURRENT_DATE - INTERVAL '12 days'),
(1, 'HOGAR', 'Pago de recibo de luz y despensa semanal', 950.00, CURRENT_DATE - INTERVAL '2 days');