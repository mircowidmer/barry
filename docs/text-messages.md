# Text messages

Barry has no text message provider, so text messages are switched off: `sms` is disabled in `private.channel_config`. Barry reaches Emergency Contacts by email only. The Contacts tab marks each phone number with "Text messages not set up yet", and starting an Adventure warns about a contact who has only a phone number, because that contact gets no message at all.

The rest of the text message path stays in place: the `sms` channel, the contact phone numbers, and the message text, which is the same as the email body.

## Add a provider

1. Write the provider's sender in `supabase/functions/deliver/senders.ts`, next to `resendEmail`, with tests in `senders.test.ts`, and use it for `sms` in `senders`. Today `sms` fails every message with `No text message provider is set up`.
2. Add the provider's secrets to `supabase/.env.hosted` and run `node scripts/hosted-secrets.mjs`.
3. Switch the channel on with a migration: `update private.channel_config set enabled = true where channel = 'sms';`.
4. Deploy with `npx supabase db push` and `npx supabase functions deploy deliver`.

## Segments

Providers charge per segment. A segment holds 160 characters, or 153 when a message has more than one. One character outside the GSM-7 alphabet, such as `’` or `…`, sends the whole message as UCS-2, with 70 characters per segment, or 67 when split. The message text uses only GSM-7 characters, and a test in `supabase/functions/deliver/messages.en.test.ts` checks it. A name, a destination or notes that the Adventurer types with other characters still switch that message to UCS-2.

With the test values in that file, a Heads-up is 3 segments, an Alert 4, and an All-clear 1.
