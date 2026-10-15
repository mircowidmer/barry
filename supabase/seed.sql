-- Local development only. The hosted project sets these in the dashboard's Vault.
select vault.create_secret('http://supabase_kong_barry-local:8000/functions/v1/deliver', 'deliver_url');
select vault.create_secret('local-deliver-secret', 'deliver_secret');
