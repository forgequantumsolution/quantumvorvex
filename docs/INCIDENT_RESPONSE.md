# Incident Response Plan — Quantum Vorvex

**Document Version:** 1.0.0
**Last Updated:** 2026-04-06
**Classification:** INTERNAL — RESTRICTED
**Owner:** Engineering Lead
**Review Cycle:** Every 6 months or after any P1/P2 incident

---

## Table of Contents

1. [Purpose and Scope](#1-purpose-and-scope)
2. [Severity Matrix](#2-severity-matrix)
3. [Response SLAs](#3-response-slas)
4. [Response Workflow](#4-response-workflow)
5. [Communication Templates](#5-communication-templates)
6. [Rollback Procedure](#6-rollback-procedure)
7. [Data Breach Response](#7-data-breach-response)
8. [Contact List](#8-contact-list)
9. [Blameless Post-Mortem Culture](#9-blameless-post-mortem-culture)

---

## 1. Purpose and Scope

This document defines the Quantum Vorvex incident response plan — the processes, roles, communication standards, and procedures used to detect, contain, eradicate, and recover from security incidents and service disruptions.

**In scope:**
- Security incidents (data breaches, account compromises, injection attacks, unauthorised access)
- Service outages (full or partial unavailability of the hotel management system)
- Data integrity issues (corrupted, deleted, or tampered records)
- Dependency and supply chain incidents (compromised npm packages)

**Out of scope:**
- Infrastructure incidents managed entirely by a third-party cloud provider with no action required from our team
- Feature bugs without user data, security, or availability impact (handle via normal bug workflow)

---

## 2. Severity Matrix

| Severity | Label       | Definition                                                                                                      | Examples                                                                                    |
|----------|-------------|------------------------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------|
| SEV-1    | Critical    | Active security breach or complete production outage. Guest PII or payment data exposed or at risk. Revenue-impacting. | Production database deleted or encrypted (ransomware). Admin credentials stolen and used. Active data exfiltration. API completely down. |
| SEV-2    | High        | Significant degradation of service OR confirmed vulnerability actively being exploited but not yet resulting in breach. | Login service down. Rate limiter failed open. Privilege escalation confirmed. JWT secret leaked but not yet exploited. Service responding at >3s p95. |
| SEV-3    | Medium      | Non-critical feature unavailable. Vulnerability confirmed but not exploited. Performance degraded but not critical. | File upload failing. Specific report feature broken. XSS found in guest-facing page. Slow search queries. |
| SEV-4    | Low         | Minor issue, no immediate user or business impact. Security hardening opportunity. Non-critical bug.             | Missing security header. Verbose error message. Outdated dependency (no known exploit). UI cosmetic issue. |

---

## 3. Response SLAs

| Severity | Acknowledge   | Commander Assigned | Containment Target | Resolution Target | Post-Mortem Due  |
|----------|---------------|--------------------|--------------------|-------------------|------------------|
| SEV-1    | 15 minutes    | 15 minutes         | 1 hour             | 4 hours           | 48 hours         |
| SEV-2    | 30 minutes    | 1 hour             | 4 hours            | 24 hours          | 5 business days  |
| SEV-3    | 2 hours       | Next business day  | 48 hours           | 1 week            | 2 weeks          |
| SEV-4    | Next business day | Next sprint    | Next release       | Next release      | Optional         |

**SLA clock starts** from the time the incident is first detected or reported, whichever is earlier.

---

## 4. Response Workflow

```
┌──────────┐    ┌─────────────┐    ┌────────┐    ┌───────────────┐
│  DETECT  │───▶│ ACKNOWLEDGE │───▶│ ASSESS │───▶│  COMMUNICATE  │
└──────────┘    └─────────────┘    └────────┘    └───────┬───────┘
                                                          │
┌──────────────┐    ┌─────────────┐    ┌──────────┐      │
│  POST-MORTEM │◀───│   RESOLVE   │◀───│INVESTIGATE│◀─────┘
└──────────────┘    └─────────────┘    └─────┬────┘
                                             │
                                      ┌──────▼──────┐
                                      │  MITIGATE   │
                                      └─────────────┘
```

### Phase 1 — Detect

**Goal:** Identify that an incident has occurred or is in progress.

**Sources of detection:**
- Automated monitoring alerts (uptime checks, error rate thresholds, anomaly detection)
- User or customer report
- Security scanner alert (gitleaks, semgrep, npm audit)
- Internal engineer observation
- Third-party disclosure

**Actions:**
1. Any team member who observes a potential incident must report it immediately.
2. Create an incident record in the incident tracking system (Jira, Notion, etc.).
3. Assign an initial severity estimate (can be revised in Assess phase).

---

### Phase 2 — Acknowledge

**Goal:** Confirm the incident is real, assign an Incident Commander (IC), and notify relevant parties.

**Actions:**
1. On-call engineer acknowledges the alert within SLA.
2. Assign an Incident Commander. For SEV-1/SEV-2 this is the on-call engineer; escalate if the IC is unable to lead.
3. Open a dedicated incident channel: `#inc-YYYY-MM-DD-brief-description` in Slack.
4. Post the initial acknowledgement message in the channel (use Communication Template 1 below).
5. Notify stakeholders per the escalation matrix in the Security Runbook.

---

### Phase 3 — Assess

**Goal:** Understand the full scope, impact, and severity of the incident.

**Questions to answer:**
- What systems are affected?
- What data may have been accessed, modified, or deleted?
- How many users are affected?
- Is the attack/issue ongoing or historical?
- What is the blast radius if left unmitigated?
- Has severity been correctly classified?

**Actions:**
1. Gather evidence: logs, error messages, metrics, user reports.
2. Reproduce the issue in a safe, isolated environment if possible.
3. Revise the severity rating if the initial estimate was incorrect.
4. Document findings in the incident record in real time.

---

### Phase 4 — Communicate

**Goal:** Keep all stakeholders informed with accurate, timely updates.

**Internal communication:**
- Post updates to the incident Slack channel every 30 minutes for SEV-1, every hour for SEV-2.
- Keep the Engineering Lead and CTO informed at all times during SEV-1.

**External communication:**
- Update the status page within 30 minutes of confirming a user-impacting incident.
- Send stakeholder/customer emails for SEV-1 and SEV-2 incidents (see templates below).
- Do NOT speculate about root cause in external communications until confirmed.
- If a data breach is suspected, escalate to legal immediately (see Section 7).

---

### Phase 5 — Mitigate

**Goal:** Stop the immediate harm, contain the blast radius, and restore service to an acceptable state.

**Mitigation strategies (choose as appropriate):**

| Situation                          | Mitigation Action                                                           |
|------------------------------------|-----------------------------------------------------------------------------|
| Compromised user account           | Revoke tokens, force password reset, notify user                            |
| Active exploitation of a route     | Temporarily disable or rate-limit the affected route                        |
| Data exfiltration in progress      | Block the source IP, revoke credentials used, isolate the server            |
| Vulnerable dependency              | `npm install <safe-version>`, redeploy                                      |
| Production code defect             | Roll back to last known good release (see Section 6)                        |
| JWT secret compromised             | Rotate secret immediately (see Security Runbook Section 2.1)                |
| DB corruption or accidental delete | Restore from most recent backup, validate integrity                         |

---

### Phase 6 — Investigate

**Goal:** Determine the full timeline, root cause, and contributing factors.

**Actions:**
1. Build a complete timeline from logs, commits, deployments, and user reports.
2. Identify the root cause (use the 5 Whys technique — see POST_MORTEM_TEMPLATE.md).
3. Identify all contributing factors (not just the proximate cause).
4. Determine the full scope of data or systems affected.
5. Preserve forensic evidence:
   ```bash
   # Archive logs before rotation
   tar -czf /tmp/incident-$(date +%Y%m%d-%H%M%S)-logs.tar.gz /var/log/quantum-vorvex/
   ```
6. Do not delete or overwrite logs, DB records, or infrastructure state until forensic review is complete.

---

### Phase 7 — Resolve

**Goal:** Return the system to normal operation and confirm the vulnerability is addressed.

**Actions:**
1. Deploy the fix (hotfix, configuration change, or rollback).
2. Verify the fix resolves the incident without introducing new issues:
   ```bash
   bash scripts/smoke-test.sh
   ```
3. Confirm monitoring returns to green.
4. Lift any temporary mitigations (IP blocks, disabled routes) where appropriate.
5. Update the status page to resolved.
6. Send the "Resolved" communication to stakeholders.
7. Close the incident channel with a summary message.

---

### Phase 8 — Post-Mortem

**Goal:** Learn from the incident and prevent recurrence.

1. Schedule a post-mortem meeting within the SLA deadline.
2. Complete the POST_MORTEM_TEMPLATE.md.
3. Track all action items in Jira with owners and due dates.
4. Share the post-mortem with the full engineering team.
5. Update this runbook and relevant documentation with lessons learned.

---

## 5. Communication Templates

### Template 1 — Initial Status Page Update

```
[INVESTIGATING] Quantum Vorvex — <Component> <Issue Type>

We are currently investigating an issue affecting <describe affected area>.
Some users may experience <describe user-facing impact>.

We will provide an update within <timeframe>.

Started: <HH:MM UTC>
Last updated: <HH:MM UTC>
```

---

### Template 2 — Ongoing Update (Status Page)

```
[UPDATE] Quantum Vorvex — <Component> <Issue Type>

We have identified the cause of the issue: <brief description without sensitive technical details>.
Our team is actively working on a fix.

Current impact: <describe>
Expected resolution: <time estimate or "under investigation">

Started: <HH:MM UTC>
Last updated: <HH:MM UTC>
```

---

### Template 3 — Resolved Update (Status Page)

```
[RESOLVED] Quantum Vorvex — <Component> <Issue Type>

This incident has been resolved. <One sentence on what was fixed>.
We apologise for any inconvenience caused.

If you continue to experience issues, please contact support@quantumvorvex.com.

Incident duration: <start> — <end> (<total duration>)
```

---

### Template 4 — Stakeholder / Customer Email (SEV-1/SEV-2)

```
Subject: Service Notice — Quantum Vorvex <Date>

Dear <Name / "Valued User">,

We are writing to inform you of an incident affecting the Quantum Vorvex hotel management system.

Incident summary:
<2-3 sentences: what happened, when it started, what was affected>

Impact to your account:
<Be specific. If no data was affected, say so clearly.>

Actions we have taken:
- <Action 1>
- <Action 2>
- <Action 3>

Actions you should take:
<e.g. reset your password, review recent activity, nothing required>

We take the security and reliability of your data seriously. We sincerely apologise for this inconvenience and will share a full post-incident report once our investigation is complete.

If you have any questions, please contact security@quantumvorvex.com.

Regards,
Quantum Vorvex Engineering Team
```

---

## 6. Rollback Procedure

### 6.1 Application Code Rollback (Node.js Backend)

**Using PM2:**
```bash
# Check deployment history
pm2 list

# If using a deployment tool, roll back to the previous release
# Example: deploying from a tagged release
git checkout v<previous-version>
cd server && npm ci --production
pm2 restart quantum-vorvex-server
```

**Using Docker:**
```bash
# List recent images
docker images quantum-vorvex-server

# Roll back to a specific image tag
docker-compose down
# Edit docker-compose.yml: change image tag to previous version
docker-compose up -d

# Verify
docker-compose logs --tail=50 server
```

### 6.2 Verify Rollback Success

```bash
# Run smoke tests after rollback
bash scripts/smoke-test.sh

# Check health endpoint
curl -s http://localhost:5000/health | jq .
```

### 6.3 Database Rollback / Restore

> Always back up the current database before restoring.

```bash
# Backup current (potentially corrupted) state
cp server/hotel_management.db /tmp/hotel_management.db.bak-$(date +%Y%m%d-%H%M%S)

# Restore from backup
cp /backups/hotel_management.db.YYYY-MM-DD server/hotel_management.db

# Run pending migrations if needed (be careful — re-evaluate if DB is a rollback target)
cd server && npx prisma migrate deploy

# Restart the server
pm2 restart quantum-vorvex-server
```

---

## 7. Data Breach Response

A data breach occurs when guest PII or other personal data is accessed, disclosed, altered, or destroyed without authorisation.

### 7.1 Immediate Actions (first 2 hours)

1. Confirm a breach has occurred — rule out false positives.
2. Escalate to SEV-1 immediately.
3. Contain: revoke credentials, block IPs, disable affected routes.
4. Notify the Engineering Lead and escalate to legal/compliance immediately.
5. Preserve all evidence before taking any mitigation actions that might overwrite data.
6. Identify the scope: which records, which fields, how many users, what time window.

### 7.2 GDPR 72-Hour Notification Requirement

Under GDPR Article 33, personal data breaches must be reported to the relevant supervisory authority **within 72 hours** of becoming aware of the breach, unless the breach is unlikely to result in risk to individuals.

**The 72-hour clock starts** from the moment the organisation becomes aware of the breach — not when it is confirmed. When in doubt, notify.

**Notification must include:**
- Nature of the breach (categories and approximate number of individuals and records concerned)
- Contact details of the Data Protection Officer (or equivalent)
- Likely consequences of the breach
- Measures taken or proposed to address the breach

**If individual notification is required (Article 34):**
- Notify affected data subjects without undue delay
- Use clear and plain language
- Describe the nature of the breach and contact details
- Describe likely consequences and measures taken

### 7.3 Breach Notification Checklist

```
[ ] Breach confirmed and scoped
[ ] Engineering Lead notified
[ ] Legal/compliance notified
[ ] Breach documented (what, when, who, how many affected)
[ ] Supervisory authority notification drafted (within 72h)
[ ] Legal review of notification completed
[ ] Supervisory authority notification submitted
[ ] Affected users identified
[ ] User notification drafted and reviewed
[ ] User notifications sent
[ ] Breach details added to the Data Breach Register
[ ] Post-mortem scheduled
```

---

## 8. Contact List

| Role                       | Name               | Phone          | Email                              | Availability          |
|----------------------------|--------------------|----------------|------------------------------------|-----------------------|
| On-call Engineer (primary) | *(fill in)*        | *(fill in)*    | *(fill in)*                        | 24/7 during on-call   |
| On-call Engineer (backup)  | *(fill in)*        | *(fill in)*    | *(fill in)*                        | 24/7 during on-call   |
| Engineering Lead           | *(fill in)*        | *(fill in)*    | *(fill in)*                        | Business hours + P1   |
| CTO                        | *(fill in)*        | *(fill in)*    | *(fill in)*                        | P1 only               |
| Legal / Compliance         | *(fill in)*        | *(fill in)*    | legal@quantumvorvex.com            | Business hours        |
| Customer Support Lead      | *(fill in)*        | *(fill in)*    | support@quantumvorvex.com          | Business hours        |
| Security Email             | —                  | —              | security@quantumvorvex.com         | Monitored 24/7        |
| Hosting / Infrastructure   | *(provider name)*  | *(support no)* | *(support email)*                  | Per SLA               |
| Domain Registrar           | *(provider name)*  | *(support no)* | *(support email)*                  | Per SLA               |

---

## 9. Blameless Post-Mortem Culture

At Quantum Vorvex, we practice **blameless post-mortems**. This is not a formality — it is a core engineering value.

### Principles

**People are not the problem.** Complex systems fail in complex ways. When an incident occurs, it is almost never because one person made a single catastrophic mistake. Systems fail because the conditions that allowed the failure to occur existed long before the failure happened.

**Blame is counterproductive.** When engineers fear blame, they become reluctant to report incidents, share close calls, or speak up when something looks wrong. Blame destroys the psychological safety needed for a high-performing team.

**We investigate systems, not people.** The goal of a post-mortem is to identify and address systemic weaknesses — gaps in tooling, monitoring, documentation, processes, or automation — not to find someone to hold responsible.

### Guidelines for Post-Mortem Meetings

1. **State the purpose at the start.** Remind attendees: we are here to learn, not to assign fault.
2. **Focus on the timeline, not the decisions.** "At 14:32, the deployment was triggered" — not "Alice made the bad call to deploy."
3. **Ask "what" and "how", not "who".** "What conditions led to this?" not "Who caused this?"
4. **Assume good intent.** Every engineer involved was doing their best with the information and tools available at the time.
5. **Action items on systems, not people.** "Add a deployment checklist to prevent this step being skipped" — not "Bob needs to be more careful."
6. **Recognise what went well.** Incidents often surface heroic recovery efforts. Acknowledge them.
7. **Make action items concrete and trackable.** Vague recommendations do not prevent recurrence.
8. **Share the post-mortem broadly.** Learning only happens if the lessons are shared.

### What a Good Post-Mortem Produces

- A clear, factual timeline
- A well-reasoned root cause (systemic, not personal)
- Concrete, trackable action items with owners and deadlines
- Improved runbooks, monitoring, and tooling
- A team that is more prepared for the next incident

---

*This incident response plan is owned by the Engineering Lead and reviewed every 6 months. All engineers are expected to read and be familiar with this document. File improvements as a PR targeting `main`.*
