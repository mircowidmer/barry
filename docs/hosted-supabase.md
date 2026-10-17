# The hosted Supabase project

Barry's hosted backend is the Supabase project `kizggaicooqhdzpqzawu`, at `https://kizggaicooqhdzpqzawu.supabase.co`. This repository is linked to it with `npx supabase link --project-ref kizggaicooqhdzpqzawu`, which needs the database password.

## What it holds

- Every migration in `supabase/migrations`. `supabase/seed.sql` is for local development only and is never pushed.
- The `deliver` Edge Function, with `verify_jwt = false` from `supabase/config.toml`, because the clock calls it with `DELIVER_SECRET` instead of a user token.
- The function secrets `DELIVER_SECRET`, `TRAIL_MAP_URL`, `RESEND_API_KEY`, `EMAIL_FROM`, `TWILIO_ACCOUNT_SID`, `TWILIO_API_KEY_SID`, `TWILIO_API_KEY_SECRET`, `TWILIO_FROM` and `HEALTHCHECK_URL`. Email goes through Resend from `barry@barry.support`, and text messages go through Twilio. [Text messages](text-messages.md) sets up Twilio. `TRAIL_MAP_URL` is `https://barry.support/adventure`.
- The Vault secrets `deliver_url`, which is `https://kizggaicooqhdzpqzawu.supabase.co/functions/v1/deliver`, and `deliver_secret`, which equals `DELIVER_SECRET`.
- Auth sends sign-up confirmation emails through Resend's SMTP server, `smtp.resend.com`, from `help@barry.support`. This is set under Authentication, Emails, SMTP Settings in the dashboard.

## Ship a change

```bash
npx supabase db push
```

```bash
npx supabase functions deploy deliver
```

## Set the secrets with the script

Do not run `npx supabase secrets set` by hand. It also uploads every entry of `[edge_runtime.secrets]` in `supabase/config.toml`, including the local `DELIVER_SECRET`, which makes `deliver` refuse the clock, and `TWILIO_API_URL`, which sends text messages to the local relay's address.

1. Put the hosted values in `supabase/.env.hosted`, which git ignores:

   ```
   TRAIL_MAP_URL=https://barry.support/adventure
   RESEND_API_KEY=re_...
   EMAIL_FROM=barry@your-verified-domain
   TWILIO_ACCOUNT_SID=AC...
   TWILIO_API_KEY_SID=SK...
   TWILIO_API_KEY_SECRET=...
   TWILIO_FROM=Barry
   HEALTHCHECK_URL=https://hc-ping.com/...
   ```

2. From the linked checkout, run:

   ```bash
   node scripts/hosted-secrets.mjs
   ```

The script sets these values, removes the local-only `EMAIL_API_URL` and `TWILIO_API_URL`, and rotates `DELIVER_SECRET` in the function secrets and the Vault together. It prints secret names only, and exits with an error if a value did not land.

## Set up Resend

`deliver` sends email through Resend when `RESEND_API_KEY` is set, and through Mailpit otherwise.

1. Create an account at resend.com.
2. Under **Domains**, add a domain you control, such as `barry.example.ch`, and add the DNS records Resend shows at your DNS provider. Until the domain shows **Verified**, Resend sends only to your own address and refuses every Emergency Contact.
3. Under **API Keys**, create a key with **Sending access**, limited to that domain.
4. Put the key in `RESEND_API_KEY` and an address on the verified domain, such as `barry@barry.example.ch`, in `EMAIL_FROM` in `supabase/.env.hosted`, then run the script.

## Edit the sign-up email

The confirmation email that Supabase Auth sends after **Create account** lives only in the dashboard, under **Authentication > Emails > Templates > Confirm signup**, and needs custom SMTP to be editable. Its subject is "Confirm your email for Barry". Supabase treats the template as HTML and builds the plain-text part from it, so write each sentence in its own `<p>`. Keep `{{ .ConfirmationURL }}` as the link target.

## Check that it runs

```bash
npx supabase db query --linked "select * from public.health()"
```

All four values are `true` when the clock ticked in the last two minutes without an error, messages are not piling up, and the providers take messages: `delivery_ok` turns `false` when an Alert failed in the last 15 minutes, or when three or more emails or text messages failed and none went out on that channel in that time.

The clock wakes `deliver` every minute, and each run reports these values to the Healthchecks.io check "Barry production server" at `HEALTHCHECK_URL`: a plain ping when all are `true`, and a ping to `/fail` naming the failing ones otherwise. When the pings stop for 5 minutes or a `/fail` arrives, Healthchecks.io emails the operator.

## Not done yet

- Text messages. They need a Twilio account and its secrets. [Text messages](text-messages.md) sets it up.
- The app. Barry on a phone reaches the hosted project only after a build with `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` set to the hosted values.
