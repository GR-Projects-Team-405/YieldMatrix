CREATE TABLE public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  email TEXT NOT NULL UNIQUE CHECK (email = lower(trim(email))),
  role TEXT NOT NULL CHECK (role IN ('farmer','buyer','driver','admin')),
  approval_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (approval_status IN ('pending','approved','rejected','suspended')),
  password_hash TEXT,
  phone TEXT,
  district TEXT,
  approval_reason TEXT,
  approved_by UUID REFERENCES public.users(id),
  session_version INTEGER NOT NULL DEFAULT 0 CHECK (session_version >= 0),
  notification_preferences JSONB NOT NULL DEFAULT '{}',
  market_advisory_preferences JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID UNIQUE REFERENCES public.users(id),
  account_type TEXT NOT NULL
    CHECK (account_type IN ('farmer','buyer','driver','admin','simulation_source')),
  currency TEXT NOT NULL DEFAULT 'LKR' CHECK (currency = 'LKR'),
  available_cents BIGINT NOT NULL DEFAULT 0 CHECK (available_cents >= 0),
  held_cents BIGINT NOT NULL DEFAULT 0 CHECK (held_cents >= 0),
  pending_payout_cents BIGINT NOT NULL DEFAULT 0 CHECK (pending_payout_cents >= 0),
  simulated BOOLEAN NOT NULL DEFAULT true CHECK (simulated),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (account_type = 'simulation_source' AND owner_id IS NULL)
    OR (account_type <> 'simulation_source' AND owner_id IS NOT NULL)
  )
);
CREATE UNIQUE INDEX one_simulation_source_wallet
  ON public.wallets(account_type)
  WHERE account_type = 'simulation_source';

CREATE TABLE public.wallet_journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL
    CHECK (event_type IN ('funding','hold','settlement','refund','payout_hold','payout','payout_release','reversal')),
  event_reference TEXT NOT NULL,
  operation_key TEXT NOT NULL UNIQUE,
  currency TEXT NOT NULL DEFAULT 'LKR' CHECK (currency = 'LKR'),
  amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
  order_id UUID,
  allocation_id UUID,
  reversal_of UUID UNIQUE REFERENCES public.wallet_journal_entries(id),
  actor_id UUID NOT NULL REFERENCES public.users(id),
  created_transaction BIGINT NOT NULL DEFAULT txid_current(),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((event_type = 'reversal') = (reversal_of IS NOT NULL))
);

CREATE TABLE public.wallet_journal_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID NOT NULL REFERENCES public.wallet_journal_entries(id),
  wallet_id UUID NOT NULL REFERENCES public.wallets(id),
  bucket TEXT NOT NULL CHECK (bucket IN ('available','held','pending_payout','simulation_equity')),
  side TEXT NOT NULL CHECK (side IN ('debit','credit')),
  amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.payout_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES public.wallets(id),
  amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','rejected')),
  decision_reason TEXT,
  decided_by UUID REFERENCES public.users(id),
  decided_at TIMESTAMPTZ,
  journal_entry_id UUID REFERENCES public.wallet_journal_entries(id),
  operation_key TEXT NOT NULL UNIQUE,
  simulated BOOLEAN NOT NULL DEFAULT true CHECK (simulated),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    status = 'pending'
    OR (
      decided_by IS NOT NULL
      AND decided_at IS NOT NULL
      AND COALESCE(length(trim(decision_reason)), 0) > 0
    )
  )
);

CREATE FUNCTION public.ym27_test_enforce_payout_transition()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE allowed JSONB;
BEGIN
  allowed := '{"pending":["completed","rejected"]}';
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'pending' THEN
      RAISE EXCEPTION 'Invalid initial payout status: %', NEW.status;
    END IF;
  ELSIF NEW.status <> OLD.status
    AND NOT COALESCE((allowed -> OLD.status) ? NEW.status, false) THEN
    RAISE EXCEPTION 'Invalid payout status transition: % -> %', OLD.status, NEW.status;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER workflow_transition
  BEFORE INSERT OR UPDATE OF status ON public.payout_requests
  FOR EACH ROW EXECUTE FUNCTION public.ym27_test_enforce_payout_transition();

CREATE FUNCTION public.ym27_test_prevent_record_mutation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% records are append-only', TG_TABLE_NAME;
END $$;
CREATE TRIGGER immutable_record
  BEFORE UPDATE OR DELETE ON public.wallet_journal_entries
  FOR EACH ROW EXECUTE FUNCTION public.ym27_test_prevent_record_mutation();
CREATE TRIGGER immutable_record
  BEFORE UPDATE OR DELETE ON public.wallet_journal_lines
  FOR EACH ROW EXECUTE FUNCTION public.ym27_test_prevent_record_mutation();

CREATE FUNCTION public.ym27_test_guard_journal_line()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  transaction_id BIGINT;
  wallet_kind TEXT;
BEGIN
  SELECT created_transaction INTO transaction_id
  FROM public.wallet_journal_entries WHERE id = NEW.entry_id;
  IF transaction_id IS DISTINCT FROM txid_current() THEN
    RAISE EXCEPTION 'Cannot append to a posted journal';
  END IF;
  SELECT account_type INTO wallet_kind FROM public.wallets WHERE id = NEW.wallet_id;
  IF (wallet_kind = 'simulation_source') <> (NEW.bucket = 'simulation_equity') THEN
    RAISE EXCEPTION 'Invalid wallet bucket';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER journal_line_guard
  BEFORE INSERT ON public.wallet_journal_lines
  FOR EACH ROW EXECUTE FUNCTION public.ym27_test_guard_journal_line();

CREATE FUNCTION public.ym27_test_check_balanced_journal()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  entry_key UUID;
  debit_total NUMERIC;
  credit_total NUMERIC;
  expected BIGINT;
BEGIN
  IF TG_TABLE_NAME = 'wallet_journal_entries' THEN
    entry_key := NEW.id;
  ELSE
    entry_key := NEW.entry_id;
  END IF;
  SELECT amount_cents INTO expected
  FROM public.wallet_journal_entries WHERE id = entry_key;
  SELECT
    COALESCE(sum(amount_cents) FILTER (WHERE side = 'debit'), 0),
    COALESCE(sum(amount_cents) FILTER (WHERE side = 'credit'), 0)
  INTO debit_total, credit_total
  FROM public.wallet_journal_lines WHERE entry_id = entry_key;
  IF debit_total <> credit_total OR debit_total <> expected OR debit_total = 0 THEN
    RAISE EXCEPTION 'Journal % must balance with debits = credits = amount', entry_key;
  END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER journal_balanced
  AFTER INSERT ON public.wallet_journal_entries
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.ym27_test_check_balanced_journal();
CREATE CONSTRAINT TRIGGER journal_balanced
  AFTER INSERT ON public.wallet_journal_lines
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.ym27_test_check_balanced_journal();
