import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import prisma from '../utils/prisma.js'

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
}

// Seed default admin user if none exists
export const seedAdminUser = async () => {
  try {
    const count = await prisma.user.count()
    if (count === 0) {
      const hashed = await bcrypt.hash('admin123', 10)
      await prisma.user.create({
        data: {
          name: 'Admin',
          email: 'admin@hotel.com',
          password: hashed,
          role: 'admin',
        },
      })
      console.log('Default admin user created: admin@hotel.com / admin123')
    }
  } catch (err) {
    console.error('Failed to seed admin user:', err.message)
  }
}

// POST /auth/login
export const login = async (req, res) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' })
    }

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password.' })
    }

    const isMatch = await bcrypt.compare(password, user.password)
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password.' })
    }

    const payload = { userId: user.id, email: user.email, role: user.role }
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' })

    res.cookie('token', token, COOKIE_OPTIONS)

    return res.status(200).json({
      message: 'Login successful.',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    })
  } catch (err) {
    console.error('Login error:', err)
    return res.status(500).json({ message: 'Internal server error.' })
  }
}

// POST /auth/logout
export const logout = (req, res) => {
  try {
    res.clearCookie('token', { httpOnly: true, sameSite: 'lax' })
    return res.status(200).json({ message: 'Logged out successfully.' })
  } catch (err) {
    console.error('Logout error:', err)
    return res.status(500).json({ message: 'Internal server error.' })
  }
}

// GET /auth/me (protected)
export const me = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    })

    if (!user) {
      return res.status(404).json({ message: 'User not found.' })
    }

    return res.status(200).json({ user })
  } catch (err) {
    console.error('Me error:', err)
    return res.status(500).json({ message: 'Internal server error.' })
  }
}
