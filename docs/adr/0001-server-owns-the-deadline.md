# Supabase owns the Deadline and sends every message

When a Deadline is missed, the Adventurer's phone may be dead, broken or out of signal, so the phone cannot be what raises the Alert. Supabase stores every Adventure, checks Deadlines on a schedule, and sends every Heads-up, Alert and All-clear. The app only reports Start, Check-in, Deadline moves and Plan edits.

## Consequences

- An Adventure is only Active once Supabase has confirmed its Start. The app shows that the Adventurer is not protected until then. A Start queued on an offline phone would look protected while nothing is watching.
- A Check-in may be queued offline and sent when signal returns. The worst case is an Alert followed by an All-clear, which is safe.
- An Adventure out of signal at its Deadline is alerted. That is the intended behaviour, so the app prompts the Adventurer to move the Deadline before losing coverage.
- The Deadline check itself is a single point of failure. It reports to an outside monitor that alerts the operator when the reports stop.
