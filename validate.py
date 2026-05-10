#!/usr/bin/env python3
"""
Typing Study - Session JSON Validator
=====================================

Reads one or more session JSON files exported by the typing-study app
and reports anything that looks structurally wrong or numerically
implausible. Use this as a quick check after each pilot or participant
session before committing the file to your data set.

Usage:
    python validate.py path/to/session.json
    python validate.py ./data/*.json
    python validate.py --strict ./data/*.json    # treat warnings as errors

Exit codes:
    0   all files passed (no errors; warnings allowed unless --strict)
    1   one or more files had errors (or warnings in --strict mode)
    2   bad invocation (e.g. file not found)

The validator is opinionated about what 'plausible' means - tweak the
PLAUSIBILITY_BOUNDS dictionary below if your study uses different
durations or thresholds.
"""

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path


# Schema version this validator was written against.
EXPECTED_EXPORT_VERSION = 4

# Versions that are still readable but predate the current schema. Files at
# these versions can still be validated and analysed; the validator emits
# informational notes rather than errors for known-and-fixed legacy issues.
#   v3: stored netWPM uses a unit-inconsistent formula (subtracts error
#       chars/min from words/min, omitting the /5 conversion). The raw
#       fields needed to recompute Net WPM correctly are present, so
#       analyse.py recomputes from those. The validator does not check the
#       stored netWPM value directly, so v3 files validate cleanly.
#   v2: timer started on any keystroke including modifiers; Ctrl+Backspace
#       deletions were silently dropped from the log; consent timestamp was
#       always equal to the session start time. v2 files trigger
#       informational notes for each of these patterns.
SUPPORTED_LEGACY_VERSIONS = {2, 3}

# Plausibility bounds - data outside these triggers a warning, not an error.
# Adjust if your study config changes (e.g. you alter TEST_DURATION).
PLAUSIBILITY_BOUNDS = {
    'taskDurationSeconds': (290, 310),       # expected ~300 (5 min) per task
    'sessionDurationSeconds': (600, 7200),   # expected 10 min - 2 hr
    'grossWPM': (5, 200),                    # roughly the human range
    'meanIKImsCopy': (50, 2000),             # expected 100-600 ms typically
    'meanIKImsPrompt': (50, 5000),           # prompt may have longer pauses
    'copyAccuracyPercent': (50, 100),        # below 50% is suspicious
}


# =========================================================================
# Issue tracking per file
# =========================================================================

class IssueList:
    """Accumulates errors, warnings and info notes for a single file."""

    def __init__(self):
        self.errors = []
        self.warnings = []
        self.info = []

    def error(self, msg):
        self.errors.append(msg)

    def warn(self, msg):
        self.warnings.append(msg)

    def note(self, msg):
        self.info.append(msg)

    def has_errors(self):
        return len(self.errors) > 0

    def has_warnings(self):
        return len(self.warnings) > 0


# =========================================================================
# Helpers
# =========================================================================

def parse_iso(s):
    """Parse ISO-8601 timestamp; supports trailing 'Z'."""
    return datetime.fromisoformat(s.replace('Z', '+00:00'))


def get(d, path, default=None):
    """Safe nested dict accessor: get(data, ['a', 'b']) -> data['a']['b']."""
    cur = d
    for key in path:
        if not isinstance(cur, dict) or key not in cur:
            return default
        cur = cur[key]
    return cur


# =========================================================================
# Top-level structural checks
# =========================================================================

def check_top_level(data, issues):
    required = ['metadata', 'consent', 'demographics', 'environment',
                'config', 'tasks']
    for key in required:
        if key not in data:
            issues.error(f"missing top-level key: '{key}'")


def check_metadata(data, issues):
    md = data.get('metadata')
    if not isinstance(md, dict):
        issues.error("metadata is missing or not an object")
        return

    for key in ['exportVersion', 'sessionId', 'participantId',
                'sessionStartTime', 'sessionEndTime', 'taskOrder']:
        if key not in md:
            issues.error(f"metadata missing key: '{key}'")

    if md.get('exportVersion') != EXPECTED_EXPORT_VERSION:
        version = md.get('exportVersion')
        if version == 2:
            issues.note(f"exportVersion is 2 (current schema is "
                        f"{EXPECTED_EXPORT_VERSION}); v2 had three fixed "
                        f"bugs - timer-start, Ctrl+Backspace, and "
                        f"consent-timestamp warnings below are expected "
                        f"for this file")
        elif version == 3:
            issues.note(f"exportVersion is 3 (current schema is "
                        f"{EXPECTED_EXPORT_VERSION}); v3 stored a "
                        f"unit-inconsistent netWPM value, but the raw "
                        f"fields needed to recompute it correctly are "
                        f"present. analyse.py recomputes Net WPM from "
                        f"those raw fields. No other warnings expected.")
        elif version in SUPPORTED_LEGACY_VERSIONS:
            # Defensive branch in case SUPPORTED_LEGACY_VERSIONS is
            # extended without updating the cases above.
            issues.note(f"exportVersion is {version} (current schema is "
                        f"{EXPECTED_EXPORT_VERSION}); legacy schema, see "
                        f"validator source for known differences")
        else:
            issues.warn(f"exportVersion is {version}, "
                        f"expected {EXPECTED_EXPORT_VERSION}")

    pid = md.get('participantId')
    if not pid or not str(pid).strip():
        issues.error("participantId is empty or whitespace")

    order = md.get('taskOrder')
    if not isinstance(order, list) or len(order) != 2:
        issues.error(f"taskOrder must be a 2-element array, got {order!r}")
    elif sorted(order) != ['copy', 'prompt']:
        issues.error(f"taskOrder must contain one 'copy' and one 'prompt', "
                     f"got {order!r}")

    # Counterbalancing parity check: does the taskOrder match what
    # determineTaskOrder() would compute from the participant ID?
    if isinstance(order, list) and len(order) == 2 and pid:
        digits = ''.join(c for c in str(pid) if c.isdigit())
        if digits:
            n = int(digits)
            expected_first = 'copy' if n % 2 == 1 else 'prompt'
            if order[0] != expected_first:
                issues.warn(
                    f"participantId '{pid}' has trailing digits {digits} "
                    f"(parity {'odd' if n%2 else 'even'}), so taskOrder[0] "
                    f"should be '{expected_first}' but is '{order[0]}'. "
                    f"Counterbalancing rule may have changed - "
                    f"verify before analysing."
                )

    # Session timing
    try:
        start = parse_iso(md['sessionStartTime'])
        end = parse_iso(md['sessionEndTime'])
        duration = (end - start).total_seconds()
        if duration < 0:
            issues.error("sessionEndTime is before sessionStartTime")
        else:
            lo, hi = PLAUSIBILITY_BOUNDS['sessionDurationSeconds']
            if duration < lo:
                issues.warn(f"session duration was only {duration:.0f}s "
                            f"(expected at least {lo}s) - did the session "
                            f"end early?")
            elif duration > hi:
                issues.warn(f"session duration was {duration:.0f}s "
                            f"(longer than {hi}s) - participant idled "
                            f"on intro screens for a long time?")
    except (KeyError, ValueError, TypeError) as e:
        issues.error(f"could not parse session timestamps: {e}")


def check_consent(data, issues):
    consent = data.get('consent', {})
    if consent.get('consented') is not True:
        issues.error(f"consent.consented is not True "
                     f"(got {consent.get('consented')!r}) - this should "
                     f"never happen for a completed session")

    consent_at = consent.get('consentedAt')
    session_start = get(data, ['metadata', 'sessionStartTime'])
    export_version = get(data, ['metadata', 'exportVersion'])
    if consent_at and session_start and consent_at == session_start:
        if export_version == 2:
            issues.note("consent.consentedAt is identical to "
                        "metadata.sessionStartTime - expected for v2 files "
                        "(known bug, fixed in v3)")
        else:
            issues.warn("consent.consentedAt is identical to "
                        "metadata.sessionStartTime - this should have been "
                        "fixed in v3; verify the consent click handler")


def check_demographics(data, issues):
    demo = data.get('demographics', {})
    expected = ['ageRange', 'typingFrequency', 'englishFirstLanguage',
                'yearsUsingComputer', 'keyboardType']
    for key in expected:
        if key not in demo:
            issues.error(f"demographics missing key: '{key}'")
        elif not demo[key]:
            issues.warn(f"demographics.{key} is empty")


def check_environment(data, issues):
    env = data.get('environment', {})
    expected = ['userAgent', 'language', 'platform', 'screenWidth',
                'screenHeight', 'windowWidth', 'windowHeight', 'timezone']
    for key in expected:
        if key not in env:
            issues.warn(f"environment missing key: '{key}'")

    for key in ['screenWidth', 'screenHeight', 'windowWidth', 'windowHeight']:
        v = env.get(key)
        if v is not None and (not isinstance(v, (int, float)) or v <= 0):
            issues.warn(f"environment.{key} is suspicious: {v!r}")


def check_config(data, issues):
    cfg = data.get('config', {})
    for key in ['testDurationSeconds', 'practiceDurationSeconds',
                'pauseThresholdMs']:
        if key not in cfg:
            issues.warn(f"config missing key: '{key}'")

    if cfg.get('testDurationSeconds') not in (None, 300):
        issues.note(f"config.testDurationSeconds is "
                    f"{cfg['testDurationSeconds']} (default is 300)")


# =========================================================================
# Task-level checks
# =========================================================================

def check_tasks(data, issues):
    tasks = data.get('tasks')
    if not isinstance(tasks, list):
        issues.error(f"'tasks' must be an array, "
                     f"got {type(tasks).__name__}")
        return

    if len(tasks) != 2:
        issues.error(f"expected exactly 2 tasks, found {len(tasks)}")
        return

    # Some downstream checks behave differently between v2 and v3 schemas
    # (notably the keystroke-count consistency check, because Bug 2 was
    # fixed in v3). Extract the version once here and thread it through.
    export_version = get(data, ['metadata', 'exportVersion'])

    # Task type coverage
    task_types = [t.get('taskType') for t in tasks]
    if sorted(t for t in task_types if t) != ['copy', 'prompt']:
        issues.error(f"tasks must contain one 'copy' and one 'prompt', "
                     f"got {task_types!r}")

    # Order consistency: tasks array must match metadata.taskOrder
    md_order = get(data, ['metadata', 'taskOrder'])
    if isinstance(md_order, list) and len(md_order) == 2:
        for i in range(2):
            if tasks[i].get('taskType') != md_order[i]:
                issues.error(
                    f"tasks[{i}].taskType is "
                    f"'{tasks[i].get('taskType')}' but "
                    f"metadata.taskOrder[{i}] says '{md_order[i]}' - "
                    f"counterbalancing inconsistency; data unsafe to analyse"
                )

    # Per-task validation
    for i, task in enumerate(tasks):
        check_one_task(task, i, issues, export_version)

    # Cross-task: task 1 must end before task 2 starts
    if len(tasks) == 2:
        try:
            t0_end = parse_iso(tasks[0]['endTime'])
            t1_start = parse_iso(tasks[1]['startTime'])
            if t1_start < t0_end:
                issues.error(f"task 2 starts before task 1 ends - "
                             f"timing data is corrupt")
        except (KeyError, ValueError, TypeError):
            pass  # already flagged in check_one_task


def check_one_task(task, idx, issues, export_version=None):
    """Validate a single task object."""
    label = f"tasks[{idx}] ({task.get('taskType', '?')})"

    required = ['taskNumber', 'taskType', 'promptOrSourceText', 'finalText',
                'startTime', 'endTime', 'durationSeconds', 'metrics', 'logs']
    for key in required:
        if key not in task:
            issues.error(f"{label} missing key: '{key}'")
            return

    # Task number consistency
    if task['taskNumber'] != idx + 1:
        issues.warn(f"{label} taskNumber is {task['taskNumber']} but "
                    f"position in array is {idx} (expected taskNumber={idx+1})")

    # Duration plausibility
    dur = task['durationSeconds']
    lo, hi = PLAUSIBILITY_BOUNDS['taskDurationSeconds']
    if not isinstance(dur, (int, float)):
        issues.error(f"{label} durationSeconds is not numeric: {dur!r}")
    elif dur < lo:
        issues.warn(f"{label} durationSeconds = {dur:.2f}s "
                    f"(expected ~300s; task ended early?)")
    elif dur > hi:
        issues.warn(f"{label} durationSeconds = {dur:.2f}s "
                    f"(expected ~300s; timer overshot?)")

    # Start/end timestamps
    try:
        ts = parse_iso(task['startTime'])
        te = parse_iso(task['endTime'])
        actual_dur = (te - ts).total_seconds()
        if abs(actual_dur - dur) > 1.0:
            issues.warn(f"{label} durationSeconds ({dur:.2f}) "
                        f"disagrees with start/end times "
                        f"({actual_dur:.2f}) by more than 1s")
    except (ValueError, TypeError) as e:
        issues.error(f"{label} timestamp parse error: {e}")

    # Metrics block
    check_metrics(task, label, issues, export_version)

    # Logs block
    check_logs(task, label, issues, export_version)

    # Final text consistency
    final_text = task.get('finalText', '')
    total_chars = get(task, ['metrics', 'totalCharactersTyped'])
    if total_chars is not None and len(final_text) != total_chars:
        issues.error(f"{label} finalText length ({len(final_text)}) does "
                     f"not match metrics.totalCharactersTyped ({total_chars})")


def check_metrics(task, label, issues, export_version=None):
    m = task.get('metrics', {})
    task_type = task.get('taskType')

    required = ['totalCharactersTyped', 'grossWPM', 'rawBackspaceCount',
                'effectiveBackspaceCount', 'pauseCount', 'averagePauseMs',
                'longestPauseMs', 'interKeystrokeInterval']
    for key in required:
        if key not in m:
            issues.error(f"{label} metrics missing key: '{key}'")

    # netWPM must be present for copy, null for prompt
    if task_type == 'copy':
        if m.get('netWPM') is None:
            issues.error(f"{label} metrics.netWPM is null but task is 'copy'")
    elif task_type == 'prompt':
        if m.get('netWPM') is not None:
            issues.warn(f"{label} metrics.netWPM = {m['netWPM']!r} but "
                        f"task is 'prompt' (expected null)")

    # copyTaskMetrics must be present for copy, null for prompt
    cm = m.get('copyTaskMetrics')
    if task_type == 'copy':
        if not isinstance(cm, dict):
            issues.error(f"{label} copyTaskMetrics is missing or not an "
                         f"object for copy task")
        else:
            for key in ['typedLength', 'comparedTargetLength', 'editDistance',
                        'accuracyPercent']:
                if key not in cm:
                    issues.error(f"{label} copyTaskMetrics missing '{key}'")
            acc = cm.get('accuracyPercent')
            lo, hi = PLAUSIBILITY_BOUNDS['copyAccuracyPercent']
            if isinstance(acc, (int, float)) and acc < lo:
                issues.warn(f"{label} copy accuracy is {acc:.1f}% - "
                            f"unusually low; verify the participant was "
                            f"genuinely attempting the task")
    elif task_type == 'prompt':
        if cm is not None:
            issues.warn(f"{label} copyTaskMetrics is not null for prompt task")

    # Backspace counts: raw must be >= effective
    raw = m.get('rawBackspaceCount')
    eff = m.get('effectiveBackspaceCount')
    if isinstance(raw, int) and isinstance(eff, int):
        if eff > raw:
            issues.error(f"{label} effectiveBackspaceCount ({eff}) > "
                         f"rawBackspaceCount ({raw}) - impossible")
        if raw - eff > 0:
            # In v2, raw>eff usually meant Ctrl+Backspace presses that
            # were silently dropped from the input pipeline (Bug 2).
            # In v3 those are correctly tracked, so raw>eff now means
            # Backspace was pressed at a point where it had nothing to
            # delete (cursor at position 0 with no selection).
            note_text = (f"{label} {raw - eff} backspace press(es) did "
                         f"not delete text")
            if export_version == 2:
                note_text += (" (or used modifier combos like Ctrl+Backspace; "
                              "Bug 2, fixed in v3)")
            else:
                note_text += (" (cursor at start of empty selection)")
            issues.note(note_text)

    # Pause stats consistency
    pc = m.get('pauseCount')
    ap = m.get('averagePauseMs')
    lp = m.get('longestPauseMs')
    if pc == 0:
        if ap not in (0, None) or lp not in (0, None):
            issues.warn(f"{label} pauseCount is 0 but pause stats are "
                        f"non-zero (avg={ap}, longest={lp})")
    elif isinstance(pc, int) and pc > 0:
        if isinstance(ap, (int, float)) and isinstance(lp, (int, float)):
            if lp < ap:
                issues.error(f"{label} longestPauseMs ({lp}) < "
                             f"averagePauseMs ({ap}) - impossible")

    # WPM plausibility
    g = m.get('grossWPM')
    if isinstance(g, (int, float)):
        lo, hi = PLAUSIBILITY_BOUNDS['grossWPM']
        if g < lo:
            issues.warn(f"{label} grossWPM = {g} (very low; "
                        f"participant barely typed?)")
        elif g > hi:
            issues.warn(f"{label} grossWPM = {g} (implausibly high)")

    # IKI plausibility
    iki = m.get('interKeystrokeInterval', {})
    mean_iki = iki.get('meanMs')
    if isinstance(mean_iki, (int, float)):
        bounds_key = ('meanIKImsCopy' if task_type == 'copy'
                      else 'meanIKImsPrompt')
        lo, hi = PLAUSIBILITY_BOUNDS[bounds_key]
        if mean_iki < lo or mean_iki > hi:
            issues.warn(f"{label} mean IKI = {mean_iki:.0f}ms "
                        f"(plausible range {lo}-{hi}ms)")

    # IKI quartile ordering
    p25 = iki.get('percentile25Ms')
    med = iki.get('medianMs')
    p75 = iki.get('percentile75Ms')
    if all(isinstance(v, (int, float)) for v in (p25, med, p75)):
        if not (p25 <= med <= p75):
            issues.error(f"{label} IKI quartiles out of order: "
                         f"p25={p25}, median={med}, p75={p75}")


def check_logs(task, label, issues, export_version=None):
    logs = task.get('logs', {})
    for key in ['totalKeystrokes', 'pauseEvents', 'keystrokes']:
        if key not in logs:
            issues.error(f"{label} logs missing key: '{key}'")
            return

    keystrokes = logs['keystrokes']
    if not isinstance(keystrokes, list):
        issues.error(f"{label} logs.keystrokes is not an array")
        return

    if len(keystrokes) != logs['totalKeystrokes']:
        issues.error(f"{label} totalKeystrokes ({logs['totalKeystrokes']}) "
                     f"!= len(keystrokes) ({len(keystrokes)})")

    pause_events = logs.get('pauseEvents', [])
    pause_count_metric = get(task, ['metrics', 'pauseCount'])
    if isinstance(pause_count_metric, int) and len(pause_events) != pause_count_metric:
        issues.error(f"{label} pauseEvents has {len(pause_events)} entries "
                     f"but metrics.pauseCount = {pause_count_metric}")

    # First-keystroke check: timer should start on a productive key, not
    # on a modifier. In v2 the timer started on any keydown (Bug 1),
    # so v2 files frequently have a modifier as the first keystroke.
    # In v3 this is fixed: the first keystroke logged with non-null
    # elapsedTimeMs should always be a productive key.
    if keystrokes:
        # We look at the first keystroke that has a non-null elapsedTimeMs,
        # since v3 logs pre-timer modifier presses with elapsedTimeMs=null.
        first_with_elapsed = next(
            (k for k in keystrokes if k.get('elapsedTimeMs') is not None),
            None
        )
        first_to_check = first_with_elapsed if first_with_elapsed else keystrokes[0]
        first_key = first_to_check.get('key', '')
        non_productive_modifiers = {'Shift', 'Control', 'Alt', 'Meta',
                                     'CapsLock', 'NumLock', 'ScrollLock',
                                     'Tab', 'Escape',
                                     'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
                                     'Home', 'End', 'PageUp', 'PageDown',
                                     'F1', 'F2', 'F3', 'F4', 'F5', 'F6',
                                     'F7', 'F8', 'F9', 'F10', 'F11', 'F12'}
        if first_key in non_productive_modifiers:
            issues.warn(f"{label} first in-task keystroke is '{first_key}' "
                        f"(non-productive key) - timer started on a modifier "
                        f"or navigation key rather than a productive keystroke. "
                        f"Expected for v2 files (Bug 1, fixed in v3).")

    # Per-keystroke sanity checks
    duration_ms = task.get('durationSeconds', 0) * 1000
    text_changing_count = 0
    for k in keystrokes:
        if not isinstance(k, dict):
            issues.error(f"{label} keystroke entry is not an object: {k!r}")
            return
        et = k.get('elapsedTimeMs')
        # In v3, pre-timer keystrokes (modifier presses before the first
        # productive key) are logged with elapsedTimeMs = null. These are
        # legitimate and not errors.
        if et is None:
            pass
        elif not isinstance(et, (int, float)):
            issues.warn(f"{label} keystroke missing/invalid elapsedTimeMs")
        elif et < 0:
            issues.error(f"{label} keystroke has negative "
                         f"elapsedTimeMs={et}")
        elif et > duration_ms + 200:
            issues.warn(f"{label} keystroke elapsedTimeMs={et}ms exceeds "
                        f"task duration ({duration_ms}ms) by more than 200ms")
        if k.get('textChanged'):
            text_changing_count += 1

    # Sanity-check the keystroke count against the final text.
    #
    # If every Backspace deleted exactly one character, then the count of
    # text-changing keystrokes would equal totalCharsTyped + 2 * eff_bs
    # (each backspace contributes itself plus the character it cancelled).
    #
    # In v2 this held by accident: Bug 2 caused Ctrl+Backspace and similar
    # modifier-Backspace combinations to be silently dropped from the log,
    # so the count appeared to follow the simple formula. Any positive
    # excess in a v2 file therefore indicates the silent-drop bug at work.
    #
    # In v3 these multi-character deletions are correctly captured. Each
    # captured Ctrl+Backspace contributes one keystroke that may delete
    # several characters, so text_changing_count legitimately exceeds the
    # v2-formula expectation by the chars-beyond-1 of every multi-char
    # deletion. A positive excess in a v3 file is therefore expected, not
    # a problem.
    #
    # The MEANINGFUL signal in both versions is the opposite direction:
    # a SHORTFALL (text_changing_count below the v2 formula) would suggest
    # text-changing keystrokes are missing from the log entirely. That is
    # always worth flagging.
    eff_bs = get(task, ['metrics', 'effectiveBackspaceCount'], 0)
    total_chars = get(task, ['metrics', 'totalCharactersTyped'], 0)
    expected_v2 = total_chars + 2 * eff_bs
    excess = text_changing_count - expected_v2

    if excess < -10:
        issues.warn(
            f"{label} text-changing keystroke count ({text_changing_count}) "
            f"is {-excess} below the expected count "
            f"(totalCharsTyped + 2*effectiveBackspaces = {expected_v2}). "
            f"May indicate keystrokes missing from the log."
        )
    elif export_version == 2 and excess > 10:
        issues.warn(
            f"{label} text-changing keystroke count ({text_changing_count}) "
            f"exceeds expected ({expected_v2}) by {excess}. In v2 files "
            f"this points to Ctrl+Backspace deletions silently dropped "
            f"from the log (Bug 2, fixed in v3)."
        )
    # v3 with positive excess: expected behaviour, no warning.

    # Final-text consistency: last text-changing keystroke should match finalText
    last_text_change = None
    for k in reversed(keystrokes):
        if k.get('textChanged'):
            last_text_change = k.get('textAfterKey')
            break
    final_text = task.get('finalText')
    if last_text_change is not None and final_text is not None:
        if last_text_change != final_text:
            issues.error(f"{label} finalText does not match the last "
                         f"text-changing keystroke's textAfterKey - "
                         f"keystroke log may have lost an event")


# =========================================================================
# Driver
# =========================================================================

def validate_file(path):
    """Run all checks against one file. Returns IssueList."""
    issues = IssueList()

    try:
        with open(path) as f:
            data = json.load(f)
    except FileNotFoundError:
        issues.error(f"file not found: {path}")
        return issues
    except json.JSONDecodeError as e:
        issues.error(f"invalid JSON: {e}")
        return issues

    check_top_level(data, issues)
    if issues.has_errors():
        return issues  # don't cascade

    check_metadata(data, issues)
    check_consent(data, issues)
    check_demographics(data, issues)
    check_environment(data, issues)
    check_config(data, issues)
    check_tasks(data, issues)

    return issues


def report(path, issues):
    """Print a per-file report."""
    name = path.name if hasattr(path, 'name') else str(path)
    if not (issues.has_errors() or issues.has_warnings() or issues.info):
        print(f"  {name}: OK")
        return

    print(f"\n  {name}:")
    for msg in issues.errors:
        print(f"    ERROR    {msg}")
    for msg in issues.warnings:
        print(f"    WARNING  {msg}")
    for msg in issues.info:
        print(f"    note     {msg}")


def main():
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument('files', nargs='+', help='Session JSON file(s) to validate')
    parser.add_argument('--strict', action='store_true',
                        help='Treat warnings as errors')
    args = parser.parse_args()

    paths = []
    for f in args.files:
        p = Path(f)
        if not p.exists():
            print(f"ERROR: not found: {f}", file=sys.stderr)
            sys.exit(2)
        paths.append(p)

    print(f"Validating {len(paths)} file(s)...")
    print("-" * 60)

    any_failed = False
    total_errors = 0
    total_warnings = 0

    for p in paths:
        issues = validate_file(p)
        report(p, issues)
        total_errors += len(issues.errors)
        total_warnings += len(issues.warnings)
        if issues.has_errors() or (args.strict and issues.has_warnings()):
            any_failed = True

    print("-" * 60)
    print(f"Done. {total_errors} error(s), {total_warnings} warning(s) "
          f"across {len(paths)} file(s).")

    if any_failed:
        print("\nValidation FAILED" + (" (strict mode)" if args.strict else ""))
        sys.exit(1)
    else:
        print("\nValidation passed.")
        sys.exit(0)


if __name__ == '__main__':
    main()
