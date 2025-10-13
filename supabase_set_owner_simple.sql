-- Setze Ihre User ID als Owner
-- User ID: 9a7b61be-0c51-453c-a657-93bac639f85e

-- Aktualisiere Ihr Profil auf Owner
UPDATE public.profiles 
SET role = 'owner' 
WHERE id = '9a7b61be-0c51-453c-a657-93bac639f85e';

-- Falls das Profil noch nicht existiert, erstelle es
INSERT INTO public.profiles (id, email, role)
SELECT '9a7b61be-0c51-453c-a657-93bac639f85e', email, 'owner'
FROM auth.users 
WHERE id = '9a7b61be-0c51-453c-a657-93bac639f85e'
ON CONFLICT (id) DO UPDATE SET role = 'owner';

-- Bestätigung
SELECT 'Owner-Rolle für User ID 9a7b61be-0c51-453c-a657-93bac639f85e gesetzt!' as status;


