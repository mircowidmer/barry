-- Barry has no text message provider, so contacts are reached by email only until one is added.
update private.channel_config set enabled = false where channel = 'sms';
