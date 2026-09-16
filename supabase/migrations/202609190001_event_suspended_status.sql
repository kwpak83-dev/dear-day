-- GAP ⑪-A: temporarily stop a published invitation without treating it as expired.
alter type public.event_status add value if not exists 'suspended' after 'published';
