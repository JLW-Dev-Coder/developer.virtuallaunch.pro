// functions/_shared/emailTemplates.js
// HTML + plain text templates for all outbound email flows.
// All HTML uses inline styles only — no <style> blocks.
// Single-column layout, max-width 600px.

const BRAND      = 'Virtual Launch Pro';
const FOOTER_TXT = 'To unsubscribe or update your preferences, reply to this email.';
const FOOTER_HTML = `<tr><td style="padding:24px 32px;border-top:1px solid #e2e8f0;text-align:center;">
  <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.5;">${FOOTER_TXT}</p>
</td></tr>`;

function wrap(bodyRows) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:'Segoe UI',Arial,sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f8fafc;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#10b981,#059669);padding:28px 32px;">
          <p style="margin:0;font-size:20px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">${BRAND}</p>
        </td></tr>
        <!-- Body -->
        ${bodyRows}
        <!-- Footer -->
        ${FOOTER_HTML}
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── onboardingConfirmation ────────────────────────────────────────────────────

export function onboardingConfirmation({ full_name, ref_number, status }) {
  const subject = 'Your Virtual Launch Pro application has been received';

  const html = wrap(`
    <tr><td style="padding:32px 32px 24px;">
      <p style="margin:0 0 16px;font-size:16px;color:#0f172a;font-weight:600;">Hi ${full_name || 'there'},</p>
      <p style="margin:0 0 24px;font-size:15px;color:#334155;line-height:1.6;">
        Thank you for submitting your developer profile to ${BRAND}. We have received your application and our team will review it shortly.
      </p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="background-color:#f1fdf7;border:1px solid #a7f3d0;border-radius:8px;padding:20px 24px;width:100%;margin-bottom:24px;">
        <tr>
          <td>
            <p style="margin:0 0 4px;font-size:12px;font-weight:600;color:#065f46;text-transform:uppercase;letter-spacing:0.5px;">Your Reference Number</p>
            <p style="margin:0;font-size:24px;font-weight:700;color:#10b981;letter-spacing:1px;">${ref_number || '—'}</p>
          </td>
        </tr>
        ${status ? `<tr><td style="padding-top:12px;border-top:1px solid #a7f3d0;margin-top:12px;">
          <p style="margin:0;font-size:13px;color:#065f46;">Status: <strong>${status}</strong></p>
        </td></tr>` : ''}
      </table>
      <p style="margin:0 0 8px;font-size:15px;color:#334155;font-weight:600;">What happens next?</p>
      <p style="margin:0;font-size:14px;color:#475569;line-height:1.7;">
        We'll review your profile and reach out when we have a matching opportunity. Save your reference number — you'll need it to update your profile or check your status.
      </p>
    </td></tr>
  `);

  const text = [
    `Hi ${full_name || 'there'},`,
    '',
    `Thank you for submitting your developer profile to ${BRAND}. We have received your application and our team will review it shortly.`,
    '',
    `Your Reference Number: ${ref_number || '—'}`,
    status ? `Status: ${status}` : '',
    '',
    "What happens next?",
    "We'll review your profile and reach out when we have a matching opportunity. Save your reference number — you'll need it to update your profile or check your status.",
    '',
    FOOTER_TXT
  ].filter(l => l !== undefined).join('\n');

  return { subject, html, text };
}

// ── operatorPostNotification ──────────────────────────────────────────────────

export function operatorPostNotification({ full_name, jobTitle, jobDescription, postedAt }) {
  const subject = `New opportunity from ${BRAND}: ${jobTitle}`;

  const dateStr = postedAt ? new Date(postedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '';

  const html = wrap(`
    <tr><td style="padding:32px 32px 24px;">
      <p style="margin:0 0 16px;font-size:16px;color:#0f172a;font-weight:600;">Hi ${full_name || 'there'},</p>
      <p style="margin:0 0 24px;font-size:15px;color:#334155;line-height:1.6;">
        ${BRAND} has a new opportunity that matches your profile. Here are the details:
      </p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:20px 24px;width:100%;margin-bottom:24px;">
        <tr><td>
          <p style="margin:0 0 6px;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;">Job Title</p>
          <p style="margin:0 0 16px;font-size:18px;font-weight:700;color:#0f172a;">${jobTitle}</p>
          <p style="margin:0 0 6px;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;">Description</p>
          <p style="margin:0;font-size:14px;color:#334155;line-height:1.7;white-space:pre-wrap;">${jobDescription}</p>
          ${dateStr ? `<p style="margin:16px 0 0;font-size:12px;color:#94a3b8;">Posted ${dateStr}</p>` : ''}
        </td></tr>
      </table>
      <p style="margin:0;font-size:14px;color:#475569;line-height:1.7;">
        To respond to this opportunity, reply to this email or log in to your profile at <a href="https://developers.virtuallaunch.pro" style="color:#10b981;text-decoration:none;">developers.virtuallaunch.pro</a>.
      </p>
    </td></tr>
  `);

  const text = [
    `Hi ${full_name || 'there'},`,
    '',
    `${BRAND} has a new opportunity that matches your profile.`,
    '',
    `Job Title: ${jobTitle}`,
    '',
    `Description:\n${jobDescription}`,
    dateStr ? `Posted: ${dateStr}` : '',
    '',
    'To respond, reply to this email or log in to your profile at https://developers.virtuallaunch.pro',
    '',
    FOOTER_TXT
  ].filter(l => l !== undefined).join('\n');

  return { subject, html, text };
}

// ── cronMatchNotification ─────────────────────────────────────────────────────

export function cronMatchNotification({ full_name, jobTitle, jobDescription, jobId }) {
  const subject = `A new role matches your profile — ${jobTitle}`;

  const html = wrap(`
    <tr><td style="padding:32px 32px 24px;">
      <p style="margin:0 0 16px;font-size:16px;color:#0f172a;font-weight:600;">Hi ${full_name || 'there'},</p>
      <p style="margin:0 0 24px;font-size:15px;color:#334155;line-height:1.6;">
        Based on your skills and preferences, we found a role that looks like a great match for you:
      </p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="background-color:#f1fdf7;border:1px solid #a7f3d0;border-radius:8px;padding:20px 24px;width:100%;margin-bottom:24px;">
        <tr><td>
          <p style="margin:0 0 6px;font-size:12px;font-weight:600;color:#065f46;text-transform:uppercase;letter-spacing:0.5px;">Matched Role</p>
          <p style="margin:0 0 16px;font-size:18px;font-weight:700;color:#0f172a;">${jobTitle}</p>
          <p style="margin:0 0 6px;font-size:12px;font-weight:600;color:#065f46;text-transform:uppercase;letter-spacing:0.5px;">Details</p>
          <p style="margin:0;font-size:14px;color:#334155;line-height:1.7;white-space:pre-wrap;">${jobDescription}</p>
          ${jobId ? `<p style="margin:12px 0 0;font-size:12px;color:#94a3b8;">Job ID: ${jobId}</p>` : ''}
        </td></tr>
      </table>
      <p style="margin:0;font-size:14px;color:#475569;line-height:1.7;">
        Interested? Reply to this email or visit <a href="https://developers.virtuallaunch.pro" style="color:#10b981;text-decoration:none;">developers.virtuallaunch.pro</a> to view and respond to this opportunity.
      </p>
    </td></tr>
  `);

  const text = [
    `Hi ${full_name || 'there'},`,
    '',
    'Based on your skills and preferences, we found a role that looks like a great match for you:',
    '',
    `Matched Role: ${jobTitle}`,
    '',
    `Details:\n${jobDescription}`,
    jobId ? `Job ID: ${jobId}` : '',
    '',
    'Interested? Reply to this email or visit https://developers.virtuallaunch.pro',
    '',
    FOOTER_TXT
  ].filter(l => l !== undefined).join('\n');

  return { subject, html, text };
}

// ── supportTicketReply ────────────────────────────────────────────────────────

export function supportTicketReply({ clientRef, subject: ticketSubject, replyBody }) {
  const subject = `Re: ${ticketSubject} [Ref: ${clientRef}]`;

  const html = wrap(`
    <tr><td style="padding:32px 32px 24px;">
      <p style="margin:0 0 24px;font-size:15px;color:#334155;line-height:1.7;white-space:pre-wrap;">${replyBody}</p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px 20px;width:100%;margin-top:24px;">
        <tr><td>
          <p style="margin:0;font-size:12px;color:#94a3b8;">Support Reference: <strong style="color:#64748b;">${clientRef}</strong></p>
        </td></tr>
      </table>
    </td></tr>
  `);

  const text = [
    replyBody,
    '',
    `---`,
    `Support Reference: ${clientRef}`,
    '',
    FOOTER_TXT
  ].join('\n');

  return { subject, html, text };
}

// ── consentPublishTemplate ────────────────────────────────────────────────────
// Migrated from functions/operator/email.js buildConsentPublish()

export function consentPublishTemplate({ full_name, ref_number }) {
  const subject = 'Your Developer Profile on Virtual Launch Pro';

  const html = wrap(`
    <tr><td style="padding:32px 32px 24px;">
      <p style="margin:0 0 16px;font-size:16px;color:#0f172a;font-weight:600;">Dear ${full_name || 'there'},</p>
      <p style="margin:0 0 16px;font-size:15px;color:#334155;line-height:1.6;">
        To view your postings, go to the link below and enter your reference number <strong>${ref_number}</strong>.
      </p>
      <p style="margin:0 0 16px;"><a href="https://developers.virtuallaunch.pro/support.html" style="color:#10b981;text-decoration:none;">https://developers.virtuallaunch.pro/support.html</a></p>
      <p style="margin:0 0 16px;font-size:15px;color:#334155;line-height:1.6;">
        Thank you for trusting me with providing you with personalized vetted matches.
      </p>
      <p style="margin:0 0 8px;font-size:15px;color:#334155;">Don't forget to leave your review:<br>
        <a href="https://developers.virtuallaunch.pro/reviews.html" style="color:#10b981;text-decoration:none;">https://developers.virtuallaunch.pro/reviews.html</a>
      </p>
      <p style="margin:24px 0 0;font-size:14px;color:#475569;line-height:1.7;">
        Your EA turned professional connector,<br>
        JLW<br>
        Virtual Launch Pro<br>
        developers.virtuallaunch.pro
      </p>
    </td></tr>
  `);

  const text = [
    `Dear ${full_name || 'there'},`,
    '',
    `To view your postings, go to the link below and enter your reference number ${ref_number}.`,
    '',
    'https://developers.virtuallaunch.pro/support.html',
    '',
    'Thank you for trusting me with providing you with personalized vetted matches.',
    '',
    "Don't forget to leave your review:",
    'https://developers.virtuallaunch.pro/reviews.html',
    '',
    'Your EA turned professional connector,',
    'JLW',
    'Virtual Launch Pro',
    'developers.virtuallaunch.pro',
    '',
    FOOTER_TXT
  ].join('\n');

  return { subject, html, text };
}

// ── welcomeAboardTemplate ─────────────────────────────────────────────────────
// Migrated from functions/operator/email.js buildWelcomeAboard()

export function welcomeAboardTemplate({ full_name, ref_number }) {
  const subject = "Welcome Aboard — You're Now Listed on Virtual Launch Pro";

  const html = wrap(`
    <tr><td style="padding:32px 32px 24px;">
      <p style="margin:0 0 16px;font-size:16px;color:#0f172a;font-weight:600;">Dear ${full_name || 'there'},</p>
      <p style="margin:0 0 16px;font-size:15px;color:#334155;line-height:1.6;">
        Congratulations, you have joined a membership that gets you vetted people who want to work with your specific skills. Look out in your email in the next three days for your next lists of client matches. To view your matches, go to the link below and enter your reference number <strong>${ref_number}</strong>.
      </p>
      <p style="margin:0 0 16px;"><a href="https://developers.virtuallaunch.pro/support.html" style="color:#10b981;text-decoration:none;">https://developers.virtuallaunch.pro/support.html</a></p>
      <p style="margin:0 0 16px;font-size:15px;color:#334155;line-height:1.6;">
        Thank you for trusting me with providing you with personalized vetted matches.
      </p>
      <p style="margin:0 0 8px;font-size:15px;color:#334155;">Don't forget to leave your review:<br>
        <a href="https://developers.virtuallaunch.pro/reviews.html" style="color:#10b981;text-decoration:none;">https://developers.virtuallaunch.pro/reviews.html</a>
      </p>
      <p style="margin:16px 0 0;font-size:15px;color:#334155;">Let's get you matched.</p>
      <p style="margin:24px 0 0;font-size:14px;color:#475569;line-height:1.7;">
        Your EA turned professional connector,<br>
        JLW<br>
        Virtual Launch Pro<br>
        developers.virtuallaunch.pro
      </p>
    </td></tr>
  `);

  const text = [
    `Dear ${full_name || 'there'},`,
    '',
    `Congratulations, you have joined a membership that gets you vetted people who want to work with your specific skills. Look out in your email in the next three days for your next lists of client matches. To view your matches, go to the link below and enter your reference number ${ref_number}.`,
    '',
    'https://developers.virtuallaunch.pro/support.html',
    '',
    'Thank you for trusting me with providing you with personalized vetted matches.',
    '',
    "Don't forget to leave your review:",
    'https://developers.virtuallaunch.pro/reviews.html',
    '',
    "Let's get you matched.",
    '',
    'Your EA turned professional connector,',
    'JLW',
    'Virtual Launch Pro',
    'developers.virtuallaunch.pro',
    '',
    FOOTER_TXT
  ].join('\n');

  return { subject, html, text };
}

// ── clientMatchTemplate ───────────────────────────────────────────────────────
// Migrated from functions/operator/email.js buildClientMatch()

export function clientMatchTemplate({ full_name, ref_number, job }) {
  const subject = 'New Client Matches Found for You';

  const jobSection = job ? (() => {
    const skills = Array.isArray(job.required_skills) ? job.required_skills.join(', ') : (job.required_skills || '');
    return `
      <table role="presentation" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px 20px;width:100%;margin-top:16px;">
        <tr><td>
          <p style="margin:0 0 6px;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;">Job Title</p>
          <p style="margin:0 0 12px;font-size:15px;font-weight:600;color:#0f172a;">${job.job_title || ''}</p>
          <p style="margin:0 0 6px;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;">Description</p>
          <p style="margin:0 0 12px;font-size:14px;color:#334155;line-height:1.7;">${job.job_description || ''}</p>
          ${job.hourly_rate_range ? `<p style="margin:0 0 6px;font-size:13px;color:#475569;">Rate: ${job.hourly_rate_range}</p>` : ''}
          ${skills ? `<p style="margin:0 0 6px;font-size:13px;color:#475569;">Skills: ${skills}</p>` : ''}
          ${job.contact_method ? `<p style="margin:0;font-size:13px;color:#475569;">How to Apply: ${job.contact_method}</p>` : ''}
        </td></tr>
      </table>`;
  })() : '';

  const html = wrap(`
    <tr><td style="padding:32px 32px 24px;">
      <p style="margin:0 0 16px;font-size:16px;color:#0f172a;font-weight:600;">Dear ${full_name || 'there'},</p>
      <p style="margin:0 0 16px;font-size:15px;color:#334155;line-height:1.6;">
        We found some client matches who are looking for the exact skills and expertise you offer. To view your matches, go to the link below and enter your reference number <strong>${ref_number}</strong>.
      </p>
      <p style="margin:0 0 16px;"><a href="https://developers.virtuallaunch.pro/support.html" style="color:#10b981;text-decoration:none;">https://developers.virtuallaunch.pro/support.html</a></p>
      ${jobSection}
      <p style="margin:16px 0 0;font-size:15px;color:#334155;line-height:1.6;">
        Thank you for trusting me with personally vetted matches.
      </p>
      <p style="margin:8px 0 8px;font-size:15px;color:#334155;">Don't forget to leave your review:<br>
        <a href="https://developers.virtuallaunch.pro/reviews.html" style="color:#10b981;text-decoration:none;">https://developers.virtuallaunch.pro/reviews.html</a>
      </p>
      <p style="margin:16px 0 0;font-size:15px;color:#334155;">Let's get you matched.</p>
      <p style="margin:24px 0 0;font-size:14px;color:#475569;line-height:1.7;">
        Your EA turned professional connector,<br>
        JLW<br>
        Virtual Launch Pro<br>
        developers.virtuallaunch.pro
      </p>
    </td></tr>
  `);

  const jobTextSection = job ? (() => {
    const skills = Array.isArray(job.required_skills) ? job.required_skills.join(', ') : (job.required_skills || '');
    return [
      '',
      '---',
      `Job Title: ${job.job_title || ''}`,
      `Description: ${job.job_description || ''}`,
      `Rate Range: ${job.hourly_rate_range || ''}`,
      `Skills Required: ${skills}`,
      `How to Apply: ${job.contact_method || ''}`
    ].join('\n');
  })() : '';

  const text = [
    `Dear ${full_name || 'there'},`,
    '',
    `We found some client matches who are looking for the exact skills and expertise you offer. To view your matches, go to the link below and enter your reference number ${ref_number}.`,
    '',
    'https://developers.virtuallaunch.pro/support.html',
    '',
    'Thank you for trusting me with personally vetted matches.',
    '',
    "Don't forget to leave your review:",
    'https://developers.virtuallaunch.pro/reviews.html',
    '',
    "Let's get you matched.",
    '',
    'Your EA turned professional connector,',
    'JLW',
    'Virtual Launch Pro',
    'developers.virtuallaunch.pro',
    jobTextSection,
    '',
    FOOTER_TXT
  ].join('\n');

  return { subject, html, text };
}

// ── bulkEmailTemplate ─────────────────────────────────────────────────────────

export function bulkEmailTemplate({ full_name, subject, body }) {
  const greeting = full_name ? `Hi ${full_name},` : `Hi there,`;

  const html = wrap(`
    <tr><td style="padding:32px 32px 24px;">
      <p style="margin:0 0 20px;font-size:16px;color:#0f172a;font-weight:600;">${greeting}</p>
      <div style="font-size:15px;color:#334155;line-height:1.7;white-space:pre-wrap;">${body}</div>
    </td></tr>
  `);

  const text = [
    greeting,
    '',
    body,
    '',
    FOOTER_TXT
  ].join('\n');

  return { subject, html, text };
}
