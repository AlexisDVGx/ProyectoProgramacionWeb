import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../config/db.js';

const signToken = (usuario) =>
  jwt.sign(
    { id: usuario.id, email: usuario.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '30d' }
  );

export const register = async (req, res, next) => {
  try {
    const { nombre, email, password, negocio_nombre } = req.body;

    const existing = await query('SELECT id FROM usuarios WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({
        ok: false,
        mensaje: 'Este correo ya está registrado.',
      });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const result = await query(
      `INSERT INTO usuarios (nombre, email, password_hash, negocio_nombre)
       VALUES ($1, $2, $3, $4)
       RETURNING id, nombre, email, negocio_nombre, creado_en`,
      [nombre, email, passwordHash, negocio_nombre || 'Esencias y Hogar']
    );

    const usuario = result.rows[0];
    const token = signToken(usuario);

    res.status(201).json({
      ok: true,
      mensaje: 'Cuenta creada correctamente',
      token,
      usuario,
    });
  } catch (error) {
    next(error);
  }
};

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const result = await query(
      'SELECT id, nombre, email, password_hash, negocio_nombre FROM usuarios WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        ok: false,
        mensaje: 'Credenciales incorrectas.',
      });
    }

    const usuario = result.rows[0];
    const isMatch = await bcrypt.compare(password, usuario.password_hash);

    if (!isMatch) {
      return res.status(401).json({
        ok: false,
        mensaje: 'Credenciales incorrectas.',
      });
    }

    const token = signToken(usuario);
    delete usuario.password_hash;

    res.json({
      ok: true,
      token,
      usuario,
    });
  } catch (error) {
    next(error);
  }
};

export const getProfile = async (req, res, next) => {
  try {
    const result = await query(
      'SELECT id, nombre, email, negocio_nombre, creado_en FROM usuarios WHERE id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ ok: false, mensaje: 'Usuario no encontrado.' });
    }

    res.json({ ok: true, usuario: result.rows[0] });
  } catch (error) {
    next(error);
  }
};