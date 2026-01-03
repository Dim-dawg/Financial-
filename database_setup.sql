-- Categories Table: Stores user-defined transaction categories.
CREATE TABLE IF NOT EXISTS public.categories (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT categories_pkey PRIMARY KEY (id)
);

-- Profiles Table: Stores information about clients, vendors, or other entities.
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone DEFAULT now(),
  name text NOT NULL,
  type text NOT NULL,
  address text,
  notes text,
  description text,
  tags TEXT[] DEFAULT ARRAY[]::text[],
  keyword_match text,
  default_category_id uuid,
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_default_category_id_fkey FOREIGN KEY (default_category_id) REFERENCES public.categories(id)
);

-- Transactions Table: The core table for all financial transactions.
CREATE TABLE IF NOT EXISTS public.transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone DEFAULT now(),
  date date NOT NULL,
  description text NOT NULL,
  amount numeric NOT NULL,
  type text NOT NULL CHECK (type = ANY (ARRAY['income'::text, 'expense'::text])),
  category_id uuid NOT NULL,
  profile_id uuid,
  original_description text,
  document_id text,
  CONSTRAINT transactions_pkey PRIMARY KEY (id),
  CONSTRAINT transactions_category_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id),
  CONSTRAINT transactions_profile_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id)
);

-- Rules Table: Stores rules for automatically categorizing transactions.
CREATE TABLE IF NOT EXISTS public.rules (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone DEFAULT now(),
  keyword text NOT NULL,
  category_id uuid NOT NULL,
  CONSTRAINT rules_pkey PRIMARY KEY (id),
  CONSTRAINT rules_category_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_category_id ON transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_transactions_profile_id ON transactions(profile_id);
CREATE INDEX IF NOT EXISTS idx_categories_name ON categories(name);
CREATE INDEX IF NOT EXISTS idx_profiles_name ON profiles(name);

-- Enable Row Level Security (RLS) on all tables
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rules ENABLE ROW LEVEL SECURITY;

-- Policies for public access (adjust as needed for your auth setup)
-- These policies are very permissive and assume you want any authenticated user to access any data.
-- You should restrict these based on your application's user roles and ownership rules.
CREATE POLICY "Public access for authenticated users" ON public.categories
  FOR ALL
  TO authenticated
  USING (true);

CREATE POLICY "Public access for authenticated users" ON public.profiles
  FOR ALL
  TO authenticated
  USING (true);

CREATE POLICY "Public access for authenticated users" ON public.transactions
  FOR ALL
  TO authenticated
  USING (true);

CREATE POLICY "Public access for authenticated users" ON public.rules
  FOR ALL
  TO authenticated
  USING (true);

-- Insert some default categories to get started
INSERT INTO public.categories (name) VALUES
  ('Uncategorized'),
  ('Software'),
  ('Contractors'),
  ('Office Supplies'),
  ('Travel'),
  ('Client Revenue'),
  ('Other Income')
ON CONFLICT (name) DO NOTHING;