/** Application data model — mirrors the bts_applications table. */

export type Org = "BTS" | "IILM";

export type Status =
  | "submitted"
  | "under_review"
  | "interviewed"
  | "rejected"
  | "active_file"
  | "appointed";

/** Lightweight row returned by GET /applications (list view). */
export interface AppListItem {
  id: number;
  email?: string | null;
  position_applied_for?: string | null;
  org?: Org | null;
  status?: Status | null;
  salutation?: string | null;
  first_name?: string | null;
  middle_name?: string | null;
  surname?: string | null;
  has_photo?: boolean;
  created_at?: string | null;
}

export interface FamilyMember {
  name?: string;
  age?: string;
  relationship?: string;
  occupation_place?: string;
}
export interface Education {
  exam?: string;
  subjects?: string;
  year_passing?: string;
  institution?: string;
  division?: string;
  percentage?: string;
}
export interface Membership {
  name?: string;
  type?: string;
  from_year?: string;
  to_year?: string;
}
export interface Training {
  name?: string;
  institution?: string;
  from_year?: string;
  to_year?: string;
}
export interface Employment {
  type?: "present" | "previous" | "prior";
  employer_name?: string;
  employer_address?: string;
  nature_business?: string;
  period_from?: string;
  period_to?: string;
  duration?: string;
  position_start?: string;
  position_last?: string;
  job_location?: string;
  supervisor?: string;
  salary_basic?: string;
  salary_allowances?: string;
  salary_total?: string;
  job_description?: string;
  reason_leaving?: string;
}
export interface Extracurricular {
  activity?: string;
  institution?: string;
  year?: string;
  position?: string;
  prizes?: string;
}
export interface Reference {
  name?: string;
  designation_org?: string;
  address_contact?: string;
  when_refer?: string;
}
export interface PrevInterview {
  interviewer?: string;
  date?: string;
  position?: string;
  location?: string;
}

/** Full record returned by GET /applications/{id}. */
export interface AppDetail extends AppListItem {
  date_of_birth?: string | null;
  age?: number | null;
  sex?: string | null;
  religion?: string | null;
  native_city_state?: string | null;
  languages_known?: string | null;
  mobile?: string | null;
  present_address?: string | null;
  permanent_address?: string | null;
  photo_base64?: string | null;

  family_members?: FamilyMember[];
  education?: Education[];
  memberships?: Membership[];
  trainings?: Training[];
  employment?: Employment[];
  extracurricular?: Extracurricular[];

  height?: string | null;
  weight?: string | null;
  power_of_glasses?: string | null;
  physical_disability?: string | null;
  illness_from?: string | null;
  illness_to?: string | null;
  illness_days?: string | null;
  illness_nature?: string | null;
  chronic_diabetes?: boolean;
  chronic_high_bp?: boolean;
  chronic_heart_disease?: boolean;
  chronic_asthma?: boolean;
  chronic_other?: string | null;

  linkedin_profile?: string | null;
  twitter_profile?: string | null;
  facebook_profile?: string | null;

  noteworthy_contributions?: string | null;
  career_plan_5yr?: string | null;
  important_personal_dev?: string | null;
  important_professional_dev?: string | null;
  role_model?: string | null;

  prev_interviewed_org?: boolean;
  prev_interview_details?: PrevInterview;
  part_time_business?: boolean;
  part_time_business_details?: string | null;
  court_proceedings?: boolean;
  court_proceedings_details?: string | null;
  employer_bond?: boolean;
  employer_bond_details?: string | null;
  notice_period?: string | null;
  earliest_joining?: string | null;
  functional_pref?: string[];
  locational_pref?: string[];
  references_list?: Reference[];
  declaration_agreed?: boolean;
  declaration_place?: string | null;
  declaration_date?: string | null;

  current_salary?: string | null;
  expected_salary?: string | null;
  ctc_offered?: string | null;
  salary_notes?: string | null;
  salary_updated_at?: string | null;
}

export const STATUS_LABELS: Record<Status, string> = {
  submitted: "Submitted",
  under_review: "Under Review",
  interviewed: "Interviewed",
  rejected: "Rejected",
  active_file: "Active File",
  appointed: "Appointed",
};

export const STATUS_ORDER: Status[] = [
  "submitted",
  "under_review",
  "interviewed",
  "rejected",
  "active_file",
  "appointed",
];
