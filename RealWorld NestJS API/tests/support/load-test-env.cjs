// Deliberately never load .env or .env.local. CI supplies explicit test values.
require('dotenv').config({ path: '.env.test.local', quiet: true });
