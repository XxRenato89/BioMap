import { createInterface } from 'node:readline/promises';
import pg from 'pg';
import { hashPassword, passwordProblem } from '../src/admin/password.js';

/**
 * CLI: crea el único administrador del panel o le pone una contraseña
 * temporal (si la olvidó). Al entrar, el panel le pedirá cambiarla.
 *
 * Uso: npm run admin:password -w apps/api -- [usuario]
 * La contraseña se escribe en la consola (o llega en ADMIN_PASSWORD, para scripts).
 */
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}
const username = process.argv[2] ?? 'admin';
let password = process.env.ADMIN_PASSWORD;
if (!password) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  password = await rl.question(`Contraseña temporal para "${username}": `);
  rl.close();
}
const problem = passwordProblem(password, { username });
if (problem) {
  console.error(problem);
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: databaseUrl });
try {
  const hash = await hashPassword(password);
  const { rowCount } = await pool.query(
    `UPDATE admin_users
        SET username = $1, password_hash = $2, password_changed_at = now(),
            must_change_password = true, is_active = true`,
    [username, hash],
  );
  if (rowCount === 0) {
    await pool.query('INSERT INTO admin_users (username, password_hash) VALUES ($1, $2)', [
      username,
      hash,
    ]);
  }
  /* Borra los fallos anteriores: si estaba bloqueado, queda desbloqueado. */
  await pool.query('DELETE FROM login_attempts WHERE lower(username) = lower($1)', [username]);
  console.log(`Listo: "${username}" debe cambiar la contraseña al entrar al panel (/admin).`);
} finally {
  await pool.end();
}
