# Experimenter Protocol

This document is the operational checklist for running a single session
of the typing study. Following it consistently across every participant
gives you grounds to claim methodological consistency in the dissertation.

Print this out, or keep it open on a phone, and tick through it for each
participant. Anything noted in the **Session log** at the bottom can be
copied into the project diary or appendix.

---

## Pre-session checklist

Do this **before** the participant arrives.

- [ ] Quiet environment: no music, no nearby conversations, no incoming
      notifications on the participant's view
- [ ] Same physical setup as previous sessions: same laptop, same keyboard,
      same chair height, same desk
- [ ] Browser: same browser, same window size (full-screen recommended), no
      open tabs other than the typing study
- [ ] No assistive features that change typing behaviour: autocorrect off,
      browser spell-check off (the textarea has `spellcheck="false"`,
      but verify), no ad-blocker injecting scripts
- [ ] Battery on charger, mouse out of the way, keyboard centred
- [ ] Application page open at the welcome screen (do not pre-fill anything)
- [ ] Outputs folder ready to receive the JSON file
- [ ] Pen and this checklist to hand

## Greeting and briefing (script)

Read this as written, or close to it. Do not improvise extra information
about the study aims, as differential briefing across participants is a
threats-to-validity concern.

> "Thank you for taking part. The session takes about 12 to 15 minutes.
>  You will be asked to type two short tasks of five minutes each, with a
>  practice round and a short break in between. The first screens explain
>  what to do and ask for your consent. Please read them and let me know
>  if you have any questions. Once you start each typing task, please type
>  continuously for the full five minutes and try to ignore me — I will
>  stay nearby in case anything goes wrong but I will not interrupt."

If asked what the study is testing:

> "I'm comparing two types of typing - copying text versus writing in
>  response to a prompt. I'd rather not say more right now because I don't
>  want to influence how you type, but I'm happy to explain in detail at
>  the end."

## During the session

- [ ] Ensure participant ID is entered correctly. Use the IDs in order
      (P01, P02, ...): the parity-based counterbalancing depends on the
      ID number being honest.
- [ ] Once they begin the first typing task, **do not interact** unless
      they explicitly ask for help or something clearly fails.
- [ ] If the application breaks (rare, but possible): note exactly when
      and what happened in the session log; the data file may still be
      partially recoverable, but treat the session as a pilot rather
      than a study run.
- [ ] Watch quietly for participant distress (sometimes the prompt task
      makes people uncomfortable). If a participant clearly wants to stop
      they may, no follow-up needed.

## End of session

- [ ] Participant clicks the Download button on the final screen.
- [ ] Take the file from the participant's downloads folder and save it
      into your study data directory with the filename **as exported**
      (do not rename).
- [ ] Verify the file opens and is valid JSON. Quick sanity check: it
      should contain two task objects in the `tasks` array.
- [ ] Debrief: explain the actual research question, thank them, answer
      any questions.
- [ ] Add a row to your session log (template below).

## Recovering from common issues

| Problem | Action |
|---|---|
| Participant didn't tick consent box | They cannot proceed. Re-explain, ask if they would like to continue. |
| Participant types something but timer doesn't start | Refresh the page and restart from the welcome screen. The session is wasted; treat as pilot. |
| Browser crashes mid-session | Session is lost. Note the participant ID; do not reuse the same ID for this participant. |
| Participant types far past five minutes (timer didn't fire) | Should not happen, but if so: end the session, note the ID, treat the data with caution. |
| Pasting was attempted | The app blocks paste; the alert dialog will have appeared. Note in the log; data is unaffected. |

## Session log template

For each session, fill in something like:

```
Participant ID:        P03
Date / time:           2026-04-30 14:30
Duration (total):      ~14 minutes
Task order assigned:   prompt -> copy
Environment notes:     home office, quiet, windows closed
Issues / notes:        participant briefly paused around 2 min into copy task
                       to ask if backspaces were allowed (I confirmed yes)
Data file saved as:    P03_session-1745930400123.json
```

A simple plain-text or spreadsheet log is enough. Reference the log file
from your dissertation appendices.

## Sample size targets

- **Pilot:** 1 participant (a friend you trust to give honest feedback on
  the experience). Iterate on instructions if needed before recruiting more.
- **Main study:** 5 minimum, 6-8 ideal. Cite Nielsen & Landauer (1993)
  for the n=5 threshold in usability evaluation.
- **Counterbalancing:** aim for an even split of orderings. Because IDs
  are assigned sequentially and the parity rule alternates, this happens
  automatically as long as no IDs are skipped.
