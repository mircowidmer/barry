# Text messages

Barry sends text messages through LINK Mobility's websms REST API (https://app.linkmobility.eu). `deliver` sends each one to `POST https://api.linkmobility.eu/rest/smsmessaging/text` with an access token.

Text messages stay switched off (`sms` is disabled in `private.channel_config`) until the access token works. While they are off, Barry reaches Emergency Contacts by email only. The Contacts tab marks each phone number with "Text messages not set up yet", and starting an Adventure warns about a contact who has only a phone number.

## Set up LINK Mobility

1. In the web interface at https://app.linkmobility.eu, create an API access token. LINK Mobility's API documentation says the token is created there.
2. Check which sender addresses are assigned to the account. For Swiss numbers, use an alphanumeric sender such as `Barry`. If none is assigned, ask LINK Mobility support at support.at@linkmobility.com to assign one.
3. Add both to `supabase/.env.hosted`, which git ignores:

   ```
   LINKMOBILITY_ACCESS_TOKEN=...
   LINKMOBILITY_SENDER=Barry
   ```

   A sender that is a phone number, such as `+41445551234`, goes out as an international sender.
4. From the linked checkout, set the secrets and deploy the function:

   ```bash
   node scripts/hosted-secrets.mjs
   ```

   ```bash
   npx supabase functions deploy deliver
   ```

5. Send one test text message and check it arrives.
6. Switch the channel on with a migration, `update private.channel_config set enabled = true where channel = 'sms';`, and push it with `npx supabase db push`.

## How `deliver` reads the answer

- `2000` and `2001` count as sent. The `transferId` is stored as the provider reference.
- Throttling (`4023`, `4025`) and LINK Mobility's own errors (`5000`, `5003`) are retried.
- Every other code fails at once, with LINK Mobility's status message as the reason, for example `LINK Mobility 4002: INVALID_RECIPIENT`.
- HTTP 401 means LINK Mobility refused the access token.

## Segments

Providers charge per segment. A segment holds 160 characters, or 153 when a message has more than one. One character outside the GSM-7 alphabet, such as `’` or `…`, sends the whole message as UCS-2, with 70 characters per segment, or 67 when split. The message text uses only GSM-7 characters, and a test in `supabase/functions/deliver/messages.en.test.ts` checks it. A name, a destination or notes that the Adventurer types with other characters still switch that message to UCS-2.

With the test values in that file, a Heads-up is 3 segments, an Alert 4, and an All-clear 1.
