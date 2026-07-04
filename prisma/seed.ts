/**
 * Rathinam MyDayOne — Database Seed
 *
 * Creates:
 *  - RTC & RGU institutions
 *  - Super admin account
 *  - First batch: RTC · B.E./B.Tech 2024-25
 *  - 4 form templates seeded from Document A & B:
 *      1. Registration Form
 *      2. General Student Code of Conduct
 *      3. General Placement Undertaking
 *      4. R-Smart Intellect Deliverables Table
 *  - BatchFormAssignment linking all 4 to the batch
 *  - One test student (username: TEST001 / password: Test@1234)
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱  Seeding Rathinam MyDayOne…");

  // ── Institutions ──────────────────────────────────────────────────────────
  const rtc = await prisma.institution.upsert({
    where: { code: "RTC" },
    update: {},
    create: {
      code: "RTC",
      name: "RTC",
      fullName: "Rathinam Technical Campus",
      primaryColor: "#4E9A2F",
      accentColor: "#2E9BD6",
      address: "Eachanari, Coimbatore – 641 021, Tamil Nadu",
      website: "https://rathinam.in",
    },
  });

  const rgu = await prisma.institution.upsert({
    where: { code: "RGU" },
    update: {},
    create: {
      code: "RGU",
      name: "RGU",
      fullName: "Rathinam Global Deemed to be University",
      primaryColor: "#4E9A2F",
      accentColor: "#2E9BD6",
      address: "Eachanari, Coimbatore – 641 021, Tamil Nadu",
      website: "https://rathinam.in",
    },
  });

  console.log(`  ✓ Institutions: ${rtc.code}, ${rgu.code}`);

  // ── Super Admin ───────────────────────────────────────────────────────────
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@rathinam.in";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "Admin@1234";
  const adminHash = await bcrypt.hash(adminPassword, 12);

  const superAdmin = await prisma.admin.upsert({
    where: { email: adminEmail },
    // Re-apply the password/role on reseed so the super-admin credentials stay
    // in sync with this seed (or SEED_ADMIN_PASSWORD) even if the row exists.
    update: {
      passwordHash: adminHash,
      role: "SUPER_ADMIN",
      isActive: true,
    },
    create: {
      name: "Super Admin",
      email: adminEmail,
      passwordHash: adminHash,
      role: "SUPER_ADMIN",
      institutionId: rtc.id,
    },
  });

  console.log(`  ✓ Admin: ${adminEmail}`);

  // ── Batch ─────────────────────────────────────────────────────────────────
  const batch = await prisma.batch.upsert({
    where: {
      // Workaround: composite unique not in schema, find-or-create manually
      id: "batch-rtc-be-2024",
    },
    update: {},
    create: {
      id: "batch-rtc-be-2024",
      institutionId: rtc.id,
      name: "RTC B.E./B.Tech 2024–25",
      course: "B.E. / B.Tech",
      department: "All Engineering Departments",
      academicYear: "2024-25",
      isActive: true,
    },
  });

  console.log(`  ✓ Batch: ${batch.name}`);

  // ── Form Template 1 — Registration Form ───────────────────────────────────
  const registrationTemplate = await prisma.formTemplate.upsert({
    where: { id: "tpl-registration-rtc" },
    update: {},
    create: {
      id: "tpl-registration-rtc",
      name: "Student Registration Form",
      description: "Personal and family details for first-year induction",
      type: "REGISTRATION",
      signatoryRoles: [
        { role: "student", label: "Signature of the Student" },
        { role: "parent", label: "Signature of the Parent" },
      ],
      schema: {
        fields: [
          {
            id: "student_name",
            label: "Name of the Student",
            type: "text",
            required: true,
            hint: "As per Aadhaar card",
            characterBoxed: true,
          },
          {
            id: "gender",
            label: "Gender",
            type: "radio",
            required: true,
            options: ["Male", "Female", "Other"],
          },
          {
            id: "course",
            label: "Course",
            type: "text",
            required: true,
            hint: "Auto-filled from your batch — edit if your branch differs",
          },
          {
            id: "aadhaar_number",
            label: "Aadhaar Card Number",
            type: "text",
            required: true,
            inputMode: "numeric",
            maxLength: 12,
            pattern: "^[0-9]{12}$",
            sensitive: true,
            hint: "12-digit Aadhaar number",
          },
          { id: "section_father", type: "section_header", label: "Father's Details" },
          {
            id: "father_name",
            label: "Father's Name",
            type: "text",
            required: true,
          },
          {
            id: "father_mobile",
            label: "Father's Mobile Number",
            type: "tel",
            required: true,
            inputMode: "numeric",
            pattern: "^[6-9][0-9]{9}$",
          },
          {
            id: "father_occupation",
            label: "Father's Occupation",
            type: "text",
            required: true,
          },
          {
            id: "father_income",
            label: "Father's Annual Income (₹)",
            type: "text",
            required: true,
            inputMode: "numeric",
            hint: "Annual income in Indian Rupees",
          },
          { id: "section_mother", type: "section_header", label: "Mother's Details" },
          {
            id: "mother_name",
            label: "Mother's Name",
            type: "text",
            required: true,
          },
          {
            id: "mother_mobile",
            label: "Mother's Mobile Number",
            type: "tel",
            required: true,
            inputMode: "numeric",
            pattern: "^[6-9][0-9]{9}$",
          },
          {
            id: "mother_occupation",
            label: "Mother's Occupation",
            type: "text",
            required: true,
          },
          {
            id: "mother_income",
            label: "Mother's Annual Income (₹)",
            type: "text",
            required: true,
            inputMode: "numeric",
            hint: "Annual income in Indian Rupees",
          },
          { id: "section_stay", type: "section_header", label: "Stay Details" },
          {
            id: "accommodation",
            label: "Accommodation",
            type: "radio",
            required: true,
            options: ["Hostel", "Day Scholar"],
          },
          {
            id: "transport_required",
            label: "College Transport Required?",
            type: "checkbox",
            required: false,
          },
          {
            id: "boarding_point",
            label: "Boarding Point",
            type: "text",
            required: false,
            showWhen: { field: "transport_required", value: true },
            hint: "Your nearest bus boarding point",
          },
          {
            id: "place",
            label: "Place",
            type: "text",
            required: true,
          },
          {
            id: "date",
            label: "Date",
            type: "date",
            required: true,
            defaultToday: true,
          },
        ],
        declaration:
          "I hereby declare that the information furnished above is true, complete, and correct to the best of my knowledge and belief. I understand that in the event of any information being found false or incorrect at any point of time, disciplinary action as deemed fit may be taken against me.",
      },
    },
  });

  // ── Form Template 2 — Code of Conduct ────────────────────────────────────
  const conductTemplate = await prisma.formTemplate.upsert({
    where: { id: "tpl-conduct-rtc" },
    update: {},
    create: {
      id: "tpl-conduct-rtc",
      name: "General Student Code of Conduct",
      description: "Rules and responsibilities all students must acknowledge",
      type: "ACKNOWLEDGMENT",
      signatoryRoles: [
        { role: "student", label: "Signature of the Student" },
        { role: "parent", label: "Signature of the Parent / Guardian" },
      ],
      schema: {
        clauses: [
          "Students must wear the college uniform on all working days and appear neat and clean at all times while on campus.",
          "Students must carry their college ID card and produce it on demand by any staff member or security personnel.",
          "Students must be punctual and maintain at least 75% attendance in each subject to be eligible for examination.",
          "Students must treat all teaching and non-teaching staff with respect. Rudeness, insubordination, or disrespectful language or behaviour will be treated as a serious disciplinary offence.",
          "Ragging in any form — physical, verbal, psychological, or online — is strictly prohibited and will result in immediate expulsion in accordance with UGC Anti-Ragging Regulations.",
          "Use of mobile phones is not permitted inside classrooms, laboratories, or library. Phones must be kept on silent mode on campus and may be used only in designated areas during break time.",
          "Students must not damage, deface, or misuse college property. Any damage caused must be compensated in full.",
          "Consumption of alcohol, tobacco, or any narcotic substance on campus or arriving on campus under the influence of any such substance is strictly prohibited.",
          "Students must not engage in any form of political activity, canvassing, or disturbance of any kind within the campus.",
          "Students are required to participate in all co-curricular and extracurricular activities as directed by the college administration.",
          "Improper use of social media to post, share, or circulate material defamatory to the institution, faculty, or fellow students is a punishable offence.",
          "Students must adhere to the examination code of conduct, including the prohibition of unfair means. Any instance of malpractice will be dealt with as per university regulations.",
          "Permission of the HOD / Principal is mandatory before leaving campus during working hours. Absence without sanctioned leave will be treated as unauthorised absence.",
          "Students are expected to maintain decorum in the library, maintain silence, and follow all library rules.",
          "Any grievance should be raised through the designated grievance redressal mechanism and not through public agitation or media.",
          "The college reserves the right to amend these rules as needed. Students are bound by any amendments communicated through official notice boards or the college communication system.",
        ],
        acknowledgmentText:
          "I have read, understood, and agree to abide by the above Code of Conduct. I acknowledge that violation of any of the above rules may result in disciplinary action, including suspension or expulsion.",
        place: { id: "place", label: "Place", required: true },
        date: { id: "date", label: "Date", required: true, defaultToday: true },
      },
    },
  });

  // ── Form Template 3 — Placement Undertaking ───────────────────────────────
  const placementTemplate = await prisma.formTemplate.upsert({
    where: { id: "tpl-placement-rtc" },
    update: {},
    create: {
      id: "tpl-placement-rtc",
      name: "General Placement Undertaking",
      description:
        "Commitment to placement-readiness activities and CRS obligations",
      type: "ACKNOWLEDGMENT",
      signatoryRoles: [
        { role: "student", label: "Signature of the Student" },
        { role: "parent", label: "Signature of the Parent / Guardian" },
      ],
      schema: {
        clauses: [
          "I will actively participate in all placement training programmes, mock interviews, aptitude sessions, and skill development workshops organised by the Training & Placement Cell.",
          "I understand that my Career Readiness Score (CRS) — assessed through RAALE (Rathinam Assessment of Applied Learning and Employability) — directly impacts my placement eligibility and will reflect my readiness across aptitude, communication, technical, and behavioural competencies.",
          "I will maintain the minimum CRS threshold as communicated by the institution from time to time. Failure to do so may result in restrictions on sitting for campus recruitment drives.",
          "I will attend all Pre-Placement Talks (PPTs), company presentations, and Group Discussions / Technical / HR interviews when scheduled. Non-attendance without prior approved leave will be treated as a placement discipline violation.",
          "I will not approach any company independently for placement purposes that has been engaged through the Placement Cell for campus recruitment, without prior written permission from the Placement Cell.",
          "I will update my resume, portfolio, and profile on the college placement portal as and when directed by the Placement Cell.",
          "I understand that once I accept a job offer from a company visiting campus, I cannot sit for any further campus drives unless specifically permitted by the Placement Cell. I will accept an offer in good faith and not renege.",
          "I will dress in appropriate formal or business-casual attire for all placement-related interactions, including assessments, interviews, and company visits.",
          "I will maintain confidentiality about the content of company assessments and interviews until officially communicated, and will not share question papers, assessment material, or insider information with other students.",
          "I will not misrepresent my CGPA, skills, project experience, or any other credentials in my resume or during any stage of the recruitment process.",
          "I understand that disciplinary action arising from placement misconduct may be shared with prospective employers if required and may impact my offer letters.",
          "I will comply with all offer-letter terms, background verification requirements, and joining-date obligations communicated by the recruiting company.",
          "I acknowledge that the institution provides placement support as a service and does not guarantee employment. The quality and number of job offers depends on my individual performance and market conditions.",
          "I agree that my parent / guardian is fully aware of these undertakings and jointly endorses this commitment with me.",
        ],
        guaranteeDeclaration:
          "I, the parent / guardian, acknowledge that I have read and understood the above undertaking along with my ward. I agree to support and encourage my ward in fulfilling all the above placement-readiness obligations and understand the consequences of non-compliance.",
        acknowledgmentText:
          "I hereby declare that I have read and understood all of the above clauses and undertake to abide by them in letter and spirit throughout my tenure as a student of this institution.",
        place: { id: "place", label: "Place", required: true },
        date: { id: "date", label: "Date", required: true, defaultToday: true },
      },
    },
  });

  // ── Form Template 4 — R-Smart Intellect Deliverables Table ───────────────
  const deliverablesTemplate = await prisma.formTemplate.upsert({
    where: { id: "tpl-deliverables-rtc-be" },
    update: {},
    create: {
      id: "tpl-deliverables-rtc-be",
      name: "R-Smart Intellect Deliverables — B.E./B.Tech",
      description:
        "Programme deliverables and fee structure acknowledgment table",
      type: "DELIVERABLES_TABLE",
      signatoryRoles: [
        { role: "student", label: "Signature of the Student" },
        {
          role: "authorized_signatory",
          label: "Signature of Authorised Signatory",
        },
      ],
      schema: {
        programmeHeader: {
          label: "Programme",
          value: "R-Smart Engineering Intellect",
        },
        rows: [
          {
            id: "row-sscp",
            sno: 1,
            deliverable: "SSCP\n(Smart Student Career Programme)",
            keyPoints:
              "• Career readiness training integrated across all 4 years\n• Aptitude, communication, soft skills, and technical skill modules\n• RAALE-based assessment and CRS tracking\n• Industry mentorship and mock interview sessions\n• Access to Growth Card for real-time progress tracking",
          },
          {
            id: "row-siip",
            sno: 2,
            deliverable: "SIIP\n(Student Industrial Immersion Programme)",
            keyPoints:
              "• Mandatory industrial internship / immersion (minimum 30 days)\n• Industry-assigned live project or shop-floor exposure\n• Travel, food & accommodation to be borne by the student\n• Internship completion is mandatory for programme certification\n• Evaluated via structured report and presentation",
          },
          {
            id: "row-fep",
            sno: 3,
            deliverable: "FEP\n(Field Experience Programme)",
            keyPoints:
              "• Hands-on field experience in relevant engineering / technology domain\n• Conducted at industry partner sites or approved institutions\n• Travel, food & accommodation to be borne by the student\n• Minimum 15 days of structured on-site exposure\n• Graded component contributing to CRS",
          },
          {
            id: "row-olt",
            sno: 4,
            deliverable: "OLT\n(Online Learning Track)",
            keyPoints:
              "• Curated online courses on platforms such as NPTEL, Coursera, LinkedIn Learning\n• Minimum credit hours per semester as defined by the institution\n• Completion certificates to be submitted for credit recognition\n• Covers technical electives, soft skills, and professional development",
          },
          {
            id: "row-gip",
            sno: 5,
            deliverable: "GIP\n(Global Immersion Programme)",
            keyPoints:
              "• International exposure programme (optional but strongly encouraged)\n• Destination and duration as announced each academic year\n• Programme fee covers academic components and visa documentation\n• International flight charges are EXTRA and borne by the student\n• Participation subject to institutional selection criteria and student CRS\n• Hike-dependent — programme execution subject to sufficient enrolment",
          },
          {
            id: "row-hlh",
            sno: 6,
            deliverable: "Hybrid Learning Hub",
            keyPoints:
              "• Access to the institution's blended learning infrastructure\n• Combination of in-person labs, virtual labs, and remote access tools\n• Includes STEM kits, simulation software licenses, and maker-space access\n• 24×7 LMS (Learning Management System) access\n• Integrated with RAALE for skill gap identification and personalised pathways",
          },
          {
            id: "row-ms-workgroup",
            sno: 7,
            deliverable: "MS Workgroup",
            keyPoints:
              "• Microsoft 365 Education suite for all enrolled students\n• Includes Teams, SharePoint, OneDrive (1TB), Word, Excel, PowerPoint\n• Collaborative project workspace throughout the programme\n• Microsoft Learn access for certification preparation\n• Azure student credits for cloud project work",
          },
          {
            id: "row-laptop",
            sno: 8,
            deliverable: "Laptop Provision",
            keyPoints:
              "• Institution-facilitated laptop procurement support\n• EMI schemes and vendor tie-ups available for affordable access\n• Minimum specifications defined by the department\n• Students are required to bring a functioning laptop from Semester 1\n• Laptop is the student's personal property and responsibility",
          },
          {
            id: "row-attire",
            sno: 9,
            deliverable: "Attire Package",
            keyPoints:
              "• Institution-branded uniform and formal attire set\n• Provided at the start of the programme (included in programme fee)\n• Comprises: formal shirts (3), formal trousers (2), college T-shirt (2), ID card lanyard\n• Additional sets can be purchased at cost from the institution store\n• Wearing uniform is mandatory on all working days",
          },
          {
            id: "row-fee-exclusions",
            sno: 10,
            deliverable: "Fee Exclusions\n(NOT included in programme fee)",
            keyPoints:
              "The following are NOT covered by the programme fee and will be billed separately if applicable:\n• Arrear examination fees\n• Semester re-registration fees for detained students\n• Event fees (cultural fests, technical symposia, etc.)\n• GIP international flight charges\n• SIIP / FEP travel, food & accommodation\n• Additional uniform sets beyond the standard package\n• Library fine / damage charges\n• Any government-mandated fee revisions",
          },
          {
            id: "row-coding",
            sno: 11,
            deliverable: "Coding Assessment Access",
            keyPoints:
              "• Access to the institution's proctored online coding assessment platform\n• Regular coding contests and leaderboard rankings\n• HackerRank / CodeChef / LeetCode integration for practice\n• Coding scores feed into CRS under technical competency\n• Department-level coding bootcamps held every semester",
          },
          {
            id: "row-skill-passport",
            sno: 12,
            deliverable: "Skill Passport",
            keyPoints:
              "• Digital credential record linked to the student's profile\n• Logs all certifications, internships, projects, and achievements\n• Shared with recruiters during placement with student consent\n• Contributes to RAALE-based CRS and Growth Card\n• Maintained and verified by the institution throughout the programme",
          },
        ],
        declaration:
          "I, the undersigned student (and parent / guardian where applicable), hereby acknowledge that I have read, understood, and individually accepted each of the programme deliverables listed above. I understand the scope, inclusions, exclusions, and obligations associated with each deliverable. I confirm that I have been given the opportunity to seek clarification on any item and am satisfied with the explanations provided. This acknowledgment is binding and forms part of my induction record.",
        place: { id: "place", label: "Place", required: true },
        date: { id: "date", label: "Date", required: true, defaultToday: true },
      },
    },
  });

  // ── Form Template 5 — Document Upload ────────────────────────────────────
  const documentTemplate = await prisma.formTemplate.upsert({
    where: { id: "tpl-documents-rtc" },
    update: {},
    create: {
      id: "tpl-documents-rtc",
      name: "Document Upload",
      description: "Upload all required documents for verification",
      type: "DOCUMENT_UPLOAD",
      signatoryRoles: [],
      schema: {
        documents: [
          {
            id: "photo",
            type: "photo",
            label: "Passport-size Photograph",
            required: true,
            accept: "image/jpeg,image/png",
            maxSizeMB: 2,
            hint: "Recent passport-size photo with white background (JPG/PNG, max 2 MB)",
          },
          {
            id: "10th_marksheet",
            type: "10th_marksheet",
            label: "10th Standard Mark Sheet",
            required: true,
            accept: "image/jpeg,image/png,application/pdf",
            maxSizeMB: 5,
            hint: "Upload a clear scan or photo of your 10th mark sheet (PDF or image, max 5 MB)",
          },
          {
            id: "12th_marksheet",
            type: "12th_marksheet",
            label: "12th Standard Mark Sheet",
            required: true,
            accept: "image/jpeg,image/png,application/pdf",
            maxSizeMB: 5,
            hint: "Upload a clear scan or photo of your 12th mark sheet (PDF or image, max 5 MB)",
          },
          {
            id: "aadhaar",
            type: "aadhaar",
            label: "Aadhaar Card",
            required: true,
            accept: "image/jpeg,image/png,application/pdf",
            maxSizeMB: 3,
            hint: "Front and back of Aadhaar card. If two pages, combine into one PDF (max 3 MB)",
          },
        ],
      },
    },
  });

  console.log(`  ✓ Form templates: 5 created`);

  // ── BatchFormAssignments ──────────────────────────────────────────────────
  const assignments = [
    {
      id: "bfa-reg",
      batchId: batch.id,
      formTemplateId: registrationTemplate.id,
      order: 1,
      stepSlug: "registration",
      required: true,
    },
    {
      id: "bfa-conduct",
      batchId: batch.id,
      formTemplateId: conductTemplate.id,
      order: 2,
      stepSlug: "code-of-conduct",
      required: true,
    },
    {
      id: "bfa-placement",
      batchId: batch.id,
      formTemplateId: placementTemplate.id,
      order: 3,
      stepSlug: "placement-undertaking",
      required: true,
    },
    {
      id: "bfa-deliverables",
      batchId: batch.id,
      formTemplateId: deliverablesTemplate.id,
      order: 4,
      stepSlug: "deliverables",
      required: true,
    },
    {
      id: "bfa-documents",
      batchId: batch.id,
      formTemplateId: documentTemplate.id,
      order: 5,
      stepSlug: "documents",
      required: true,
    },
  ];

  for (const a of assignments) {
    await prisma.batchFormAssignment.upsert({
      where: { id: a.id },
      update: {},
      create: a,
    });
  }

  console.log(`  ✓ Batch form assignments: ${assignments.length}`);

  // ── Sample Template Batch ─────────────────────────────────────────────────
  // A reusable "sample" every admin can see and duplicate. Owned by the super
  // admin; only they can edit the template itself.
  const sampleBatch = await prisma.batch.upsert({
    where: { id: "batch-sample-template" },
    update: {
      isTemplate: true,
      createdById: superAdmin.id,
    },
    create: {
      id: "batch-sample-template",
      institutionId: rtc.id,
      name: "Sample Induction Batch (Template)",
      course: "B.E. / B.Tech",
      department: "All Departments",
      academicYear: "2025-26",
      isActive: true,
      isTemplate: true,
      createdById: superAdmin.id,
    },
  });

  const sampleAssignments = [
    { id: "bfa-sample-reg",          formTemplateId: registrationTemplate.id, order: 1, stepSlug: "registration" },
    { id: "bfa-sample-conduct",      formTemplateId: conductTemplate.id,      order: 2, stepSlug: "code-of-conduct" },
    { id: "bfa-sample-placement",    formTemplateId: placementTemplate.id,    order: 3, stepSlug: "placement-undertaking" },
    { id: "bfa-sample-deliverables", formTemplateId: deliverablesTemplate.id, order: 4, stepSlug: "deliverables" },
    { id: "bfa-sample-documents",    formTemplateId: documentTemplate.id,     order: 5, stepSlug: "documents" },
  ];

  for (const a of sampleAssignments) {
    await prisma.batchFormAssignment.upsert({
      where: { id: a.id },
      update: {},
      create: { ...a, batchId: sampleBatch.id, required: true },
    });
  }

  console.log(`  ✓ Sample template batch: ${sampleBatch.name} (${sampleAssignments.length} steps)`);

  // ── Test Student ──────────────────────────────────────────────────────────
  const studentPasswordHash = await bcrypt.hash("Test@1234", 12);
  await prisma.student.upsert({
    where: { regNo: "TEST001" },
    update: {},
    create: {
      batchId: batch.id,
      regNo: "TEST001",
      name: "Arjun Kumar",
      email: "arjun.kumar@example.com",
      mobile: "9876543210",
      username: "TEST001",
      passwordHash: studentPasswordHash,
      mustResetPassword: false, // allow direct test login
      status: "NOT_STARTED",
      completionPct: 0,
    },
  });

  console.log(`  ✓ Test student: TEST001 / Test@1234`);
  console.log("\n✅  Seed complete.");
  console.log(`\n   Admin login:   ${adminEmail} / ${adminPassword}`);
  console.log("   Student login: TEST001 / Test@1234");
}

main()
  .catch((e) => {
    console.error("❌  Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
