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
//   -> practice intro -> practice (1 min, neutral free typing)
//   -> practice end (continue button)
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
const INTERMISSION_MIN_SECONDS = 60; // Minimum enforced rest between tasks
const EXPORT_VERSION = 3;           // v3: timer starts only on productive keys;
                                    //     Ctrl/Cmd/Alt+Backspace tracked correctly;
                                    //     consent timestamp reflects actual click time


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
//
// Design rationale: this prompt was chosen to be (a) impersonal, so that
// participants are not asked to disclose anything sensitive about their
// own lives; (b) inexhaustible, so that nobody runs out of things to say
// in five minutes; and (c) roughly equal in cognitive load across
// participants, since the everyday tasks named here (making tea, etc.)
// are universally familiar. An earlier draft asked participants to
// "describe a memorable experience or place from your life", which was
// rejected because it could elicit autobiographical or emotionally
// sensitive content that the researcher cannot honestly promise will
// remain unread (the typed text is necessarily present in the data file).
const PROMPT_TEXT =
    "Imagine you are writing instructions for someone who has never made a cup of tea. " +
    "Describe in as much detail as possible how to make a cup of tea, step by step. " +
    "When you have finished, write similar step-by-step instructions for another simple " +
    "everyday task you know well, such as making toast, tying shoelaces, or brushing " +
    "your teeth. Keep going with new tasks until the time is up.";

// Practice instruction text. Shown in the same place that the source-text /
// prompt would normally appear, so the participant has something to look at
// during practice.
//
// The practice round is now neutral interface familiarisation (free typing)
// rather than copy-typing practice. This change removes a methodological
// asymmetry: copy-only practice would have given the copy condition an
// unfair head start, since participants would have had ~60 seconds of
// "what it feels like to type with reference text on screen" before the
// copy task but no equivalent preview before the prompt task.
const PRACTICE_INSTRUCTIONS =
    "Type anything you like for one minute. There is no specific text to copy " +
    "and nothing you type here is recorded. The point is just to get used to " +
    "the typing area and the timer before the measured tasks begin. " +
    "The timer starts when you press your first key.";


// -----------------------------------
// Application state
// -----------------------------------

const state = {
    sessionId: null,
    participantId: null,
    consented: false,
    consentedAt: null,          // Real time the consent button was clicked
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
// copy first, even-numbered do prompt first. Deterministic so the order
// can be reconstructed from the ID alone if needed.
function determineTaskOrder(participantId) {
    const match = participantId.match(/(\d+)/);
    const number = match ? parseInt(match[1], 10) : 0;
    return number % 2 === 1 ? ['copy', 'prompt'] : ['prompt', 'copy'];
}


// -----------------------------------
// Environment metadata
// -----------------------------------

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
                prev[j] + 1,
                curr[j - 1] + 1,
                prev[j - 1] + cost
            );
        }
        [prev, curr] = [curr, prev];
    }

    return prev[n];
}

function calculateGrossWPM(finalText, elapsedTimeMs) {
    const minutes = elapsedTimeMs / 60000;
    if (minutes <= 0) return 0;
    return Number(((finalText.length / 5) / minutes).toFixed(2));
}

function calculateNetWPM(grossWPM, uncorrectedErrors, elapsedTimeMs) {
    const minutes = elapsedTimeMs / 60000;
    if (minutes <= 0) return 0;
    const errorsPerMinute = uncorrectedErrors / minutes;
    return Math.max(0, Number((grossWPM - errorsPerMinute).toFixed(2)));
}

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
// Key classification helpers
// -----------------------------------

// "Productive" keystrokes are the ones that actually produce or remove
// text in the textarea. The timer is gated on a productive keystroke so
// that pressing Shift, the Windows key, etc. before the first character
// does not start the timer. (Bug 1 in the v2 schema: P01's data showed
// Task 2 lost ~13 seconds because the Windows key was pressed before
// any letter was typed.)
//
// Anything that produces visible text (single-character keys), removes
// text (Backspace, Delete), or inserts a newline (Enter) counts as
// productive. Modifier keys (Shift, Ctrl, Alt, Meta), navigation keys
// (arrow keys, Home, End, etc.), and function keys do not.
//
// Note that for Backspace/Delete we accept ANY modifier combination -
// Ctrl+Backspace deletes a word, Cmd+Backspace deletes a line on macOS,
// etc. (Bug 2 in the v2 schema: such combinations were classified as
// non-text-changing even when they actually modified the textarea.)
function isProductiveKey(event) {
    if (event.key === 'Backspace' || event.key === 'Delete') {
        return true;
    }
    if (event.key === 'Enter') {
        return true;
    }
    // Any single-character key, but only if no command-style modifier
    // is held (Ctrl+C should not count as productive even though "c"
    // would). Shift IS allowed because Shift+letter is just a capital.
    if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
        return true;
    }
    return false;
}


// -----------------------------------
// Task runner
// -----------------------------------

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

            // Bug 1 fix: only a productive keystroke starts the timer.
            // Modifier keys, function keys, and navigation keys are still
            // logged so the keystroke trace is complete, but they do not
            // begin the measurement window.
            if (!timerStarted) {
                if (isProductiveKey(event)) {
                    startTimer();
                } else {
                    // Pre-timer keystroke: log it with elapsedTimeMs = null
                    // so that downstream analysis can distinguish these
                    // from in-task events. We do not push pause events
                    // for gaps between pre-timer keystrokes either, since
                    // there is no taskStartTime to anchor them to yet.
                    keystrokeLog.push({
                        key: event.key,
                        code: event.code,
                        timestamp: new Date(Date.now()).toISOString(),
                        elapsedTimeMs: null,
                        textAfterKey: typingInput.value,
                        cursorPosition: typingInput.selectionStart,
                        textChanged: false
                    });
                    return;
                }
            }

            const keyTime = Date.now();
            const textBeforeKey = typingInput.value;
            const selectionStartBefore = typingInput.selectionStart;
            const selectionEndBefore = typingInput.selectionEnd;

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

            // Bug 2 fix: Backspace and Delete are classed as text-changing
            // regardless of any modifier held. Ctrl+Backspace, Cmd+Backspace
            // and similar combinations all actually delete text, so they
            // must go through the keydown -> input pipeline that captures
            // the post-input textAfterKey state.
            //
            // Single-character keys still require no command-style modifier,
            // because Ctrl+C / Cmd+V / etc. do NOT produce text in the
            // textarea even though their .key value is a single character.
            const keyChangesText =
                event.key === 'Backspace' ||
                event.key === 'Delete' ||
                event.key === 'Enter' ||
                (event.key.length === 1 &&
                 !event.ctrlKey && !event.metaKey && !event.altKey);

            if (!keyChangesText) {
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

            typingInput.removeEventListener('keydown', onKeydown);
            typingInput.removeEventListener('input', onInput);
            typingInput.removeEventListener('paste', onPaste);
            typingInput.removeEventListener('cut', onCut);
            typingInput.removeEventListener('drop', onDrop);

            const endTime = Date.now();
            const finalText = typingInput.value;
            const elapsedTimeMs = taskStartTime ? endTime - taskStartTime : 0;

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

            if (isPractice) {
                resolve(null);
                return;
            }

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
            consentedAt: state.consentedAt
                ? new Date(state.consentedAt).toISOString()
                : null
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
// Intermission countdown
// -----------------------------------
//
// Enforces a minimum rest period between Task 1 and Task 2. The Continue
// button starts disabled and becomes active only after INTERMISSION_MIN_SECONDS
// have elapsed. After that the participant can take as long as they like
// before continuing.
//
// Why: pure participant-chosen rest creates uncontrolled variability between
// participants (some take 5s, some take 5 minutes), which is a confound
// when comparing tasks. Pure fixed rest is rigid and feels coercive. The
// minimum-with-extension hybrid sets a controlled lower bound while
// preserving participant autonomy.

function startIntermissionCountdown() {
    const button = document.getElementById('intermissionContinue');
    const hintEl = document.getElementById('intermissionHint');
    let secondsRemaining = INTERMISSION_MIN_SECONDS;

    button.disabled = true;
    hintEl.textContent = `You may continue in ${secondsRemaining} seconds.`;

    const interval = setInterval(() => {
        secondsRemaining--;
        if (secondsRemaining > 0) {
            const noun = secondsRemaining === 1 ? 'second' : 'seconds';
            hintEl.textContent = `You may continue in ${secondsRemaining} ${noun}.`;
        } else {
            clearInterval(interval);
            button.disabled = false;
            hintEl.textContent = 'You may continue when ready.';
        }
    }, 1000);
}


// -----------------------------------
// Configure the task-intro screen
// -----------------------------------

function prepareTaskIntro(idx) {
    const titleEl = document.getElementById('taskIntroTitle');
    const descEl = document.getElementById('taskIntroDescription');
    const taskType = state.taskOrder[idx];

    titleEl.textContent = `Task ${idx + 1} of 2: ${taskType === 'copy' ? 'Copy typing' : 'Prompt typing'}`;

    // Both branches give parallel guidance on correction behaviour, so
    // a participant in either condition has the same explicit permission
    // to correct (or not). Without this symmetry, a participant might
    // implicitly infer that correction is less expected in the prompt
    // task, which would confound any comparison of correction behaviour
    // between the two conditions.
    //
    // The prompt branch additionally includes honest data-handling language:
    // we cannot promise the typed text will not be read (it is necessarily
    // present in the exported data file), so we tell the participant clearly
    // that the analysis focuses on typing behaviour rather than content.
    // This honesty is preferable to a misleading reassurance and pairs with
    // the impersonal prompt to keep any disclosure low-stakes.
    if (taskType === 'copy') {
        descEl.textContent =
            'You will see a passage of text on the screen. Type it as accurately and as quickly ' +
            'as you can. You may correct mistakes if you wish, but you do not have to. ' +
            'The text is long enough that you will not run out before time is up.';
    } else {
        descEl.textContent =
            'You will see a writing prompt. Type a free response in your own words for the full ' +
            'five minutes, writing as accurately and as quickly as you can. There are no right ' +
            'or wrong answers. You may correct mistakes if you wish, but you do not have to. ' +
            'Try to keep typing throughout - if you finish one thought, start another. ' +
            'The text you type will be saved as part of the data file; the analysis focuses on ' +
            'how you type rather than what you write, so please do not worry about your ' +
            'wording, spelling, or grammar.';
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

    // Back navigation on the pre-experiment screens. Allowed up to and
    // including the setup screen so a participant can re-read the
    // information / consent text or correct a typo in their demographics.
    // No back navigation after setup is committed: clicking Continue on
    // the setup screen captures the participant ID, environment metadata,
    // and session start time, so going back from there would either
    // silently invalidate that data or leave the application in an
    // inconsistent state.
    document.getElementById('consentBack').addEventListener('click', () => {
        showScreen('screen-welcome');
    });

    document.getElementById('setupBack').addEventListener('click', () => {
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
        state.consentedAt = Date.now();   // Bug 3 fix: real click time
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

    // Practice intro -> practice -> practice end (NEW)
    //
    // Practice now uses neutral free-typing (no source text). After the
    // timer ends we show an explicit "Practice complete" confirmation
    // screen rather than auto-jumping into Task 1 intro.
    document.getElementById('practiceStart').addEventListener('click', async () => {
        showScreen('screen-typing');
        await runTypingTask({
            taskType: 'practice',
            taskContent: PRACTICE_INSTRUCTIONS,
            durationSeconds: PRACTICE_DURATION,
            isPractice: true,
            taskNumber: 0
        });
        showScreen('screen-practice-end');
    });

    // Practice end -> task 1 intro (NEW)
    document.getElementById('practiceEndContinue').addEventListener('click', () => {
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
            startIntermissionCountdown();
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
