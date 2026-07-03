import { NextResponse } from 'next/server';
import {
  clamp,
  normalizeLeadPhone,
  parseBookingPrice,
  parseLeadUtm,
  updateCampLead,
  type CampLeadQualification,
  type ChildDocumentType,
  type PaymentType,
  type PreferredContactTime,
  type QualificationFlow,
  type QualificationStep,
  type ShiftDecision,
  type TransferNeed,
} from '@/lib/bitrix-camp-lead';
import {
  getVlasevoLeadById,
  updateVlasevoLeadQualification,
} from '@/lib/vlasevo-lead-store';

export const dynamic = 'force-dynamic';

function parseStep(value: unknown): QualificationStep | null {
  return ['contacts', 'intent', 'payment', 'documents', 'transfer', 'questions'].includes(String(value))
    ? (String(value) as QualificationStep)
    : null;
}

function parseFlow(value: unknown): QualificationFlow | null {
  return value === 'ready' || value === 'questions' ? value : null;
}

function parseShiftDecision(value: unknown): ShiftDecision | undefined {
  return value === 'yes' || value === 'no' || value === 'changes'
    ? (value as ShiftDecision)
    : undefined;
}

function parsePaymentType(value: unknown): PaymentType | undefined {
  return value === 'certificate' || value === 'self' ? (value as PaymentType) : undefined;
}

function parseChildDocumentType(value: unknown): ChildDocumentType | undefined {
  return value === 'birth_certificate' || value === 'passport'
    ? (value as ChildDocumentType)
    : undefined;
}

function parseTransferNeed(value: unknown): TransferNeed | undefined {
  return value === 'yes' || value === 'no' ? (value as TransferNeed) : undefined;
}

function parsePreferredContactTime(value: unknown): PreferredContactTime | undefined {
  return value === 'morning' || value === 'day' || value === 'evening'
    ? (value as PreferredContactTime)
    : undefined;
}

function parseDocument(raw: unknown) {
  if (!raw || typeof raw !== 'object') return undefined;
  const source = raw as Record<string, unknown>;
  const document = {
    seriesNumber: clamp(source.seriesNumber, 80),
    issueDate: clamp(source.issueDate, 40),
    issuer: clamp(source.issuer, 200),
    departmentCode: clamp(source.departmentCode, 20),
  };
  if (!document.seriesNumber && !document.issueDate && !document.issuer && !document.departmentCode) {
    return undefined;
  }
  return document;
}

function mergeCompletedSteps(current: QualificationStep[] | undefined, nextStep: QualificationStep) {
  return Array.from(new Set([...(current ?? []), nextStep]));
}

function calculateReadinessPercent(qualification: CampLeadQualification): number {
  if (qualification.flow === 'questions') return 15;
  let score = 25;
  if (qualification.applicantFullName && qualification.contactPhone && qualification.email) score += 15;
  if (qualification.shiftDecision) score += 15;
  if (qualification.paymentType) score += 10;
  if (qualification.childFullName && qualification.childBirthDate) score += 15;
  if (qualification.transferNeeded) score += 10;
  const applicantPassport = qualification.applicantPassport;
  const childDocument = qualification.childDocument;
  if (applicantPassport?.seriesNumber && childDocument?.seriesNumber) score += 10;
  return Math.max(0, Math.min(100, score));
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ leadId: string }> }
) {
  const { leadId } = await params;
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'bad_json' }, { status: 400 });
  }

  const step = parseStep(body.step);
  if (!step) {
    return NextResponse.json({ ok: false, error: 'invalid_step' }, { status: 400 });
  }

  const flow = parseFlow(body.flow);
  if (!flow) {
    return NextResponse.json({ ok: false, error: 'invalid_flow' }, { status: 400 });
  }

  const lead = await getVlasevoLeadById(leadId);
  if (!lead) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
  }

  const currentQualification = lead.qualification ?? {};
  const qualificationPatch: CampLeadQualification = {
    flow,
    currentStep: step,
    updatedAt: new Date().toISOString(),
    completedSteps: mergeCompletedSteps(currentQualification.completedSteps, step),
  };

  if (flow === 'questions') {
    qualificationPatch.status = 'questions';
    qualificationPatch.consultationQuestion = clamp(body.consultationQuestion, 1000);
    qualificationPatch.preferredContactTime = parsePreferredContactTime(body.preferredContactTime);
  } else {
    if (step === 'contacts') {
      qualificationPatch.status = 'in_progress';
      qualificationPatch.applicantFullName = clamp(body.applicantFullName, 150);
      qualificationPatch.contactPhone =
        typeof body.contactPhone === 'string' ? normalizeLeadPhone(body.contactPhone) ?? clamp(body.contactPhone, 30) : undefined;
      qualificationPatch.email = clamp(body.email, 120);
    }
    if (step === 'intent') {
      qualificationPatch.shiftDecision = parseShiftDecision(body.shiftDecision);
      qualificationPatch.shiftChangeRequest = clamp(body.shiftChangeRequest, 500);
    }
    if (step === 'payment') {
      qualificationPatch.paymentType = parsePaymentType(body.paymentType);
    }
    if (step === 'documents') {
      qualificationPatch.childFullName = clamp(body.childFullName, 150);
      qualificationPatch.childBirthDate = clamp(body.childBirthDate, 20);
      qualificationPatch.childDocumentType = parseChildDocumentType(body.childDocumentType);
      qualificationPatch.applicantPassport = parseDocument(body.applicantPassport);
      qualificationPatch.childDocument = parseDocument(body.childDocument);
    }
    if (step === 'transfer') {
      qualificationPatch.transferNeeded = parseTransferNeed(body.transferNeeded);
      qualificationPatch.transferAddress = clamp(body.transferAddress, 300);
      qualificationPatch.transferTrafficData = clamp(body.transferTrafficData, 500);
    }
  }

  const nextQualification: CampLeadQualification = {
    ...currentQualification,
    ...qualificationPatch,
    applicantPassport: {
      ...(currentQualification.applicantPassport ?? {}),
      ...(qualificationPatch.applicantPassport ?? {}),
    },
    childDocument: {
      ...(currentQualification.childDocument ?? {}),
      ...(qualificationPatch.childDocument ?? {}),
    },
  };

  const readinessPercent = calculateReadinessPercent(nextQualification);
  nextQualification.readinessPercent = readinessPercent;
  if (flow === 'ready') {
    nextQualification.status = step === 'transfer' ? 'completed' : 'in_progress';
  }

  const updatedLead = await updateVlasevoLeadQualification(leadId, { qualification: nextQualification });
  if (!updatedLead) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
  }

  if (updatedLead.bitrixDealId) {
    try {
      await updateCampLead({
        logPrefix: 'vlasevo-lead-enrich',
        dealId: updatedLead.bitrixDealId,
        landing: updatedLead.landing,
        name: updatedLead.name,
        phone: updatedLead.phone,
        shift: updatedLead.shift,
        bookingPrice: parseBookingPrice(updatedLead.bookingPrice),
        source: updatedLead.source,
        utm: parseLeadUtm(updatedLead.utm),
        qualification: updatedLead.qualification,
      });
    } catch (error) {
      console.error('vlasevo-lead-enrich: failed to sync Bitrix', error);
    }
  }

  return NextResponse.json({
    ok: true,
    leadId: updatedLead.id,
    qualification: updatedLead.qualification,
    bitrixUpdated: Boolean(updatedLead.bitrixDealId),
  });
}
