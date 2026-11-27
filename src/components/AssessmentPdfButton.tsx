'use client';

import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';

export interface AssessmentPdfData {
  procedureName: string;
  diagnosis?: string | null;
  cptCode?: string | null;
  assessmentDate?: string | null;
  hospitalName?: string | null;
  hospitalCity?: string | null;
  status?: string | null;
  usQuotedCost: number | null;
  indiaHospitalPackage: number | null;
  travelCost: number | null;
  totalIndiaTripCost: number | null;
  netSavings: number | null;
  savingsPercentage?: number | null;
  travelBreakdown?: {
    flightsCost?: number | null;
    hotelNights?: number | null;
    hotelCost?: number | null;
    visasAndLogistics?: number | null;
  } | null;
  notes?: string | null;
}

interface Props {
  assessment: AssessmentPdfData;
  className?: string;
}

function formatCurrency(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'Not available';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string | null | undefined) {
  if (!value) return new Date().toLocaleDateString('en-US');
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-US');
}

export default function AssessmentPdfButton({ assessment, className }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDownload = async () => {
    setLoading(true);
    setError(null);

    try {
      const { jsPDF } = await import('jspdf');
      const pdf = new jsPDF();
      const margin = 18;
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const contentWidth = pageWidth - margin * 2;
      const lineHeight = 6;
      let y = margin;

      const ensureSpace = (height: number) => {
        if (y + height > pageHeight - margin) {
          pdf.addPage();
          y = margin;
        }
      };

      const addText = (text: string, fontSize = 10, bold = false) => {
        pdf.setFont('helvetica', bold ? 'bold' : 'normal');
        pdf.setFontSize(fontSize);
        const lines = pdf.splitTextToSize(text, contentWidth);

        for (const line of lines) {
          ensureSpace(lineHeight);
          pdf.text(line, margin, y);
          y += lineHeight;
        }
      };

      const addSection = (heading: string) => {
        y += 4;
        ensureSpace(12);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(12);
        pdf.text(heading, margin, y);
        y += 8;
      };

      addText('Cross-Border Surgical & Savings Assessment', 18, true);
      y += 2;
      addText(`Prepared: ${formatDate(assessment.assessmentDate)}`, 9);
      y += 2;
      addText(
        'Planning estimate only. This document is not a medical diagnosis, treatment recommendation, or confirmed hospital quote.',
        9
      );

      addSection('Procedure Summary');
      addText(`Procedure: ${assessment.procedureName || 'Not specified'}`);
      addText(`Diagnosis: ${assessment.diagnosis || 'Not specified'}`);
      if (assessment.cptCode) addText(`CPT code: ${assessment.cptCode}`);
      if (assessment.hospitalName) {
        addText(`Selected hospital: ${assessment.hospitalName}${assessment.hospitalCity ? `, ${assessment.hospitalCity}` : ''}`);
      }
      if (assessment.status) addText(`Inquiry status: ${assessment.status.replace(/_/g, ' ')}`);

      addSection('Estimated Costs (USD)');
      addText(`US estimate: ${formatCurrency(assessment.usQuotedCost)}`);
      addText(`India hospital package: ${formatCurrency(assessment.indiaHospitalPackage)}`);
      addText(`Travel and logistics: ${formatCurrency(assessment.travelCost)}`);
      addText(`Estimated total India trip: ${formatCurrency(assessment.totalIndiaTripCost)}`);
      addText(`Estimated net savings: ${formatCurrency(assessment.netSavings)}`);
      if (assessment.savingsPercentage !== null && assessment.savingsPercentage !== undefined) {
        addText(`Estimated savings compared with US estimate: ${assessment.savingsPercentage}%`);
      }

      if (assessment.travelBreakdown) {
        addSection('Travel Cost Breakdown');
        const { flightsCost, hotelNights, hotelCost, visasAndLogistics } = assessment.travelBreakdown;
        if (flightsCost !== null && flightsCost !== undefined) {
          addText(`Flights: ${formatCurrency(flightsCost)}`);
        }
        if (hotelNights !== null && hotelNights !== undefined) {
          addText(`Hotel recuperation stay: ${hotelNights} nights`);
        }
        if (hotelCost !== null && hotelCost !== undefined) {
          addText(`Hotel estimate: ${formatCurrency(hotelCost)}`);
        }
        if (visasAndLogistics !== null && visasAndLogistics !== undefined) {
          addText(`Visas and local logistics: ${formatCurrency(visasAndLogistics)}`);
        }
      }

      if (assessment.notes) {
        addSection('Preliminary Feedback');
        addText(assessment.notes);
      }

      y += 4;
      addText(
        'All figures are estimates based on the submitted information and available benchmarks. Confirm current pricing, travel costs, eligibility, and clinical plans directly with qualified professionals and the hospital.',
        9
      );

      const pageCount = pdf.getNumberOfPages();
      for (let page = 1; page <= pageCount; page += 1) {
        pdf.setPage(page);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8);
        pdf.text(`Page ${page} of ${pageCount}`, pageWidth - margin, pageHeight - 8, { align: 'right' });
      }

      const procedureSlug = assessment.procedureName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'assessment';
      pdf.save(`cross-border-assessment-${procedureSlug}.pdf`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to create the PDF assessment.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleDownload}
        disabled={loading}
        className={className ?? 'inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50'}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        {loading ? 'Preparing PDF...' : 'Download PDF Assessment'}
      </button>
      {error && <p className="text-xs text-red-700" role="alert">{error}</p>}
    </div>
  );
}
