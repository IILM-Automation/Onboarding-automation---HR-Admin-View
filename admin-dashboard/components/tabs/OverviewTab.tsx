"use client";

import type { AppDetail } from "@/lib/types";
import { fmtDate, fullName, has } from "@/lib/format";
import { Cell, DataTable, KV } from "../ui";

export default function OverviewTab({ app }: { app: AppDetail }) {
  const family = app.family_members || [];
  const education = app.education || [];
  const trainings = app.trainings || [];

  const social: Array<[string, string | null | undefined]> = [
    ["LinkedIn", app.linkedin_profile],
    ["Twitter", app.twitter_profile],
    ["Facebook", app.facebook_profile],
  ];

  return (
    <div>
      <div className="section">
        <div className="section-title">Personal</div>
        <div className="card-box">
          <div className="kv-grid">
            <KV label="Full Name" value={fullName(app)} />
            <KV label="Date of Birth" value={fmtDate(app.date_of_birth)} />
            <KV label="Age" value={app.age ?? ""} />
            <KV label="Sex" value={app.sex} />
            <KV label="Native City & State" value={app.native_city_state} />
            <KV label="Languages Known" value={app.languages_known} />
            <KV label="Mobile" value={app.mobile} />
            <KV label="Email" value={app.email} />
            <KV label="Present Address" value={app.present_address} full />
            <div className="kv full">
              <div className="kv-label">Permanent Address</div>
              <div className={`kv-val${has(app.permanent_address) ? "" : " muted"}`}>
                {has(app.permanent_address) ? app.permanent_address : "Same as present address"}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="section">
        <div className="section-title">Family Members</div>
        <DataTable
          headers={["Name", "Age", "Relationship", "Occupation & Place of Work"]}
          rows={family.map((r) => [
            <Cell key="n" value={r.name} />,
            <Cell key="a" value={r.age} />,
            <Cell key="r" value={r.relationship} />,
            <Cell key="o" value={r.occupation_place} />,
          ])}
        />
      </div>

      <div className="section">
        <div className="section-title">Education</div>
        <DataTable
          headers={["Qualification", "Subjects", "Year", "Institution", "Division", "%/CGPA"]}
          rows={education.map((r) => [
            <Cell key="1" value={r.exam} />,
            <Cell key="2" value={r.subjects} />,
            <Cell key="3" value={r.year_passing} />,
            <Cell key="4" value={r.institution} />,
            <Cell key="5" value={r.division} />,
            <Cell key="6" value={r.percentage} />,
          ])}
        />
      </div>

      <div className="section">
        <div className="section-title">Training</div>
        <DataTable
          headers={["Course", "Institution", "From", "To"]}
          rows={trainings.map((r) => [
            <Cell key="1" value={r.name} />,
            <Cell key="2" value={r.institution} />,
            <Cell key="3" value={r.from_year} />,
            <Cell key="4" value={r.to_year} />,
          ])}
        />
      </div>

      <div className="section">
        <div className="section-title">Social Media</div>
        <div className="card-box">
          <div className="kv-grid">
            {social.map(([label, url]) => (
              <div className="kv" key={label}>
                <div className="kv-label">{label}</div>
                <div className={`kv-val${has(url) ? "" : " muted"}`}>
                  {has(url) ? (
                    <a href={url as string} target="_blank" rel="noopener noreferrer">
                      {url}
                    </a>
                  ) : (
                    "Not provided"
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
