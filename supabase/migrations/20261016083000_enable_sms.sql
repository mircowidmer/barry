-- Text messages are on. deliver sends them through Twilio with TWILIO_ACCOUNT_SID, TWILIO_API_KEY_SID,
-- TWILIO_API_KEY_SECRET and TWILIO_FROM, as docs/text-messages.md describes. LINK Mobility, the provider
-- when this migration was written, is gone.
update private.channel_config set enabled = true where channel = 'sms';
