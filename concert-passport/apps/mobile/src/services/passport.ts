import { supabase } from './supabase';
import type { Passport, Stamp, UserWrapped } from '@concert-passport/shared';

export async function getPassport(userId: string) {
  const { data, error } = await supabase
    .from('passports')
    .select(`
      *,
      profile:profiles(*),
      stamps(
        *,
        artist:artists(*)
      )
    `)
    .eq('user_id', userId)
    .single();

  if (error) throw error;
  return data as Passport & { stamps: Stamp[] };
}

export async function getStamps(userId: string) {
  const { data, error } = await supabase
    .from('stamps')
    .select('*, artist:artists(*)')
    .eq('user_id', userId)
    .order('issued_at', { ascending: false });

  if (error) throw error;
  return data as Stamp[];
}

export async function getWrapped(userId: string, year: number) {
  const { data, error } = await supabase
    .from('user_wrapped')
    .select(`
      *,
      top_artist:artists(*),
      top_venue:venues(*),
      first_show:show_logs(*, show:shows(*, artist:artists(*), venue:venues(*))),
      highest_rated_show:show_logs(*, show:shows(*, artist:artists(*), venue:venues(*)))
    `)
    .eq('user_id', userId)
    .eq('year', year)
    .single();

  if (error) throw error;
  return data as UserWrapped;
}

export async function updatePassportTheme(theme: string, coverColor: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('passports')
    .update({ theme, cover_color: coverColor })
    .eq('user_id', user.id);

  if (error) throw error;
}
