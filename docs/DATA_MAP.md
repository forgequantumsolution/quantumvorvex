# Data Classification Map — Quantum Vorvex

**Document Version:** 1.0.0
**Last Updated:** 2026-04-06
**Classification:** INTERNAL — RESTRICTED
**Owner:** Engineering Lead / Data Protection Officer
**Review Cycle:** Annually or when data structure changes

---

## Overview

This document maps all personal data fields processed by the Quantum Vorvex hotel management system. It serves as the primary data inventory for GDPR compliance, supports data subject rights requests, and guides security controls for each data category.

---

## Data Classification Levels

| Level        | Definition                                                                                    |
|--------------|-----------------------------------------------------------------------------------------------|
| PUBLIC       | Information that can be freely shared. No harm if disclosed.                                  |
| INTERNAL     | For internal use only. Not sensitive but not meant for public sharing.                        |
| CONFIDENTIAL | Sensitive business or personal data. Disclosure could cause moderate harm.                    |
| RESTRICTED   | Highly sensitive personal data. Disclosure could cause serious harm or legal liability.       |

---

## Guest Personal Data — PII Fields

| Field              | DB Table / Column              | Classification | Storage Format | Encryption at Rest | Retention Policy                          | GDPR Legal Basis                     | Third-Party Sharing | GDPR Rights Applicable                  |
|--------------------|-------------------------------|----------------|----------------|--------------------|-------------------------------------------|--------------------------------------|--------------------|-----------------------------------------|
| Full Name          | `guests.name`                 | CONFIDENTIAL   | Plaintext      | None (DB-level encryption recommended) | Duration of stay + 7 years (legal/tax) | Art. 6(1)(b) — Contract performance  | None               | Access, Rectification, Erasure, Portability |
| Email Address      | `guests.email`                | CONFIDENTIAL   | Plaintext      | None (DB-level encryption recommended) | Duration of stay + 7 years            | Art. 6(1)(b) — Contract performance  | None               | Access, Rectification, Erasure, Portability |
| Phone Number       | `guests.phone`                | CONFIDENTIAL   | Plaintext      | None               | Duration of stay + 7 years            | Art. 6(1)(b) — Contract performance  | None               | Access, Rectification, Erasure, Portability |
| Date of Birth      | `guests.dob`                  | RESTRICTED     | Plaintext      | AES-256 recommended | Duration of stay + 7 years           | Art. 6(1)(c) — Legal obligation (identity verification) | None | Access, Rectification, Erasure, Portability |
| ID Number (passport/national ID) | `guests.idNumber` | RESTRICTED | Plaintext | AES-256 recommended | Duration of stay + 7 years (legal) | Art. 6(1)(c) — Legal obligation (hotel guest registration law) | None | Access, Rectification, Erasure (subject to legal retention) |
| Address            | `guests.address`              | CONFIDENTIAL   | Plaintext      | None               | Duration of stay + 7 years            | Art. 6(1)(b) — Contract performance  | None               | Access, Rectification, Erasure, Portability |
| Emergency Contact Name | `guests.emergencyName`    | CONFIDENTIAL   | Plaintext      | None               | Duration of stay only                  | Art. 6(1)(d) — Vital interests        | None               | Access, Rectification, Erasure           |
| Emergency Contact Phone | `guests.emergencyPhone`  | CONFIDENTIAL   | Plaintext      | None               | Duration of stay only                  | Art. 6(1)(d) — Vital interests        | None               | Access, Rectification, Erasure           |

---

## Staff / User Account Data

| Field              | DB Table / Column              | Classification | Storage Format  | Encryption at Rest | Retention Policy                       | GDPR Legal Basis                     | Third-Party Sharing | GDPR Rights Applicable          |
|--------------------|-------------------------------|----------------|-----------------|--------------------|-----------------------------------------|--------------------------------------|--------------------|---------------------------------|
| Username           | `users.username`              | INTERNAL       | Plaintext       | None               | Duration of employment + 2 years        | Art. 6(1)(b) — Contract (employment) | None               | Access, Rectification           |
| Email Address      | `users.email`                 | CONFIDENTIAL   | Plaintext       | None               | Duration of employment + 2 years        | Art. 6(1)(b) — Contract (employment) | None               | Access, Rectification, Erasure  |
| Password           | `users.password`              | RESTRICTED     | bcrypt hash     | bcrypt (cost ≥12)  | Duration of employment + 2 years        | Art. 6(1)(b) — Contract (employment) | None               | Rectification (change only)     |
| Role               | `users.role`                  | INTERNAL       | Plaintext enum  | None               | Duration of employment + 2 years        | Art. 6(1)(b) — Contract (employment) | None               | Access                          |

---

## Booking Data

| Field              | DB Table / Column              | Classification | Storage Format | Encryption at Rest | Retention Policy                          | GDPR Legal Basis                     | Third-Party Sharing | GDPR Rights Applicable                  |
|--------------------|-------------------------------|----------------|----------------|--------------------|-------------------------------------------|--------------------------------------|--------------------|-----------------------------------------|
| Booking Reference  | `bookings.id`                 | INTERNAL       | Plaintext      | None               | 7 years (financial/legal records)         | Art. 6(1)(b) — Contract performance  | None               | Access, Portability                     |
| Check-in / Check-out dates | `bookings.checkIn`, `bookings.checkOut` | INTERNAL | Plaintext | None          | 7 years                                   | Art. 6(1)(b) — Contract performance  | None               | Access, Portability                     |
| Room Assignment    | `bookings.roomId`             | INTERNAL       | Foreign key    | None               | 7 years                                   | Art. 6(1)(b) — Contract performance  | None               | Access                                  |
| Payment Amount     | `bookings.totalAmount`        | CONFIDENTIAL   | Plaintext      | None               | 7 years (accounting requirement)          | Art. 6(1)(c) — Legal obligation       | None               | Access                                  |
| Guest ID (FK)      | `bookings.guestId`            | CONFIDENTIAL   | Foreign key    | None               | 7 years                                   | Art. 6(1)(b) — Contract performance  | None               | Access, Portability                     |

---

## File Uploads

| File Type                     | Storage Location    | Classification | Content Sensitivity | Retention Policy              | Notes                                                    |
|-------------------------------|---------------------|----------------|----------------------|-------------------------------|----------------------------------------------------------|
| Guest ID documents (scan/photo) | `server/uploads/guests/` | RESTRICTED | High (contains idNumber, photo, DOB) | Duration of stay + 7 years | Must be stored outside webroot. Access via signed URL only. |
| Profile photos                | `server/uploads/profiles/` | CONFIDENTIAL | Medium            | Duration of account           | MIME validation required. Max size enforced.             |

---

## Authentication Tokens

| Token Type     | Storage Location (Server) | Storage Location (Client) | Classification | Expiry       | Notes                                           |
|----------------|---------------------------|---------------------------|----------------|--------------|--------------------------------------------------|
| Access JWT     | Not persisted server-side | `localStorage` or httpOnly cookie | RESTRICTED | 15 minutes  | Contains `userId`, `role`. Never log full token. |
| Refresh JWT    | `token_blacklist` table (if revoked) | httpOnly cookie | RESTRICTED | 7 days     | Use `SameSite=Strict`. Rotate on use.            |

---

## Application Logs

| Log Type          | Location                    | Contains PII?                          | Retention  | Notes                                                       |
|-------------------|-----------------------------|----------------------------------------|------------|-------------------------------------------------------------|
| Access logs       | `server/logs/access.log`    | IP addresses, user IDs (pseudonymised) | 90 days    | Never log request bodies that may contain passwords or PII. |
| Error logs        | `server/logs/error.log`     | Potentially (if stack traces leak data) | 90 days   | Strip PII from error logs in production.                    |
| Audit logs        | `server/logs/audit.log`     | User IDs, action types, timestamps     | 1 year     | Do not log full request payloads.                           |

---

## Third-Party Data Sharing

**Current status: No guest or staff personal data is shared with any third party.**

| Third Party     | Data Shared | Purpose | Legal Basis | DPA in Place | Notes |
|-----------------|-------------|---------|-------------|--------------|-------|
| *(none)*        | —           | —       | —           | —            | To be reviewed if payment gateway or email provider is integrated |

---

## GDPR Data Subject Rights — Handling Procedure

| Right                        | Article  | How to Fulfil                                                                                       | Response Deadline |
|------------------------------|----------|------------------------------------------------------------------------------------------------------|-------------------|
| Right of Access (SAR)        | Art. 15  | Export all data linked to `guestId` or `userId` from all relevant tables. Provide in machine-readable format. | 1 month (extendable to 3) |
| Right to Rectification       | Art. 16  | Update incorrect fields via admin dashboard or direct DB update. Confirm update to data subject.     | 1 month           |
| Right to Erasure ("Right to be Forgotten") | Art. 17 | Delete or anonymise all PII fields. Retain records required for legal obligations (bookings, financials) in anonymised form. | 1 month |
| Right to Data Portability    | Art. 20  | Export personal data in JSON or CSV format. Include: name, email, phone, address, booking history.   | 1 month           |
| Right to Restriction         | Art. 18  | Flag record as `processingRestricted = true`. Cease processing except for storage until restriction is lifted. | Without undue delay |
| Right to Object              | Art. 21  | Applicable if processing is based on legitimate interests. Cease processing unless compelling grounds can be demonstrated. | Without undue delay |

---

## Data Minimisation Checklist

When adding new data fields to the schema, the following questions must be answered before the field is merged:

- [ ] Is this field **necessary** for the stated purpose? (If not, do not collect it.)
- [ ] What is the **legal basis** for processing this field?
- [ ] Has a **classification level** been assigned?
- [ ] Does the field contain **special category data** under GDPR Art. 9 (health, biometrics, etc.)? If so, a Data Protection Impact Assessment (DPIA) is required.
- [ ] What is the **retention policy**?
- [ ] Is **encryption at rest** required for this field's classification?
- [ ] Has this data map been **updated** to include the new field?

---

## Encryption Recommendations

| Current State                    | Recommendation                                                                          | Priority |
|----------------------------------|------------------------------------------------------------------------------------------|----------|
| `guests.idNumber` stored plaintext | Encrypt at application layer using AES-256-GCM before writing to DB                   | High     |
| `guests.dob` stored plaintext    | Encrypt at application layer using AES-256-GCM before writing to DB                     | High     |
| SQLite file not encrypted        | Enable SQLite encryption extension (SQLCipher) or migrate to encrypted PostgreSQL volume | Medium   |
| ID document files stored as-is   | Encrypt files at rest on the filesystem using OS-level or application-level encryption  | High     |

---

*This document is maintained by the Engineering Lead. Updates require review from the Data Protection Officer (or equivalent). Any change to data collection, storage, or sharing must be reflected here before the code change is merged.*
