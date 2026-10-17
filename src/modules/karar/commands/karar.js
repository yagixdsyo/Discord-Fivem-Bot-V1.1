/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { card, error as errorTemplate, success, list as listTemplate } from '../../../ui/templates/index.js';
import { MAJORITY_TYPES, VOTE_CHOICES } from '../lib/decisions.js';
import { buildVoteCard, policyLine } from '../lib/card.js';

function stripNumberFlag(text, key) {
  const re = new RegExp(`${key}[:=]\\s*(\\d+)`, 'i');
  const match = text.match(re);
  if (!match) return { value: null, text };
  return { value: Number(match[1]), text: text.replace(match[0], ' ').replace(/\s+/g, ' ').trim() };
}

function normalizeChoice(input) {
  const value = String(input ?? '').toLowerCase();
  const aliases = { yes: 'evet', no: 'hayir', abstain: 'cekimser', cekimser: 'cekimser' };
  const mapped = aliases[value] ?? value;
  return VOTE_CHOICES.includes(mapped) ? mapped : null;
}

export default {
  name: 'karar',
  aliases: ['oy'],
  description: 'Karar acar, oylama yurutur, sonuc hesaplar ve anayasayi yonetir.',
  category: 'Karar',
  system: 'karar',
  cooldown: 5,
  permission: { discord: [] },
  args: [
    { name: 'islem', type: 'string', required: true, description: 'ac|oyla|sonuc|veto|kapat|liste|anayasa' },
    { name: 'parametre', type: 'rest', required: false, description: 'Isleme gore parametreler' },
  ],
  async run(ctx) {
    const t = ctx.t;
    const lib = await import('../lib/decisions.js');
    const islem = String(ctx.args.islem || '').toLowerCase();
    const raw = String(ctx.args.parametre || '').trim();

    if (islem === 'ac' || islem === 'aç') {
      const sure = stripNumberFlag(raw, 'sure');
      const gerekli = stripNumberFlag(sure.text, 'gerekli');
      const policy = await lib.getPolicy(ctx.guild.id);
      const decision = await lib.createDecision({
        guildId: ctx.guild.id,
        title: gerekli.text || t('karar.default_title'),
        createdBy: ctx.user.id,
        policy: {
          ...policy,
          durationMinutes: sure.value && sure.value > 0 ? Math.min(sure.value, 20160) : policy.durationMinutes,
          requiredVotes: gerekli.value && gerekli.value > 0 ? Math.min(gerekli.value, 100) : policy.requiredVotes,
        },
      });
      const tally = await lib.tally(ctx.guild.id, decision);
      await ctx.reply(buildVoteCard(t, decision, tally, { mode: 'open' }));
      return;
    }

    if (islem === 'oyla' || islem === 'oy') {
      const [decisionId, choiceRaw] = raw.split(/\s+/);
      const choice = normalizeChoice(choiceRaw);
      if (!decisionId || !choice) {
        await ctx.reply(errorTemplate(t('karar.vote_input_title'), [t('karar.vote_input')], { ephemeral: true }));
        return;
      }
      const result = await lib.castVote({ guildId: ctx.guild.id, decisionId, userId: ctx.user.id, choice });
      if (!result.ok) {
        const messageKey = result.error === 'closed' ? 'karar.vote_closed' : result.error === 'expired' ? 'karar.vote_expired' : 'karar.vote_fail';
        await ctx.reply(errorTemplate(t('karar.vote_fail_title'), [t(messageKey)], { ephemeral: true }));
        return;
      }
      const decision = await lib.getDecision(ctx.guild.id, decisionId);
      const tally = await lib.tally(ctx.guild.id, decision);
      await ctx.reply(success(t('karar.vote_ok_title'), [
        t('karar.vote_ok', { oy: t(`karar.choice_${choice}`) }),
        t('karar.vote_counts', { evet: tally.counts.evet, hayir: tally.counts.hayir, cekimser: tally.counts.cekimser }),
      ], { ephemeral: true }));
      return;
    }

    if (islem === 'sonuc') {
      const [decisionId] = raw.split(/\s+/);
      const decision = decisionId ? await lib.getDecision(ctx.guild.id, decisionId) : null;
      if (!decision) {
        await ctx.reply(errorTemplate(t('karar.not_found_title'), [t('karar.not_found')]));
        return;
      }
      const tally = await lib.tally(ctx.guild.id, decision);
      await ctx.reply(buildVoteCard(t, decision, tally, { mode: 'result' }));
      return;
    }

    if (islem === 'veto') {
      const [decisionId, ...reasonParts] = raw.split(/\s+/);
      const decision = decisionId ? await lib.getDecision(ctx.guild.id, decisionId) : null;
      if (!decision) {
        await ctx.reply(errorTemplate(t('karar.not_found_title'), [t('karar.not_found')]));
        return;
      }
      const policy = { ...lib.defaultPolicy(), ...(decision.policy ?? {}) };
      const hasVetoRole = (policy.vetoRoleIds ?? []).some((roleId) => ctx.member?.roles?.cache?.has?.(roleId));
      const canVeto = hasVetoRole || Boolean(ctx.member?.permissions?.has?.('ManageGuild'));
      if (!canVeto) {
        await ctx.reply(errorTemplate(t('karar.veto_denied_title'), [t('karar.veto_denied')]));
        return;
      }
      const result = await lib.vetoDecision({ guildId: ctx.guild.id, decisionId, userId: ctx.user.id, reason: reasonParts.join(' ') || null });
      if (!result.ok) {
        await ctx.reply(errorTemplate(t('karar.veto_fail_title'), [t('karar.veto_fail')]));
        return;
      }
      await ctx.reply(success(t('karar.veto_ok_title'), [t('karar.veto_ok', { id: decisionId })]));
      return;
    }

    if (islem === 'kapat') {
      const [decisionId, verdictRaw] = raw.split(/\s+/);
      if (!ctx.member?.permissions?.has?.('ManageGuild')) {
        await ctx.reply(errorTemplate(t('karar.close_denied_title'), [t('karar.close_denied')]));
        return;
      }
      const verdict = ['kabul', 'red'].includes(String(verdictRaw || '').toLowerCase()) ? String(verdictRaw).toLowerCase() : null;
      const result = await lib.closeDecision({ guildId: ctx.guild.id, decisionId, actorId: ctx.user.id, manualResult: verdict });
      if (!result.ok) {
        await ctx.reply(errorTemplate(t('karar.not_found_title'), [t('karar.not_found')]));
        return;
      }
      await ctx.reply(success(t('karar.closed_title'), [t('karar.closed', { id: decisionId, sonuc: result.result })]));
      return;
    }

    if (islem === 'liste') {
      const rows = await lib.listDecisions(ctx.guild.id);
      const lines = rows.map((x) => t('karar.list_line', { id: x.decision_id, baslik: x.title, durum: x.status, sonuc: x.result ?? '-' }));
      await ctx.reply(lines.length ? listTemplate({ title: t('karar.list_title'), lines }) : success(t('karar.list_empty_title'), [t('karar.list_empty')]));
      return;
    }

    if (islem === 'anayasa') {
      const [setting, ...restParts] = raw.split(/\s+/);
      const value = restParts.join(' ').trim();
      if (!setting || setting === 'goster') {
        const policy = await lib.getPolicy(ctx.guild.id);
        await ctx.reply(card({
          emojiKey: 'AYAR',
          title: t('karar.policy_title'),
          lines: [policyLine(t, policy), t('karar.policy_majorities', { liste: MAJORITY_TYPES.map((m) => t(`karar.majority_${m}`)).join(', ') })],
          footer: t('karar.policy_footer'),
        }));
        return;
      }
      if (setting === 'gerekli-oy') {
        const next = Number(value);
        if (!Number.isInteger(next) || next < 1 || next > 100) {
          await ctx.reply(errorTemplate(t('karar.policy_invalid_title'), [t('karar.policy_invalid_number')]));
          return;
        }
        const policy = await lib.setPolicy(ctx.guild.id, { requiredVotes: next });
        await ctx.reply(success(t('karar.policy_updated_title'), [policyLine(t, policy)], { ephemeral: true }));
        return;
      }
      if (setting === 'sure') {
        const next = Number(value);
        if (!Number.isInteger(next) || next < 5 || next > 20160) {
          await ctx.reply(errorTemplate(t('karar.policy_invalid_title'), [t('karar.policy_invalid_duration')]));
          return;
        }
        const policy = await lib.setPolicy(ctx.guild.id, { durationMinutes: next });
        await ctx.reply(success(t('karar.policy_updated_title'), [policyLine(t, policy)], { ephemeral: true }));
        return;
      }
      if (setting === 'cogunluk') {
        const next = String(value).toLowerCase();
        if (!MAJORITY_TYPES.includes(next)) {
          await ctx.reply(errorTemplate(t('karar.policy_invalid_title'), [t('karar.policy_invalid_majority')]));
          return;
        }
        const policy = await lib.setPolicy(ctx.guild.id, { majority: next });
        await ctx.reply(success(t('karar.policy_updated_title'), [policyLine(t, policy)], { ephemeral: true }));
        return;
      }
      if (setting === 'veto-rol') {
        if (value === 'temizle') {
          const policy = await lib.setPolicy(ctx.guild.id, { vetoRoleIds: [] });
          await ctx.reply(success(t('karar.policy_updated_title'), [policyLine(t, policy)], { ephemeral: true }));
          return;
        }
        const roleId = value.match(/<@&(\d+)>/)?.[1] ?? (/^\d+$/.test(value) ? value : null);
        if (!roleId) {
          await ctx.reply(errorTemplate(t('karar.policy_invalid_title'), [t('karar.policy_invalid_role')]));
          return;
        }
        const policy = await lib.setPolicy(ctx.guild.id, { vetoRoleIds: [roleId] });
        await ctx.reply(success(t('karar.policy_updated_title'), [policyLine(t, policy)], { ephemeral: true }));
        return;
      }
      await ctx.reply(errorTemplate(t('karar.policy_invalid_title'), [t('karar.policy_settings_help')]));
      return;
    }

    await ctx.reply(errorTemplate(t('karar.unknown_title'), [t('karar.unknown_action')]));
  },
};
