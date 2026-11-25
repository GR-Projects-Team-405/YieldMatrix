/**
 * Pure client-side PDF 1.4 generator for YieldMatrix Forward Contracts.
 * Zero external dependencies. Generates a valid standard PDF document and triggers download.
 */
export function downloadAgreementPdf(commitment: any) {
  const ref = commitment.reference || 'COM-1042';
  const hash = commitment.contractHash || '#YM-8820-CC';
  const buyer = commitment.specs?.buyerName || 'Demo Buyer';
  const supplier = commitment.specs?.supplierName || 'Highland Harvest';
  const batch = commitment.specs?.plannedFieldBatch || 'Fresh Salad Tomatoes (Grade A)';
  const kg = commitment.specs?.expectedKg ? commitment.specs.expectedKg.toLocaleString() : '1,000';
  const price = commitment.specs?.agreedPricePerKgCents
    ? (commitment.specs.agreedPricePerKgCents / 100).toFixed(2)
    : '184.25';
  const total = commitment.specs?.expectedTotalCents
    ? (commitment.specs.expectedTotalCents / 100).toLocaleString()
    : '184,250';
  const windowStr = commitment.specs?.targetHarvestWindow || '12 Nov - 14 Nov 2026';
  const hub = commitment.logistics?.receivingHub || 'Colombo Central Hub - Intake Dock 04';
  const gatePass = commitment.logistics?.gatePass || '#GP-8832';
  const dateStr = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const lines = [
    'YIELDMATRIX PRODUCE FORWARD CONTRACT AGREEMENT',
    '========================================================================',
    '',
    `Contract Reference:      ${ref}`,
    `Cryptographic Hash:      ${hash}`,
    `Date of Execution:       ${dateStr}`,
    `Status:                  ${(commitment.status || 'ACCEPTED').toUpperCase()}`,
    '',
    '1. CONTRACT PARTIES:',
    `   Buyer:                ${buyer} (Colombo Hub Workspace)`,
    `   Producer / Supplier:  ${supplier}`,
    '',
    '2. PRODUCE & PRICING SPECIFICATIONS:',
    `   Field Batch:          ${batch}`,
    `   Committed Volume:     ${kg} kg net volume`,
    `   Agreed Unit Price:    LKR ${price} / kg`,
    `   Total Contract Value: LKR ${total} (Smart Escrow Held)`,
    '',
    '3. FULFILMENT & LOGISTICS:',
    `   Target Harvest Window:${windowStr}`,
    `   Receiving Hub:        ${hub}`,
    `   Digital Gate Pass:    ${gatePass}`,
    '',
    '4. MANDATORY PROTOCOLS (SRS v1.0):',
    '   - Domain Rule DR-01: Forward commitment reserves forward harvest batch.',
    '     Stock allocation to active orders occurs strictly upon hub intake scan.',
    '   - Domain Rule DR-02: Pre-harvest changes require explicit buyer acceptance.',
    '   - Escrow Settlement: Auto-settles to farmer Agri Wallet on QA warehouse scan.',
    '',
    '========================================================================',
    'Digitally verified and executed on the YieldMatrix Agricultural Ledger.',
  ];

  // Build PDF 1.4 text content stream
  let stream = 'BT\n/F1 10 Tf\n15 TL\n45 760 Td\n';
  lines.forEach((line) => {
    const escaped = line
      .replace(/\\/g, '\\\\')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)');

    if (line.startsWith('YIELDMATRIX') || line.startsWith('1.') || line.startsWith('2.') || line.startsWith('3.') || line.startsWith('4.')) {
      stream += `/F1 11 Tf (${escaped}) Tj T* /F1 10 Tf\n`;
    } else {
      stream += `(${escaped}) Tj T*\n`;
    }
  });
  stream += 'ET';

  const streamLen = stream.length;

  const pdfParts = [
    '%PDF-1.4\n',
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n',
    `4 0 obj\n<< /Length ${streamLen} >>\nstream\n${stream}\nendstream\nendobj\n`,
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
  ];

  let offset = 0;
  const offsets: number[] = [];
  let body = '';
  for (const part of pdfParts) {
    offsets.push(offset);
    body += part;
    offset += part.length;
  }

  const xrefOffset = offset;
  let xref = 'xref\n0 6\n0000000000 65535 f \n';
  for (let i = 1; i <= 5; i++) {
    xref += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }

  const trailer = `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  const pdfString = body + xref + trailer;

  // Convert to downloadable Blob
  const blob = new Blob([pdfString], { type: 'application/pdf' });
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = `YieldMatrix-Contract-${ref}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
}
