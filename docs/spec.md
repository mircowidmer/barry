# Barry specification

Barry is a React Native app with a Supabase backend. An Adventurer plans a solo Adventure, sets a Deadline, and checks in when they are back safe. If the Deadline passes without a Check-in, Barry alerts the Adventurer's Emergency Contacts.

Terms in capitals are defined in [CONTEXT.md](../CONTEXT.md). [ADR 0001](adr/0001-server-owns-the-deadline.md) explains why Supabase, not the phone, owns the Deadline.

## Scope of the first version

The first version serves one Adventurer: the app's author, on their own phone. It still uses real accounts and stores nothing specific to that person in code, so it can become a public app later.

## Accounts

- An Adventurer signs in with an email address and a password through Supabase Auth.
- Each account has one Adventurer Profile.
- An account cannot be deleted while it has an Active, Overdue, or Alerted Adventure.

## Adventurer Profile

| Field | Required | Sent in |
| --- | --- | --- |
| Name | Yes | Heads-up, Alert, All-clear, Trail Map |
| Phone number | Yes | Alert |
| Car make, colour, and number plate | No | Alert |
| Medical notes | No | Alert |

The name and the phone number must be filled in before the Adventurer starts their first Adventure. Only the Alert carries the full Profile.

## Emergency Contacts

- Each Adventurer keeps a saved list of Emergency Contacts.
- An Emergency Contact has a name and a phone number, an email address, or both.
- Emergency Contacts have no account and do not install Barry.
- Barry sends nothing to a person when the Adventurer adds them to the list.
- Each Adventure uses one or more contacts from the list.
- A contact that an Active, Overdue, or Alerted Adventure uses cannot be deleted from the list.
- A contact that only Planned Adventures use can be deleted from the list. The contact leaves those Planned Adventures. If a Planned Adventure has no contact left, Start refuses until the Adventurer adds one.

## Adventures

### Fields

| Field | Required to start | Notes |
| --- | --- | --- |
| Destination | Yes | Part of the Plan. |
| Route | No | Part of the Plan. |
| Starting point | No | Part of the Plan, for example where the car is parked. |
| Notes | No | Part of the Plan. Free text, for example clothing and equipment. |
| Deadline | Yes | An absolute moment in time. Must be in the future at Start. No maximum length. |
| Emergency Contacts | Yes, at least one | Each must have a phone number or an email address. |
| Last Known Position | No | Recorded by Barry, not entered. |

### Stages

| Stage | Entered when | Leaves to |
| --- | --- | --- |
| Planned | The Adventurer saves a new Adventure. | Active, or Deleted |
| Active | Supabase confirms the Start, or the Adventurer moves the Deadline of an Overdue Adventure. | Overdue, Ended |
| Overdue | The Deadline passes without a Check-in. | Active, Alerted, Ended |
| Alerted | The Grace Period ends without a Check-in. | Ended |
| Ended | The Adventurer checks in. | Nothing |

An Adventurer has at most one Active, Overdue, or Alerted Adventure at a time. They can have any number of Planned Adventures. Ended Adventures stay in the Adventurer's history. Opening one shows its Plan, its Check-in time, and a map of its readings.

### Rules by stage

- **Planned.** The Adventurer can edit or delete the Adventure. Barry sends nothing and watches nothing. If the Adventurer never taps **Start**, nobody is protected.
- **Active and Overdue.** The Adventurer can edit the Plan, add contacts, remove contacts, and move the Deadline later. At least one contact always remains. The Adventure cannot be cancelled. A Check-in is the only way to end it.
- **Alerted.** The Adventurer cannot move the Deadline or edit the Adventure. A Check-in is the only way to end it.

### Start

1. The Adventurer taps **Start**.
2. The app records the Last Known Position.
3. The app sends the Start to Supabase.
4. When Supabase confirms the Start, the Adventure becomes Active and Barry sends a Heads-up to each of its contacts.

If the phone has no signal, the Start is not saved for later. The app shows that the Adventurer is not protected until Supabase confirms the Start.

Before Start, the app shows these warnings when they apply. Start is still allowed.

- The Adventurer has not allowed push notifications, or no phone is registered for push notifications. The app shows "You will get no Reminder or Overdue Notice". The app registers its push token again each time it opens.
- While text messages are not set up, the app lists the contacts that get email only, and the contacts that have only a phone number and get no message at all.
- The Adventurer has not allowed Barry to read the location in the background. The app shows "Barry can share only where you started".

### Move the Deadline

The Adventurer can move the Deadline later at any time before the Alert. Each move records a new Last Known Position. Moving the Deadline of an Overdue Adventure makes it Active again. Emergency Contacts are not told that the Deadline moved.

### Check-in

- A Check-in needs a deliberate gesture, such as press and hold. One tap is not enough.
- A Check-in from an Active or Overdue Adventure ends it without a message to anyone.
- A Check-in from an Alerted Adventure ends it and sends an All-clear.
- If the phone has no signal, the app keeps the Check-in and sends it when the signal returns. If the Alert goes out first, the All-clear follows the Check-in.

### Edit an Active or Overdue Adventure

- The Alert always carries the latest Plan.
- A contact added to the Adventure gets a Heads-up.
- A contact removed from the Adventure gets no further messages, and their Trail Map link stops working.
- The Adventure always keeps at least one contact. Removing the last one is refused.

## Messages

Barry sends every message from Supabase. The phone never sends a message to an Emergency Contact.

| Message | Recipient | Channel | Sent when | Content |
| --- | --- | --- | --- | --- |
| Heads-up | Each contact of the Adventure | Every channel the contact has | Supabase confirms the Start, or a contact is added to an Active or Overdue Adventure | Adventurer's name, Plan, Deadline, the contact's Trail Map link |
| Reminder | Adventurer | Push notification | 30 minutes before the Deadline | Prompt to check in or move the Deadline |
| Overdue Notice | Adventurer | Push notification | The Deadline passes | The time the Alert will go out |
| Alert | Each contact of the Adventure | Every channel the contact has | The Grace Period ends, then every hour, up to three Alerts in total | Plan, Deadline, Last Known Position, Adventurer Profile, the contact's Trail Map link |
| All-clear | Each contact that received an Alert | Every channel the contact has | The Adventurer checks in from an Alerted Adventure | The time of the Check-in |

### Message rules

- The Grace Period is 30 minutes. The Reminder lead time is 30 minutes. The Adventurer cannot change either value.
- If the Adventurer sets a Deadline less than 30 minutes ahead, at Start or with a move, Barry sends no Reminder for it. The Overdue Notice still goes out.
- The Last Known Position in an Alert gives the time of the reading, the coordinates, and a map link.
- Every time in a message names its time zone, for example "18:00 Zurich time". Barry uses the Adventurer's time zone at Start.
- An Alert states facts only. It gives no guidance on what to do.
- Messages are in English. All message text is kept in one place so that other languages can be added.
- After the third Alert, Barry sends nothing more. The Adventure stays Alerted until the Adventurer checks in.
- Barry never contacts a rescue service. The Emergency Contacts decide what to do.

### Channels

- Barry sends email and text messages. Each message goes to every channel the contact has.
- Email comes first, because local Supabase catches outgoing email in Mailpit. Text messages must work before the Adventurer relies on Barry outdoors.
- While text messages are not set up, the contact screen marks each contact's phone number with "Text messages not set up yet". A contact with an email address and a phone number gets email only. Barry records no Delivery Failure for the unused phone number.

### Delivery Failures

If a Heads-up, an Alert, or an All-clear cannot be delivered, the app shows the Delivery Failure to the Adventurer.

## Location

- Barry reads the location at Start and at each Deadline move. This needs only the "while using the app" location permission.
- If the Adventurer allows the "Always" location permission, Barry also records the Trail. There is no switch for each Adventure.
- The Trail keeps about one reading per minute, as accurate as the phone allows, from Start until the Check-in. It runs while the Adventure is Active, Overdue, and Alerted.
- iOS sends background readings when the phone moves, not on a timer. Barry keeps at most one of them per minute.
- Without signal, the phone keeps the readings and sends them when the signal returns.
- iOS stops background readings when the Adventurer closes the app. The live Adventure screen says that closing Barry stops the Trail. Barry also watches an area of about 200 meters around the newest reading, so iOS opens the app again when the Adventurer leaves that area, and the Trail continues.
- The Last Known Position is the newest reading, from Start, a Deadline move, or the Trail.
- The Trail stays with the Adventure after the Check-in. Only the Adventurer can see it: the app shows the map on the Check-in screen and on each Ended Adventure in the history. Emergency Contacts lose sight of every position at the Check-in.
- The Trail is deleted with the Adventurer's account.

## Trail Map

The Trail Map is a web page that lets an Emergency Contact follow the Adventurer during the Adventure. The contact needs no account and no app.

- Each contact of an Active, Overdue, or Alerted Adventure has their own Trail Map link. The Heads-up and every Alert carry it.
- The page shows the Adventurer's name, the Plan, the Trail as a line on an OpenStreetMap map, and the Last Known Position with the time of the reading.
- The page does not show the Deadline, and it does not show that the Adventure is Overdue. After the first Alert, it shows that the Adventure is Alerted.
- After the Check-in, the page shows the time of the Check-in and no positions.
- When the Adventurer removes a contact from the Adventure, that contact's link stops working.
- Without the "Always" permission, the page shows only the readings from Start and from Deadline moves.
- The page is a web route of the Expo app, served by EAS Hosting. Supabase Edge Functions cannot serve it, because they send HTML as plain text.

## Monitoring

Supabase checks Deadlines every minute. Each run reports to an outside monitor, such as Healthchecks.io. If the reports stop for a few minutes, the monitor emails or texts the operator.

## Out of scope for the first version

- A topographic map, such as swisstopo, on the Trail Map.
- Checkpoints during an Adventure. The only Check-in is the final one.
- Sign-in with a magic link, Apple, or Google.
- A message to a contact when they are added to the saved list, and contact confirmation.
- A scheduled start. Every Adventure starts when the Adventurer taps **Start**.
- A reminder to start a Planned Adventure.
- Cancelling an Active, Overdue, or Alerted Adventure.
- Telling contacts that a Deadline moved.
- Guidance in the Alert, such as emergency numbers.
- Grace Period and Reminder lengths set per Adventure.
- A way for a contact to acknowledge an Alert.
- Messages in a language other than English.
- An app warning when the outside monitor has not heard from Supabase.
- Detecting bounced emails.
- Push delivery receipts from Expo, and removing expired push tokens. A push notification counts as sent once Expo accepts it.
- Deleting the account from the app.
