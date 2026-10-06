"use client";

import { useEffect, useState } from "react";
import {
  createOfferLetter,
  fetchOfferDefaults,
  type OfferDefaults,
  type OfferLetter,
} from "@/lib/client";
import { fmtDate } from "@/lib/format";
import { useToast } from "./Toast";

/**
 * Offer-letter form. SUPER-ADMIN ONLY — the backend enforces that and
 * re-checks the candidate's status, so this modal is the convenient path,
 * not the gate.
 *
 * Fields are prefilled from the candidate's record (designation and joining
 * date from the interview notes, CTC from the confidential salary block) and
 * remain editable: the record is what was agreed, the letter is what is being
 * sent, and those are not always identical.
 */

function inr(n: number): string {
  return "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

export default function OfferLetterModal({
  appId,
  onClose,
  onGenerated,
}: {
  appId: number;
  onClose: () => void;
  /** Hands the issued letter up so the print view can render it. */
  onGenerated: (offer: OfferLetter) => void;
}) {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [defaults, setDefaults] = useState<OfferDefaults | null>(null);

  const [name, setName] = useState("");
  const [designation, setDesignation] = useState("");
  const [employmentType, setEmploymentType] = useState("");
  const [ctc, setCtc] = useState("");
  const [doj, setDoj] = useState("");
  const [address, setAddress] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetchOfferDefaults(appId)
      .then((d) => {
        if (cancelled) return;
        setDefaults(d);
        setName(d.candidate_name || "");
        setDesignation(d.designation || "");
        setEmploymentType(d.employment_type || "");
        setCtc(d.ctc_annual != null ? String(d.ctc_annual) : "");
        setDoj(d.date_of_joining || "");
        setAddress(d.school_address || "");
      })
      .catch((e) => {
        if (!cancelled) toast((e as Error).message || "Failed to load defaults", "error");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [appId, toast]);

  // Preview only. The authoritative figures come back from the server on
  // generate and are what actually get printed and stored.
  const ctcNum = Number(ctc.replace(/[^\d.]/g, "")) || 0;
  const preview =
    ctcNum > 0
      ? (() => {
          const basic = ctcNum * 0.5;
          const hra = basic * 0.4;
          const conveyance = 19200;
          const pf = basic * 0.12;
          const gratuity = basic * 0.0481;
          const special = ctcNum - (basic + hra + conveyance + pf + gratuity);
          return { basic, hra, conveyance, pf, gratuity, special };
        })()
      : null;

  async function generate() {
    if (busy) return;
    if (!name.trim()) return toast("Candidate name is required.", "error");
    if (!designation.trim()) return toast("Designation is required.", "error");
    if (!(ctcNum > 0)) return toast("Enter a valid annual CTC.", "error");
    setBusy(true);
    try {
      const offer = await createOfferLetter(appId, {
        candidate_name: name.trim(),
        designation: designation.trim(),
        ctc_annual: ctcNum,
        date_of_joining: doj || undefined,
        employment_type: employmentType || undefined,
        school_address: address || undefined,
      });
      toast(`Offer letter ${offer.reference_no} generated`, "success");
      onGenerated(offer);
    } catch (e) {
      toast((e as Error).message || "Failed to generate offer letter", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card offer-card" onClick={(e) => e.stopPropagation()}>
        <div className="section-title">Create offer letter</div>

        {loading ? (
          <div className="spinner-wrap">
            <div className="spinner" />
          </div>
        ) : !defaults ? (
          <p className="modal-sub">Could not load candidate details.</p>
        ) : !defaults.eligible ? (
          <p className="offer-blocked">
            This candidate&apos;s status is <strong>{defaults.status}</strong>. An offer letter can
            only be issued once they are marked <strong>Active File</strong> or{" "}
            <strong>Appointed</strong>.
          </p>
        ) : (
          <>
            {defaults.existing.length > 0 && (
              <div className="offer-existing">
                <strong>Already issued:</strong>
                {defaults.existing.map((o) => (
                  <div key={o.id}>
                    {o.reference_no} · {o.designation} · {fmtDate(o.created_at)}
                  </div>
                ))}
                <div className="offer-existing-note">
                  Generating again will issue a new letter with a new reference number.
                </div>
              </div>
            )}

            <div className="offer-grid">
              <div className="salary-field offer-wide">
                <label>Candidate name</label>
                <input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="salary-field">
                <label>Designation offered</label>
                <input value={designation} onChange={(e) => setDesignation(e.target.value)} />
              </div>
              <div className="salary-field">
                <label>Employment type</label>
                <select
                  value={employmentType}
                  onChange={(e) => setEmploymentType(e.target.value)}
                >
                  <option value="">—</option>
                  <option value="Full Time">Full Time</option>
                  <option value="Part Time">Part Time</option>
                </select>
              </div>
              <div className="salary-field">
                <label>Annual CTC (₹)</label>
                <input
                  inputMode="numeric"
                  value={ctc}
                  placeholder="600000"
                  onChange={(e) => setCtc(e.target.value)}
                />
              </div>
              <div className="salary-field">
                <label>Date of joining</label>
                <input type="date" value={doj} onChange={(e) => setDoj(e.target.value)} />
              </div>
              <div className="salary-field offer-wide">
                <label>
                  School address{" "}
                  <span className="offer-hint">(prefilled from {defaults.campus || "campus"})</span>
                </label>
                <textarea rows={3} value={address} onChange={(e) => setAddress(e.target.value)} />
              </div>
            </div>

            {preview && (
              <div className="offer-preview">
                <div className="offer-preview-head">Break-up preview (annual)</div>
                <div className="offer-preview-grid">
                  <span>Basic</span>
                  <span>{inr(preview.basic)}</span>
                  <span>HRA</span>
                  <span>{inr(preview.hra)}</span>
                  <span>Conveyance</span>
                  <span>{inr(preview.conveyance)}</span>
                  <span>Special Allowance</span>
                  <span>
                    {preview.special < 0 ? (
                      <em className="offer-neg">CTC too low</em>
                    ) : (
                      inr(preview.special)
                    )}
                  </span>
                  <span>Employer PF</span>
                  <span>{inr(preview.pf)}</span>
                  <span>Gratuity</span>
                  <span>{inr(preview.gratuity)}</span>
                </div>
              </div>
            )}
          </>
        )}

        <div className="modal-foot">
          <button className="btn-outline" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            className="btn-accent"
            onClick={generate}
            disabled={busy || loading || !defaults?.eligible}
          >
            {busy ? "Generating…" : "Generate offer letter"}
          </button>
        </div>
      </div>
    </div>
  );
}
