# How to see what Barry sends locally

With the local Supabase stack, no message leaves your Mac. Each channel lands somewhere you can open.

## Email

Mailpit catches every email. Open http://127.0.0.1:54324 to read the Heads-ups, Alerts and All-clears your Emergency Contacts would get.

## Text messages

`scripts/sms-relay.mjs` catches every text message. `supabase/config.toml` points `TWILIO_API_URL` at it.

1. Start the relay in a terminal:

   ```bash
   node scripts/sms-relay.mjs
   ```

   Each text message prints `texted <to> from Barry: <first line>`, for example `texted +41792222222 from Barry: Anna has not checked in from an adventure. The Deadline was Thu 15 Oct, 18:00.`, followed by the rest of the text indented, including the Adventure page link. A text message carries the same text as the email body, without the subject.

2. Open http://localhost:8788/messages to read them in full. The page lists each text message's recipient, sender and body.

The relay keeps text messages in memory only, so the list is empty after it restarts. While it is not running, each text message is retried until it runs again.

## The Reminder and the Overdue Notice

The app shows these on the phone itself, as notifications at the right time. Nothing leaves the Mac for them.

## Every message at once

Supabase Studio at http://127.0.0.1:54323 shows the `messages` table. Each row is one message to one address on one channel. Two contacts who share an address get one message. `kind` is `heads_up`, `plan_update`, `deadline_update`, `alert` or `all_clear`. Older rows can also say `reminder` or `overdue_notice`, from before the phone showed those itself. `status` is `pending`, `sending`, `sent`, `failed` or `cancelled`, and `failure_reason` says why it failed. The text itself is not stored, because Barry writes it at the moment it sends.
