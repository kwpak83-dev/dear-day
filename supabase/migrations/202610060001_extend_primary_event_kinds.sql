-- Extend the legacy event_kind enum with DearDay's six primary event categories.
-- Additive only: existing wedding/first-birthday rows and legacy enum values remain valid.

alter type public.event_kind add value if not exists 'milestone_birthday';
alter type public.event_kind add value if not exists 'gathering';
alter type public.event_kind add value if not exists 'opening';
