# Post-Mortem Template — Quantum Vorvex

> **Blameless culture reminder:** This document is a learning tool, not a blame tool. Focus on systems, processes, and tooling — not individuals. See `INCIDENT_RESPONSE.md` Section 9 for our post-mortem culture guidelines.
>
> **Instructions:** Copy this file to `docs/post-mortems/INC-YYYY-NNN.md`, fill in every section, and share with the full engineering team within the SLA deadline.

---

## Incident Metadata

| Field                  | Value                                        |
|------------------------|----------------------------------------------|
| **Incident Title**     | *(e.g. "Admin JWT Secret Exposed in Git Commit")* |
| **Incident ID**        | INC-YYYY-NNN                                 |
| **Date**               | YYYY-MM-DD                                   |
| **Incident Start**     | HH:MM UTC                                    |
| **Incident End**       | HH:MM UTC                                    |
| **Total Duration**     | Xh Ym                                        |
| **Severity**           | SEV-1 / SEV-2 / SEV-3 / SEV-4               |
| **On-Call Engineer**   | *(Name)*                                     |
| **Incident Commander** | *(Name)*                                     |
| **Post-Mortem Author** | *(Name)*                                     |
| **Post-Mortem Date**   | YYYY-MM-DD                                   |
| **Status**             | Draft / In Review / Final                    |

---

## Executive Summary

*Write 3-5 sentences suitable for non-technical stakeholders. Cover: what happened, what was the user/business impact, how long it lasted, and what was done to resolve it.*

*(Example: At 14:17 UTC on YYYY-MM-DD, a deployment pushed to production contained a misconfigured rate limiter that caused all authenticated API requests to be rejected. Guests were unable to access the booking portal for approximately 47 minutes. The issue was identified via monitoring alerts and resolved by rolling back to the previous release. Approximately 120 active sessions were disrupted. No data loss occurred.)*

---

## Timeline of Events

*Fill in every significant event in chronological order. Include detection, all response actions, and resolution. Be specific with timestamps.*

| Time (UTC)  | Event                                      | Action Taken                                          | Who          |
|-------------|---------------------------------------------|-------------------------------------------------------|--------------|
| HH:MM       | *(describe what happened)*                 | *(describe action taken, or "None — not yet detected")* | *(name/team)* |
| HH:MM       |                                             |                                                       |              |
| HH:MM       | First user report received                 |                                                       |              |
| HH:MM       | Alert fired in monitoring                  | On-call engineer acknowledged                         |              |
| HH:MM       | Incident declared SEV-X                    | Incident channel opened                               |              |
| HH:MM       | Root cause identified                      |                                                       |              |
| HH:MM       | Mitigation deployed                        |                                                       |              |
| HH:MM       | Service restored                           | Status page updated to Resolved                       |              |
| HH:MM       | Post-mortem scheduled                      |                                                       |              |

---

## Root Cause Analysis — 5 Whys

*Start from the user-visible symptom and ask "why" at least five times, drilling down to the systemic root cause. The final "why" should reveal a gap in process, tooling, or system design.*

**Symptom:** *(e.g. "Authenticated API requests returned 401 for all users")*

1. **Why did users receive 401 errors?**
   *(e.g. "The JWT validation middleware was rejecting all tokens.")*

2. **Why was the JWT middleware rejecting all tokens?**
   *(e.g. "The JWT_SECRET environment variable was empty in production.")*

3. **Why was JWT_SECRET empty in production?**
   *(e.g. "The deployment script did not copy the .env file to the new container.")*

4. **Why did the deployment script not copy the .env file?**
   *(e.g. "The deployment script was updated but the step to copy secrets was accidentally removed.")*

5. **Why was the removal not caught before deployment?**
   *(e.g. "There is no automated test that verifies required environment variables are present before the service starts.")*

**Root Cause:**
*(Single, clear statement of the systemic root cause. Example: "The absence of a pre-startup environment variable validation check meant that a deployment script regression went undetected until it caused a production outage.")*

---

## Contributing Factors

*List all factors that contributed to the incident occurring or its severity/duration. These are not the root cause — they are conditions that made things worse or allowed the root cause to manifest.*

- *(e.g. "No pre-deployment checklist meant the missing env var step was not reviewed before release.")*
- *(e.g. "The monitoring alert threshold was too high — it took 12 minutes to fire after the outage began.")*
- *(e.g. "The rollback procedure was documented but not practised, slowing the recovery time.")*
- *(e.g. "The engineer who deployed was covering for a team member and was less familiar with this part of the deployment process.")*

---

## Impact Quantification

### User Impact

| Metric                         | Value                  |
|--------------------------------|------------------------|
| Users affected                 | *(number or estimate)* |
| Active sessions disrupted      | *(number or estimate)* |
| Bookings failed or lost        | *(number)*             |
| User-facing error messages     | *(yes/no, describe)*   |

### Data Impact

| Metric                          | Value                  |
|---------------------------------|------------------------|
| Personal data accessed          | *(yes/no — if yes, describe what and how much)* |
| Personal data modified          | *(yes/no — if yes, describe)*                   |
| Personal data deleted           | *(yes/no — if yes, describe)*                   |
| GDPR notification required      | *(yes/no)*             |
| Records affected                | *(number or "N/A")*    |

### Business Impact

| Metric                          | Value                  |
|---------------------------------|------------------------|
| Revenue impact (estimate)       | *(e.g. "~£X in lost bookings" or "Negligible")* |
| SLA breach                      | *(yes/no)*             |
| Reputational impact             | *(describe or "None identified")* |
| Regulatory/legal exposure       | *(describe or "None identified")* |

---

## What Went Well

*Be genuine here. Recognise the things that worked — fast detection, good communication, effective tooling, team collaboration. This section matters.*

- *(e.g. "The on-call engineer acknowledged the alert within 8 minutes — well within the 15-minute SLA.")*
- *(e.g. "The rollback was executed cleanly and service was restored within the target window.")*
- *(e.g. "Communication to stakeholders was clear and timely.")*
- *(e.g. "The incident channel was organised and kept confusion to a minimum.")*

---

## What Went Poorly

*Be honest and constructive. Focus on systemic gaps, not individual failures.*

- *(e.g. "The deployment script lacked automated validation of required environment variables.")*
- *(e.g. "The monitoring alert took 12 minutes to fire — users reported the issue before we detected it.")*
- *(e.g. "The post-incident communication to users was delayed because no email template was ready.")*
- *(e.g. "There was no runbook entry for this type of failure, so the response was improvised.")*

---

## Action Items

*Every action item must have an owner, a due date, and a priority. Vague action items do not prevent recurrence. Create Jira tickets for each item.*

| #  | Action Item                                                                 | Owner          | Due Date   | Priority | Jira Ticket |
|----|-----------------------------------------------------------------------------|----------------|------------|----------|-------------|
| 1  | *(e.g. Add startup validation that asserts all required env vars are set)* | *(Name)*       | YYYY-MM-DD | High     | QV-XXX      |
| 2  | *(e.g. Reduce monitoring alert threshold for 401 rate from 10% to 2%)*     | *(Name)*       | YYYY-MM-DD | Medium   | QV-XXX      |
| 3  | *(e.g. Add email communication templates to INCIDENT_RESPONSE.md)*         | *(Name)*       | YYYY-MM-DD | Medium   | QV-XXX      |
| 4  | *(e.g. Schedule quarterly rollback drills)*                                 | *(Name)*       | YYYY-MM-DD | Low      | QV-XXX      |
| 5  |                                                                             |                |            |          |             |

---

## Lessons Learned

*Summarise the key takeaways for the broader engineering team. What does this incident teach us about our systems, our processes, or our assumptions?*

1. *(e.g. "Critical environment variables must be validated at startup — not assumed to be correct.")*
2. *(e.g. "Monitoring alert thresholds should err on the side of sensitivity — false positives are cheaper than delayed detection.")*
3. *(e.g. "Communication templates prepared in advance significantly reduce stress and delay during incident response.")*

---

## Appendix

### Supporting Evidence

*Attach or link to relevant artefacts:*

- Log excerpts: *(path or link)*
- Metrics graphs: *(link to dashboard snapshot)*
- Relevant commits or PRs: *(link)*
- Slack thread: *(link)*

### Related Incidents

| Incident ID  | Summary                                | Relationship             |
|--------------|----------------------------------------|--------------------------|
| *(INC-XXX)*  | *(brief description)*                  | *(related/duplicate/etc.)* |

---

*Post-mortem completed by: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_ on \_\_\_\_\_\_\_\_\_\_*

*Reviewed by Engineering Lead: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_ on \_\_\_\_\_\_\_\_\_\_*
