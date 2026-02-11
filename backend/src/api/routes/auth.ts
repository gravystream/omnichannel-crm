import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getPool } from '../../utils/database';

const router = Router();

// Login endpoint
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Email and password are required' },
      });
    }

    // Get user from database
    const pool = getPool();
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Invalid credentials' },
      });
    }

    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Invalid credentials' },
      });
    }

    // Generate tokens
    const accessToken = jwt.sign(
      { sub: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'dev-secret-change-in-production',
      { expiresIn: '1h' }
    );

    const refreshToken = jwt.sign(
      { sub: user.id, type: 'refresh' },
      process.env.JWT_SECRET || 'dev-secret-change-in-production',
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      data: {
        token: accessToken,
        refreshToken,
        expiresIn: 3600,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          role: user.role,
          teamId: user.team_id,
          skills: user.skills,
        },
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Internal server error' },
    });
  }
});

// Register endpoint (for creating agent login credentials)
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password, firstName, lastName, role, teamId, skills } = req.body;

    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Email, password, first name, and last name are required' },
      });
    }

    // Check if user already exists
    const pool = getPool();
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'USER_EXISTS', message: 'User with this email already exists' },
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const result = await pool.query(
      `INSERT INTO users (email, password, first_name, last_name, role, team_id, skills, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
       RETURNING id, email, first_name, last_name, role, team_id, skills`,
      [email, hashedPassword, firstName, lastName, role || 'agent', teamId || null, skills || []]
    );

    const user = result.rows[0];

    res.status(201).json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        teamId: user.team_id,
        skills: user.skills,
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Internal server error' },
    });
  }
});

// Logout endpoint
router.post('/logout', (req: Request, res: Response) => {
  res.json({ success: true });
});

// Get current user
router.get('/me', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'No token provided' },
      });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'dev-secret-change-in-production'
    ) as { sub: string; email: string; role: string };

    // Get user from database
    const pool = getPool();
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [decoded.email]
    );

    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'User not found' },
      });
    }

    res.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        teamId: user.team_id,
        skills: user.skills,
      },
    });
  } catch (error) {
    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Invalid token' },
    });
  }
});

export default router;
