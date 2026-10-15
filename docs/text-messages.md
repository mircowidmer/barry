# How to send real text messages

Barry sends text messages through Twilio's Messaging API. Locally, `scripts/sms-relay.mjs` stands in for Twilio: it prints each text message and sends nothing. Follow these steps to send real text messages to Emergency Contacts.

## Steps

1. Create a Twilio account at https://www.twilio.com/try-twilio.
2. Upgrade the account in the Twilio Console. A trial account sends only Twilio's predefined templates, and only to verified numbers, so it cannot send Barry's messages.
3. In **Messaging > Settings > Geo permissions**, enable every country your Emergency Contacts' phone numbers are in.
4. Choose the sender:
   - For Swiss numbers, use the alphanumeric sender `Barry`. Twilio's guidelines for Switzerland list it as supported without registration, so you buy nothing. Contacts cannot reply to it.
   - For a country without alphanumeric senders, buy an SMS-capable number in **Phone Numbers > Manage > Buy a number** and use it in E.164 form, for example `+41445551234`.
5. Copy the **Account SID** and the **Auth Token** from the Console's account dashboard.
6. Set the secrets:
   - Hosted Supabase:

     ```bash
     npx supabase secrets set TWILIO_ACCOUNT_SID=AC... TWILIO_AUTH_TOKEN=... TWILIO_FROM=Barry
     ```

     Do not set `TWILIO_API_URL`. Without it, `deliver` sends to `https://api.twilio.com`.
   - Local Supabase: in `[edge_runtime.secrets]` in `supabase/config.toml`, remove `TWILIO_API_URL` and set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` and `TWILIO_FROM` to the values from step 5. Do not commit the Auth Token. Restart Supabase, because the edge runtime reads secrets only at start.

## Cost

Twilio charges per segment. A segment holds 160 characters, or 153 when a message has more than one. One character outside the GSM-7 alphabet, such as `’` or `…`, sends the whole message as UCS-2, with 70 characters per segment, or 67 when split. The message text uses only GSM-7 characters, and a test in `supabase/functions/deliver/messages.en.test.ts` checks it. A name, a destination or notes that the Adventurer types with other characters still switch that message to UCS-2.

With the test values in that file, a Heads-up is 3 segments, an Alert 4, and an All-clear 1.
