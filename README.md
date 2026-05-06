# Typing Study

Web-based research application for an undergraduate dissertation comparing
copy-based and prompt-based typing performance.

- **Author:** Christian Roberts
- **Supervisor:** Irena Spasic
- **Moderator:** Oktay Karakus
- **Institution:** Cardiff University, School of Computer Science & Informatics
- **Submission:** May 2026

---

## Project overview

The application administers a within-subjects typing experiment. Each
participant completes:

1. A 1-minute practice round (not recorded)
2. A 5-minute **copy-typing** task (reproduce a passage shown on screen)
3. A 5-minute **prompt-typing** task (write a free response to a prompt)

Task order is **counterbalanced** by participant ID (odd IDs receive copy
first, even IDs receive prompt first) to control for fatigue, learning,
and screen-familiarity effects across the sample.

Per-task data captured includes every keystroke with timestamps, pause
events, raw and effective backspace counts, and computed metrics including
gross WPM, net WPM (copy task only), copy accuracy via Levenshtein edit
distance, and inter-keystroke interval (IKI) statistics. Demographics and
environment metadata are captured once per session. The session ends with
a single combined JSON download.

## Repository layout

```
.
├── index.html                  Multi-screen experiment UI (entry point)
├── script.js                   Application logic, task runner, metrics
├── style.css                   Stylesheet
├── README.md                   This file
├── experimenter_protocol.md    Session-running checklist
├── analyse.py                  Post-study analysis pipeline (Python)
└── requirements.txt            Python dependencies for analyse.py
```

## Running the application

The application is a static three-file web app with no build step and no
server requirement.

To run locally for development or testing:

```
# from the project directory:
python -m http.server 8000

# then open http://localhost:8000 in a browser
```

For real participant sessions, hosting the page on any static web host
or simply opening `index.html` directly in a modern browser is sufficient.

**Browser requirements:** Any current Chrome, Firefox, Edge, or Safari.
The application uses standard DOM APIs and does not depend on any
browser-specific feature.

## Conducting a session

See `experimenter_protocol.md` for the full session checklist. In brief:

1. Open the welcome screen in a clean browser window
2. The participant reads the welcome and consent screens, ticks the
   consent box, and proceeds
3. They enter the participant ID **provided by the experimenter** (this
   determines task order — see Counterbalancing below) and answer the
   optional demographics
4. They complete a 1-minute practice, then both 5-minute tasks (in the
   order assigned by the system) with a short break between
5. The application offers a JSON file for download at the end. The
   experimenter takes this file and saves it for analysis

## JSON data schema

The exported file is named `<participantId>_<sessionId>.json` and has
this structure (showing nesting only):

```
metadata
    exportVersion           number   schema version (currently 2)
    sessionId               string
    participantId           string
    sessionStartTime        ISO 8601 string
    sessionEndTime          ISO 8601 string
    taskOrder               array of "copy"|"prompt" e.g. ["copy","prompt"]

consent
    consented               boolean
    consentedAt             ISO 8601 string

demographics
    ageRange                string
    typingFrequency         string
    englishFirstLanguage    "yes"|"no"|"prefer-not-say"
    yearsUsingComputer      string
    keyboardType            string

environment
    userAgent               string
    language                string
    platform                string
    screenWidth             number
    screenHeight            number
    windowWidth             number
    windowHeight            number
    timezone                string
    capturedAt              ISO 8601 string

config
    testDurationSeconds     number
    practiceDurationSeconds number
    pauseThresholdMs        number

tasks                       array (always length 2)
    [each task]
        taskNumber          1 or 2
        taskType            "copy" or "prompt"
        promptOrSourceText  string  (the source text or prompt shown)
        finalText           string  (what the participant typed)
        startTime           ISO 8601
        endTime             ISO 8601
        durationSeconds     number  (actual elapsed time of the test)
        metrics
            totalCharactersTyped    number
            grossWPM                number
            netWPM                  number or null  (copy task only)
            rawBackspaceCount       number  (every Backspace press)
            effectiveBackspaceCount number  (Backspace presses that deleted text)
            pauseCount              number  (gaps >= pauseThresholdMs)
            averagePauseMs          number
            longestPauseMs          number
            interKeystrokeInterval
                count               number
                meanMs              number
                medianMs            number
                stdDevMs            number
                percentile25Ms      number
                percentile75Ms      number
            copyTaskMetrics         object or null  (copy task only)
                typedLength         number
                comparedTargetLength number
                editDistance        number  (Levenshtein, lower = more accurate)
                accuracyPercent     number  (0-100)
        logs
            totalKeystrokes         number
            pauseEvents             array of {durationMs, ...}
            keystrokes              array of {key, code, timestamp, ...}
```

## Counterbalancing

Task order is determined by a deterministic rule: the first run of digits
in the participant ID is parsed as an integer; if odd, the participant
does the **copy** task first, otherwise **prompt** first. The order is
also written into `metadata.taskOrder` for redundancy.

For example: P01, P03, P05 → copy first; P02, P04, P06 → prompt first.

Use sequential participant IDs (P01, P02, P03, ...) without skipping to
ensure a roughly equal split of orderings.

## Metrics — how each is computed

| Metric | Computed from | Notes |
|---|---|---|
| **Gross WPM** | `(chars / 5) / minutes` | Standard typing-test formula. Includes errors. |
| **Net WPM** | `Gross WPM − errorsPerMinute` | Errors = Levenshtein edit distance to target. Copy task only. |
| **Copy accuracy** | `(1 − editDistance / typedLength) × 100` | Compared against same-length prefix of target. Handles misalignment. |
| **Effective backspace count** | Backspaces that actually deleted text | Filtered from `keydown` + post-`input` state comparison. |
| **Pause count** | Gaps ≥ 2000 ms between keystrokes | Threshold is `PAUSE_THRESHOLD_MS` in `script.js`. |
| **IKI mean / SD / quartiles** | Time between successive text-changing keystrokes | Excludes modifier keys, arrow keys, etc. |

## Analysing the data

After collecting JSON files from all participants:

```bash
# 1. install dependencies once
python -m pip install -r requirements.txt

# 2. place all session JSON files in a directory
mkdir -p data
cp <wherever>/P*.json data/

# 3. run the analysis
python analyse.py --data-dir ./data --output-dir ./analysis_output
```

The script produces:

- `summary_per_participant.csv` — one row per participant per task
- `summary_group.csv` — group means, SDs, medians by task type
- `paired_tests.csv` — Wilcoxon and t-test results with effect sizes
- `order_effects.csv` — sanity check that counterbalancing worked
- `*.png` — paired-line plots and box plots for the dissertation
- `analysis_report.md` — narrative summary, ready to lift into the report

## Methodology notes for the dissertation

These design choices are worth flagging in the System Implementation and
Methodology chapters:

- **Counterbalanced within-subjects design** controls for fatigue,
  learning, and individual differences, increasing statistical power
  versus a between-subjects design with the same N.
- **Levenshtein edit distance** for copy-task accuracy avoids the
  misalignment problem inherent in naive character-by-character matching.
- **Net WPM** (Soukoreff & MacKenzie, 2003) penalises uncorrected errors
  and is the recommended typing-research speed metric.
- **Inter-keystroke interval distribution** (mean, SD, IQR) gives a
  finer-grained view of typing rhythm than aggregate WPM alone.
  Higher IKI variability under cognitive load is a common finding in
  the literature.
- **Pasting and dragging are blocked** in the typing area to prevent
  participants from circumventing the typing measurement.
- **Timer starts on first keystroke** so participants are not penalised
  for time spent reading instructions.
- **Practice round** familiarises participants with the interface
  before the measured tasks, reducing first-task novelty effects.

## References (for the dissertation)

- Nielsen, J., & Landauer, T. K. (1993). A mathematical model of the
  finding of usability problems. *Proceedings of INTERCHI '93.*
- Soukoreff, R. W., & MacKenzie, I. S. (2003). Metrics for text entry
  research: an evaluation of MSD and KSPC, and a new unified error metric.
  *Proceedings of CHI '03.*
- Card, S. K., Moran, T. P., & Newell, A. (1980). The keystroke-level
  model for user performance time with interactive systems.
  *Communications of the ACM*, 23(7).

## License & data handling

This is an academic project. Participant data is identified only by an
opaque participant ID (no names collected) and is used solely for the
purposes of this dissertation and any associated assessment.
