---
name: barry-security
description: Analyse Barry in depth for security vulnerabilities across the React Native app, the Supabase database (grants, row level security, security definer functions, the commands), the Edge Function deliver, the Trail Map web build, Auth, secrets, the supply chain and the CI workflows, and report each finding with its attack path, its source and its severity. Read-only unless invoked with --fix, which then applies the certain fixes that close a vulnerability without changing what an honest Adventurer or Emergency Contact sees, and commits each one. Use when asked for a security review, a security audit, a pentest-style analysis, to look for vulnerabilities or leaks, or before a release.
---

# Security analysis

You are analysing the repository at the current working directory, Barry, for security vulnerabilities: an Expo iPhone app in React Native and TypeScript with a Supabase backend that alerts an Adventurer's Emergency Contacts when a Deadline passes without a Check-in, and a static web build that shows the Trail Map to a contact. Your job is to find every place where someone can read, change, suppress or forge what they should not, or where Barry leaks, loses or misuses data it holds. The deliverable is a report, and with `--fix`, the fixes that are certain, one commit each.

A finding is a vulnerability with an attack path: who the attacker is, what they hold, the steps they take, and what they gain. A rule broken with no path to harm is a hardening note, not a finding. A finding names its source (OWASP MASVS, the OWASP Mobile Top 10, OWASP ASVS, the OWASP Cheat Sheets, the CWE, docs.expo.dev, supabase.com/docs, postgresql.org/docs, docs.github.com) and would survive the author asking "how, exactly?".

## Arguments

- No argument: analyse everything below. Change nothing.
- A path, such as `supabase/migrations`, `supabase/functions/deliver` or `src/lib/barry`: analyse only the files under it, but still read whatever they call or are called by when an attack path crosses the boundary.
- `--fix`: analyse, write the report, then apply the fixes the section **Applying fixes with --fix** allows, and commit each one. Can be combined with a path. The report comes first either way, so a fix is never applied to a finding the report does not name.

Any other argument is an error. Say so and stop.

## What Barry must protect

Read these before judging anything, because they define what a vulnerability is here: `AGENTS.md`, `CONTEXT.md`, `docs/spec.md`, `docs/adr/0001-server-owns-the-deadline.md`, `docs/design/backend/design.md` (where it disagrees with the migrations, the migrations win), `docs/hosted-supabase.md`, `docs/trail-map-hosting.md`, `docs/text-messages.md` and `docs/builds.md`.

Barry is a safety app. Rank harm in this order:

1. **The safety promise breaks.** Someone other than the Adventurer stops, delays or forges an Alert, a Check-in, a Deadline move or an All-clear; or an attacker makes Barry stay silent when a Deadline passes (for example by exhausting the outbox, the clock, the text message budget or a sender's reputation, or by making `deliver` fail).
2. **Location and plans leak.** The live Trail, the destination, the Deadline or the fact that someone is out alone reach anyone but the Adventurer and the Emergency Contacts of that Adventure, or reach a contact after the time the spec allows.
3. **Accounts and personal data leak or change.** Another user's Profile, contacts, phone numbers, email addresses, History or session; a contact's address used to reach people who never agreed.
4. **Barry is turned against others or against its operator.** Text message or email pumping and spam through Heads-ups to arbitrary addresses, cost run-ups on the text message provider, phishing that looks like a Barry message, an open redirect or injected content on barry.support.
5. **Hardening.** Defence in depth with no current path to harm.

The attackers to consider, each with only what they really hold:

- **Another Adventurer:** a valid account and session of their own, the publishable key, and every RPC and table the app may call, called directly with crafted arguments, not through the app.
- **An anonymous caller:** the publishable key from the app bundle (it is public), the Supabase URL, the Edge Function URL and the Trail Map page.
- **An Emergency Contact:** a Trail Map link with its token, the messages they received, and possibly a removed contact who kept an old link.
- **Someone near the phone:** a stolen or unlocked iPhone, a backup of it, another app on it, a link or QR code that opens the app's URL scheme, a malicious Wi-Fi network.
- **The supply chain and the repository:** an npm package, a GitHub Action, a pull request from a fork, a secret committed by mistake, a document that tells the next developer to do something unsafe.

## The checks

Work through every group. Read both sides of each boundary fully: the client call and the SQL it reaches, the message and the template that renders it. Do not sample, and do not judge a file from its name.

### 1. Database privileges and row level security

Postgres is Barry's security boundary: the app calls PostgREST directly with the user's JWT. Establish the final state first. Migrations are history: later files replace functions and grants earlier files created, so for every object read the latest migration that touches it.

- **Exposed schemas.** Read `[api] schemas` and `extra_search_path` in `supabase/config.toml`. Every table, view and function in an exposed schema is reachable by `anon` and `authenticated` unless a grant says otherwise. List each one with its effective privileges for `anon`, `authenticated` and `service_role`.
- **Default privileges.** Find every `alter default privileges`, `grant` and `revoke` in the migrations. AGENTS.md says privileges fail closed; prove it: a table, view, sequence or function created after the revoke that was granted back by accident, or a function left with Postgres' default `EXECUTE` to `public`, is a finding. [Supabase: Securing your API](https://supabase.com/docs/guides/api/securing-your-api), [PostgreSQL: Default privileges](https://www.postgresql.org/docs/current/ddl-priv.html)
- **Row level security on every exposed table.** `enable row level security` on each, and for each policy the role, the command, `using` and `with check`. A policy that checks `using` but not `with check` lets a user write a row they then cannot read, or move a row to another owner; an `update` policy that lets `user_id` or `adventure_id` change is a finding. Policies use `(select auth.uid())`, never a column the client sends. [Supabase: Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- **Views.** A view runs with its owner's rights unless it is `security_invoker`. Every view in an exposed schema that bypasses RLS this way is a finding unless its grants keep it from `anon` and `authenticated`. Check `message_facts` and any view the app or `deliver` reads.
- **Security definer functions.** For each one: `set search_path = ''` (or a fixed, safe path) and fully qualified names; who may execute it; and above all that it checks the caller itself: it derives the Adventurer from `auth.uid()` and never trusts an `adventure_id`, `contact_id`, `user_id`, `message_id` or token argument without proving the caller owns it. An RPC that takes an id and acts on someone else's row is the classic IDOR (CWE-639). [Supabase: Database functions, security definer](https://supabase.com/docs/guides/database/functions#security-definer-vs-invoker), [PostgreSQL: Writing security definer functions safely](https://www.postgresql.org/docs/current/sql-createfunction.html#SQL-CREATEFUNCTION-SECURITY)
- **The commands.** For `save_adventure`, `delete_adventure`, `start_adventure`, `move_deadline`, `check_in`, `record_trail`, `delete_account` and every other function in `public` and `commands`: call it in your head as another Adventurer and as `anon` with every argument chosen by the attacker. Check the Stage rules cannot be skipped (a Check-in on another's Adventure, a Deadline moved after an Alert in a way the spec forbids, a Start without contacts, an Adventure revived after it Ended), that refusals do not reveal whether someone else's row exists, and that numeric and text inputs are bounded (a Deadline years away, a destination of a megabyte, a Trail of a million points, coordinates outside the earth).
- **Service-role-only functions.** `claim_messages`, `health` and whatever `deliver` calls: executable by `service_role` only, revoked from `public`, `anon` and `authenticated`. Prove it from the grants, not from the name.
- **The clock and the outbox.** `private.tick`, `private.reconcile` and `private.decide`: can a user's input make them raise and so stop the tick for every Adventure (one poisoned row that blocks everyone's Alert is a priority 1 finding)? Can a user enqueue messages to arbitrary addresses, or many of them? Is the unique key really what stops a double send?
- **Account deletion.** `delete_account` removes or anonymises every row that holds the user's data, including Trail points, messages, delivery reports, push devices and `auth.users`, as `docs/spec.md` promises. Any data left behind is a privacy finding.

Run the database probes in **Machine checks** to confirm what reading suggests.

### 2. The Trail Map and its token

- **Token strength.** How `trail_token` is generated: a CSPRNG (`gen_random_bytes`, `gen_random_uuid`) with at least 128 bits, never `random()`, a sequence, a hash of guessable fields or anything derived from ids. Unique per Adventure and contact, so revoking one contact does not need the others' links to change. [OWASP ASVS V3 / V6](https://owasp.org/www-project-application-security-verification-standard/), CWE-330
- **Lifetime.** `public.trail_map(p_token)` returns data only in the Stages and the time window the spec allows, and nothing for a removed contact, a Planned Adventure, an Adventure past its window or a deleted account. Read the latest migration that defines it.
- **What it returns.** Only what the contact needs. No user id, email, phone number of the Adventurer or other contacts, auth data, internal ids or other contacts' tokens.
- **Enumeration and timing.** A wrong token and a revoked one look the same. The function is not usable as an oracle for whether an Adventure exists.
- **The URL.** The token travels in the fragment (`#`) so it is not sent to the server, logged by GitHub Pages or leaked in `Referer`. Check `supabase/functions/deliver/links.ts`, `src/app/adventure.web.tsx`, `src/lib/trail-map` and that the page sets a `Referrer-Policy` or a `<meta name="referrer">` and loads no third-party script, font or tile server that could see the page URL with its token, or say which ones do and what they see.

### 3. The Edge Function deliver

`supabase/config.toml` sets `verify_jwt = false` for `deliver`, so the function alone decides who may call it.

- **Authentication of every route.** The kick from pg_net, the delivery report callback (`/status`), the health ping and any other path in `index.ts`. Each checks its secret before doing anything: a route that claims, sends or settles messages without it is priority 1.
- **Secret comparison.** `DELIVER_SECRET` and the delivery report HMAC are compared in constant time (`crypto.subtle.verify` or a timing-safe compare), not with `!==` or `===` on strings. CWE-208. A non-constant compare over the network is usually a hardening note; say which it is and why.
- **The delivery report token.** HMAC-SHA-256 with a secret of at least 256 bits, binding the message id and anything else the report changes; a token from one message cannot settle another; the provider's own request signature is verified where the provider offers one (read `docs/text-messages.md` and `senders.ts` for which provider).
- **Injection into messages.** Every value an Adventurer controls (name, destination, phone number, contact names, the Plan) that lands in an email, a text message or a push: HTML-escaped in HTML email, not able to inject headers (CR and LF in a subject, a `From` or a `To`), not able to add a link that looks like Barry's, and length-bounded so a text message cannot run to hundreds of segments. Read `messages.ts`, `messages.en.ts`, `messages.de.ts` and `senders.ts`. CWE-79, CWE-93.
- **Abuse of the senders.** How many Heads-ups and Alerts one account can make Barry send, to how many distinct addresses, how fast, and at what cost; whether a recipient who never agreed can stop them; whether a phone number is validated before it reaches the provider (premium-rate and international pumping). OWASP API4:2023, Unrestricted Resource Consumption.
- **Secrets and errors.** No secret, token, full address list or provider response body is logged or returned in an HTTP response; errors return a generic body. Outbound requests go only to fixed provider hosts, never to a URL built from user data (SSRF, CWE-918).
- **Leases and settlement.** A crashed or concurrent `deliver` cannot send a message twice or drop it; a forged settle cannot mark an Alert sent that was not.

### 4. Auth

- `supabase/config.toml`, both the local `[auth]` blocks and `[remotes.hosted]`, and `scripts/hosted-auth.mjs`: email confirmation required, minimum password length and required characters, leaked password protection where the plan offers it, `secure_password_change`, rate limits on sign-up, sign-in, OTP and email, JWT expiry, refresh token rotation and reuse interval, `site_url` and `additional_redirect_urls` (an allow-list with no wildcard that matches a foreign host), anonymous sign-ins off, sign-ups only as the spec intends, MFA if the spec asks for it. [Supabase: Auth production checklist](https://supabase.com/docs/guides/deployment/going-into-prod)
- The local config may be relaxed for development; a relaxed value is a finding only where it reaches the hosted project or a build that ships. Say which side each value is on.
- Password reset (`src/lib/password-reset.ts`) and email confirmation (`src/app/confirmed.web.tsx`): tokens in the fragment or exchanged by PKCE, no account enumeration through different messages, no open redirect after confirmation.
- Sign-out and account deletion clear the session on the device and revoke it on the server (`src/lib/log-out.ts`, `src/lib/delete-account.ts`), and stop the background Trail and geofence tasks so no point is uploaded under a dead session.

### 5. The app on the phone

Measure it against [OWASP MASVS v2](https://mas.owasp.org/MASVS/) and the [OWASP Mobile Top 10 (2024)](https://owasp.org/www-project-mobile-top-10/), and fetch the Expo docs for the installed SDK (`https://docs.expo.dev/versions/v<major>.0.0/`, and `https://docs.expo.dev/llms.txt`) before calling an API safe or unsafe. Never answer from memory.

- **MASVS-STORAGE.** Where the Supabase session (access and refresh token) is stored: `src/lib/auth-storage.ts` keeps it in the iOS Keychain through `expo-secure-store`, for this device only and readable after the first unlock, and `src/lib/keychain-session.ts` moves a session saved before out of `src/lib/storage.ts` (`expo-sqlite/localStorage`, a plain file in the app container that device backups include). Check the Keychain options and that the plain file keeps no copy, and state what an attacker with an unencrypted backup or a jailbroken phone gets. Do the same for the cached Adventure (`adventure-cache.ts`), the Check-in queue (`check-in-queue.ts`) and the Trail buffer (`trail-buffer.ts`), which hold location history. Nothing sensitive in `console.*`, in crash reports or in notification texts shown on the lock screen beyond what the spec intends.
- **MASVS-AUTH.** Every action that matters goes through a command the server authorises; nothing is decided only on the phone. The offline Check-in queue cannot be replayed into another Adventure or after the Adventure Ended.
- **MASVS-NETWORK.** Every URL is `https` in a shipped build; no `NSAllowsArbitraryLoads` or other App Transport Security exception in `app.json`, `app.config.js` or a config plugin, except the development variant's local network access, which must not reach the `production` profile. Read `app.config.js` per `APP_VARIANT` and `eas.json` per profile.
- **MASVS-PLATFORM.** The URL scheme per variant (`app.config.js`): every route reachable through a deep link or universal link, and whether opening it can trigger an action (a Check-in, a delete, a sign-in with a foreign session) without the user's confirmation. `Linking.openURL` and `WebBrowser` calls with a URL built from data. Any `WebView`, `dangerouslySetInnerHTML` or `injectedJavaScript`. Permission strings ask for no more than the app uses (location always, notifications, local network).
- **MASVS-CODE.** Every value from outside (route params, storage, network rows, notification payloads, background task data) is parsed before use (`rows.ts` is the place for rows; check the others reach it). Background tasks in `trail-task.ts` run before any UI and under whatever session is stored: what happens with no session, an expired one, or a different user's after a sign-out and sign-in.
- **MASVS-PRIVACY.** Location is collected only while an Adventure is Active, stops when it Ends, and is kept on the server only as long as the spec says. Geofences are removed on End, sign-out and account deletion.
- **MASVS-RESILIENCE.** Barry needs no anti-tamper; note only what the spec relies on. A finding here is a hardening note at most.
- **Build-time values.** Every `EXPO_PUBLIC_*` variable is compiled into the bundle and is public. Check `.env.example`, `eas.json`, `app.config.js` and every `process.env` read in `src/`: anything other than the Supabase URL, the publishable key and other values meant to be public is a finding.

### 6. The web build and barry.support

- `src/app/adventure.web.tsx`, `src/app/confirmed.web.tsx`, `src/lib/trail-map`, `src/lib/site-language.ts` and every page in `web/`: no `innerHTML`, `dangerouslySetInnerHTML`, `eval` or `document.write` with data from the fragment, the query, the API or the language; no open redirect; links to other origins carry `rel="noopener noreferrer"`.
- GitHub Pages cannot set HTTP headers, so the pages need `<meta http-equiv="Content-Security-Policy">` and `<meta name="referrer">` where they matter. Report what each page has and what a missing one exposes, with the token page first.
- `.github/workflows/trail-map.yml` publishes only the files it should: no source maps with secrets, no `.env`, no file outside the export and `web/`.

### 7. Secrets in the repository

- Search the working tree and the full git history for keys, tokens and passwords: `git log -p --all` piped through a search for `service_role`, `sb_secret_`, `eyJhbGci` (JWTs), `-----BEGIN`, `api[_-]?key`, `secret`, `password`, `token`, `Bearer `, Twilio-, Resend-, AWS- and Apple-style key shapes. Use `gitleaks detect --log-opts=--all` instead if it is installed. Read each hit: the publishable key and the well-known local Supabase demo keys are public by design; say so and move on.
- `.gitignore` covers every file that holds a secret (`supabase/.env`, `supabase/.env.hosted`, `supabase/functions/.env`, `.env*.local`, `*.p8`, `*.p12`, `*.pem`, `*.key`, `*.mobileprovision`), and none of them is tracked: `git ls-files` must not list one.
- `supabase/seed.sql` and `supabase/config.toml` hold local values only. A hosted value in either, or a document that tells the reader to put one there, is a finding. AGENTS.md says hosted secrets go only through `scripts/hosted-secrets.mjs`: check the script cannot upload a local value or print a secret.
- Vault secrets the database reads (`vault.decrypted_secrets`) are readable by no role the app holds.

### 8. Supply chain and CI

- `npm audit --omit=dev --json` and `npm audit --json`: report each advisory with the package, the path that pulls it in, whether the vulnerable code runs in the shipped app, the Edge Function, the web build or only in development, and the fixed version. A dev-only advisory is a hardening note unless it runs on a developer's machine with network input.
- An `.npmrc` with `legacy-peer-deps=true` or `force=true` lets mismatching peer ranges through without a warning: report it. `package-lock.json` is committed and `npm ci` is what CI runs.
- Deno imports in `supabase/functions/deliver`: pinned to exact versions or to a lock, from trusted registries (`jsr:`, `npm:`, `https://deno.land/x/...@<version>`), no import from a mutable URL.
- `.github/workflows/*.yml`: `permissions` as narrow as each job needs; actions pinned to a full commit SHA or at least a release tag of a trusted publisher (report tags as a hardening note); no `pull_request_target` that checks out the pull request's code; no `${{ github.event.* }}` expanded inside `run:` (script injection); secrets not exposed to forks. [GitHub: Security hardening for GitHub Actions](https://docs.github.com/en/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions)
- `.githooks/` and `.claude/hooks/session-start.sh`, and `.claude/settings.json`: nothing that downloads and runs code without a pinned version or a checksum, and no permission that lets an agent run arbitrary commands without asking where the project did not intend it.
- `plugins/` (config plugins): they run at prebuild with full access; read each one.

### 9. Documents that teach something unsafe

Guides are read and followed. A step in `README.md`, `AGENTS.md`, `docs/*.md` or a skill under `.claude/skills/` that tells the reader to disable RLS, use the service role key in the app, commit a secret, set a secret with a command that leaks it, skip email confirmation in the hosted project, or open a port to the internet is a finding with the document as its location.

## Machine checks

Run these and keep their output. Each hit becomes a finding or a line under **Checked and safe**.

1. **The project's own checks:** `npx expo lint`, `npx tsc --noEmit` and `npm test`. Not security checks, but the report states the tree they ran on.
2. **Dependencies:** `npm audit --omit=dev --json` and `npm audit --json`. Network access may be limited in a cloud session; if the registry cannot be reached, say so under **Could not check**.
3. **Secrets:** the history search of group 7. Write intermediate output to a temporary directory outside the repository.
4. **Database, when the local stack runs** (`npx supabase status`; start it with `npx supabase start` if the session allows it, and `npx supabase db reset --local` only if the user agreed, because it deletes the test account):
   - `npx supabase db advisors --local --type security --level info` (the Supabase security advisors: RLS disabled, security definer views, mutable search paths, exposed auth users and the rest). Every row is a finding or an explained exception.
   - `npx supabase db lint --local --level warning`.
   - Queries through `npx supabase db query` or `psql` on the local database that list the effective state: tables in exposed schemas with `relrowsecurity` and their policies (`pg_policies`); `has_table_privilege` and `has_function_privilege` for `anon` and `authenticated` on every table, view, sequence and function in every schema the API exposes or a security definer function touches; every function with `prosecdef` and its `proconfig`; every view without `security_invoker`.
   - **Attack probes.** Prove each suspected database finding by doing it: create two throw-away accounts through the Auth API of the local stack, sign in as each, and call the RPCs and tables with PostgREST (`curl` with the publishable key and each user's JWT), as `e2e/stack.mjs` does for the e2e suite. Try every command with the other user's ids, every table with a filter on the other user's rows, `trail_map` with a guessed and a revoked token, and `deliver` without and with a wrong secret. Delete both accounts afterwards. Without the stack, mark these findings **unproven** and say what would prove them.
5. **Deno:** `deno check supabase/functions/deliver/index.ts` and `deno test supabase/functions/deliver` to confirm the function you read is the one that compiles.

Never run a probe against the hosted project, a real phone number or a real inbox. Every probe targets the local stack and the local message catchers ([docs/local-messages.md](../../../docs/local-messages.md)).

## How to work

1. **Threat model.** Read the documents under **What Barry must protect** and write down, in a few lines, the assets, the trust boundaries (phone, PostgREST, Postgres roles, `deliver`, the providers, the Trail Map page, GitHub Pages, CI) and which attacker reaches which boundary.
2. **Machine checks.** Run them and group the output by check.
3. **Read every file in scope fully,** following every attack path across boundaries. For each group above, write one line per candidate: `path:line`, the attacker, the steps, the gain, and **proven** (a probe or a test showed it), **certain** (the code admits no other reading) or **likely** (it depends on something you could not see, which you name).
4. **Try to disprove each candidate.** Look for the grant, policy, check, trigger or later migration that stops it. A candidate that a later migration closed is not a finding; say so under **Checked and safe** when it is worth knowing.
5. **Rate** each finding Critical, High, Medium, Low or Note, from the harm order above and how much the attacker needs: anything that lets an anonymous caller or another Adventurer break the safety promise or read someone's location is Critical; the same needing a stolen unlocked phone is lower. Give the CWE where one fits.

## Report

Write the report in Markdown, in the language the user writes in (German in Swiss High German, with `ss`, never `ß`), with these sections, in this order:

1. **Summary:** what was analysed, the checks run and their results, findings per severity, and the three that matter most.
2. **Threat model:** the assets, boundaries and attackers from step 1, in at most fifteen lines.
3. **Findings,** from Critical to Note. One entry each: an identifier (`SEC-1`, `SEC-2`, …), a one-sentence title, the severity and CWE, `path:line` with the code quoted, the attack path step by step, what the attacker gains, proven, certain or likely, the source of the rule, and the fix in one or two sentences. With `--fix`, each entry also carries an outcome: **fixed** with the commit hash, or **skipped** with the rule below that stopped it.
4. **Hardening notes:** rules broken without a path to harm, one line each.
5. **Checked and safe:** one line per group above saying what was compared and why it holds, so the reader sees what was covered.
6. **Could not check:** what needed the stack, a device, the hosted project, network access or a tool you did not have, and what each would have shown.

Quote code verbatim with `path:line`. One finding per root cause, with every location. Do not pad, and do not report a finding you could not trace to an attacker.

Give the report in the reply, with or without `--fix`, unless the user asks for a file. It quotes no secret value beyond its first six characters, not even a local one.

With `--fix`, append the commits made, in order, one line each, and the skipped findings with their rules.

## Applying fixes with --fix

Only after the report is complete. Work from Critical down and apply a fix only when every rule below holds. Skip it otherwise and say which rule stopped it.

1. **The finding is proven or certain.** A likely finding is the author's call.
2. **The fix closes the hole and nothing else.** An honest Adventurer and an honest Emergency Contact see the same screens, texts, messages and timing afterwards. Revoking a grant nothing legitimate uses, adding an ownership check to a command, setting `search_path`, escaping a value in a template, comparing a secret in constant time, adding a `Referrer-Policy` meta tag, narrowing a workflow's `permissions` or pinning an action all count. Moving the session to another storage, changing an Auth setting of the hosted project, changing what `trail_map` returns or how long it answers, adding rate limits, rotating a secret or anything that changes the spec does not: those are the author's decisions, and the report proposes them.
3. **Migrations are added, never edited.** A database fix is a new migration in `supabase/migrations/` named like its neighbours (`<timestamp>_<what_it_closes>.sql`), that redefines the latest version of the function or changes the grant or policy. Copy the function's current body from the latest migration that defines it and change only what the fix needs. If the change alters a table, view, function or enum signature, regenerate `src/lib/database.types.ts` as AGENTS.md describes. Without the local stack, skip every database fix: it cannot be proven.
4. **Each fix is proven.** Run the probe that showed the finding again and show it now fails; add the probe as a pgTAP test in `supabase/tests/database/` or a Deno test next to `deliver` when the fix is in the database or the Edge Function, so the hole cannot reopen. Then run `npx expo lint`, `npx tsc --noEmit`, `npm test`, and for a database or `deliver` fix `npx supabase test db` and `deno test supabase/functions/deliver` (restart the Edge Runtime first, as AGENTS.md says). If anything fails, revert the files with `git checkout -- <files>`, remove any new file, and mark the finding skipped with the failing output.
5. **Nothing is silenced.** No `eslint-disable`, `@ts-ignore`, test skipped or weakened, advisor lint suppressed or audit advisory ignored to make a finding go away.
6. **Dependencies move only by patch or minor version within the SDK,** with `npx expo install <package>` for Expo packages and `npx expo install --fix` where it applies, never `npm audit fix --force`. A major upgrade is a proposal.
7. **No secret is created, rotated, printed or committed,** and no hosted resource is touched: no `supabase db push`, `functions deploy`, `scripts/hosted-secrets.mjs` or `scripts/hosted-auth.mjs`. Name the fixes that must go out to the hosted project at the end of the report.
8. **One finding, one commit,** with a message in the style of the repository's history (one sentence naming the behaviour that changed, in the glossary's terms, such as "Another Adventurer can no longer check in on an Adventure that is not theirs"). The repository's `commit-msg` hook refuses a message or identity that names Claude, so add no attribution line.
9. **Changes the project wants proven are named.** A fix under `supabase/` needs `/barry-backend-verify`; a fix to a screen or `src/lib/barry` needs `/barry-frontend-verify`. List the commits that need it at the end of the report; do not claim them verified.
10. **Never push, never open a pull request.** If the current branch is the default branch, create a branch first and say which. Leave pushing to the user unless they asked for it in the same message.
