import { supabase } from './supabaseClient';

export interface Profile {
  id: string;
  email: string;
  role: 'owner' | 'user';
  created_at: string;
}

export interface UserWithRole {
  user_id: string;
  email: string;
  role: string;
  created_at: string;
}

// Prüfe, ob der aktuelle Benutzer Owner ist
export const isOwner = async (): Promise<boolean> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { data, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (error) {
      console.error('Fehler beim Prüfen der Owner-Rolle:', error);
      return false;
    }

    return data?.role === 'owner';
  } catch (error) {
    console.error('Fehler beim Prüfen der Owner-Rolle:', error);
    return false;
  }
};

// Prüfe, ob der aktuelle Benutzer Admin oder Owner ist (für Ihr Schema nur Owner)
export const isAdminOrOwner = async (): Promise<boolean> => {
  return await isOwner(); // In Ihrem Schema gibt es nur 'owner' und 'user'
};

// Hole die Rolle des aktuellen Benutzers
export const getCurrentUserRole = async (): Promise<string> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return 'user';

    const { data, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (error) {
      console.error('Fehler beim Abrufen der Benutzerrolle:', error);
      return 'user';
    }

    return data?.role || 'user';
  } catch (error) {
    console.error('Fehler beim Abrufen der Benutzerrolle:', error);
    return 'user';
  }
};

// Hole alle Benutzer mit ihren Rollen
export const getAllUsersWithRoles = async (): Promise<UserWithRole[]> => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, role, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Fehler beim Abrufen der Benutzer:', error);
      return [];
    }

    return data?.map(profile => ({
      user_id: profile.id,
      email: profile.email,
      role: profile.role,
      created_at: profile.created_at
    })) || [];
  } catch (error) {
    console.error('Fehler beim Abrufen der Benutzer:', error);
    return [];
  }
};

// Weise einem Benutzer eine Rolle zu
export const assignUserRole = async (userId: string, role: 'owner' | 'user'): Promise<void> => {
  try {
    const { error } = await supabase
      .from('profiles')
      .update({ role })
      .eq('id', userId);

    if (error) {
      console.error('Fehler beim Zuweisen der Rolle:', error);
      throw error;
    }
  } catch (error) {
    console.error('Fehler beim Zuweisen der Rolle:', error);
    throw error;
  }
};

// Entferne die Rolle eines Benutzers (setzt auf 'user')
export const removeUserRole = async (userId: string): Promise<void> => {
  try {
    const { error } = await supabase
      .from('profiles')
      .update({ role: 'user' })
      .eq('id', userId);

    if (error) {
      console.error('Fehler beim Entfernen der Rolle:', error);
      throw error;
    }
  } catch (error) {
    console.error('Fehler beim Entfernen der Rolle:', error);
    throw error;
  }
};

// Hole die Benutzerrolle direkt aus der Tabelle
export const getUserRole = async (userId: string): Promise<Profile | null> => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // Keine Rolle gefunden, Benutzer ist standardmäßig 'user'
        return null;
      }
      console.error('Fehler beim Abrufen der Benutzerrolle:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Fehler beim Abrufen der Benutzerrolle:', error);
    return null;
  }
};

// Erstelle ein Profil (wird automatisch durch Trigger erstellt)
export const createProfile = async (userId: string, email: string, role: 'owner' | 'user' = 'user'): Promise<Profile> => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .insert([{ id: userId, email, role }])
      .select()
      .single();

    if (error) {
      console.error('Fehler beim Erstellen des Profils:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Fehler beim Erstellen des Profils:', error);
    throw error;
  }
};

// Aktualisiere eine Benutzerrolle
export const updateUserRole = async (userId: string, role: 'owner' | 'user'): Promise<Profile> => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .update({ role })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      console.error('Fehler beim Aktualisieren der Benutzerrolle:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Fehler beim Aktualisieren der Benutzerrolle:', error);
    throw error;
  }
};
