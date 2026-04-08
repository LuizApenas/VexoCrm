import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import mongoSanitize from 'express-mongo-sanitize';
import hpp from 'hpp';

/**
 * Configuração de Helmet para headers de segurança
 */
export const helmetConfig = helmet({
  // Content Security Policy
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
    },
  },
  // Clickjacking protection
  frameguard: {
    action: 'deny',
  },
  // Prevent MIME type sniffing
  noSniff: true,
  // XSS Protection
  xssFilter: true,
  // HSTS (HTTP Strict Transport Security)
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },
  // Cross-Origin policies
  crossOriginResourcePolicy: {
    policy: 'cross-origin',
  },
});

/**
 * Rate Limiters específicos por endpoint
 */

// Login rate limiter: 5 tentativas em 15 minutos
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Muitas tentativas de login. Tente novamente em 15 minutos.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => process.env.NODE_ENV === 'development',
});

// Signup rate limiter: 3 tentativas em 1 hora
export const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Muitas tentativas de cadastro. Tente novamente em 1 hora.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => process.env.NODE_ENV === 'development',
});

// API rate limiter: 100 requisições em 15 minutos
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Muitas requisições. Tente novamente mais tarde.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => process.env.NODE_ENV === 'development',
});

// Webhook rate limiter: 60 requisições por minuto
export const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Rate limit excedido para webhooks.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Middleware de sanitização contra NoSQL injection
 */
export const sanitizationMiddleware = mongoSanitize({
  onSanitize: ({ req, key }) => {
    console.warn(`Potential NoSQL injection attempt on ${key}`);
  },
});

/**
 * Middleware de proteção contra HTTP Parameter Pollution
 */
export const parameterPollutionProtection = hpp({
  whitelist: ['sort', 'fields', 'q', 'limit', 'page'], // Parâmetros que podem ser arrays
});

/**
 * Middleware de tratamento seguro de erros
 */
export const secureErrorHandler = (err, req, res, next) => {
  const isDevelopment = process.env.NODE_ENV === 'development';

  // Log do erro para debugging
  console.error('Error:', {
    message: err.message,
    status: err.status || 500,
    timestamp: new Date().toISOString(),
    path: req.path,
    method: req.method,
  });

  // Não expor stack trace em produção
  const errorResponse = {
    error: {
      code: err.code || 'INTERNAL_SERVER_ERROR',
      message: isDevelopment ? err.message : 'Ocorreu um erro interno',
      ...(isDevelopment && { stack: err.stack }),
    },
  };

  res.status(err.status || 500).json(errorResponse);
};

/**
 * Middleware para validar Content-Type
 */
export const validateContentType = (req, res, next) => {
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    const contentType = req.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      return res.status(400).json({
        error: {
          code: 'INVALID_CONTENT_TYPE',
          message: 'Content-Type deve ser application/json',
        },
      });
    }
  }
  next();
};

/**
 * Middleware para remover headers sensíveis da resposta
 */
export const removesSensitiveHeaders = (req, res, next) => {
  // Remove headers que podem revelar informações do servidor
  res.removeHeader('X-Powered-By');
  res.removeHeader('Server');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
};
