# Text messages

Barry sends text messages through Twilio's Messaging API. `deliver` sends each one to `POST https://api.twilio.com/2010-04-01/Accounts/<Account SID>/Messages.json` signed with an API key that may only create messages.

Text messages are switched on in `private.channel_config`. Locally, `supabase/config.toml` points `TWILIO_API_URL` at `scripts/sms-relay.mjs`, which prints each text message and sends nothing. [How to see what Barry sends locally](local-messages.md) shows where to read them.

## Set up Twilio

1. Create a Twilio account at https://www.twilio.com/try-twilio.
2. Upgrade the account in the Twilio Console. A trial account sends only Twilio's predefined templates, and only to verified numbers, so it cannot send Barry's messages.
3. In **Messaging > Settings > Geo permissions**, enable every country your Emergency Contacts' phone numbers are in.
4. Choose the sender:
   - For Swiss numbers, use the alphanumeric sender `Barry`. Twilio's guidelines for Switzerland list it as supported without registration, so you buy nothing. Contacts cannot reply to it.
   - For a country without alphanumeric senders, buy an SMS-capable number in **Phone Numbers > Manage > Buy a number** and use it in E.164 form, for example `+41445551234`.
5. Copy the **Account SID** from the Console's account dashboard.
6. Create an API key in the Console's API key settings. Choose the key type **Restricted** and tick only **Create** on **Messaging > Messages > messages**. That is the classic Messaging API that `deliver` calls. Leave **Comms** unticked: it is Twilio's Communications API, a Private Beta that answers asynchronously, so a refused number would not fail at once. The counter above the list must read **1 item selected**. Copy the key's **SID** and its **Client secret** on the last step, because Twilio shows the secret only once.
7. Add them to `supabase/.env.hosted`, which git ignores, and remove any `LINKMOBILITY_*` lines:

   ```
   TWILIO_ACCOUNT_SID=AC...
   TWILIO_API_KEY_SID=SK...
   TWILIO_API_KEY_SECRET=...
   TWILIO_FROM=Barry
   ```

   Leave `TWILIO_API_URL` out. Without it, `deliver` sends to `https://api.twilio.com`.
8. From the linked checkout, set the secrets and deploy the function:

   ```bash
   node scripts/hosted-secrets.mjs
   ```

   ```bash
   npx supabase functions deploy deliver
   ```

9. Send one test text message and check it arrives.

The hosted project still holds `LINKMOBILITY_ACCESS_TOKEN` from before. `deliver` ignores it. Remove it with `npx supabase secrets unset LINKMOBILITY_ACCESS_TOKEN`.

## How `deliver` reads the answer

- A `2xx` answer counts as sent. The message `sid` is stored as the provider reference.
- Rate limiting (HTTP 429) and Twilio outages (HTTP 5xx) are retried.
- Every other answer fails at once, with Twilio's error code and message as the reason, for example `HTTP 400: Twilio 21211: The 'To' number is not a valid phone number.`
- Without `TWILIO_ACCOUNT_SID`, each text message fails with `TWILIO_ACCOUNT_SID is not set`.

## Segments

Providers charge per segment. A segment holds 160 characters, or 153 when a message has more than one. One character outside the GSM-7 alphabet, such as `’` or `…`, sends the whole message as UCS-2, with 70 characters per segment, or 67 when split. The message text uses only GSM-7 characters, and a test in `supabase/functions/deliver/messages.en.test.ts` checks it. A name, a destination or notes that the Adventurer types with other characters still switch that message to UCS-2.

With the test values in that file, a Heads-up is 3 segments, an Alert 4, and an All-clear 1.
