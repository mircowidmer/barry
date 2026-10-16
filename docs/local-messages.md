# How to see what Barry sends locally

With the local Supabase stack, no message leaves your Mac. Each channel lands somewhere you can open.

## Email

Mailpit catches every email. Open http://127.0.0.1:54324 to read the Heads-ups, Alerts and All-clears your Emergency Contacts would get.

## Text messages

Text messages are switched off. Locally, `deliver` has no LINK Mobility access token, so it would fail every text message. [Text messages](text-messages.md) sets up LINK Mobility.

## The Reminder and the Overdue Notice

The app shows these on the phone itself, as notifications at the right time. Nothing leaves the Mac for them.

## Every message at once

Supabase Studio at http://127.0.0.1:54323 shows the `messages` table. Each row is one message to one contact on one channel. `kind` is `heads_up`, `alert` or `all_clear`. Older rows can also say `reminder` or `overdue_notice`, from before the phone showed those itself. `status` says whether the message was `sent` or `failed`, and `failure_reason` says why it failed. The text itself is not stored, because Barry writes it at the moment it sends.
