#!/usr/bin/env python3
"""
Typing Study - Analysis Script
==============================

Loads exported session JSON files, aggregates metrics across participants,
runs paired statistical tests comparing copy vs prompt typing, and generates
report-ready figures and a markdown summary report.

Usage:
    python analyse.py --data-dir ./data --output-dir ./analysis_output

Inputs:
    --data-dir : directory containing one .json file per participant session
                 (the files exported by the typing-study web app)
    --output-dir : directory where outputs are written (created if missing)

Outputs (written to --output-dir):
    summary_per_participant.csv : one row per participant per task
    summary_group.csv           : means, SDs, medians per task type
    paired_tests.csv            : statistical test results
    order_effects.csv           : task-order effect check
    figures/*.png               : paired-line plots and IKI comparisons
    analysis_report.md          : narrative summary, ready for the dissertation

Designed for small-N within-subjects designs (n ~= 5-15). Reports both
parametric (paired t-test) and non-parametric (Wilcoxon signed-rank) tests
with effect sizes - small samples warrant reporting both.
"""

import argparse
import json
import sys
from pathlib import Path

import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from scipy import stats


# Schema version this script was written against. Sessions exported by an
# older version of the app will trigger a warning but the script will still
# attempt to process them.
EXPECTED_EXPORT_VERSION = 3

# =========================================================================
# Loading & validation
# =========================================================================

def load_session(filepath):
    """Load and lightly validate a single session JSON file."""
    with open(filepath) as f:
        data = json.load(f)

    if 'metadata' not in data or 'tasks' not in data:
        raise ValueError(f"missing required top-level fields")

    version = data['metadata'].get('exportVersion')
    if version != EXPECTED_EXPORT_VERSION:
        print(f"  WARNING: {filepath.name} has exportVersion={version}, "
              f"expected {EXPECTED_EXPORT_VERSION}")

    if len(data['tasks']) != 2:
        raise ValueError(f"expected 2 tasks, found {len(data['tasks'])}")

    task_types = sorted(t['taskType'] for t in data['tasks'])
    if task_types != ['copy', 'prompt']:
        raise ValueError(f"expected one copy and one prompt task, "
                         f"got {task_types}")

    return data


def extract_task_row(session, task):
    """Flatten one task in one session to a dict suitable for a DataFrame row."""
    m = task['metrics']
    iki = m.get('interKeystrokeInterval', {})
    cm = m.get('copyTaskMetrics') or {}

    return {
        # Identifiers
        'participantId': session['metadata']['participantId'],
        'sessionId': session['metadata']['sessionId'],
        'taskType': task['taskType'],
        'taskNumber': task['taskNumber'],
        'wasFirstTask': task['taskNumber'] == 1,

        # Demographics carried over to make per-task subgroup analysis easier
        'demographics_typingFrequency': session.get('demographics', {})
                                                .get('typingFrequency', 'NA'),
        'demographics_englishFirstLanguage': session.get('demographics', {})
                                                     .get('englishFirstLanguage', 'NA'),
        'demographics_keyboardType': session.get('demographics', {})
                                             .get('keyboardType', 'NA'),

        # Speed metrics
        'durationSeconds': task['durationSeconds'],
        'totalCharacters': m['totalCharactersTyped'],
        'grossWPM': m['grossWPM'],
        'netWPM': m.get('netWPM'),

        # Correction behaviour
        'rawBackspaces': m['rawBackspaceCount'],
        'effectiveBackspaces': m['effectiveBackspaceCount'],

        # Pausing
        'pauseCount': m['pauseCount'],
        'avgPauseMs': m['averagePauseMs'],
        'longestPauseMs': m['longestPauseMs'],

        # Inter-keystroke interval
        'iki_mean': iki.get('meanMs', np.nan),
        'iki_median': iki.get('medianMs', np.nan),
        'iki_stdDev': iki.get('stdDevMs', np.nan),
        'iki_p25': iki.get('percentile25Ms', np.nan),
        'iki_p75': iki.get('percentile75Ms', np.nan),
        'iki_iqr': iki.get('percentile75Ms', np.nan) - iki.get('percentile25Ms', np.nan)
                    if iki.get('percentile75Ms') is not None
                    and iki.get('percentile25Ms') is not None else np.nan,

        # Copy-only metrics
        'copy_editDistance': cm.get('editDistance'),
        'copy_accuracyPercent': cm.get('accuracyPercent'),
    }


def build_dataframe(data_dir):
    """Load every JSON file in data_dir and return a long-format DataFrame."""
    rows = []
    json_files = sorted(Path(data_dir).glob('*.json'))
    if not json_files:
        raise FileNotFoundError(f"No .json files found in {data_dir}")

    print(f"\nLoading sessions from {data_dir}/")
    print("-" * 60)
    for fp in json_files:
        try:
            session = load_session(fp)
            for task in session['tasks']:
                rows.append(extract_task_row(session, task))
            print(f"  loaded {fp.name}")
        except Exception as e:
            print(f"  SKIPPED {fp.name}: {e}")

    if not rows:
        raise RuntimeError("No valid sessions loaded.")

    df = pd.DataFrame(rows)
    print("-" * 60)
    print(f"Total: {df['participantId'].nunique()} participants, "
          f"{len(df)} task rows.\n")
    return df


# =========================================================================
# Summary tables
# =========================================================================

def save_per_participant(df, output_dir):
    df.to_csv(output_dir / 'summary_per_participant.csv', index=False)


def summarise_by_task(df, output_dir):
    """Group-level summary: mean, SD, median for each metric by task type."""
    metrics = ['grossWPM', 'netWPM', 'effectiveBackspaces', 'pauseCount',
               'avgPauseMs', 'iki_mean', 'iki_median', 'iki_stdDev', 'iki_iqr',
               'copy_accuracyPercent']

    rows = []
    for metric in metrics:
        for task_type in ['copy', 'prompt']:
            vals = df.loc[df['taskType'] == task_type, metric].dropna()
            if len(vals) == 0:
                continue
            rows.append({
                'metric': metric,
                'taskType': task_type,
                'n': len(vals),
                'mean': vals.mean(),
                'sd': vals.std(ddof=1) if len(vals) > 1 else np.nan,
                'median': vals.median(),
                'min': vals.min(),
                'max': vals.max(),
            })

    summary = pd.DataFrame(rows).round(3)
    summary.to_csv(output_dir / 'summary_group.csv', index=False)
    return summary


# =========================================================================
# Statistical tests
# =========================================================================

def paired_tests(df, output_dir):
    """Run paired tests for each comparable metric (copy vs prompt within-subjects)."""
    metrics = ['grossWPM', 'effectiveBackspaces', 'pauseCount', 'avgPauseMs',
               'iki_mean', 'iki_median', 'iki_stdDev', 'iki_iqr']

    pivoted = df.pivot(index='participantId', columns='taskType', values=metrics)

    rows = []
    for metric in metrics:
        if (metric, 'copy') not in pivoted.columns or \
           (metric, 'prompt') not in pivoted.columns:
            continue

        c = pivoted[(metric, 'copy')]
        p = pivoted[(metric, 'prompt')]
        valid = (~c.isna()) & (~p.isna())
        c, p = c[valid], p[valid]

        n = len(c)
        if n < 2:
            continue

        diff = c - p

        # Paired t-test
        try:
            t_stat, t_p = stats.ttest_rel(c, p)
        except Exception:
            t_stat, t_p = np.nan, np.nan

        # Wilcoxon signed-rank - robust for small N / non-normal distributions
        try:
            w_stat, w_p = stats.wilcoxon(c, p)
        except (ValueError, Exception):
            w_stat, w_p = np.nan, np.nan

        # Cohen's d_z (paired effect size)
        sd = diff.std(ddof=1)
        cohens_dz = diff.mean() / sd if (sd is not None and sd > 0) else np.nan

        rows.append({
            'metric': metric,
            'n_pairs': n,
            'copy_mean': c.mean(),
            'copy_sd': c.std(ddof=1),
            'prompt_mean': p.mean(),
            'prompt_sd': p.std(ddof=1),
            'mean_diff_(copy-prompt)': diff.mean(),
            't_stat': t_stat,
            't_p_value': t_p,
            'wilcoxon_stat': w_stat,
            'wilcoxon_p_value': w_p,
            'cohens_dz': cohens_dz,
        })

    out = pd.DataFrame(rows).round(4)
    out.to_csv(output_dir / 'paired_tests.csv', index=False)
    return out


def order_effect_check(df, output_dir):
    """Check for task-order effects: did performance differ between Task 1 and Task 2
    regardless of task type? A clear order effect would suggest counterbalancing
    failed to fully wash out fatigue or learning."""
    metrics = ['grossWPM', 'effectiveBackspaces', 'iki_mean']

    rows = []
    for metric in metrics:
        first = df.loc[df['wasFirstTask'], metric].dropna()
        second = df.loc[~df['wasFirstTask'], metric].dropna()
        if len(first) < 2 or len(second) < 2:
            continue
        try:
            u_stat, u_p = stats.mannwhitneyu(first, second, alternative='two-sided')
        except Exception:
            u_stat, u_p = np.nan, np.nan
        rows.append({
            'metric': metric,
            'n_first_task': len(first),
            'n_second_task': len(second),
            'mean_first': first.mean(),
            'mean_second': second.mean(),
            'mann_whitney_u': u_stat,
            'p_value': u_p,
        })

    out = pd.DataFrame(rows).round(4)
    out.to_csv(output_dir / 'order_effects.csv', index=False)
    return out


# =========================================================================
# Figures
# =========================================================================

def plot_paired(df, metric, ylabel, output_dir):
    """Paired-line plot: each participant's two values connected by a line."""
    pivoted = df.pivot(index='participantId', columns='taskType', values=metric)
    if 'copy' not in pivoted.columns or 'prompt' not in pivoted.columns:
        return

    fig, ax = plt.subplots(figsize=(6, 5))
    for pid, row in pivoted.iterrows():
        if pd.isna(row.get('copy')) or pd.isna(row.get('prompt')):
            continue
        ax.plot(['Copy', 'Prompt'], [row['copy'], row['prompt']],
                marker='o', alpha=0.6, color='steelblue', linewidth=1.4)

    # Group means as a thicker connecting line
    means = [pivoted['copy'].mean(), pivoted['prompt'].mean()]
    ax.plot(['Copy', 'Prompt'], means, marker='s', markersize=12,
            color='black', linewidth=2.5, label='Group mean')

    ax.set_ylabel(ylabel, fontsize=12)
    ax.set_title(f'{ylabel} by task type', fontsize=12)
    ax.legend()
    ax.grid(axis='y', alpha=0.3)
    fig.tight_layout()
    fig.savefig(output_dir / f'paired_{metric}.png', dpi=150)
    plt.close(fig)


def plot_iki_distribution_summary(df, output_dir):
    """Box plot of mean IKI and IKI std dev side-by-side, by task type."""
    fig, axes = plt.subplots(1, 2, figsize=(11, 5))

    metrics = [('iki_mean', 'Mean IKI (ms)'),
               ('iki_stdDev', 'IKI Std Dev (ms)')]

    for ax, (col, title) in zip(axes, metrics):
        copy_v = df.loc[df.taskType == 'copy', col].dropna()
        prompt_v = df.loc[df.taskType == 'prompt', col].dropna()
        ax.boxplot([copy_v, prompt_v], labels=['Copy', 'Prompt'],
                   patch_artist=True,
                   boxprops=dict(facecolor='lightsteelblue'))
        ax.scatter([1] * len(copy_v), copy_v, alpha=0.6, color='steelblue', zorder=3)
        ax.scatter([2] * len(prompt_v), prompt_v, alpha=0.6, color='coral', zorder=3)
        ax.set_ylabel(title)
        ax.grid(axis='y', alpha=0.3)

    fig.suptitle('IKI distribution by task type', fontsize=12)
    fig.tight_layout()
    fig.savefig(output_dir / 'iki_distributions.png', dpi=150)
    plt.close(fig)


def plot_correction_behaviour(df, output_dir):
    """Backspace counts and pause counts side-by-side."""
    fig, axes = plt.subplots(1, 2, figsize=(11, 5))

    for ax, col, title in zip(
        axes,
        ['effectiveBackspaces', 'pauseCount'],
        ['Effective backspaces', 'Pause count (>= 2 s)']
    ):
        copy_v = df.loc[df.taskType == 'copy', col].dropna()
        prompt_v = df.loc[df.taskType == 'prompt', col].dropna()
        ax.boxplot([copy_v, prompt_v], labels=['Copy', 'Prompt'],
                   patch_artist=True,
                   boxprops=dict(facecolor='lightsteelblue'))
        ax.scatter([1] * len(copy_v), copy_v, alpha=0.6, color='steelblue', zorder=3)
        ax.scatter([2] * len(prompt_v), prompt_v, alpha=0.6, color='coral', zorder=3)
        ax.set_ylabel(title)
        ax.grid(axis='y', alpha=0.3)

    fig.suptitle('Correction and pause behaviour by task type', fontsize=12)
    fig.tight_layout()
    fig.savefig(output_dir / 'correction_behaviour.png', dpi=150)
    plt.close(fig)


# =========================================================================
# Markdown report
# =========================================================================

def write_markdown_report(df, group, tests, order, output_dir):
    """Generate a narrative summary in markdown - intended as a starting
    point for the Results / Evaluation chapter of the dissertation."""

    n_participants = df['participantId'].nunique()

    lines = []
    lines.append(f"# Typing Study - Analysis Report\n")
    lines.append(f"_Auto-generated by `analyse.py`. Edit freely before "
                 f"including in the dissertation._\n\n")

    lines.append(f"## Sample\n")
    lines.append(f"- Number of participants: **{n_participants}**\n")
    lines.append(f"- Each participant completed both task types "
                 f"(within-subjects design)\n")
    copy_first = df[(df.taskType == 'copy') & df.wasFirstTask]['participantId'].nunique()
    prompt_first = df[(df.taskType == 'prompt') & df.wasFirstTask]['participantId'].nunique()
    lines.append(f"- Task order distribution: **{copy_first}** participants "
                 f"received copy first, **{prompt_first}** received prompt first\n\n")

    lines.append(f"## Group summary\n")
    lines.append(f"Means and standard deviations for each metric, split by task type. "
                 f"Full table in `summary_group.csv`.\n\n")

    # Render group summary as a markdown table
    pivot = group.pivot(index='metric', columns='taskType',
                        values=['mean', 'sd']).round(2)
    lines.append(pivot.to_markdown())
    lines.append("\n\n")

    lines.append(f"## Paired statistical tests\n")
    lines.append(f"Each metric compared within-participants between copy and prompt typing. "
                 f"Both paired t-test and Wilcoxon signed-rank reported - the latter "
                 f"is more appropriate for small samples and non-normal distributions. "
                 f"Cohen's d_z is the paired-design effect size.\n\n")
    lines.append(tests.to_markdown(index=False))
    lines.append("\n\n")

    lines.append(f"### Interpretation guide\n")
    lines.append(f"- p < 0.05 conventionally indicates a statistically significant difference\n")
    lines.append(f"- |d_z| ~ 0.2 = small effect, ~ 0.5 = medium, ~ 0.8 = large\n")
    lines.append(f"- With small N, prefer Wilcoxon p-values and report effect sizes "
                 f"alongside p-values regardless of significance\n\n")

    lines.append(f"## Order-effect check\n")
    lines.append(f"Comparison of Task 1 vs Task 2 performance regardless of task type. "
                 f"A significant order effect would indicate that counterbalancing "
                 f"did not fully neutralise practice or fatigue effects. "
                 f"Mann-Whitney U used because the groups differ across "
                 f"participants in this comparison.\n\n")
    lines.append(order.to_markdown(index=False))
    lines.append("\n\n")

    lines.append(f"## Figures\n")
    lines.append(f"Generated figures (in this directory):\n\n")
    for png in sorted(output_dir.glob('*.png')):
        lines.append(f"- `{png.name}`\n")
    lines.append("\n")

    lines.append(f"## Caveats\n")
    lines.append(f"- Small sample size limits statistical power; treat null results "
                 f"as inconclusive rather than as evidence of no effect.\n")
    lines.append(f"- All participants used the same physical environment "
                 f"only insofar as the experimenter protocol was followed; "
                 f"check `summary_per_participant.csv` for environment / demographic "
                 f"variation across participants.\n")
    lines.append(f"- Net WPM is reported only for the copy task (no reference text "
                 f"exists for the prompt task).\n")
    lines.append(f"- Copy-task accuracy uses Levenshtein edit distance against the "
                 f"prefix of the target with the same length as the typed text "
                 f"(handles misalignment without penalising incompletion).\n")

    (output_dir / 'analysis_report.md').write_text('\n'.join(lines))


# =========================================================================
# Main
# =========================================================================

def main():
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--data-dir', type=Path, required=True,
                        help='Directory containing session JSON files')
    parser.add_argument('--output-dir', type=Path, default=Path('./analysis_output'),
                        help='Directory to write results into')
    args = parser.parse_args()

    args.output_dir.mkdir(parents=True, exist_ok=True)

    df = build_dataframe(args.data_dir)

    print("Saving per-participant table...")
    save_per_participant(df, args.output_dir)

    print("Computing group summary...")
    group = summarise_by_task(df, args.output_dir)
    print(group.to_string(index=False))
    print()

    print("Running paired tests...")
    tests = paired_tests(df, args.output_dir)
    print(tests.to_string(index=False))
    print()

    print("Checking for task-order effects...")
    order = order_effect_check(df, args.output_dir)
    print(order.to_string(index=False))
    print()

    print("Generating figures...")
    for metric, label in [('grossWPM', 'Gross WPM'),
                          ('effectiveBackspaces', 'Effective backspaces'),
                          ('pauseCount', 'Pause count'),
                          ('iki_mean', 'Mean IKI (ms)'),
                          ('iki_stdDev', 'IKI std dev (ms)')]:
        plot_paired(df, metric, label, args.output_dir)
    plot_iki_distribution_summary(df, args.output_dir)
    plot_correction_behaviour(df, args.output_dir)

    print("Writing markdown report...")
    write_markdown_report(df, group, tests, order, args.output_dir)

    print(f"\nDone. Outputs written to {args.output_dir}/")
    print("\nKey files for the dissertation:")
    print(f"  - {args.output_dir}/analysis_report.md  (narrative summary)")
    print(f"  - {args.output_dir}/paired_tests.csv    (statistical test results)")
    print(f"  - {args.output_dir}/*.png               (figures)")


if __name__ == '__main__':
    main()
