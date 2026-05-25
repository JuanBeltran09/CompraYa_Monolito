const SesionRepository = require('../repositories/SesionRepository');

/**
 * Extracts and validates the DB-backed user session.
 * Tracks session query timing and attaches it to req.dbQueries for API response inclusion.
 */
async function loadSession(req, res, next) {
  req.dbQueries = req.dbQueries || [];
  req.user = null;
  req.sessionId = null;

  // Retrieve token from Authorization header or cookies
  let token = req.headers['authorization'] || req.headers['x-session-id'];
  
  if (token && token.startsWith('Bearer ')) {
    token = token.substring(7);
  }

  if (!token && req.headers.cookie) {
    const cookies = Object.fromEntries(
      req.headers.cookie.split(';').map(c => c.trim().split('='))
    );
    token = cookies['session_id'];
  }

  if (token) {
    try {
      const { data: session, queries } = await SesionRepository.getSession(token);
      if (queries) {
        req.dbQueries.push(...queries);
      }

      if (session) {
        req.user = {
          id: session.user_id,
          email: session.email,
          nombre_completo: session.nombre_completo
        };
        req.sessionId = token;

        // Slide session expiration window (touch session) asynchronously
        const newExpira = new Date(Date.now() + 24 * 60 * 60 * 1000); // +24 hours
        SesionRepository.touchSession(token, newExpira).then(({ queries: touchQueries }) => {
          if (touchQueries && req.dbQueries) {
            // Optional: log or push to next request. Since async, we don't block
          }
        }).catch(err => console.error('Error touching session:', err));
      }
    } catch (err) {
      console.error('Session loading database error:', err);
    }
  }

  next();
}

/**
 * Guard middleware for routes requiring authentication.
 */
function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Inicia sesión para realizar esta acción.',
      meta: {
        queries: req.dbQueries || []
      }
    });
  }
  next();
}

module.exports = {
  loadSession,
  requireAuth
};
