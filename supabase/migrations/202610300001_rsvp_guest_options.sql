-- RSVP guest-side and optional meal / shuttle-bus responses.
-- Nullable columns preserve legacy responses; safe to apply when columns already exist.
ALTER TABLE public.rsvps
  ADD COLUMN IF NOT EXISTS guest_side text,
  ADD COLUMN IF NOT EXISTS meal_attending boolean,
  ADD COLUMN IF NOT EXISTS bus_riding boolean;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.rsvps'::regclass
      AND conname = 'rsvps_guest_side_check'
  ) THEN
    ALTER TABLE public.rsvps
      ADD CONSTRAINT rsvps_guest_side_check
      CHECK (guest_side IS NULL OR guest_side IN ('groom', 'bride'));
  END IF;
END $$;
