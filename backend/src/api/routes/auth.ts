/**
 * Authentication Routes
 */

import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const router = Router();

// Mock user database
const users = new Map([
  ['admin@company.com', {
    id: 'user_admin',
    email: 'admin@company.com',
    password: bcrypt.hashSync('admin123', 10),
    firstName: 'Admin',
    lastName: 'User',
    role: 'admin',
    teamId: 'team_support',
    skills: ['general', 'technical', 'billing'],
  }],
  ['agent@company.com', {
    id: 'user_agent1',
    email: 'agent@company.com',
    password: bcrypt.hashSync('agent123', 10),
    firstName: 'Support',
    lastName: 'Agent',
    role: 'agent',
    teamId: 'team_support',
    skills: ['general', 'billing'],
  }],
  ['engineer@company.com', {
    id: 'user_engineer1',
    email: 'engineer@company.com',
    password: bcrypt.hashSync('engineer123', 10),
    firstName: 'Tech',
    lastName: 'Engineer',
    role: 'engineer',
    teamId: 'team_engineering',
    skills: ['technical', 'infrastructure'],
  }],
]);

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Email and password are required' },
      });
    }

    const user = users.get(email);

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
        accessToken,
        refreshToken,
        expiresIn: 3600,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          teamId: user.teamId,
          skills: user.skills,
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: (error as Error).message },
    });
  }
});

// POST /api/auth/refresh
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Refresh token is required' },
      });
    }

    const decoded = jwt.verify(
      refreshToken,
      process.env.JWT_SECRET || 'dev-secret-change-in-production'
    ) as { sub: string; type: string };

    if (decoded.type !== 'refresh') {
      throw new Error('Invalid token type');
    }

    // Find user
    let user = null;
    for (const [, u] of users) {
      if (u.id === decoded.sub) {
        user = u;
        break;
      }
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'User not found' },
      });
    }

    // Generate new access token
    const accessToken = jwt.sign(
      { sub: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'dev-secret-change-in-production',
      { expiresIn: '1h' }
    );

    res.json({
      success: true,
      data: {
        accessToken,
        expiresIn: 3600,
      },
    });
  } catch (error) {
    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Invalid refresh token' },
    });
  }
});

// POST /api/auth/logout
router.post('/logout', (req: Request, res: Response) => {
  // In production, invalidate the refresh token
  res.json({
    success: true,
    data: { message: 'Logged out successfully' },
  });
});

// GET /api/auth/me
router.get('/me', (req: Request, res: Response) => {
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

    // Find user
    const user = users.get(decoded.email);

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
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        teamId: user.teamId,
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
