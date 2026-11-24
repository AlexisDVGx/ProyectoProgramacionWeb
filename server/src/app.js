const allowedOrigins = [
  'http://localhost:5173',
  process.env.CLIENT_URL?.replace(/\/$/, ''),
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Permitir peticiones sin origin (apps móviles, Postman) o desde orígenes autorizados
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Origen no permitido por CORS'));
    },
    credentials: true,
  })
);