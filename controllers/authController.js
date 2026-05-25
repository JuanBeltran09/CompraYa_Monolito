const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const UsuarioRepository = require('../repositories/UsuarioRepository');
const SesionRepository = require('../repositories/SesionRepository');

/**
 * Helper to consolidate query statistics for metadata responses.
 */
function getMeta(req, ...moreQueries) {
  const queries = [...(req.dbQueries || [])];
  for (const qGroup of moreQueries) {
    if (Array.isArray(qGroup)) {
      queries.push(...qGroup);
    } else if (qGroup) {
      queries.push(qGroup);
    }
  }
  return { queries };
}

class AuthController {
  /**
   * Register a new user account.
   */
  async register(req, res) {
    const { email, password, nombre_completo, pais, direccion } = req.body;
    
    if (!email || !password || !nombre_completo) {
      return res.status(400).json({
        success: false,
        message: 'Por favor, completa todos los campos obligatorios (email, password, nombre completo).',
        meta: getMeta(req)
      });
    }

    try {
      // 1. Check if user already exists
      const { data: existingUser, queries: checkQueries } = await UsuarioRepository.getByEmail(email);
      req.dbQueries.push(...checkQueries);

      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: 'El correo electrónico ya está registrado.',
          meta: getMeta(req)
        });
      }

      // 2. Hash the password
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);

      // 3. Create user record
      const { data: newUser, queries: createQueries } = await UsuarioRepository.create({
        email,
        passwordHash,
        nombreCompleto: nombre_completo,
        pais: pais || 'Colombia',
        direccion: direccion || {}
      });
      req.dbQueries.push(...createQueries);

      // 4. Autologin: Create session in DB
      const sessionToken = crypto.randomBytes(32).toString('hex');
      const expira = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      const sessionPayload = { ip: req.ip, userAgent: req.headers['user-agent'] };

      const { queries: sessionQueries } = await SesionRepository.createOrUpdateSession(
        sessionToken,
        newUser.id,
        sessionPayload,
        expira
      );
      req.dbQueries.push(...sessionQueries);

      res.status(201).json({
        success: true,
        message: 'Registro completado con éxito.',
        data: {
          session_id: sessionToken,
          user: {
            id: newUser.id,
            email: newUser.email,
            nombre_completo: newUser.nombre_completo
          }
        },
        meta: getMeta(req)
      });

    } catch (err) {
      console.error('Error during registration:', err);
      res.status(500).json({
        success: false,
        message: 'Ocurrió un error interno en el servidor.',
        meta: getMeta(req)
      });
    }
  }

  /**
   * Authenticate a user and create a session.
   */
  async login(req, res) {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Por favor, ingresa correo electrónico y contraseña.',
        meta: getMeta(req)
      });
    }

    try {
      // 1. Fetch user by email
      const { data: user, queries: fetchQueries } = await UsuarioRepository.getByEmail(email);
      req.dbQueries.push(...fetchQueries);

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Correo electrónico o contraseña incorrectos.',
          meta: getMeta(req)
        });
      }

      // 2. Validate password
      // For seed users, password might be plain text or a different hash.
      // The seeder sets '$2a$10$tZ2R8/3vM5aVscXkoxDTe.7YyS2eH3b/YV6v7.07e/0XG0n3Wly8m' which is the hash of 'admin123'.
      // If the password matches or is 'hash_demo' (from standard seed), let's support both for safety.
      let isMatch = false;
      if (user.password_hash === 'hash_demo') {
        isMatch = (password === 'admin123'); // demo bypass
      } else {
        isMatch = await bcrypt.compare(password, user.password_hash);
      }

      if (!isMatch) {
        return res.status(401).json({
          success: false,
          message: 'Correo electrónico o contraseña incorrectos.',
          meta: getMeta(req)
        });
      }

      // 3. Create session token and write to database
      const sessionToken = crypto.randomBytes(32).toString('hex');
      const expira = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      const sessionPayload = { ip: req.ip, userAgent: req.headers['user-agent'] };

      const { queries: sessionQueries } = await SesionRepository.createOrUpdateSession(
        sessionToken,
        user.id,
        sessionPayload,
        expira
      );
      req.dbQueries.push(...sessionQueries);

      res.status(200).json({
        success: true,
        message: 'Inicio de sesión exitoso.',
        data: {
          session_id: sessionToken,
          user: {
            id: user.id,
            email: user.email,
            nombre_completo: user.nombre_completo
          }
        },
        meta: getMeta(req)
      });

    } catch (err) {
      console.error('Error during login:', err);
      res.status(500).json({
        success: false,
        message: 'Ocurrió un error en el servidor.',
        meta: getMeta(req)
      });
    }
  }

  /**
   * Log out a user by destroying their database session.
   */
  async logout(req, res) {
    if (!req.sessionId) {
      return res.status(200).json({
        success: true,
        message: 'Sesión cerrada (sin sesión activa).',
        meta: getMeta(req)
      });
    }

    try {
      const { queries: destroyQueries } = await SesionRepository.destroySession(req.sessionId);
      req.dbQueries.push(...destroyQueries);

      res.status(200).json({
        success: true,
        message: 'Sesión cerrada con éxito.',
        meta: getMeta(req)
      });
    } catch (err) {
      console.error('Error during logout:', err);
      res.status(500).json({
        success: false,
        message: 'Error al cerrar sesión.',
        meta: getMeta(req)
      });
    }
  }

  /**
   * Check session validity and retrieve active user profile.
   */
  async checkSession(req, res) {
    if (!req.user) {
      return res.status(200).json({
        success: true,
        data: { user: null },
        meta: getMeta(req)
      });
    }

    res.status(200).json({
      success: true,
      data: {
        user: req.user
      },
      meta: getMeta(req)
    });
  }
}

module.exports = new AuthController();
