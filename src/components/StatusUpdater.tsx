'use client';

import { useState } from 'react';
import { Loader2, Check } from 'lucide-react';

interface Props {
  inquiryId: string;
  currentStatus: string;
  currentNotes: string;
}

export default function StatusUpdater({ inquiryId, currentStatus, currentNotes }: Props) {
  const [status, setStatus] = useState(currentStatus);
  const [notes, setNotes] = useState(currentNotes);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleUpdate = async () => {
    setSaving(true);
    setSaved(false);

    try {
      const res = await fetch('/api/inquiries/update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inquiryId,
          status,
          notes,
        }),
      });

      if (!res.ok) throw new Error('Update failed');
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="pt-2 border-t border-slate-100 flex flex-col md:flex-row gap-3 items-end md:items-center justify-between">
      <div className="flex-1 w-full flex flex-col md:flex-row gap-3">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="text-xs p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-medium"
        >
          <option value="pending_hospital_review">Pending Hospital Review</option>
          <option value="opinion_received">Opinion Received</option>
          <option value="treatment_scheduled">Treatment Scheduled</option>
          <option value="cancelled">Cancelled</option>
        </select>

        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Coordinator / doctor preliminary notes..."
          className="text-xs p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 flex-1"
        />
      </div>

      <button
        onClick={handleUpdate}
        disabled={saving}
        className="px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition shrink-0"
      >
        {saving ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : saved ? (
          <>
            <Check className="w-3.5 h-3.5 text-emerald-400" />
            Updated
          </>
        ) : (
          'Save Status'
        )}
      </button>
    </div>
  );
}