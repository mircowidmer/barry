-- The app schedules the Reminder and the Overdue Notice as local notifications, which need no
-- signal and no push entitlement. Pushing them too would show each one twice.
update private.channel_config set enabled = false where channel = 'push';
