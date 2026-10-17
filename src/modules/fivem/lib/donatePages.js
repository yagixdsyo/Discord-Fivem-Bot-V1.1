/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

function shortDate(iso) {
  if (!iso) return '-';
  try {
    return new Date(iso).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return '-';
  }
}

function userName(doc) {
  return doc.user_tag ?? (doc.user_id ? String(doc.user_id) : '-');
}

/** 6 sayfalik tanim listesini uretir. */
export function buildDonatePages(t, { info, donates = [] } = {}) {
  const packages = Array.isArray(info?.packages) ? info.packages : [];
  const methods = Array.isArray(info?.methods) ? info.methods : [];
  const contact = info?.contact ?? null;

  const overviewRows = [
    { title: t('fivem.donate.page_overview_step1'), subtitle: t('fivem.donate.page_overview_step1_desc') },
    { title: t('fivem.donate.page_overview_step2'), subtitle: t('fivem.donate.page_overview_step2_desc') },
    { title: t('fivem.donate.page_overview_step3'), subtitle: t('fivem.donate.page_overview_step3_desc') },
  ];

  const packageRows = packages.map((paket) => ({
    title: paket.name,
    subtitle: paket.desc ?? null,
    value: paket.price ?? null,
  }));

  const methodRows = methods.map((method) => ({ title: method, subtitle: t('fivem.donate.page_methods_row_desc'), value: t('fivem.donate.page_methods_row_badge') }));

  const recentRows = donates.slice(0, 8).map((doc) => ({
    title: doc.package ?? '-',
    subtitle: `${userName(doc)} · ${shortDate(doc.created_at)}`,
    value: doc.amount ?? '-',
  }));

  return [
    {
      cardTitle: t('fivem.donate.page_overview_title'),
      cardSubtitle: t('fivem.donate.page_overview_subtitle'),
      accent: 'success',
      lines: [info?.intro ?? '', ...overviewRows.map((row) => `**${row.title}** — ${row.subtitle}`)],
      canvas: {
        title: t('fivem.donate.page_overview_title'),
        subtitle: t('fivem.donate.page_overview_subtitle'),
        stats: [
          { label: t('fivem.donate.stat_records'), value: `${donates.length}` },
          { label: t('fivem.donate.stat_packages'), value: `${packages.length}` },
          { label: t('fivem.donate.stat_methods'), value: `${methods.length}` },
        ],
        rows: overviewRows,
        footer: info?.intro ?? t('fivem.donate.page_footer_hint'),
      },
    },
    {
      cardTitle: t('fivem.donate.page_packages_title'),
      cardSubtitle: t('fivem.donate.page_packages_subtitle'),
      accent: 'primary',
      lines: packageRows.map((row) => t('fivem.donate.package_line', { ad: `**${row.title}**`, fiyat: row.value ?? '-', aciklama: row.subtitle ?? '' })),
      canvas: {
        title: t('fivem.donate.page_packages_title'),
        subtitle: t('fivem.donate.page_packages_subtitle'),
        rows: packageRows.length ? packageRows : [{ title: t('fivem.donate.page_packages_empty') }],
        footer: t('fivem.donate.page_packages_footer'),
      },
    },
    {
      cardTitle: t('fivem.donate.page_methods_title'),
      cardSubtitle: t('fivem.donate.page_methods_subtitle'),
      accent: 'info',
      lines: [
        ...(methods.length ? [t('fivem.donate.methods_line', { yontemler: methods.join(', ') })] : []),
        contact ? t('fivem.donate.contact_line', { iletisim: contact }) : null,
      ].filter(Boolean),
      canvas: {
        title: t('fivem.donate.page_methods_title'),
        subtitle: t('fivem.donate.page_methods_subtitle'),
        rows: [
          ...(methodRows.length ? methodRows : [{ title: t('fivem.donate.page_methods_empty') }]),
          ...(contact ? [{ title: t('fivem.donate.page_contact_row'), subtitle: contact }] : []),
        ],
        footer: t('fivem.donate.page_methods_footer'),
      },
    },
    {
      cardTitle: t('fivem.donate.page_recent_title'),
      cardSubtitle: t('fivem.donate.page_recent_subtitle'),
      accent: 'success',
      lines: recentRows.map((row, index) => `${index + 1}. ${row.title} — ${row.subtitle} · ${row.value}`),
      canvas: {
        title: t('fivem.donate.page_recent_title'),
        subtitle: t('fivem.donate.page_recent_subtitle'),
        rows: recentRows.length ? recentRows : [{ title: t('fivem.donate.page_recent_empty'), subtitle: t('fivem.donate.page_recent_empty_hint') }],
        footer: t('fivem.donate.page_recent_footer', { adet: donates.length }),
      },
    },
    {
      cardTitle: t('fivem.donate.page_rules_title'),
      cardSubtitle: t('fivem.donate.page_rules_subtitle'),
      accent: 'warn',
      lines: [
        `**${t('fivem.donate.page_rules_q1')}** — ${t('fivem.donate.page_rules_a1')}`,
        `**${t('fivem.donate.page_rules_q2')}** — ${t('fivem.donate.page_rules_a2')}`,
        `**${t('fivem.donate.page_rules_q3')}** — ${t('fivem.donate.page_rules_a3')}`,
        `**${t('fivem.donate.page_rules_q4')}** — ${t('fivem.donate.page_rules_a4')}`,
      ],
      canvas: {
        title: t('fivem.donate.page_rules_title'),
        subtitle: t('fivem.donate.page_rules_subtitle'),
        rows: [
          { title: t('fivem.donate.page_rules_q1'), subtitle: t('fivem.donate.page_rules_a1') },
          { title: t('fivem.donate.page_rules_q2'), subtitle: t('fivem.donate.page_rules_a2') },
          { title: t('fivem.donate.page_rules_q3'), subtitle: t('fivem.donate.page_rules_a3') },
          { title: t('fivem.donate.page_rules_q4'), subtitle: t('fivem.donate.page_rules_a4') },
        ],
        footer: t('fivem.donate.page_rules_footer'),
      },
    },
    {
      cardTitle: t('fivem.donate.page_contact_title'),
      cardSubtitle: t('fivem.donate.page_contact_subtitle'),
      accent: 'primary',
      lines: [
        contact ? t('fivem.donate.contact_line', { iletisim: contact }) : null,
        `**${t('fivem.donate.page_contact_ticket')}** — ${t('fivem.donate.page_contact_ticket_desc')}`,
        `**${t('fivem.donate.page_contact_thanks')}** — ${t('fivem.donate.page_contact_thanks_desc')}`,
      ].filter(Boolean),
      canvas: {
        title: t('fivem.donate.page_contact_title'),
        subtitle: t('fivem.donate.page_contact_subtitle'),
        rows: [
          ...(contact ? [{ title: t('fivem.donate.page_contact_row'), subtitle: contact }] : []),
          { title: t('fivem.donate.page_contact_ticket'), subtitle: t('fivem.donate.page_contact_ticket_desc') },
          { title: t('fivem.donate.page_contact_thanks'), subtitle: t('fivem.donate.page_contact_thanks_desc') },
        ],
        footer: t('fivem.donate.page_contact_footer'),
      },
    },
  ];
}
