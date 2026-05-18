/**
 * BACS Standard 18–style ACH credit file (single processing day, 100-byte records + 6 blank processing slots).
 * Standard credit + contra layout follows common UK banking MIG patterns (e.g. HSBC Standard 18 MIG).
 * Headers are best-effort 80-character records; validate with your bank / Modulr before live use.
 * @see https://knowledge.modulrfinance.com/knowledge-hub/formatting-a-payment-file
 */

function pad80(line: string): string {
  return line.padEnd(80, ' ').slice(0, 80)
}

/** bYYDDD — blank + 2-digit year + day-of-year (001–366). */
export function bacsProcessingDate(d: Date): string {
  const y = d.getFullYear()
  const start = new Date(y, 0, 1)
  const dayOfYear = Math.floor((d.getTime() - start.getTime()) / 86400000) + 1
  const yy = String(y % 100).padStart(2, '0')
  const ddd = String(dayOfYear).padStart(3, '0')
  return ` ${yy}${ddd}`
}

function digitsOnly(s: string, len: number): string {
  const d = s.replace(/\D/g, '')
  return d.padStart(len, '0').slice(-len)
}

function alnumSerial(s: string): string {
  const t = s.toUpperCase().replace(/[^A-Z0-9]/g, '')
  return (t.length >= 6 ? t.slice(-6) : t.padStart(6, 'X')).slice(0, 6)
}

/** BACS subset of permitted characters; uppercase and trim. */
export function bacsSanitize(text: string, maxLen: number): string {
  const u = text.toUpperCase()
  let out = ''
  for (const ch of u) {
    if (/[A-Z0-9\-/:().,'+=%!#&*<>;{}@? ]/.test(ch)) out += ch
    if (out.length >= maxLen) break
  }
  return out.padEnd(maxLen, ' ').slice(0, maxLen)
}

/** 106-char standard credit (tx 99). */
export function standardCreditLine(params: {
  beneficiarySortCode: string
  beneficiaryAccountNumber: string
  originatorSortCode: string
  originatorAccountNumber: string
  amountPence: number
  originatorName: string
  paymentReference: string
  beneficiaryName: string
}): string {
  const destSort = digitsOnly(params.beneficiarySortCode, 6)
  const destAcc = digitsOnly(params.beneficiaryAccountNumber, 8)
  const origSort = digitsOnly(params.originatorSortCode, 6)
  const origAcc = digitsOnly(params.originatorAccountNumber, 8)
  const amt = String(Math.max(0, Math.floor(params.amountPence))).padStart(11, '0').slice(-11)
  const line =
    destSort +
    destAcc +
    '0' +
    '99' +
    origSort +
    origAcc +
    '    ' +
    amt +
    bacsSanitize(params.originatorName, 18) +
    bacsSanitize(params.paymentReference, 18) +
    bacsSanitize(params.beneficiaryName, 18) +
    '      '
  if (line.length !== 106) throw new Error(`Standard record length ${line.length}, expected 106`)
  return line
}

/** 106-char contra debit (tx 17). */
export function contraLine(params: {
  originatorSortCode: string
  originatorAccountNumber: string
  totalPence: number
  originatorName: string
  debitReference?: string
}): string {
  const sort = digitsOnly(params.originatorSortCode, 6)
  const acc = digitsOnly(params.originatorAccountNumber, 8)
  const amt = String(Math.max(0, Math.floor(params.totalPence))).padStart(11, '0').slice(-11)
  const ref = bacsSanitize(params.debitReference ?? 'BACS PAYMENTS', 18)
  const contraId = 'CONTRA'.padEnd(18, ' ')
  const accName = bacsSanitize(params.originatorName, 18)
  const line = sort + acc + '0' + '17' + sort + acc + '    ' + amt + ref + contraId + accName + '      '
  if (line.length !== 106) throw new Error(`Contra record length ${line.length}, expected 106`)
  return line
}

export interface BacsOriginator {
  /** Bacs service user number (6 digits). */
  sun: string
  originatorSortCode: string
  originatorAccountNumber: string
  /** Legal name of debiting account (max 18 in payment lines; longer names truncated per line). */
  originatorName: string
}

export interface BacsPaymentInput {
  beneficiarySortCode: string
  beneficiaryAccountNumber: string
  beneficiaryName: string
  /** Shown on beneficiary statement / ISO reference (max 18). */
  paymentReference: string
  amountPence: number
}

function utl1Line(debitCount: number, creditCount: number, debitPence: number, creditPence: number): string {
  const debitTotal = String(debitPence).padStart(13, '0').slice(-13)
  const creditTotal = String(creditPence).padStart(13, '0').slice(-13)
  const debits = String(debitCount).padStart(7, '0').slice(-7)
  const credits = String(creditCount).padStart(7, '0').slice(-7)
  return pad80(`UTL1${debitTotal}${creditTotal}${debits}${credits}${' '.repeat(10)}${' '.repeat(26)}`)
}

export interface BuildBacsFileOptions {
  originator: BacsOriginator
  payments: BacsPaymentInput[]
  /** When set, used for header dates; defaults to now. */
  processingDate?: Date
  /** 3-digit file sequence, default from time. */
  fileNumber?: string
}

/**
 * Builds a CRLF-separated BACS-style ACH credit file (VOL/HDR/UHL + credits + contra + EOF + UTL).
 * Payment lines use UK domestic sort code / 8-digit account layout (Standard 18 payment record).
 */
export function buildAchCreditBacsFile(options: BuildBacsFileOptions): string {
  const { originator, payments } = options
  if (payments.length === 0) throw new Error('No payments')

  const now = options.processingDate ?? new Date()
  const proc = bacsProcessingDate(now)
  const create = proc
  const expire = bacsProcessingDate(new Date(now.getTime() + 86400000 * 14))
  const serial = alnumSerial(String(Date.now() % 1e9))
  const sun = digitsOnly(originator.sun, 6)
  const fNum = (options.fileNumber ?? String((Date.now() % 900) + 100)).padStart(3, '0').slice(-3)

  const vol = pad80(`VOL1${serial}  ${sun} 1${' '.repeat(63)}`)
  const hdr1 = pad80(`HDR1A${sun}S ${serial}00010001${create}${expire} 000000`)
  const hdr2 = pad80('HDR2F0200000106 00' + ' '.repeat(58))
  const uhlCore = `UHL1${proc}9999999999 000000001 DAILY ${fNum}`
  const uhl1 = pad80(uhlCore)

  const creditLines: string[] = []
  let creditPence = 0
  for (const p of payments) {
    const pence = Math.floor(p.amountPence)
    creditPence += pence
    creditLines.push(
      standardCreditLine({
        beneficiarySortCode: p.beneficiarySortCode,
        beneficiaryAccountNumber: p.beneficiaryAccountNumber,
        originatorSortCode: originator.originatorSortCode,
        originatorAccountNumber: originator.originatorAccountNumber,
        amountPence: pence,
        originatorName: originator.originatorName,
        paymentReference: p.paymentReference,
        beneficiaryName: p.beneficiaryName,
      }),
    )
  }

  const contra = contraLine({
    originatorSortCode: originator.originatorSortCode,
    originatorAccountNumber: originator.originatorAccountNumber,
    totalPence: creditPence,
    originatorName: originator.originatorName,
  })

  const debitCount = 1
  const creditCount = payments.length
  const eof1 = pad80(`EOF${hdr1.slice(3)}`)
  const eof2 = pad80(`EOF${hdr2.slice(3)}`)

  const parts = [vol, hdr1, hdr2, uhl1, ...creditLines, contra, eof1, eof2, utl1Line(debitCount, creditCount, creditPence, creditPence)]

  return parts.map((l) => l.replace(/\r?\n/g, '')).join('\r\n') + '\r\n'
}
