// =========================================================================
// Typing Study Application
// =========================================================================
//
// Web-based typing experiment comparing copy-based and prompt-based typing.
// Each participant completes BOTH task types in a single session, with
// counterbalanced order to control for learning / fatigue effects.
//
// Flow:
//   welcome -> consent -> setup (ID + demographics)
//   -> practice (1 min, not recorded)
//   -> task 1 intro -> task 1 (5 min)
//   -> intermission
//   -> task 2 intro -> task 2 (5 min)
//   -> complete (download JSON)
//
// =========================================================================


// -----------------------------------
// Configuration constants
// -----------------------------------

const TEST_DURATION = 5 * 60;      // 5 minutes per measured task (seconds)
const PRACTICE_DURATION = 60;       // 1 minute practice (seconds, not logged)
const PAUSE_THRESHOLD_MS = 2000;    // Gap counted as a "pause"
const EXPORT_VERSION = 2;           // Bumped from 1 because schema changed materially


// -----------------------------------
// Task content
// -----------------------------------

// Single long copy passage used by every participant for fair comparison.
// Length is generous (~1300 words) so that even fast typists do not finish
// within the 5-minute window. Original prose - no copyright issues.
const COPY_TEXT = `Walking through an old city in the early hours of the morning is an unusual kind of pleasure. The streets, normally crowded and noisy, are nearly empty. Shopkeepers have not yet rolled up their shutters, and only a handful of pedestrians, mostly older residents heading to the market, share the pavements with the occasional cyclist. The light at this hour falls gently on the stonework of the buildings, picking out the small details that go unnoticed when the city is busy: a carved date above a doorway, the worn step of an old courtyard entrance, the curve of an iron railing that has been polished by centuries of hands. These cities, built before the age of cars and central planning, have a particular character that newer places struggle to imitate. Their streets twist and narrow without apparent reason, opening into small squares that you would never find from a map alone. Their buildings press together at odd angles, their roofs at slightly different heights, their walls painted in colours that have softened with weather and time.

For visitors, the appeal of these places is often expressed in the language of romance and atmosphere. They speak of the beauty of the architecture, the charm of the cobbled streets, the warmth of a small cafe tucked into a corner that few tourists discover. Yet for the people who live in such cities, the experience is more complicated. The same buildings that visitors admire are often expensive to maintain, with thick stone walls that hold the cold in winter and the heat in summer. The narrow streets that look so picturesque are difficult to drive through, and parking is a constant struggle. Public services, designed for an earlier era, sometimes strain under the demands of modern life. A medieval drainage system was never built to handle the runoff from a thousand new air conditioning units, and a road designed for horse-drawn carts cannot easily accommodate a delivery lorry. The tension between preservation and modernity is one that every old city has to manage in its own way.

In some places this tension has been resolved through careful regulation. The historic centre is protected, with strict rules about what can be built and how it should look, while modern development is concentrated in neighbouring districts. New residents move into the suburbs, while the old streets become quieter, occupied increasingly by tourists, second homes, and a small number of long-time residents. In other cities the approach has been different. Modern apartments rise alongside ancient churches, and chain shops occupy the ground floors of buildings that once housed local trades. The result, in either case, is rarely entirely satisfying. The first approach risks turning the historic centre into a museum, beautifully preserved but emptied of the everyday life that gave it its character. The second risks erasing what made the place special in the first place.

The most successful old cities seem to be those that have found a balance, where the past and the present live alongside each other without either taking over completely. In such places you might find a centuries-old market where local farmers still sell their produce, a public library housed in a former monastery, or a school where the playground occupies a courtyard that once belonged to a craftsman's workshop. The buildings have been adapted, not preserved like museum exhibits, and the streets are still used by ordinary people going about ordinary lives. Children walk to school past Roman walls; office workers eat their lunch on benches placed beside fountains that are older than any of the surrounding nations. This kind of layered existence is hard to plan for, and harder still to maintain. It depends on a slow accumulation of small decisions, each one made with respect for what came before, but also with willingness to allow things to change.

Travelling slowly through such a city, on foot or by bicycle, is the best way to appreciate this layered character. From a car the details disappear; from a tour bus, even more so. Walking allows you to notice the contrast between two neighbouring streets, the difference in atmosphere between a square in the morning and the same square in the evening, the way a particular building catches the light at a particular time of year. You begin to understand that a city is not a single thing but a collection of small experiences, each one shaped by history, geography, and the lives of the people who use it. Some of these experiences are shared by everyone, residents and visitors alike: the view from a famous viewpoint, the taste of a regional dish, the sound of bells from a particular church. Others are private, personal to a single person, and yet they are no less real for that. A particular bench, a particular doorway, a particular view down a particular alley: these become anchors of memory that no guidebook can capture.

There is, finally, something to be said for the way old cities slow you down. In a modern city, designed for efficiency and movement, you walk quickly, looking ahead, planning your route. In an old city you cannot do this. The streets do not run in straight lines; the signs are not always in the right places; the layout sometimes seems designed to confuse rather than to help. You find yourself stopping more often, looking around, asking questions, accepting that you might be lost for a while and that this is not necessarily a problem. The pace of life adjusts itself accordingly. Conversations last longer. Meals are eaten more slowly. The sense of urgency that fills the working day in a busier city begins to fade. Whether this is a genuine effect of the place or simply a state of mind that comes with being a visitor is hard to say. It may be that we bring our own pace with us, and that the city merely offers an excuse to slow down. Whatever the explanation, the experience is restorative, and it is one of the reasons that people return to such places again and again.

There are, of course, cities of every age and kind, and the contrast between old and new is far from being the only thing that gives a place its character. A city is shaped by its climate, by its location, by the people who have lived there over the centuries, and by countless small choices made by individuals and institutions. The longer you spend in any one place, the more you notice these other influences. The way the wind comes off the water in a coastal town, the way a river divides a city into two halves with quite different histories, the way a particular trade or industry has marked the street names and the architecture: all of these shape the experience of being there in ways that are hard to define but easy to feel. To pay attention to these things is to understand a place properly, rather than simply to pass through it. It takes time, and patience, and a willingness to be quiet long enough to let the place reveal itself.`;

// Single prompt used by all participants for fair comparison.
// Open-ended enough that nobody runs out of things to say in 5 minutes.
const PROMPT_TEXT =
    "Describe a memorable experience or place from your life. Try to include where you were, " +
    "who was with you, what happened, and what made it stand out. If you finish describing one " +
    "experience, please continue with another. Keep writing for the full duration of the test.";

// Practice content - a short copy passage. Practice is always copy-typing
// because the goal is interface familiarisation, not task-specific practice
// (which would unfairly advantage one of the real tasks).
const PRACTICE_COPY_TEXT =
    "The sun rose slowly over the quiet hills, casting long shadows across the valley below. " +
    "A few birds began to call from the trees, and a soft breeze stirred the leaves. " +
    "The morning air carried the smell of damp grass and distant smoke from a wood fire.";


// -----------------------------------
// Application state
// -----------------------------------
//
// Single object holding all session-level data. Per-task data lives inside
// state.completedTasks (one entry per finished task). This is built up as
// the participant moves through the screens and is exported at the end.
//
const state = {
    sessionId: null,
    participantId: null,
    consented: false,
    demographics: null,
    environment: null,
    sessionStartTime: null,
    sessionEndTime: null,
    taskOrder: null,            // e.g. ["copy", "prompt"] or ["prompt", "copy"]
    completedTasks: []
};


// -----------------------------------
// Screen management
// -----------------------------------

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
    window.scrollTo(0, 0);
}


// -----------------------------------
// Counterbalancing
// -----------------------------------

// Determine task order from participant ID. Odd-numbered participants do
// copy first, even-numbered do prompt first. This is a deterministic rule
// so the order can be reconstructed from the ID alone if needed.
//
// Why this matters: if every participant did copy first, any difference
// between the tasks could be attributed to fatigue, learning, or screen
// familiarity rather than to the task type itself. Counterbalancing
// distributes those order effects evenly across both conditions.
function determineTaskOrder(participantId) {
    const match = participantId.match(/(\d+)/);
    const number = match ? parseInt(match[1], 10) : 0;
    return number % 2 === 1 ? ['copy', 'prompt'] : ['prompt', 'copy'];
}


// -----------------------------------
// Environment metadata
// -----------------------------------
//
// Captures browser / device characteristics for the threats-to-validity
// section of the report. The initial plan flags cross-device variability
// as a known risk; logging this lets you say "all participants used X"
// rather than hand-waving.
//
function captureEnvironment() {
    return {
        userAgent: navigator.userAgent,
        language: navigator.language,
        platform: navigator.platform || 'unknown',
        screenWidth: screen.width,
        screenHeight: screen.height,
        windowWidth: window.innerWidth,
        windowHeight: window.innerHeight,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        capturedAt: new Date().toISOString()
    };
}


// -----------------------------------
// Helper: download JSON
// -----------------------------------

function downloadJSON(data, filename) {
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}


// -----------------------------------
// Metric calculation
// -----------------------------------

// Levenshtein edit distance using a rolling-row dynamic programming table.
// O(m*n) time, O(min(m,n)) memory. For two ~1500-character strings this
// runs in well under a second in any modern browser.
function levenshtein(a, b) {
    const m = a.length;
    const n = b.length;
    if (m === 0) return n;
    if (n === 0) return m;

    let prev = new Array(n + 1);
    let curr = new Array(n + 1);
    for (let j = 0; j <= n; j++) prev[j] = j;

    for (let i = 1; i <= m; i++) {
        curr[0] = i;
        for (let j = 1; j <= n; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            curr[j] = Math.min(
                prev[j] + 1,        // deletion
                curr[j - 1] + 1,    // insertion
                prev[j - 1] + cost  // substitution
            );
        }
        // swap rows: previous row becomes current, current is reused as next
        [prev, curr] = [curr, prev];
    }

    return prev[n];
}

// Gross WPM: standard typing-test formula treating 5 characters as one word.
// Includes everything the participant typed, errors included.
function calculateGrossWPM(finalText, elapsedTimeMs) {
    const minutes = elapsedTimeMs / 60000;
    if (minutes <= 0) return 0;
    return Number(((finalText.length / 5) / minutes).toFixed(2));
}

// Net WPM = Gross WPM minus errors per minute.
// "Errors" here are uncorrected errors in the final text, measured as the
// edit distance to the target. Net WPM penalises sloppiness, so a typist
// who races and makes mistakes scores lower than one who is slower but
// accurate. This is the standard typing-research metric (see
// Soukoreff & MacKenzie, 2003).
//
// Only meaningful for the copy task - prompt typing has no reference text
// against which to count uncorrected errors.
function calculateNetWPM(grossWPM, uncorrectedErrors, elapsedTimeMs) {
    const minutes = elapsedTimeMs / 60000;
    if (minutes <= 0) return 0;
    const errorsPerMinute = uncorrectedErrors / minutes;
    return Math.max(0, Number((grossWPM - errorsPerMinute).toFixed(2)));
}

// Copy task accuracy using Levenshtein edit distance.
//
// Compares the typed text to the prefix of the target with the same length,
// then computes accuracy as 1 - (editDistance / typedLength).
//
// Why prefix-of-target rather than full target: most participants will not
// finish the 1300-word passage in 5 minutes. Comparing to the full target
// would inflate the error count with all the characters they simply didn't
// reach. Comparing to a same-length prefix asks the right question:
// "of the characters you typed, how many were correct?"
//
// Why edit distance rather than char-by-char: if a participant inserts or
// deletes a character early in the text, naive char-by-char comparison
// marks every subsequent character wrong because everything is shifted
// by one position. Edit distance finds the minimum number of corrections
// (insertions, deletions, substitutions) needed and so handles misalignment
// correctly. The diary entry on 5 April flagged this as a known issue.
function calculateCopyTaskAccuracy(finalText, targetText) {
    const typedLen = finalText.length;
    if (typedLen === 0) {
        return {
            typedLength: 0,
            comparedTargetLength: 0,
            editDistance: 0,
            accuracyPercent: 0
        };
    }

    const comparedTarget = targetText.substring(0, typedLen);
    const editDistance = levenshtein(finalText, comparedTarget);

    const accuracyPercent = Math.max(0, (1 - editDistance / typedLen)) * 100;

    return {
        typedLength: typedLen,
        comparedTargetLength: comparedTarget.length,
        editDistance: editDistance,
        accuracyPercent: Number(accuracyPercent.toFixed(2))
    };
}

// Pause statistics over events that exceeded PAUSE_THRESHOLD_MS.
// Same calculation as the previous version, kept here for completeness.
function calculatePauseStats(pauseEvents) {
    if (pauseEvents.length === 0) {
        return { pauseCount: 0, averagePauseMs: 0, longestPauseMs: 0 };
    }
    const total = pauseEvents.reduce((s, p) => s + p.durationMs, 0);
    return {
        pauseCount: pauseEvents.length,
        averagePauseMs: Number((total / pauseEvents.length).toFixed(2)),
        longestPauseMs: Math.max(...pauseEvents.map(p => p.durationMs))
    };
}

// Inter-keystroke interval (IKI) statistics.
//
// IKI is the time between two successive text-changing keystrokes. It is
// a much finer-grained measure of typing rhythm than WPM. Typing under
// cognitive load (such as the prompt task) tends to produce a wider,
// more variable IKI distribution: occasional long thinking gaps mixed
// with bursts of fast typing, even when the mean WPM looks similar.
//
// Reporting mean, median, std dev, and the inter-quartile range gives
// you a much richer picture of typing behaviour for the report.
//
// We exclude non-text-changing keystrokes (Shift on its own, arrow keys,
// etc.) because we want intervals between *productive* keystrokes.
function calculateIKIStats(keystrokeLog) {
    const textKeys = keystrokeLog.filter(k => k.textChanged);
    if (textKeys.length < 2) {
        return {
            count: 0,
            meanMs: 0,
            medianMs: 0,
            stdDevMs: 0,
            percentile25Ms: 0,
            percentile75Ms: 0
        };
    }

    const intervals = [];
    for (let i = 1; i < textKeys.length; i++) {
        intervals.push(textKeys[i].elapsedTimeMs - textKeys[i - 1].elapsedTimeMs);
    }

    const sorted = [...intervals].sort((a, b) => a - b);
    const n = intervals.length;

    const mean = intervals.reduce((s, v) => s + v, 0) / n;
    const variance = intervals.reduce((s, v) => s + (v - mean) ** 2, 0) / n;

    const median = sorted.length % 2 === 1
        ? sorted[(sorted.length - 1) / 2]
        : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;

    function percentile(p) {
        const idx = Math.floor((p / 100) * (sorted.length - 1));
        return sorted[idx];
    }

    return {
        count: n,
        meanMs: Number(mean.toFixed(2)),
        medianMs: Number(median.toFixed(2)),
        stdDevMs: Number(Math.sqrt(variance).toFixed(2)),
        percentile25Ms: Number(percentile(25).toFixed(2)),
        percentile75Ms: Number(percentile(75).toFixed(2))
    };
}


// -----------------------------------
// Task runner
// -----------------------------------
//
// Runs a single typing session and resolves with collected data (or null
// for practice). Used identically for practice, task 1, and task 2.
//
// Behaviour worth knowing about:
//   - The timer starts on the FIRST KEYSTROKE rather than on screen entry.
//     This is what the project diary asked for: a participant who needs a
//     few seconds to read the prompt should not be penalised in their WPM.
//
//   - Listeners (keydown, input, paste, cut, drop) are attached when the
//     task begins and removed when it finishes. This keeps each task's
//     event handling isolated - no leftover listeners from the previous
//     task interfering with the next.
//
//   - The keydown -> input pairing for text-changing keys is preserved
//     from the original code. It is the right pattern because the input
//     event fires after the textarea has updated, which is when the new
//     text state is actually correct.
//
//   - A trailing pause is captured if the test ends mid-pause (i.e. the
//     participant stops typing for the last few seconds). Same edge-case
//     handling as the original implementation.
//
function runTypingTask({ taskType, taskContent, durationSeconds, isPractice, taskNumber }) {
    return new Promise(resolve => {
        const typingInput = document.getElementById('typingInput');
        const timerDisplay = document.getElementById('timer');
        const taskText = document.getElementById('taskText');
        const headerEl = document.getElementById('typingTaskHeader');
        const hintEl = document.getElementById('timerHint');

        // Reset visible state for this task
        headerEl.textContent = isPractice
            ? 'Practice'
            : `Task ${taskNumber} of 2 — ${taskType === 'copy' ? 'Copy typing' : 'Prompt typing'}`;
        taskText.textContent = taskContent;
        typingInput.value = '';
        typingInput.disabled = false;
        typingInput.focus();

        // Per-task local state. Kept in closure rather than in the global
        // state object so multiple tasks cannot accidentally pollute each
        // other's logs or counters.
        let timeRemaining = durationSeconds;
        let timerInterval = null;
        let taskStartTime = null;
        let lastKeystrokeTime = null;
        let pauseEvents = [];
        let keystrokeLog = [];
        let rawBackspaceCount = 0;
        let effectiveBackspaceCount = 0;
        let pendingTextChangeLog = null;
        let timerStarted = false;

        function updateTimer() {
            const minutes = Math.floor(timeRemaining / 60);
            const seconds = timeRemaining % 60;
            timerDisplay.textContent =
                `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        }
        updateTimer();
        hintEl.textContent = 'Timer starts when you begin typing';
        hintEl.style.display = 'block';

        function startTimer() {
            timerStarted = true;
            taskStartTime = Date.now();
            hintEl.style.display = 'none';
            timerInterval = setInterval(() => {
                timeRemaining--;
                updateTimer();
                if (timeRemaining <= 0) {
                    finish();
                }
            }, 1000);
        }

        function onKeydown(event) {
            if (typingInput.disabled) return;

            // First keystroke kicks the timer off
            if (!timerStarted) {
                startTimer();
            }

            const keyTime = Date.now();
            const textBeforeKey = typingInput.value;
            const selectionStartBefore = typingInput.selectionStart;
            const selectionEndBefore = typingInput.selectionEnd;

            // Pause detection: any gap >= threshold between keystrokes
            if (lastKeystrokeTime !== null) {
                const gapMs = keyTime - lastKeystrokeTime;
                if (gapMs >= PAUSE_THRESHOLD_MS) {
                    pauseEvents.push({
                        startAfterElapsedMs: lastKeystrokeTime - taskStartTime,
                        endAtElapsedMs: keyTime - taskStartTime,
                        durationMs: gapMs
                    });
                }
            }
            lastKeystrokeTime = keyTime;

            if (event.key === 'Backspace') rawBackspaceCount++;

            // Decide whether this key will produce an input event we need
            // to wait for. If yes, defer logging to the input handler so
            // the logged textAfterKey is the actual post-input state.
            const keyChangesText =
                !event.ctrlKey && !event.metaKey && !event.altKey &&
                (event.key.length === 1 ||
                 event.key === 'Backspace' ||
                 event.key === 'Delete' ||
                 event.key === 'Enter');

            if (!keyChangesText) {
                // Modifier / navigation keys logged immediately
                keystrokeLog.push({
                    key: event.key,
                    code: event.code,
                    timestamp: new Date(keyTime).toISOString(),
                    elapsedTimeMs: keyTime - taskStartTime,
                    textAfterKey: typingInput.value,
                    cursorPosition: typingInput.selectionStart,
                    textChanged: false
                });
                return;
            }

            pendingTextChangeLog = {
                key: event.key,
                code: event.code,
                keyTime,
                textBeforeKey,
                selectionStartBefore,
                selectionEndBefore
            };
        }

        function onInput() {
            if (typingInput.disabled || !pendingTextChangeLog) return;
            const textAfterKey = typingInput.value;
            const {
                key, code, keyTime,
                textBeforeKey, selectionStartBefore, selectionEndBefore
            } = pendingTextChangeLog;

            // Effective backspace = backspace that actually deleted something.
            // (A backspace at position 0 with no selection deletes nothing.)
            if (key === 'Backspace') {
                const hadSelection = selectionStartBefore !== selectionEndBefore;
                const textGotShorter = textAfterKey.length < textBeforeKey.length;
                const hadCharacterBeforeCursor =
                    selectionStartBefore > 0 &&
                    selectionStartBefore === selectionEndBefore;
                if ((hadSelection && textGotShorter) ||
                    (hadCharacterBeforeCursor && textGotShorter)) {
                    effectiveBackspaceCount++;
                }
            }

            keystrokeLog.push({
                key,
                code,
                timestamp: new Date(keyTime).toISOString(),
                elapsedTimeMs: keyTime - taskStartTime,
                textAfterKey,
                cursorPosition: typingInput.selectionStart,
                textChanged: true
            });
            pendingTextChangeLog = null;
        }

        function blockInput(event, action) {
            if (typingInput.disabled) return;
            event.preventDefault();
            alert(`${action} is disabled during the typing test.`);
        }
        const onPaste = e => blockInput(e, 'Pasting');
        const onCut = e => blockInput(e, 'Cutting');
        const onDrop = e => blockInput(e, 'Drag-and-drop');

        typingInput.addEventListener('keydown', onKeydown);
        typingInput.addEventListener('input', onInput);
        typingInput.addEventListener('paste', onPaste);
        typingInput.addEventListener('cut', onCut);
        typingInput.addEventListener('drop', onDrop);

        function finish() {
            clearInterval(timerInterval);
            typingInput.disabled = true;

            // Detach all listeners so they do not survive into the next task
            typingInput.removeEventListener('keydown', onKeydown);
            typingInput.removeEventListener('input', onInput);
            typingInput.removeEventListener('paste', onPaste);
            typingInput.removeEventListener('cut', onCut);
            typingInput.removeEventListener('drop', onDrop);

            const endTime = Date.now();
            const finalText = typingInput.value;
            const elapsedTimeMs = taskStartTime ? endTime - taskStartTime : 0;

            // Trailing pause: if the participant stopped typing well before
            // time ran out, count that final stretch as a pause.
            if (lastKeystrokeTime !== null && taskStartTime !== null) {
                const finalPauseMs = endTime - lastKeystrokeTime;
                if (finalPauseMs >= PAUSE_THRESHOLD_MS) {
                    pauseEvents.push({
                        startAfterElapsedMs: lastKeystrokeTime - taskStartTime,
                        endAtElapsedMs: endTime - taskStartTime,
                        durationMs: finalPauseMs,
                        endedBy: 'testEnd'
                    });
                }
            }

            // Practice: nothing else to compute, nothing exported
            if (isPractice) {
                resolve(null);
                return;
            }

            // Build full task data
            const grossWPM = calculateGrossWPM(finalText, elapsedTimeMs);
            const pauseStats = calculatePauseStats(pauseEvents);
            const ikiStats = calculateIKIStats(keystrokeLog);

            let copyTaskMetrics = null;
            let netWPM = null;
            if (taskType === 'copy') {
                copyTaskMetrics = calculateCopyTaskAccuracy(finalText, taskContent);
                netWPM = calculateNetWPM(
                    grossWPM,
                    copyTaskMetrics.editDistance,
                    elapsedTimeMs
                );
            }

            const taskData = {
                taskNumber: taskNumber,
                taskType: taskType,
                promptOrSourceText: taskContent,
                finalText: finalText,
                startTime: new Date(taskStartTime).toISOString(),
                endTime: new Date(endTime).toISOString(),
                durationSeconds: Number((elapsedTimeMs / 1000).toFixed(2)),
                metrics: {
                    totalCharactersTyped: finalText.length,
                    grossWPM: grossWPM,
                    netWPM: netWPM,
                    rawBackspaceCount: rawBackspaceCount,
                    effectiveBackspaceCount: effectiveBackspaceCount,
                    pauseCount: pauseStats.pauseCount,
                    averagePauseMs: pauseStats.averagePauseMs,
                    longestPauseMs: pauseStats.longestPauseMs,
                    interKeystrokeInterval: ikiStats,
                    copyTaskMetrics: copyTaskMetrics
                },
                logs: {
                    totalKeystrokes: keystrokeLog.length,
                    pauseEvents: pauseEvents,
                    keystrokes: keystrokeLog
                }
            };

            resolve(taskData);
        }
    });
}


// -----------------------------------
// Demographics gathering
// -----------------------------------

function gatherDemographics() {
    return {
        ageRange: document.getElementById('ageRange').value,
        typingFrequency: document.getElementById('typingFrequency').value,
        englishFirstLanguage: document.getElementById('englishFirstLanguage').value,
        yearsUsingComputer: document.getElementById('yearsUsingComputer').value,
        keyboardType: document.getElementById('keyboardType').value
    };
}


// -----------------------------------
// Build final exported object
// -----------------------------------

function buildSessionExport() {
    return {
        metadata: {
            exportVersion: EXPORT_VERSION,
            sessionId: state.sessionId,
            participantId: state.participantId,
            sessionStartTime: new Date(state.sessionStartTime).toISOString(),
            sessionEndTime: new Date(state.sessionEndTime).toISOString(),
            taskOrder: state.taskOrder
        },
        consent: {
            consented: state.consented,
            consentedAt: new Date(state.sessionStartTime).toISOString()
        },
        demographics: state.demographics,
        environment: state.environment,
        config: {
            testDurationSeconds: TEST_DURATION,
            practiceDurationSeconds: PRACTICE_DURATION,
            pauseThresholdMs: PAUSE_THRESHOLD_MS
        },
        tasks: state.completedTasks
    };
}


// -----------------------------------
// Configure the task-intro screen
// -----------------------------------

function prepareTaskIntro(idx) {
    const titleEl = document.getElementById('taskIntroTitle');
    const descEl = document.getElementById('taskIntroDescription');
    const taskType = state.taskOrder[idx];

    titleEl.textContent = `Task ${idx + 1} of 2: ${taskType === 'copy' ? 'Copy typing' : 'Prompt typing'}`;

    if (taskType === 'copy') {
        descEl.textContent =
            'You will see a passage of text on the screen. Type it as accurately and as quickly ' +
            'as you can. You may correct mistakes if you wish, but you do not have to. ' +
            'The text is long enough that you will not run out before time is up.';
    } else {
        descEl.textContent =
            'You will see a writing prompt. Type a free response in your own words for the full ' +
            'five minutes. There are no right or wrong answers. Try to keep typing throughout - ' +
            'if you finish one thought, start another.';
    }
}


// -----------------------------------
// Wire up screen flow
// -----------------------------------

document.addEventListener('DOMContentLoaded', () => {

    // Welcome -> consent
    document.getElementById('welcomeContinue').addEventListener('click', () => {
        showScreen('screen-consent');
    });

    // Consent: checkbox toggles continue button; continue moves on
    const consentCheckbox = document.getElementById('consentCheckbox');
    const consentContinue = document.getElementById('consentContinue');
    consentCheckbox.addEventListener('change', () => {
        consentContinue.disabled = !consentCheckbox.checked;
    });
    consentContinue.addEventListener('click', () => {
        state.consented = true;
        showScreen('screen-setup');
    });

// Setup -> practice intro
    //
    // Participant ID must match the pattern P<digits> (e.g. P01, P15, P100).
    // The trailing digits are required because determineTaskOrder() uses
    // their parity to assign counterbalanced task order. An ID with no
    // digits would silently default to the "even" condition - we reject
    // it explicitly to make this requirement visible to the experimenter.
    const PARTICIPANT_ID_PATTERN = /^P\d+$/;

    function showIdError(message) {
        const input = document.getElementById('participantId');
        const errorEl = document.getElementById('participantIdError');
        errorEl.textContent = message;
        input.classList.add('invalid');
        input.focus();
        input.select();
    }

    function clearIdError() {
        document.getElementById('participantId').classList.remove('invalid');
        document.getElementById('participantIdError').textContent = '';
    }

    // Clear the error as soon as the participant edits the field, so they
    // get immediate feedback that their correction was registered.
    document.getElementById('participantId').addEventListener('input', clearIdError);

    document.getElementById('setupContinue').addEventListener('click', () => {
        const rawInput = document.getElementById('participantId').value;
        const enteredId = rawInput.trim().toUpperCase();

        if (!enteredId) {
            showIdError('Please enter the participant ID provided by the researcher.');
            return;
        }

        if (!PARTICIPANT_ID_PATTERN.test(enteredId)) {
            showIdError(
                'Participant ID must be in the form P followed by digits ' +
                '(e.g. P01, P15). Please check with the researcher if unsure.'
            );
            return;
        }

        // Write back the cleaned-up form so the input matches what we store.
        // (Useful for the participant to see their ID was accepted as e.g.
        // "P01" even if they typed " p01 ".)
        document.getElementById('participantId').value = enteredId;
        clearIdError();

        state.participantId = enteredId;
        state.demographics = gatherDemographics();
        state.environment = captureEnvironment();
        state.taskOrder = determineTaskOrder(enteredId);
        state.sessionId = `session-${Date.now()}`;
        state.sessionStartTime = Date.now();
        showScreen('screen-practice-intro');
    });

    // Practice intro -> practice -> task 1 intro
    document.getElementById('practiceStart').addEventListener('click', async () => {
        showScreen('screen-typing');
        await runTypingTask({
            taskType: 'copy',
            taskContent: PRACTICE_COPY_TEXT,
            durationSeconds: PRACTICE_DURATION,
            isPractice: true,
            taskNumber: 0
        });
        prepareTaskIntro(0);
        showScreen('screen-task-intro');
    });

    // Task intro -> task -> intermission OR complete
    document.getElementById('taskStart').addEventListener('click', async () => {
        const idx = state.completedTasks.length;
        const taskType = state.taskOrder[idx];
        const taskContent = taskType === 'copy' ? COPY_TEXT : PROMPT_TEXT;

        showScreen('screen-typing');
        const taskData = await runTypingTask({
            taskType: taskType,
            taskContent: taskContent,
            durationSeconds: TEST_DURATION,
            isPractice: false,
            taskNumber: idx + 1
        });
        state.completedTasks.push(taskData);

        if (state.completedTasks.length === 1) {
            showScreen('screen-intermission');
        } else {
            state.sessionEndTime = Date.now();
            showScreen('screen-complete');
        }
    });

    // Intermission -> task 2 intro
    document.getElementById('intermissionContinue').addEventListener('click', () => {
        prepareTaskIntro(1);
        showScreen('screen-task-intro');
    });

    // Complete -> download
    document.getElementById('downloadButton').addEventListener('click', () => {
        const data = buildSessionExport();
        downloadJSON(data, `${state.participantId}_${state.sessionId}.json`);
        document.getElementById('downloadStatus').textContent =
            'Data file downloaded. Please send it to the researcher. You may now close this page.';
    });
});
