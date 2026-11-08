/** Supabase herkese açık (anon) anahtarı tasarım gereği tarayıcıda bulunur; veriyi koruyan şey sunucudaki RLS kurallarıdır (supabase/schema.sql). */
export const SUPABASE_URL: string = import.meta.env.VITE_SUPABASE_URL ?? ''
export const SUPABASE_KEY: string = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''
export const CLOUD = SUPABASE_URL.startsWith('https://') && SUPABASE_KEY.length > 20
