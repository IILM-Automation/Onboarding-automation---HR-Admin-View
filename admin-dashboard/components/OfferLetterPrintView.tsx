"use client";

import type { OfferLetter } from "@/lib/client";
import { fmtDate } from "@/lib/format";

/**
 * The printed offer letter. Hidden on screen; revealed by the print
 * stylesheet when body[data-print="offer"].
 *
 * Page 1 is the letter, page 2 the salary annexure — split by an explicit
 * page break rather than left to chance, because this is a document that
 * goes to a candidate.
 *
 * Every figure comes from the server's frozen `breakdown` snapshot, never
 * recomputed here: the letter must render identically forever, including
 * after the salary structure is retuned.
 */

function inr(n: number): string {
  return "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

export default function OfferLetterPrintView({ offer }: { offer: OfferLetter | null }) {
  if (!offer) return null;
  const b = offer.breakdown;

  return (
    <div className="offer-print-root">
      {/* ---------------- Page 1 — the letter ---------------- */}
      <section className="ol-page">
        <header className="ol-head">
          <div className="ol-school">Banyan Tree School</div>
          <div className="ol-addr">
            {(offer.school_address || "").split("\n").map((line, i) => (
              <div key={i}>{line}</div>
            ))}
          </div>
        </header>

        <div className="ol-meta">
          <span>
            Ref: <strong>{offer.reference_no}</strong>
          </span>
          <span>Date: {fmtDate(offer.created_at) || "—"}</span>
        </div>

        <h1 className="ol-title">Letter of Appointment</h1>

        <p className="ol-to">
          <strong>{offer.candidate_name}</strong>
        </p>

        <p>Dear {offer.candidate_name},</p>

        <p>
          With reference to your application and the subsequent interview, we are pleased to
          offer you the position of <strong>{offer.designation}</strong>
          {offer.employment_type ? ` on a ${offer.employment_type.toLowerCase()} basis` : ""} at
          Banyan Tree School
          {offer.campus ? `, ${offer.campus}` : ""}.
        </p>

        <p>
          Your date of joining will be{" "}
          <strong>{offer.date_of_joining ? fmtDate(offer.date_of_joining) : "____________"}</strong>.
          Your total cost to company will be{" "}
          <strong>{inr(b.ctc_annual)} per annum</strong> ({inr(b.ctc_monthly)} per month). A
          detailed break-up of your compensation is set out in the annexure overleaf, which forms
          part of this letter.
        </p>

        <p>
          This appointment is subject to verification of the documents and references furnished by
          you. You will be governed by the rules, regulations and policies of the School as
          applicable from time to time and as amended.
        </p>

        <p>
          We request you to sign and return a copy of this letter as a token of your acceptance of
          the terms stated herein.
        </p>

        <p>We look forward to welcoming you to the Banyan Tree School family.</p>

        <div className="ol-signatures">
          <div className="ol-sig">
            <div className="ol-sig-line" />
            <div className="ol-sig-name">Director</div>
            <div className="ol-sig-sub">Banyan Tree School</div>
          </div>
          <div className="ol-sig">
            <div className="ol-sig-line" />
            <div className="ol-sig-name">Accepted by {offer.candidate_name}</div>
            <div className="ol-sig-sub">Signature &amp; Date</div>
          </div>
        </div>
      </section>

      {/* ---------------- Page 2 — salary annexure ---------------- */}
      <section className="ol-page ol-page-2">
        <div className="ol-meta">
          <span>
            Ref: <strong>{offer.reference_no}</strong>
          </span>
          <span>{offer.candidate_name}</span>
        </div>

        <h2 className="ol-title ol-title-2">Annexure — Compensation Break-up</h2>

        <table className="ol-table">
          <thead>
            <tr>
              <th>Component</th>
              <th className="ol-num">Per Annum</th>
              <th className="ol-num">Per Month</th>
            </tr>
          </thead>
          <tbody>
            {b.components.map((c) => (
              <tr key={c.label}>
                <td>{c.label}</td>
                <td className="ol-num">{inr(c.annual)}</td>
                <td className="ol-num">{inr(c.monthly)}</td>
              </tr>
            ))}
            <tr className="ol-subtotal">
              <td>Gross Salary (A)</td>
              <td className="ol-num">{inr(b.gross_annual)}</td>
              <td className="ol-num">{inr(b.gross_monthly)}</td>
            </tr>
            {b.retirals.map((r) => (
              <tr key={r.label}>
                <td>{r.label}</td>
                <td className="ol-num">{inr(r.annual)}</td>
                <td className="ol-num">{inr(r.monthly)}</td>
              </tr>
            ))}
            <tr className="ol-total">
              <td>Total Cost to Company (A + B)</td>
              <td className="ol-num">{inr(b.ctc_annual)}</td>
              <td className="ol-num">{inr(b.ctc_monthly)}</td>
            </tr>
          </tbody>
        </table>

        <p className="ol-foot-note">
          All figures are in Indian Rupees and are annual unless stated otherwise. Statutory
          deductions, including the employee&apos;s own provident fund contribution and applicable
          income tax, will be made from the gross salary as required by law. Gratuity is payable
          subject to the Payment of Gratuity Act, 1972.
        </p>

        <div className="ol-signatures">
          <div className="ol-sig">
            <div className="ol-sig-line" />
            <div className="ol-sig-name">Director</div>
            <div className="ol-sig-sub">Banyan Tree School</div>
          </div>
        </div>
      </section>
    </div>
  );
}
