/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { card } from '../../../ui/templates/index.js';
import { button, row } from '../../../ui/v2.js';

export function policyLine(t, policy) {
  return t('karar.policy_line', {
    oy: policy.requiredVotes,
    cogunluk: t(`karar.majority_${policy.majority}`),
    sure: policy.durationMinutes,
    veto: (policy.vetoRoleIds ?? []).length > 0 ? policy.vetoRoleIds.map((id) => `<@&${id}>`).join(', ') : t('karar.policy_veto_none'),
  });
}

export function statusLine(t, decision, tally) {
  return decision.status === 'acik'
    ? (tally.quorumMet ? (tally.passed ? t('karar.status_passing') : t('karar.status_failing')) : t('karar.status_quorum_missing'))
    : decision.status === 'veto' ? t('karar.status_veto') : (decision.result === 'kabul' ? t('karar.status_accepted') : t('karar.status_rejected'));
}

export function voteButtons(t, decision) {
  return row([
    button({ id: `karar:oyla:evet:${decision.decision_id}`, label: t('karar.btn_yes'), emojiKey: 'ONAY', style: 'success' }),
    button({ id: `karar:oyla:hayir:${decision.decision_id}`, label: t('karar.btn_no'), emojiKey: 'RED', style: 'danger' }),
    button({ id: `karar:oyla:cekimser:${decision.decision_id}`, label: t('karar.btn_abstain'), emojiKey: 'NOT', style: 'secondary' }),
    button({ id: `karar:sonuc:${decision.decision_id}`, label: t('karar.btn_result'), emojiKey: 'GRAFIK', style: 'primary' }),
  ]);
}

/**
 * Oylama kartini uretir.
 * @param {'open'|'result'} mode open: oylama duyurusu; result: sonuc gorunumu.
 */
export function buildVoteCard(t, decision, tally, { mode = 'open', ephemeral = false } = {}) {
  const isOpen = decision.status === 'acik';
  const counts = t('karar.vote_counts', { evet: tally.counts.evet, hayir: tally.counts.hayir, cekimser: tally.counts.cekimser });
  const lines = [`**${decision.title}**`, policyLine(t, tally.policy)];

  if (mode === 'open') {
    if (isOpen) {
      lines.push(t('karar.created_ends', { bitis: `<t:${Math.floor(new Date(decision.ends_at).getTime() / 1000)}:R>` }));
    } else {
      lines.push(t('karar.result_state', { durum: statusLine(t, decision, tally) }));
    }
    lines.push(counts);
    lines.push(t('karar.vote_live_hint'));
  } else {
    lines.push(t('karar.quorum_line', {
      oy: tally.total,
      gerekli: tally.policy.requiredVotes,
      durum: tally.quorumMet ? t('karar.quorum_ok') : t('karar.quorum_missing'),
    }));
    lines.push(counts);
    lines.push(t('karar.result_state', { durum: statusLine(t, decision, tally) }));
  }

  return card({
    emojiKey: 'BELGE',
    title: mode === 'open' ? t('karar.created_title') : t('karar.result_title'),
    subtitle: `${t('karar.id_label')}: \`${decision.decision_id}\``,
    accent: mode === 'open' ? 'info' : (isOpen ? (tally.passed ? 'success' : 'warn') : 'primary'),
    lines,
    buttons: isOpen ? [voteButtons(t, decision)] : [],
    footer: isOpen ? t('karar.created_footer') : null,
    ephemeral,
  });
}
