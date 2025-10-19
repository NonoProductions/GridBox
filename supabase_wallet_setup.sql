-- Wallet und Transaktions-Tabellen Setup

-- 1. Erstelle wallets Tabelle
CREATE TABLE IF NOT EXISTS wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    balance DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- 2. Erstelle transactions Tabelle
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL, -- 'charge', 'rental', 'return', 'refund'
    amount DECIMAL(10, 2) NOT NULL,
    description TEXT,
    station_id UUID REFERENCES stations(id),
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Erstelle Indizes
CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_wallet_id ON transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);

-- 4. Erstelle Trigger für updated_at
CREATE OR REPLACE FUNCTION update_wallet_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_wallet_updated_at ON wallets;
CREATE TRIGGER trigger_update_wallet_updated_at
    BEFORE UPDATE ON wallets
    FOR EACH ROW
    EXECUTE FUNCTION update_wallet_updated_at();

-- 5. Erstelle Funktion zum automatischen Erstellen eines Wallets für neue User
CREATE OR REPLACE FUNCTION create_wallet_for_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO wallets (user_id, balance)
    VALUES (NEW.id, 100.00);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_create_wallet_on_signup ON auth.users;
CREATE TRIGGER trigger_create_wallet_on_signup
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION create_wallet_for_new_user();

-- 6. Erstelle Funktion zum Hinzufügen von Geld
CREATE OR REPLACE FUNCTION add_money_to_wallet(
    p_user_id UUID,
    p_amount DECIMAL(10, 2),
    p_description TEXT DEFAULT 'Guthaben aufgeladen'
)
RETURNS JSONB AS $$
DECLARE
    v_wallet_id UUID;
    v_new_balance DECIMAL(10, 2);
    v_transaction_id UUID;
BEGIN
    -- Validierung
    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Betrag muss größer als 0 sein';
    END IF;

    -- Wallet finden oder erstellen
    SELECT id INTO v_wallet_id FROM wallets WHERE user_id = p_user_id;
    
    IF v_wallet_id IS NULL THEN
        INSERT INTO wallets (user_id, balance)
        VALUES (p_user_id, 0.00)
        RETURNING id INTO v_wallet_id;
    END IF;

    -- Balance aktualisieren
    UPDATE wallets
    SET balance = balance + p_amount
    WHERE id = v_wallet_id
    RETURNING balance INTO v_new_balance;

    -- Transaktion erstellen
    INSERT INTO transactions (user_id, wallet_id, type, amount, description)
    VALUES (p_user_id, v_wallet_id, 'charge', p_amount, p_description)
    RETURNING id INTO v_transaction_id;

    RETURN jsonb_build_object(
        'success', true,
        'wallet_id', v_wallet_id,
        'new_balance', v_new_balance,
        'transaction_id', v_transaction_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Erstelle Funktion für Powerbank-Ausleihe
CREATE OR REPLACE FUNCTION create_rental_transaction(
    p_user_id UUID,
    p_station_id UUID,
    p_amount DECIMAL(10, 2),
    p_description TEXT DEFAULT 'Powerbank ausgeliehen'
)
RETURNS JSONB AS $$
DECLARE
    v_wallet_id UUID;
    v_new_balance DECIMAL(10, 2);
    v_transaction_id UUID;
BEGIN
    -- Wallet finden
    SELECT id, balance INTO v_wallet_id, v_new_balance FROM wallets WHERE user_id = p_user_id;
    
    IF v_wallet_id IS NULL THEN
        RAISE EXCEPTION 'Wallet nicht gefunden';
    END IF;

    -- Prüfen ob genug Guthaben vorhanden ist
    IF v_new_balance < p_amount THEN
        RAISE EXCEPTION 'Nicht genug Guthaben';
    END IF;

    -- Balance aktualisieren
    UPDATE wallets
    SET balance = balance - p_amount
    WHERE id = v_wallet_id
    RETURNING balance INTO v_new_balance;

    -- Transaktion erstellen
    INSERT INTO transactions (user_id, wallet_id, type, amount, description, station_id)
    VALUES (p_user_id, v_wallet_id, 'rental', -p_amount, p_description, p_station_id)
    RETURNING id INTO v_transaction_id;

    RETURN jsonb_build_object(
        'success', true,
        'wallet_id', v_wallet_id,
        'new_balance', v_new_balance,
        'transaction_id', v_transaction_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Row Level Security
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Policies für wallets
DROP POLICY IF EXISTS "Users can view their own wallet" ON wallets;
CREATE POLICY "Users can view their own wallet" ON wallets
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own wallet" ON wallets;
CREATE POLICY "Users can update their own wallet" ON wallets
    FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own wallet" ON wallets;
CREATE POLICY "Users can insert their own wallet" ON wallets
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policies für transactions
DROP POLICY IF EXISTS "Users can view their own transactions" ON transactions;
CREATE POLICY "Users can view their own transactions" ON transactions
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own transactions" ON transactions;
CREATE POLICY "Users can insert their own transactions" ON transactions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 9. Erstelle Wallets für existierende User (falls vorhanden)
DO $$
DECLARE
    user_record RECORD;
BEGIN
    FOR user_record IN SELECT id FROM auth.users LOOP
        INSERT INTO wallets (user_id, balance)
        VALUES (user_record.id, 100.00)
        ON CONFLICT (user_id) DO NOTHING;
    END LOOP;
END $$;

-- 10. Zeige finale Tabellenstruktur
SELECT 'Wallets Tabelle:' AS info;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'wallets' 
ORDER BY ordinal_position;

SELECT 'Transactions Tabelle:' AS info;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'transactions' 
ORDER BY ordinal_position;

