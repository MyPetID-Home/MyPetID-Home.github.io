import crypto from 'crypto';
import tls from 'tls';

export const verificationSender = process.env.MYPETID_VERIFICATION_FROM || process.env.MYPETID_SMTP_USER || 'mypetid@yahoo.com';

export function makeVerificationCode() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
}

export function hashVerificationCode(profileId: string, email: string, code: string) {
  const secret = process.env.MYPETID_EMAIL_VERIFICATION_SECRET || process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error('Email verification secret is not configured.');
  return crypto.createHmac('sha256', secret).update(`${profileId}:${email.toLowerCase()}:${code}`).digest('hex');
}

function smtpConfig() {
  const host = process.env.MYPETID_SMTP_HOST || 'smtp.mail.yahoo.com';
  const port = Number(process.env.MYPETID_SMTP_PORT || 465);
  const user = process.env.MYPETID_SMTP_USER || process.env.MYPETID_YAHOO_EMAIL || 'mypetid@yahoo.com';
  const pass = process.env.MYPETID_SMTP_PASSWORD || process.env.MYPETID_YAHOO_APP_PASSWORD;
  if (!host || !port || !user || !pass) throw new Error('Email provider is not configured yet. Add Yahoo SMTP app-password env for mypetid@yahoo.com.');
  return { host, port, user, pass };
}

function readLine(socket: tls.TLSSocket, timeoutMs = 12000) {
  return new Promise<string>((resolve, reject) => {
    let buffer = '';
    const timer = setTimeout(() => cleanup(new Error('SMTP timeout.')), timeoutMs);
    function cleanup(error?: Error) {
      clearTimeout(timer);
      socket.off('data', onData);
      socket.off('error', onError);
      if (error) reject(error); else resolve(buffer);
    }
    function onError(error: Error) { cleanup(error); }
    function onData(chunk: Buffer) {
      buffer += chunk.toString('utf8');
      const lines = buffer.split(/\r?\n/).filter(Boolean);
      const last = lines.at(-1) || '';
      if (/^\d{3} /.test(last)) cleanup();
    }
    socket.on('data', onData);
    socket.on('error', onError);
  });
}

async function smtpCommand(socket: tls.TLSSocket, command: string, expected: number[]) {
  socket.write(command + '\r\n');
  const response = await readLine(socket);
  const code = Number(response.slice(0, 3));
  if (!expected.includes(code)) throw new Error(`SMTP ${code || 'error'} while sending mail.`);
  return response;
}

function htmlEscape(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] || char));
}

export async function sendEmail(to: string, subject: string, text: string, html: string) {
  const config = smtpConfig();
  const boundary = `mypetid-${crypto.randomUUID()}`;
  const message = [
    `From: MyPetID <${verificationSender}>`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=utf-8',
    '',
    text,
    `--${boundary}`,
    'Content-Type: text/html; charset=utf-8',
    '',
    html,
    `--${boundary}--`,
    '',
  ].join('\r\n').replace(/\r?\n\./g, '\r\n..');

  const socket = tls.connect({ host: config.host, port: config.port, servername: config.host });
  await new Promise<void>((resolve, reject) => {
    socket.once('secureConnect', () => resolve());
    socket.once('error', reject);
  });
  try {
    await readLine(socket);
    await smtpCommand(socket, 'EHLO mypetid.app', [250]);
    await smtpCommand(socket, 'AUTH LOGIN', [334]);
    await smtpCommand(socket, Buffer.from(config.user).toString('base64'), [334]);
    await smtpCommand(socket, Buffer.from(config.pass).toString('base64'), [235]);
    await smtpCommand(socket, `MAIL FROM:<${verificationSender}>`, [250]);
    await smtpCommand(socket, `RCPT TO:<${to}>`, [250, 251]);
    await smtpCommand(socket, 'DATA', [354]);
    await smtpCommand(socket, message + '\r\n.', [250]);
    await smtpCommand(socket, 'QUIT', [221]);
  } finally {
    socket.end();
  }
}

export async function sendVerificationEmail(to: string, code: string) {
  const subject = 'Your MyPetID verification code';
  const text = `Your MyPetID verification code is ${code}. It expires in 15 minutes. If you did not request this code, you can ignore this email.`;
  const html = `<p>Your MyPetID verification code is:</p><p style="font-size:28px;font-weight:800;letter-spacing:6px">${htmlEscape(code)}</p><p>This code expires in 15 minutes. If you did not request this code, you can ignore this email.</p>`;
  await sendEmail(to, subject, text, html);
}

export async function sendCouponEmail(to: string, code: string, tier: string, durationDays?: number | null) {
  const title = `${tier[0]?.toUpperCase() || ''}${tier.slice(1)} MyPetID access`;
  const duration = durationDays ? `${durationDays} day${durationDays === 1 ? '' : 's'}` : 'ongoing admin-granted';
  const subject = `Your MyPetID ${title} code`;
  const text = `Your MyPetID ${title} coupon code is ${code}. It unlocks ${duration} access. Sign up or sign in at https://mypetid.vercel.app/dashboard/account/ and redeem it from Account access.`;
  const html = `<p>Your MyPetID ${htmlEscape(title)} coupon code is:</p><p style="font-size:28px;font-weight:800;letter-spacing:4px">${htmlEscape(code)}</p><p>It unlocks ${htmlEscape(duration)} access.</p><p>Sign up or sign in at <a href="https://mypetid.vercel.app/dashboard/account/">MyPetID Account</a>, then redeem the code from Account access.</p>`;
  await sendEmail(to, subject, text, html);
}
