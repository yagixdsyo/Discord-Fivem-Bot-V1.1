/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { insertDoc, findDocs, findOneDoc, updateDoc } from '../../fivem/lib/store.js';

const DECISIONS = 'decisions';
const VOTES = 'decision_votes';
const POLICIES = 'decision_policies';

export const MAJORITY_TYPES = ['basit', 'nitelikli', 'oybirligi'];
export const VOTE_CHOICES = ['evet', 'hayir', 'cekimser'];

export function defaultPolicy() {
  return {
    requiredVotes: 3,
    majority: 'basit',
    durationMinutes: 1440,
    vetoRoleIds: [],
    proposeRoleIds: [],
  };
}

export async function getPolicy(guildId) {
  const doc = await findOneDoc(POLICIES, { guild_id: guildId }).catch(() => null);
  return { ...defaultPolicy(), ...(doc?.policy ?? {}) };
}

export async function setPolicy(guildId, patch) {
  const current = await getPolicy(guildId);
  const next = { ...current, ...patch };
  const existing = await findOneDoc(POLICIES, { guild_id: guildId }).catch(() => null);
  if (existing) {
    await updateDoc(POLICIES, { guild_id: guildId }, { policy: next, updated_at: new Date().toISOString() });
  } else {
    await insertDoc(POLICIES, { guild_id: guildId, policy: next, created_at: new Date().toISOString() });
  }
  return next;
}

export async function createDecision({ guildId, title, description = null, createdBy, policy }) {
  const effective = { ...defaultPolicy(), ...(policy ?? {}) };
  const decision = {
    decision_id: `k-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 4)}`,
    guild_id: guildId,
    title,
    description,
    created_by: createdBy,
    created_at: new Date().toISOString(),
    ends_at: new Date(Date.now() + effective.durationMinutes * 60_000).toISOString(),
    status: 'acik',
    policy: effective,
    result: null,
    vetoed_by: null,
    veto_reason: null,
    manual_override: null,
  };
  await insertDoc(DECISIONS, decision);
  return decision;
}

export async function getDecision(guildId, decisionId) {
  return findOneDoc(DECISIONS, { guild_id: guildId, decision_id: decisionId }).catch(() => null);
}

export async function listDecisions(guildId, { status = null, limit = 25 } = {}) {
  const filter = { guild_id: guildId };
  if (status) filter.status = status;
  return findDocs(DECISIONS, filter, { sort: { created_at: -1 }, limit });
}

export async function castVote({ guildId, decisionId, userId, choice }) {
  if (!VOTE_CHOICES.includes(choice)) return { ok: false, error: 'invalid_choice' };
  const decision = await getDecision(guildId, decisionId);
  if (!decision) return { ok: false, error: 'missing' };
  if (decision.status !== 'acik') return { ok: false, error: 'closed' };
  if (new Date(decision.ends_at).getTime() < Date.now()) return { ok: false, error: 'expired' };
  const existing = await findOneDoc(VOTES, { guild_id: guildId, decision_id: decisionId, user_id: userId }).catch(() => null);
  const patch = { choice, updated_at: new Date().toISOString() };
  if (existing) {
    await updateDoc(VOTES, { guild_id: guildId, decision_id: decisionId, user_id: userId }, patch);
  } else {
    await insertDoc(VOTES, { guild_id: guildId, decision_id: decisionId, user_id: userId, created_at: new Date().toISOString(), ...patch });
  }
  return { ok: true };
}

export async function tally(guildId, decision) {
  const votes = await findDocs(VOTES, { guild_id: guildId, decision_id: decision.decision_id }, { limit: 500 }).catch(() => []);
  const counts = { evet: 0, hayir: 0, cekimser: 0 };
  for (const vote of votes) {
    if (counts[vote.choice] !== undefined) counts[vote.choice] += 1;
  }
  const total = votes.length;
  const effective = counts.evet + counts.hayir;
  const policy = { ...defaultPolicy(), ...(decision.policy ?? {}) };
  const quorumMet = total >= (policy.requiredVotes ?? 1);
  let passed = false;
  if (quorumMet && effective > 0) {
    if (policy.majority === 'nitelikli') passed = counts.evet / effective >= 2 / 3;
    else if (policy.majority === 'oybirligi') passed = counts.hayir === 0;
    else passed = counts.evet > counts.hayir;
  }
  const expired = new Date(decision.ends_at).getTime() < Date.now();
  return { counts, total, effective, quorumMet, passed, expired, policy };
}

export async function closeDecision({ guildId, decisionId, actorId, manualResult = null }) {
  const decision = await getDecision(guildId, decisionId);
  if (!decision) return { ok: false, error: 'missing' };
  const t = await tally(guildId, decision);
  const finalResult = manualResult ?? (t.passed ? 'kabul' : 'red');
  await updateDoc(DECISIONS, { guild_id: guildId, decision_id: decisionId }, {
    status: 'kapandi',
    result: finalResult,
    closed_by: actorId,
    closed_at: new Date().toISOString(),
    manual_override: manualResult ? actorId : null,
  });
  return { ok: true, result: finalResult, tally: t };
}

export async function vetoDecision({ guildId, decisionId, userId, reason = null }) {
  const decision = await getDecision(guildId, decisionId);
  if (!decision) return { ok: false, error: 'missing' };
  if (decision.status !== 'acik') return { ok: false, error: 'closed' };
  await updateDoc(DECISIONS, { guild_id: guildId, decision_id: decisionId }, {
    status: 'veto',
    result: 'veto',
    vetoed_by: userId,
    veto_reason: reason,
    closed_at: new Date().toISOString(),
  });
  return { ok: true };
}
