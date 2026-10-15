-- The app only soft-deletes contacts, so a hard delete happens only when the account goes, and
-- that cascade can reach a contact before the Adventure rows that point at it.
alter table public.adventure_contacts
  drop constraint adventure_contacts_contact_id_fkey,
  add constraint adventure_contacts_contact_id_fkey
    foreign key (contact_id) references public.emergency_contacts (id) on delete cascade;

alter table public.messages
  drop constraint messages_contact_id_fkey,
  add constraint messages_contact_id_fkey
    foreign key (contact_id) references public.emergency_contacts (id) on delete cascade;
