// @ts-check
// data/court-marriage.js — reference data for the court-marriage assistant.
//
// GUIDANCE ONLY. Sambandh does not file with any government office and this is not
// legal advice: requirements and procedure vary by state and district. The workflow
// helps a couple organise documents, track the statutory notice period, and record
// their progress — the actual filing/solemnisation happens with the local Marriage
// Officer. No third party is contacted.

/** Acts a couple can proceed under. */
const ACTS = ['special_marriage', 'hindu_marriage'];

/** Statutory public-notice / objection window (days) before solemnisation.
 * @type {Record<string, number>} */
const NOTICE_PERIOD_DAYS = { special_marriage: 30, hindu_marriage: 0 };

/** Witnesses required at solemnisation. @type {Record<string, number>} */
const WITNESSES_REQUIRED = { special_marriage: 3, hindu_marriage: 2 };

/** Document checklist per act. `perPartner` items are required from BOTH partners;
 * `conditional` items are only needed if applicable (e.g. a prior marriage).
 * @type {Record<string, {key:string,label:string,perPartner:boolean,conditional?:boolean}[]>} */
const REQUIRED_DOCUMENTS = {
  special_marriage: [
    { key: 'application_form', label: 'Signed notice/application form', perPartner: false },
    { key: 'dob_proof', label: 'Date-of-birth proof (birth certificate / passport / class-10 certificate)', perPartner: true },
    { key: 'residence_proof', label: 'Residence proof (Aadhaar / utility bill / passport)', perPartner: true },
    { key: 'id_proof', label: 'Government photo ID', perPartner: true },
    { key: 'passport_photos', label: 'Passport-size photographs', perPartner: true },
    { key: 'affidavit', label: 'Affidavit of marital status, DOB and no prohibited relationship', perPartner: true },
    { key: 'prior_marriage_proof', label: 'Divorce decree / spouse death certificate (if previously married)', perPartner: true, conditional: true }
  ],
  hindu_marriage: [
    { key: 'dob_proof', label: 'Date-of-birth proof (birth certificate / passport / class-10 certificate)', perPartner: true },
    { key: 'residence_proof', label: 'Residence proof (Aadhaar / utility bill / passport)', perPartner: true },
    { key: 'id_proof', label: 'Government photo ID', perPartner: true },
    { key: 'marriage_proof', label: 'Marriage photographs / invitation / priest certificate', perPartner: false },
    { key: 'affidavit', label: 'Joint affidavit of marriage', perPartner: false },
    { key: 'prior_marriage_proof', label: 'Divorce decree / spouse death certificate (if previously married)', perPartner: true, conditional: true }
  ]
};

/** The ordered high-level steps, for the UI to render progress.
 * @type {Record<string, string[]>} */
const STEPS = {
  special_marriage: ['propose', 'accept', 'collect_documents', 'file_notice', 'notice_period', 'solemnise', 'register', 'certificate'],
  hindu_marriage: ['propose', 'accept', 'collect_documents', 'solemnise', 'register', 'certificate']
};

const DISCLAIMER = 'Guidance only — requirements and procedure vary by state and district. Confirm every step with your local Marriage Officer/registrar. Sambandh does not file on your behalf and this is not legal advice.';

const isAct = (/** @type {string} */ a) => ACTS.includes(a);

/** The mandatory (non-conditional) checklist for an act. @param {string} act */
function mandatoryDocs(act) {
  return (REQUIRED_DOCUMENTS[act] || []).filter((d) => !d.conditional);
}

module.exports = {
  ACTS, NOTICE_PERIOD_DAYS, WITNESSES_REQUIRED, REQUIRED_DOCUMENTS, STEPS, DISCLAIMER,
  isAct, mandatoryDocs
};
