# The hosted Supabase project

Barry's hosted backend is the Supabase project `kizggaicooqhdzpqzawu`, at `https://kizggaicooqhdzpqzawu.supabase.co`. This repository is linked to it with `npx supabase link --project-ref kizggaicooqhdzpqzawu`, which needs the database password.

## What it holds

- Every migration in `supabase/migrations`. `supabase/seed.sql` is for local development only and is never pushed.
- The `deliver` Edge Function, with `verify_jwt = false` from `supabase/config.toml`, because the clock calls it with `DELIVER_SECRET` instead of a user token.
- The function secrets `DELIVER_SECRET`, `TRAIL_MAP_URL`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` and `TWILIO_FROM`. `TRAIL_MAP_URL` is `https://mircowidmer.github.io/barry/trail`. Without `TWILIO_API_URL`, text messages go to `https://api.twilio.com`.
- The Vault secrets `deliver_url`, which is `https://kizggaicooqhdzpqzawu.supabase.co/functions/v1/deliver`, and `deliver_secret`, which equals `DELIVER_SECRET`.

## Ship a change

```bash
npx supabase db push
```

```bash
npx supabase functions deploy deliver
```

## Do not upload the local secrets

`npx supabase secrets set` also uploads every entry of `[edge_runtime.secrets]` in `supabase/config.toml`, including the local-only `EMAIL_API_URL`, `EMAIL_FROM` and `TWILIO_API_URL`. After any `secrets set`, remove them again:

```bash
npx supabase secrets unset TWILIO_API_URL EMAIL_API_URL EMAIL_FROM
```

With `TWILIO_API_URL` left in place, hosted text messages go to the local relay's address and fail. `DELIVER_SECRET` in `config.toml` is the local value too, so set the hosted one in the same call, or the clock's calls to `deliver` get refused.

## Check that it runs

```bash
npx supabase db query --linked "select * from public.health()"
```

All three values are `true` when the clock ticked in the last two minutes and messages are not piling up.

## Not done yet

- Email. `deliver` sends email only through Mailpit's local API, so every hosted email fails until a real provider's sender is added.
- Text messages. The Twilio account is a trial, which sends only template messages, so hosted text messages fail until it is upgraded.
- Sign-up. Hosted Auth asks new accounts to confirm their email, and its built-in email service sends only to members of the Supabase team.
- The app. Barry on a phone reaches the hosted project only after a build with `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` set to the hosted values.
