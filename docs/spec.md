# Barry specification

Barry is a React Native app with a Supabase backend. An Adventurer plans a solo Adventure, sets a Deadline, and checks in when they are back safe. If the Deadline passes without a Check-in, Barry alerts the Adventurer's Emergency Contacts.

Terms in capitals are defined in [CONTEXT.md](../CONTEXT.md). [ADR 0001](adr/0001-server-owns-the-deadline.md) explains why Supabase, not the phone, owns the Deadline.

## Scope of the first version

The first version serves one Adventurer: the app's author, on their own phone. It still uses real accounts and stores nothing specific to that person in code, so it can become a public app later.

## Accounts

- An Adventurer signs in with an email address and a password through Supabase Auth.
- A new account confirms its email address with a link that Barry sends from help@barry.support. The link opens a page on `https://barry.support/confirmed` that asks the Adventurer to sign in.
- An Adventurer who forgot the password asks for a new one with **Forgot Password?** on the sign-in screen. Barry emails a six-digit code from help@barry.support, valid for an hour. Entering the code with a new password signs the Adventurer in with the new password.
- Each account has one Adventurer Profile.
- The Adventurer changes the password and the email address on the Account screen, which slides up as a sheet from **Email and Password** in the Account group of the Profile tab. A password change needs the current password. A changed email address takes effect once the Adventurer has confirmed it from both the old and the new address, with the link Barry sends to each.
- The Adventurer deletes the account from the Profile tab with **Delete Account**, after confirming. Deleting removes the Profile, the Emergency Contacts, every Adventure with its Trail and its messages, and every Trail Map link.
- An account cannot be deleted while it has an Active, Overdue, or Alerted Adventure, or while a message such as an All-clear is still being sent.

## Adventurer Profile

| Field | Required | Sent in |
| --- | --- | --- |
| Name | Yes | Heads-up, Plan Update, Deadline Update, Alert, All-clear, Trail Map |
| Phone number | No | Alert |
| Car make, colour, and number plate | No | Alert |
| Medical notes | No | Alert |
| Message language | Yes, set by the app to the phone's language, German or English | Decides the language of every message to the contacts |

The name must be filled in before the Adventurer starts their first Adventure. Only the Alert carries the full Profile, and it leaves the phone line out when there is no phone number.

## Emergency Contacts

- Each Adventurer keeps a saved list of Emergency Contacts.
- An Emergency Contact has a name and a phone number, an email address, or both.
- The Adventurer adds a contact only by picking a Phone Contact in the phone's own picker. Barry asks for no access to the phone's contacts beyond that pick.
- Barry copies the name, the first mobile number it can use, else the first other number it can use, and the first email address, and switches both addresses on. A number without a country code is read in the phone's region. A contact without a name takes the company's name, else the email address, else the number.
- The copy is not typed over. To change an address, the Adventurer deletes the contact and picks it again.
- A pick whose email address or phone number a saved contact already has is refused, naming that contact. A pick with no email address and no usable phone number is refused.
- The Adventurer can switch the email address and the phone number on and off. Barry reaches a contact only on the addresses that are switched on. A switched-off address is kept, so switching it back on restores it.
- A contact needs at least one address that is filled in and switched on. Without one, it cannot be saved.
- Emergency Contacts have no account and do not install Barry.
- Barry sends nothing to a person when the Adventurer adds them to the list.
- Each Adventure uses one or more contacts from the list.
- The Adventurer deletes a contact from the list with **Delete**, after confirming.
- A contact that an Active, Overdue, or Alerted Adventure uses cannot be deleted from the list.
- A contact that only Planned Adventures use can be deleted from the list. The contact leaves those Planned Adventures. If a Planned Adventure has no contact left, Start refuses until the Adventurer adds one.

## Adventures

### Fields

| Field | Required to start | Notes |
| --- | --- | --- |
| Destination | Yes | Part of the Plan. |
| Destination on the map | No | Part of the Plan. **Show on Map** suggests the place Apple Maps finds for the destination, and the Adventurer moves the pin with a tap. Without a match, the map opens where the Adventurer is. The contacts are not told the point. |
| Route | No | Part of the Plan. |
| Deadline | Yes | An absolute moment in time. Must be in the future at Start. No maximum length. |
| Emergency Contacts | Yes, at least one | Each must have a phone number or an email address that is switched on. |
| Last Position | No | Recorded by Barry, not entered. |

### Stages

| Stage | Entered when | Leaves to |
| --- | --- | --- |
| Planned | The Adventurer saves a new Adventure. | Active, or Deleted |
| Active | Supabase confirms the Start, or the Adventurer moves the Deadline of an Overdue or Alerted Adventure. | Overdue, Ended |
| Overdue | The Deadline passes without a Check-in. | Active, Alerted, Ended |
| Alerted | The Grace Period ends without a Check-in. | Active, Ended |
| Ended | The Adventurer checks in. | Deleted |

An Adventurer has at most one Active, Overdue, or Alerted Adventure at a time. They can have any number of Planned Adventures. The Adventure tab lists the Planned Adventures, or shows the Adventure in progress. The History tab, the second tab, shows the Adventure in progress and lists the Ended Adventures, newest first. Opening an Ended Adventure shows its Plan, its Check-in time, and a map of its readings. The Adventurer can delete a Planned or an Ended Adventure after confirming, from its screen or by swiping its card left, and several Ended Adventures at once with **Select** in the History. Deleting an Ended Adventure removes its Plan, its readings and its messages, and its Trail Map links stop working. Barry refuses while a message for it is still being sent, such as the All-clear after an Alert.

### Rules by stage

- **Planned.** The Adventurer can edit or delete the Adventure. Barry sends nothing and watches nothing. If the Adventurer never taps **Start**, nobody is protected.
- **Active and Overdue.** The Adventurer can edit the Plan, add contacts, remove contacts, and move the Deadline later. At least one contact always remains. The Adventure cannot be cancelled. A Check-in is the only way to end it.
- **Alerted.** The Adventurer can move the Deadline later, but cannot edit the Adventure. A Check-in is the only way to end it.

### Start

1. The Adventurer taps **Start**.
2. The app records the Last Position.
3. The app sends the Start to Supabase.
4. When Supabase confirms the Start, the Adventure becomes Active and Barry sends a Heads-up to each of its contacts.

If the phone has no signal, the Start is not saved for later. The app shows that the Adventurer is not protected until Supabase confirms the Start. If a Start or a save fails, the Plan screen says why right above the buttons.

Before Start, the app shows these warnings when they apply. Start is still allowed.

- The Adventurer has not allowed notifications. The app shows "you will get no Reminder or Overdue Notice".
- While text messages are switched off, the app lists the contacts that get email only, and the contacts that have only a phone number and get no message at all.
- The Adventurer has not allowed Barry to read the location in the background. The app shows "Barry can share only where you started", and that Barry cannot tell them when they reach their destination.

### Move the Deadline

The Adventurer can move the Deadline later at any time until the Check-in, also after the Alert, as long as the new Deadline is in the future. Each move records a new Last Position. Moving the Deadline of an Overdue or Alerted Adventure makes it Active again.

- When a moved Deadline passes too, the contacts get up to three Alerts for it, the same way as for the first one. The History counts the Alerts for every Deadline.

- A move sends a Deadline Update to each contact whose Heads-up already went out. A contact whose Heads-up is still on its way gets none, because the Heads-up carries the new Deadline.
- The Deadline Update waits 3 minutes. Another move in that time replaces it, so quick moves in a row send one Deadline Update, from the time the contact knew to the latest one.
- A Deadline Update still waiting at the Check-in or when the Alert goes out is not sent.

### Check-in

- A Check-in needs a deliberate gesture: the Adventurer presses and holds **Hold to Check In**, which floats above the tab bar on the live Adventure screen. One tap is not enough.
- A Check-in ends the Adventure and sends an All-clear to every contact, whether it comes before the Deadline, while Overdue, or after the Alert.
- If the phone has no signal, the app keeps the Check-in and sends it when the signal returns. If the Alert goes out first, the All-clear follows it.
- With the "Always" location permission, Barry keeps trying to send a waiting Check-in in the background, without the app being opened, until it arrives. It keeps location updates running only for that. Without the permission, the Check-in is sent the next time the Adventurer opens Barry.

### Edit an Active or Overdue Adventure

- The Alert always carries the latest Plan.
- A change to the destination or route sends a Plan Update to each contact whose Heads-up already went out. A contact whose Heads-up is still on its way gets no Plan Update, because the Heads-up carries the latest Plan.
- Several changes before a Plan Update goes out send only one, with the latest Plan.
- Changing only the contacts, moving the Deadline, or moving the destination on the map sends no Plan Update.
- A contact added to the Adventure gets a Heads-up.
- A contact removed from the Adventure gets no further messages, and their Trail Map link stops working.
- The Adventure always keeps at least one contact. Removing the last one is refused.

## Messages

Barry sends every message to an Emergency Contact from Supabase. The phone never sends a message to an Emergency Contact. The Reminder, the Overdue Notice and the Arrival Notice go to the Adventurer only, so the phone shows them itself as local notifications.

| Message | Recipient | Channel | Sent when | Content |
| --- | --- | --- | --- | --- |
| Heads-up | Each contact of the Adventure | Every channel the contact has | Supabase confirms the Start, or a contact is added to an Active or Overdue Adventure | Adventurer's name, Plan, Deadline, the contact's Trail Map link |
| Plan Update | Each contact whose Heads-up went out | Every channel the contact has | The Adventurer changes the Plan of an Active or Overdue Adventure | Adventurer's name, the new Plan, Deadline, the contact's Trail Map link |
| Deadline Update | Each contact whose Heads-up went out | Every channel the contact has | 3 minutes after the Adventurer moves the Deadline | Adventurer's name, destination, the Deadline the contact knew, the new Deadline, the contact's Trail Map link |
| Reminder | Adventurer | Local notification | 30 minutes before the Deadline | Prompt to check in or move the Deadline |
| Overdue Notice | Adventurer | Local notification | The Deadline passes | The time the Alert will go out |
| Arrival Notice | Adventurer | Local notification | The phone enters the region around the destination on the map | The destination, and a prompt to check in once back safe |
| Alert | Each contact of the Adventure | Every channel the contact has | The Grace Period ends, then every hour, up to three Alerts for each Deadline | Plan, Deadline, Last Position, Adventurer Profile, the contact's Trail Map link |
| All-clear | Each contact of the Adventure | Every channel the contact has | The Adventurer checks in | The time of the Check-in, the contact's Trail Map link to see where the Adventurer has been |

### Message rules

- The Grace Period is 5 minutes. The Reminder lead time is 30 minutes. The Adventurer cannot change either value.
- If the Adventurer sets a Deadline less than 30 minutes ahead, at Start or with a move, Barry sends no Reminder for it. The Overdue Notice still goes out.
- The Last Position in an Alert gives the time of the reading and the coordinates.
- Every time in a message is in the Adventurer's time zone at Start and does not name the time zone, for example "Sat 17 Oct, 18:00".
- An Alert states facts only. It gives no guidance on what to do.
- Messages are in English or German. The text of the messages Supabase sends is kept in one place per language, and the text of the Reminder and the Overdue Notice in the app's texts, so that other languages can be added.
- After the third Alert for a Deadline, Barry sends nothing more for it. The Adventure stays Alerted until the Adventurer checks in or moves the Deadline.
- Barry never contacts a rescue service. The Emergency Contacts decide what to do.

### Reminder and Overdue Notice

- The app schedules both notifications on the phone when Supabase confirms the Start, and again whenever it confirms a Deadline move. They need no signal and no push entitlement, so they also work on an iPhone build signed by a free Apple team.
- Each Adventure has one scheduled notification per kind. Scheduling again replaces it, so a moved Deadline moves both.
- A Check-in cancels both, even while it waits for signal. So does any time the app sees that the Adventure is no longer Active, Overdue or Alerted.
- A notification whose time has already passed is not scheduled. A Deadline set less than 30 minutes ahead therefore gets no Reminder.
- Supabase does not push either notification. The push channel is turned off, so the Adventurer never gets the same notification twice. The phone knows every Deadline, because only the app moves it, and push is the part that fails without signal.
- The phone's clock decides when they show. The Alert still follows the server's clock.

### Arrival Notice

- With the "Always" location permission, the phone watches a region around the destination on the map from the Start until the Check-in, whether Barry is open or not. iOS wakes Barry when the Adventurer walks into it, and the phone shows the Arrival Notice. It needs no signal and no push.
- Each Adventure shows it at most once, even when the Adventurer walks out of the region and back in.
- It does not check in. A Check-in stays the Adventurer's deliberate press and hold, because reaching the destination is not being back safe.
- Without a point on the map, without the "Always" permission, or once a Check-in waits for signal, there is no Arrival Notice.

### Channels

- Barry sends email and text messages. Each message goes to every channel the contact has, on the addresses that are switched on. "Every channel the contact has" in the table above means the same. A text message carries the same text as the email body, without the subject.
- Barry sends email through Resend, from the sender name "🐶 Barry".
- Barry writes every message to the contacts in the language of the Adventurer's phone: German when the phone is in German, English otherwise. The app stores that language in the Profile each time it opens and each time the Profile is saved, so a language changed in Settings reaches the next message. The German texts use Swiss Standard German, with "ss" instead of "ß", and address the contact as "du".
- Barry sends text messages through Twilio. [Text messages](text-messages.md) sets it up.
- Contacts that share an email address or a phone number get one message per address.
- Text messages use only the GSM-7 alphabet, so each segment holds 160 characters.
- A channel can be switched off. While text messages are switched off, the contact list shows the text message symbol of each contact Barry would text in the warning colour, and VoiceOver reads "Text messages not set up yet". A contact left with no channel Barry can use gets an exclamation mark. A contact with an email address and a phone number gets email only. Barry records no Delivery Failure for the unused phone number. A contact with only a phone number gets a Delivery Failure.

### Delivery Failures

If a Heads-up, a Plan Update, a Deadline Update, an Alert, or an All-clear cannot be delivered, the app shows the Delivery Failure to the Adventurer. That includes a text message that Twilio accepted but later reports as not delivered.

## Location

- Barry reads the location at Start and at each Deadline move. This needs only the "while using the app" location permission.
- If the Adventurer allows the "Always" location permission, Barry also records the Trail. There is no switch for each Adventure.
- The Trail keeps about one reading every 5 minutes, as accurate as the phone allows, from Start until the Check-in. It runs while the Adventure is Active, Overdue, and Alerted.
- iOS sends background readings when the phone moves, not on a timer. Barry keeps the first one of every 5 minutes.
- Without signal, the phone keeps the readings and sends them when the signal returns.
- iOS stops background readings when the Adventurer closes the app. The live Adventure screen says that closing Barry stops the Trail. Barry also watches an area of about 200 meters around the newest reading, so iOS opens the app again when the Adventurer leaves that area, and the Trail continues.
- The Last Position is the newest reading, from Start, a Deadline move, or the Trail.
- The Trail stays with the Adventure after the Check-in. The app shows the map on the live Adventure screen, below Need More Time and above the Plan, where it adds new readings every 5 minutes and the Plan's Last Position shows the same newest reading, and on the Check-in screen and each Ended Adventure in the History tab. Emergency Contacts keep seeing it on the Trail Map.
- The Trail is deleted with the Adventurer's account.

## Trail Map

The Trail Map is a web page that lets an Emergency Contact follow the Adventurer during the Adventure. The contact needs no account and no app.

- Each contact of an Active, Overdue, or Alerted Adventure has their own Trail Map link. The Heads-up, every Plan Update, every Deadline Update, every Alert and the All-clear carry it.
- The page shows the Adventurer's name, the Plan, the Trail as a line on an OpenStreetMap map, and the Last Position with the time of the reading.
- The page adds new readings every 5 minutes while it is open, the same pace as the Adventurer's live screen.
- The page does not show the Deadline, and it does not show that the Adventure is Overdue. While the Adventure is Alerted, it shows that.
- After the Check-in, the page shows the time of the Check-in, the Trail up to the Check-in and the Last Position. Barry records no readings after the Check-in.
- The link never expires. After the Check-in it keeps showing the Check-in time and the Trail until the Adventurer deletes the Adventure or the account.
- When the Adventurer removes a contact from the Adventure, that contact's link stops working.
- Without the "Always" permission, the page shows only the readings from Start and from Deadline moves.
- The page is a web route of the Expo app, served by GitHub Pages at `https://barry.support/adventure`. Supabase Edge Functions cannot serve it, because they send HTML as plain text.
- Any other address on `barry.support`, such as an old `/trail` link, opens the landing page.
- The landing page, the Adventure page and the email confirmation page are in German when the browser's first preferred language is German, and in English otherwise.
- `https://barry.support/privacy` and `https://barry.support/terms` hold the Privacy Policy and the Terms of Use, in English and German. The landing page, the Sign In screen and the Profile link to both, and Sign In and the Profile say that Barry is not an emergency service.
- The iOS app is in German when the phone's first language is German, and in English otherwise. Settings › Barry › Language can pick either for Barry alone. The messages to the contacts follow the same language.

## Monitoring

Supabase checks Deadlines every minute. Each run reports to an outside monitor, such as Healthchecks.io. If the reports stop for a few minutes, the monitor emails or texts the operator. It also does when an Alert could not be delivered, or when the email or text message provider refuses every message, because those fail at once instead of piling up.

## Limits that live in the code

A few limits are implementation choices, not promises to the Adventurer. Their values live only in the code, next to what they protect, with a test where one matters, so a changed value needs no change here. Each is named so it can be found.

- `MAX_SLOTS` in `src/lib/barry/trail-buffer.ts` is how many readings of Trail the phone keeps while it has no signal, and `SLOT_MS` there is how often the Trail keeps one. Once full, the oldest readings go first. `BATCH` there is how many readings one upload carries, and the `limit` in `record_trail` (`supabase/migrations/20261015200000_ten_second_trail.sql`) is how many the server takes per call. `trail-buffer.test.ts` pins both phone values. The `slot` column of `position_readings` in the same migration is the window the server keeps one reading per Adventure in, and `trail.test.sql` pins it.
- `FENCE_MOVE_M` in `src/lib/barry/trail.ts` is how far the Adventurer walks before the geofence moves to the newest reading. `ARRIVAL_RADIUS_M` there is how close to the destination on the map the Arrival Notice shows. `trail.test.ts` pins it.
- `max_attempts` and `retry_backoff` (`supabase/migrations/20261015084008_deliver.sql`) and the lease in `claim_messages` (last defined in `supabase/migrations/20261022120000_move_after_alert.sql`) are how often a message is retried, how long Barry waits between attempts, and how long one attempt may run before another run of `deliver` may claim the row. `deliver.test.sql` pins them.
- `MOBILE_LABELS` in `src/lib/barry/phone-contact.ts` is which labels of a Phone Contact's numbers count as mobile. `phone-contact.test.ts` pins it.
- `POSITION_TIMEOUT_MS` in `src/lib/barry/index.ts` is how long Start or a Deadline move waits for a position fix before going without one. `REQUEST_TIMEOUT_MS` in `src/lib/supabase.ts` is how long any request waits before the app treats the signal as lost and falls back to the saved Adventure.

## Out of scope for the first version

- A topographic map, such as swisstopo, on the Trail Map.
- Checkpoints during an Adventure. The only Check-in is the final one.
- Sign-in with a magic link, Apple, or Google.
- A message to a contact when they are added to the saved list, and contact confirmation.
- A scheduled start. Every Adventure starts when the Adventurer taps **Start**.
- A reminder to start a Planned Adventure.
- Cancelling an Active, Overdue, or Alerted Adventure.
- Guidance in the Alert, such as emergency numbers.
- Grace Period and Reminder lengths set per Adventure.
- A way for a contact to acknowledge an Alert.
- Messages in a language other than English and German.
- The app in a language other than English and German.
- An app warning when the outside monitor has not heard from Supabase.
- Detecting bounced emails.
