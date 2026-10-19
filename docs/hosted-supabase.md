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

The clock wakes `deliver` every minute, and each run reports these values to the Healthchecks.io check "Barry production server" at `HEALTHCHECK_URL`: a plain ping when all are `true`, and a ping to `/fail` naming the failing ones otherwise. When the pings stop for 5 minutes or a `/fail` arrives, Healthchecks.io notifies the operator by email and through ntfy. `e2e/health.e2e.mjs` checks the heartbeat locally against `scripts/sms-relay.mjs`.

## When Healthchecks.io alerts

An Alert to an Emergency Contact may be waiting, so act at once. Healthchecks.io says which of two cases it is.

### The pings stopped

`deliver` has not run for 5 minutes.

1. Open the project in the Supabase dashboard. If it is paused, restore it.
2. Check the clock:

   ```bash
   npx supabase db query --linked "select jobname, active from cron.job where jobname = 'barry-tick'"
   ```

   If `active` is `false`, switch it on:

   ```bash
   npx supabase db query --linked "select cron.alter_job((select jobid from cron.job where jobname = 'barry-tick'), active := true)"
   ```

3. If the clock is on, open **Edge Functions > deliver > Logs** in the dashboard. `unauthorized` means `DELIVER_SECRET` and the Vault's `deliver_secret` differ: run `node scripts/hosted-secrets.mjs`, which sets both. An error in `deliver` itself means redeploying the last good version with `npx supabase functions deploy deliver`.

### A `/fail` arrived

The ping's body names the failing values of `health()`.

- `clock_ok`: the clock has not ticked for 2 minutes. Handle it like stopped pings.
- `adventures_ok`: the clock ticked but failed on an Adventure. Read the error:

  ```bash
  npx supabase db query --linked "select at, adventure_id, message from private.tick_error order by at desc limit 5"
  ```

- `outbox_ok`: messages are waiting for more than 5 minutes. List them:

  ```bash
  npx supabase db query --linked "select id, kind, channel, status, attempts, next_attempt_at, failure_reason from public.messages where status in ('pending', 'sending') order by next_attempt_at limit 20"
  ```

- `delivery_ok`: an Alert failed, or a provider refuses every message. See why:

  ```bash
  npx supabase db query --linked "select kind, channel, failure_reason, count(*) from public.messages where status = 'failed' and settled_at > now() - interval '1 hour' group by 1, 2, 3 order by 4 desc"
  ```

  `HTTP 401` or `HTTP 403` means a key: renew it at Twilio or Resend, put it in `supabase/.env.hosted`, and run `node scripts/hosted-secrets.mjs`. An empty Twilio balance or a blocked sender shows in the Twilio console.

### Who was affected

These Adventures are past their Deadline and an Alert did not reach every address:

```bash
npx supabase db query --linked "select a.id, a.stage, a.deadline, p.name, p.phone, m.channel, m.to_address, m.status from public.adventures a join public.adventurer_profiles p on p.id = a.adventurer_id join public.messages m on m.adventure_id = a.id and m.kind = 'alert' where a.stage in ('overdue', 'alerted') and m.status <> 'sent' order by a.deadline"
```

Once Barry runs again, a waiting Alert goes out by itself. A failed one does not: call or message those Emergency Contacts yourself.

## Not done yet

- The app. Barry on a phone reaches the hosted project only after a build with `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` set to the hosted values.
