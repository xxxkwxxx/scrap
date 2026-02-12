const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyMigration() {
    const sql = `
    -- Enable RLS for system_status
    ALTER TABLE system_status ENABLE ROW LEVEL SECURITY;

    -- Drop existing policies if they exist to avoid errors
    DROP POLICY IF EXISTS "Allow authenticated users to select system_status" ON system_status;
    DROP POLICY IF EXISTS "Allow authenticated users to update system_status" ON system_status;
    DROP POLICY IF EXISTS "Allow authenticated users to insert system_status" ON system_status;

    -- Allow authenticated users to select system status
    CREATE POLICY "Allow authenticated users to select system_status"
    ON system_status FOR SELECT
    TO authenticated
    USING (true);

    -- Allow authenticated users to update system status
    CREATE POLICY "Allow authenticated users to update system_status"
    ON system_status FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

    -- Allow authenticated users to insert system_status
    CREATE POLICY "Allow authenticated users to insert system_status"
    ON system_status FOR INSERT
    TO authenticated
    WITH CHECK (true);
    `;

    // We can't execute raw SQL with supabase-js directly unless we use an RPC function that executes SQL, 
    // OR we use the pg library. 
    // BUT! Since we are using the service_role key, we can simply bypass RLS for now 
    // and rely on the fact that we might have enabled RLS but not added policies yet? 
    // No, wait. supabase-js client doesn't have a method to execute raw SQL.

    // Correction: I cannot execute raw SQL with supabase-js client.
    // I need to use the 'postgres' or 'pg' library to connect to the DB directly if I have the connection string.
    // I do NOT have the connection string in the .env file.

    // However, I can try to use the `rpc` method if there is a `exec_sql` function.
    // Most supabase projects don't have this by default.

    // Let's re-examine my options.
    // 1. MCP tool failed.
    // 2. Direct SQL via JS client impossible without connection string or RPC.

    // Actually, I can use the `mcp_supabase-mcp-server_execute_sql` tool! 
    // I previously tried `mcp_supabase-mcp-server_apply_migration` which failed on "Project reference".
    // Maybe `execute_sql` works differently?

    // Let's try to output the SQL to console so I can copy it to the MCP tool call.
    console.log(sql);
}

applyMigration();
