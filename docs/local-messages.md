# How to see what Barry sends locally

With the local Supabase stack, no message leaves your Mac. Each channel lands somewhere you can open.

## Email

Mailpit catches every email. Open http://127.0.0.1:54324 to read the Heads-ups, Alerts and All-clears your Emergency Contacts would get.

## Text messages

Barry sends no text messages, locally or hosted, because it has no text message provider. [Text messages](text-messages.md) says what adding one takes.

## The Reminder and the Overdue Notice

The app shows these on the phone itself, as notifications at the right time. Nothing leaves the Mac for them.

## Every message at once

Supabase Studio at http://127.0.0.1:54323 shows the `messages` table. Each row is one message to one contact on one channel. `kind` is `heads_up`, `alert` or `all_clear`. Older rows can also say `reminder` or `overdue_notice`, from before the phone showed those itself. `status` says whether the message was `sent` or `failed`, and `failure_reason` says why it failed. The text itself is not stored, because Barry writes it at the moment it sends.
