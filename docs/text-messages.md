# How to send real text messages

Barry sends text messages from the `deliver` function. It uses Azure Communication Services (ACS) when `ACS_CONNECTION_STRING` is set, and Twilio otherwise. Locally, `scripts/sms-relay.mjs` stands in for Twilio: it prints each text message and sends nothing. [How to see what Barry sends locally](local-messages.md) shows where to read them.

## Send with Azure Communication Services

1. In the Azure portal, open the Communication Services resource and get a sender. `ACS_SMS_FROM` must name a sender this resource owns.
   - An alphanumeric sender ID such as `Barry`: open **Alphanumeric Sender ID** in the resource menu, choose the **Dynamic** tab and click **Enable Alphanumeric Sender ID**. Some countries need the **Preregistered** tab instead, which takes weeks. Contacts cannot reply to it.
   - A phone number: open **Phone numbers** in the resource menu and get one with SMS enabled. Use it in E.164 form, for example `+41445551234`.

   For Swiss numbers, only the alphanumeric sender ID can send: Swiss local and toll-free numbers from ACS have no SMS. It also needs a paid subscription, such as Pay-As-You-Go. On a free trial or free credits, **Enable Alphanumeric Sender ID** stays greyed out, and Azure answers each text with `401 Unauthorized`.
2. Copy the **Connection string** from **Settings > Keys**. It looks like `endpoint=https://<name>.communication.azure.com/;accesskey=...`.
3. Add both to `supabase/.env.hosted`, which git ignores:

   ```
   ACS_CONNECTION_STRING=endpoint=https://<name>.communication.azure.com/;accesskey=...
   ACS_SMS_FROM=Barry
   ```

   Remove the `TWILIO_*` lines. `deliver` ignores them while `ACS_CONNECTION_STRING` is set.
4. From the linked checkout, set the secrets and deploy the function:

   ```bash
   node scripts/hosted-secrets.mjs
   ```

   ```bash
   npx supabase functions deploy deliver
   ```

`deliver` signs each request with the access key. A refused number fails at once with Azure's error message, and throttling or an Azure outage is retried.

## Send with Twilio

1. Create a Twilio account at https://www.twilio.com/try-twilio.
2. Upgrade the account in the Twilio Console. A trial account sends only Twilio's predefined templates, and only to verified numbers, so it cannot send Barry's messages.
3. In **Messaging > Settings > Geo permissions**, enable every country your Emergency Contacts' phone numbers are in.
4. Choose the sender:
   - For Swiss numbers, use the alphanumeric sender `Barry`. Twilio's guidelines for Switzerland list it as supported without registration, so you buy nothing. Contacts cannot reply to it.
   - For a country without alphanumeric senders, buy an SMS-capable number in **Phone Numbers > Manage > Buy a number** and use it in E.164 form, for example `+41445551234`.
5. Copy the **Account SID** and the **Auth Token** from the Console's account dashboard.
6. Set the secrets:
   - Hosted Supabase: put `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` and `TWILIO_FROM` in `supabase/.env.hosted`, leave `ACS_CONNECTION_STRING` out, and run `node scripts/hosted-secrets.mjs`. Do not set `TWILIO_API_URL`. Without it, `deliver` sends to `https://api.twilio.com`.
   - Local Supabase: put the values in `supabase/.env`, which git ignores. `supabase/config.toml` reads them with `env(...)`. Set `TWILIO_API_URL=https://api.twilio.com` for real texts, or `TWILIO_API_URL=http://host.docker.internal:8788` to send them to `scripts/sms-relay.mjs`. Restart Supabase, because the edge runtime reads secrets only at start.

## Cost

Both providers charge per segment. A segment holds 160 characters, or 153 when a message has more than one. One character outside the GSM-7 alphabet, such as `’` or `…`, sends the whole message as UCS-2, with 70 characters per segment, or 67 when split. The message text uses only GSM-7 characters, and a test in `supabase/functions/deliver/messages.en.test.ts` checks it. A name, a destination or notes that the Adventurer types with other characters still switch that message to UCS-2.

With the test values in that file, a Heads-up is 3 segments, an Alert 4, and an All-clear 1.
