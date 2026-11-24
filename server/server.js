import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { query } from './src/config/db.js';
import authRoutes from './src/routes/authRoutes.js';
import clientesRoutes from './src/routes/clientesRoutes.js';
import ventasRoutes from './src/routes/ventasRoutes.js';
import tandasRoutes from './src/routes/tandasRoutes.js';
import gastosRoutes from './src/routes/gastosRoutes.js';
import syncAndPublicRoutes from './src/routes/syncAndPublicRoutes.js';
import { errorHandler } from './src/middlewares/errorHandler.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(
  cors({
    origin: process.env.CLIENT_URL || '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', async (req, res, next) => {
  try {
    const dbCheck = await query('SELECT NOW() AS hora_servidor');
    res.json({
      ok: true,
      estado: 'Servidor en línea',
      base_datos: 'Conectada a PostgreSQL',
      timestamp: dbCheck.rows[0].hora_servidor,
    });
  } catch (error) {
    next(error);
  }
});

// Rutas de la API REST
app.use('/api/auth', authRoutes);
app.use('/api/clientes', clientesRoutes);
app.use('/api/ventas', ventasRoutes);
app.use('/api/tandas', tandasRoutes);
app.use('/api/gastos', gastosRoutes);
app.use('/api', syncAndPublicRoutes);

app.use((req, res) => {
  res.status(404).json({ ok: false, mensaje: 'Endpoint no encontrado' });
});

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});