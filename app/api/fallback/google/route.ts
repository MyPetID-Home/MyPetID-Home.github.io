import { NextRequest, NextResponse } from 'next/server';
import { appendFallbackRow, googleFallbackConfigured, googleFallbackMissing, uploadFallbackFile, type GoogleFallbackRecord } from '../../../../lib/google-fallback';

export const dynamic = 'force-dynamic';

function assertWriteAllowed(request: NextRequest) {
  const configuredSecret = process.env.MYPETID_FALLBACK_WRITE_SECRET || process.env.GOOGLE_FALLBACK_WRITE_SECRET || '';
  if (!configuredSecret) return;
  const provided = request.headers.get('x-fallback-secret') || '';
  if (provided !== configuredSecret) throw new Error('Invalid fallback write code.');
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    configured: googleFallbackConfigured(),
    missing: googleFallbackMissing(),
    sheetName: process.env.GOOGLE_FALLBACK_SHEET_NAME || 'OutageQueue',
    writeCodeRequired: Boolean(process.env.MYPETID_FALLBACK_WRITE_SECRET || process.env.GOOGLE_FALLBACK_WRITE_SECRET),
  });
}

export async function POST(request: NextRequest) {
  try {
    assertWriteAllowed(request);
    if (!googleFallbackConfigured()) {
      return NextResponse.json({ error: 'Google fallback is not fully configured.', missing: googleFallbackMissing() }, { status: 503 });
    }
    const body = await request.json() as GoogleFallbackRecord;
    const record: GoogleFallbackRecord = {
      type: String(body.type || 'generic').slice(0, 80),
      actorEmail: body.actorEmail ? String(body.actorEmail).slice(0, 180) : '',
      title: body.title ? String(body.title).slice(0, 180) : '',
      tagCode: body.tagCode ? String(body.tagCode).slice(0, 80).toUpperCase() : '',
      petName: body.petName ? String(body.petName).slice(0, 120) : '',
      payload: body.payload || {},
      file: body.file,
    };
    let driveFile: { id: string; webViewLink?: string } | undefined;
    if (record.file?.base64) driveFile = await uploadFallbackFile(record.file);
    const sheetAppend = await appendFallbackRow(record, driveFile);
    return NextResponse.json({ ok: true, queuedAt: new Date().toISOString(), driveFile, sheetAppend });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Google fallback write failed.' }, { status: 400 });
  }
}
