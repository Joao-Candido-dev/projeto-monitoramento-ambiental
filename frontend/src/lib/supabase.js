import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Instância única. Sem as variáveis no .env, fica null e a página mostra o erro de configuração (nunca dados inventados).
// Sem login: nada de sessão no navegador.
export const supabase = url && key
  ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
  : null;
