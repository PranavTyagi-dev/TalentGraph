// Use environment variables so an administrator password is never stored in source.
import bcrypt from 'bcryptjs';
import { db } from '../server/db.js';

const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;
try {
  if (!email || !password || password.length < 8 || Buffer.byteLength(password) > 72) {
    throw new Error(
      'Set ADMIN_EMAIL and ADMIN_PASSWORD (at least 8 characters, at most 72 bytes).'
    );
  }
  await db.user.create({
    data: {
      name: 'Administrator',
      email,
      role: 'ADMIN',
      passwordHash: await bcrypt.hash(password, 10),
    },
  });
  console.log('Administrator created.');
} finally {
  await db.$disconnect();
}
