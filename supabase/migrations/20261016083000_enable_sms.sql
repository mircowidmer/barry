-- LINK Mobility sends Barry's text messages; deliver reads its access token from LINKMOBILITY_ACCESS_TOKEN.
update private.channel_config set enabled = true where channel = 'sms';
