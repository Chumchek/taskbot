import { existsSync } from 'fs';
import { resolve } from 'path';
import { configDotenv } from 'dotenv';

// Load .env.test if it exists, so integration tests can pick up DATABASE_URL etc.
const envTestPath = resolve(process.cwd(), '.env.test');
if (existsSync(envTestPath)) {
  configDotenv({ path: envTestPath });
}
