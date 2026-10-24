# Barry

Barry watches over people who go on outdoor outings alone. If an Adventurer fails to check in by the Deadline they set, Barry alerts the people they chose.

## Language

### People

**Adventurer**:
A Barry user who plans Adventures and checks in from them.
_Avoid_: User, hiker, member

**Adventurer Profile**:
What Barry knows about an Adventurer for rescuers: name, and optionally phone number, car make, colour and number plate, and medical notes.
_Avoid_: Account, user details, settings

**Emergency Contact**:
A person in an Adventurer's saved list, copied from a Phone Contact, reachable by phone number, email, or both. The Adventurer can switch each address on and off, and Barry uses only the ones that are on. They don't need Barry or an account. Each Adventure uses some of them.
_Avoid_: Watcher, guardian, buddy, friend

**Phone Contact**:
A person in the phone's own contacts app. Barry reads one only through the phone's picker, copies what it needs into an Emergency Contact, and never keeps the rest.
_Avoid_: Address book, native contact, iOS contact, system contact

### Adventures

**Adventure**:
One solo outing an Adventurer plans in Barry, with a Plan and a Deadline. An Adventurer has at most one Active, Overdue or Alerted Adventure at a time.
_Avoid_: Trip, outing, tour, activity

**Plan**:
What an Adventure records about the outing: destination, and optionally its place on the map.
_Avoid_: Itinerary, details

**Deadline**:
The time by which the Adventurer must Check In before Barry raises an Alert.
_Avoid_: Due time, return time, ETA

**Grace Period**:
The wait after a missed Deadline before Barry raises the Alert.
_Avoid_: Buffer, timeout

**Check-in**:
The Adventurer's single confirmation that they are back safe, which ends the Adventure.
_Avoid_: Ping, heartbeat, check-out

**Last Position**:
The Adventurer's most recent location reading. Barry takes one when they start an Adventure or move its Deadline, and, if the Adventurer lets Barry read the location in the background, about every 5 minutes until they check in.
_Avoid_: Last known position, location, GPS fix, track

**Trail**:
The location readings Barry takes in the background during an Adventure, about one every 5 minutes, until the Check-in. After the Check-in the Adventurer and their Emergency Contacts can still see them.
_Avoid_: Track, breadcrumbs, route, live location

**Trail Map**:
The web page where an Emergency Contact follows an Adventure's Trail through their own link, without an account.
_Avoid_: Live map, tracking page, share link

### Adventure Stages

**Planned**:
An Adventure that is saved but not started.

**Active**:
A started Adventure whose Deadline has not passed.
_Avoid_: Running, live, in progress

**Overdue**:
An Adventure whose Deadline has passed and whose Grace Period is still running. Nobody has been told yet.
_Avoid_: Late, missed

**Alerted**:
An Adventure whose Alert has gone out for its current Deadline. Moving the Deadline makes it Active again.
_Avoid_: Escalated, emergency

**Ended**:
An Adventure the Adventurer has checked in from.
_Avoid_: Closed, finished, completed, cancelled

### Messages

**Reminder**:
A notification the Adventurer's phone shows shortly before the Deadline.
_Avoid_: Warning, nudge

**Heads-up**:
The message to an Adventure's Emergency Contacts when it starts, or to a contact added while it is Active or Overdue, carrying the Plan, the Deadline and the contact's Trail Map link.
_Avoid_: Start notification, invite

**Plan Update**:
The message to an Adventure's Emergency Contacts when the Adventurer changes the Plan of an Active or Overdue Adventure, carrying the new Plan, the Deadline and the contact's Trail Map link.
_Avoid_: Change notification, edit message

**Deadline Update**:
The message to an Adventure's Emergency Contacts a few minutes after the Adventurer moves the Deadline, carrying the destination, the Deadline the contact knew, the new one and the contact's Trail Map link. Quick moves in a row send one.
_Avoid_: Extension notice, delay message

**Alert**:
The message to an Adventure's Emergency Contacts when the Grace Period ends without a Check-in, carrying the Plan, the Deadline, the Last Position, the Adventurer Profile and the contact's Trail Map link.
_Avoid_: Notification, alarm, SOS

**All-clear**:
The message to every Emergency Contact of the Adventure when the Adventurer checks in, before or after an Alert, with the contact's Trail Map link to see where the Adventurer has been.
_Avoid_: Cancellation, resolution

**Overdue Notice**:
A notification the Adventurer's phone shows when their Deadline passes, saying when the Alert will go out.
_Avoid_: Second reminder, warning

**Arrival Notice**:
A notification the Adventurer's phone shows when they reach the destination they put on the map, reminding them to check in once back safe.
_Avoid_: Arrival alert, geofence notification, destination reached

**Delivery Failure**:
A Heads-up, Plan Update, Deadline Update, Alert or All-clear that could not be delivered to an Emergency Contact, which Barry shows to the Adventurer.
_Avoid_: Bounce, error
