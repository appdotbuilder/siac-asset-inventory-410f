import { db } from '../db';
import { usersTable, userActivityLogsTable } from '../db/schema';
import { type LoginInput, type User } from '../schema';
import { eq } from 'drizzle-orm';
import { sign } from 'jsonwebtoken';

export async function loginUser(input: LoginInput): Promise<{ user: User; token: string } | null> {
  try {
    // Find user by email
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.email, input.email))
      .execute();

    if (users.length === 0) {
      return null; // User not found
    }

    const user = users[0];

    // Check if user is active
    if (!user.is_active) {
      return null; // User account is disabled
    }

    // For this implementation, we'll use a simple password verification
    // In a real application, you would use bcrypt or similar to verify hashed passwords
    const passwordHash = await Bun.password.hash(input.password);
    const isPasswordValid = await Bun.password.verify(input.password, user.password_hash);

    if (!isPasswordValid) {
      return null; // Invalid password
    }

    // Generate JWT token (using a simple secret for demo purposes)
    const jwtSecret = process.env['JWT_SECRET'] || 'your-secret-key';
    const token = sign(
      { 
        userId: user.id, 
        email: user.email, 
        role: user.role 
      },
      jwtSecret,
      { expiresIn: '24h' }
    );

    // Log login activity
    await db.insert(userActivityLogsTable)
      .values({
        id: crypto.randomUUID(),
        user_id: user.id,
        action: 'LOGIN',
        entity_type: 'USER',
        entity_id: user.id,
        details: `User logged in from email: ${input.email}`,
        timestamp: new Date()
      })
      .execute();

    // Return user data (excluding password hash) and token
    const { password_hash, ...userWithoutPassword } = user;
    
    return {
      user: userWithoutPassword as User,
      token
    };

  } catch (error) {
    console.error('Login failed:', error);
    throw error;
  }
}