# Report Components Reference

Structure and content requirements for SOC 2 Type I and Type II reports per AT-C 320 and SSAE 18.

---

## Report Structure Overview

### Type I Report (Point-in-Time)

| Section | Content | Prepared By |
|---------|---------|-------------|
| I | Independent Service Auditor's Report | Service Auditor |
| II | Management's Assertion | Service Organization Management |
| III | Description of the Service Organization's System | Service Organization (reviewed by auditor) |
| IV | Service Auditor's Description of Tests of Controls and Results | Service Auditor |

### Type II Report (Over a Period)

| Section | Content | Prepared By |
|---------|---------|-------------|
| I | Independent Service Auditor's Report | Service Auditor |
| II | Management's Assertion | Service Organization Management |
| III | Description of the Service Organization's System | Service Organization (reviewed by auditor) |
| IV | Service Auditor's Description of Tests of Controls and Results | Service Auditor |
| (Optional) V | Other Information Provided by the Service Organization | Service Organization |

---

## Section I: Independent Service Auditor's Report

### Required Elements

1. **Title:** "Independent Service Auditor's Report"
2. **Addressee:** Management of the service organization
3. **Scope paragraph:**
   - Identify the service organization
   - Identify the system examined
   - Identify the criteria (TSC categories in scope)
   - State the audit period (Type II) or point-in-time date (Type I)
4. **Service organization's responsibilities:**
   - Providing the description
   - Designing and implementing controls
   - Providing written assertion
5. **Service auditor's responsibilities:**
   - Express an opinion based on the examination
   - Conducted in accordance with attestation standards (AT-C 205)
   - Plan and perform to obtain reasonable assurance
6. **Inherent limitations paragraph:**
   - Controls may not prevent/detect all errors or fraud
   - Projection of controls effectiveness to future periods is inappropriate
7. **Opinion paragraph:**
   - **Type I:** Description is fairly presented AND controls are suitably designed
   - **Type II:** Description is fairly presented AND controls are suitably designed AND controls operated effectively throughout the period
8. **Restriction on use:**
   - Report is intended solely for specified parties (management, user entities, prospective user entities, regulators)
9. **Signature and date**

### Opinion Types

#### Unqualified Opinion
```
In our opinion, in all material respects:
a) The description fairly presents the [System Name] system...
b) The controls stated in the description were suitably designed to provide reasonable assurance...
c) [Type II only] The controls operated effectively throughout the period [date] to [date]...
```

#### Qualified Opinion
```
In our opinion, except for the matter(s) described in the Basis for Qualified Opinion paragraph:
a) The description fairly presents...
[etc.]
```

**Basis for Qualified Opinion paragraph must:**
- Describe the matter giving rise to the qualification
- State the criteria not met
- Describe the nature and extent of the exception(s)

#### Adverse Opinion
```
In our opinion, because of the significance of the matter(s) described in the Basis for Adverse Opinion paragraph, the controls stated in the description were NOT suitably designed [or did NOT operate effectively]...
```

---

## Section II: Management's Assertion

### Required Assertions

#### Type I:
1. The description fairly presents the system that was designed and implemented as of [date]
2. The controls stated in the description were suitably designed as of [date] to meet the applicable trust services criteria

#### Type II:
1. The description fairly presents the system that was designed and implemented throughout the period [start] to [end]
2. The controls stated in the description were suitably designed throughout the period to meet the applicable trust services criteria
3. The controls stated in the description operated effectively throughout the period to meet the applicable trust services criteria

### Additional Required Content

- Criteria used (2017 Trust Services Criteria with any applicable revisions)
- Trust service categories addressed
- Identification of any subservice organizations
- Method used for subservice organizations (carve-out or inclusive)
- Statement that risks from subservice organizations were identified and controls mitigate those risks

---

## Section III: System Description

### Required Description Criteria (DC Section 200)

The description must include:

1. **Types of services provided**
2. **Principal service commitments and system requirements**
3. **Components of the system:**
   - Infrastructure (hardware, facilities, networks)
   - Software (operating systems, middleware, applications)
   - People (roles, responsibilities, training)
   - Procedures (automated and manual)
   - Data (types processed, stored, transmitted)
4. **Boundaries of the system**
5. **Disclosure of specific controls** that meet the applicable criteria
6. **Relevant aspects of the control environment, risk assessment process, information and communication systems, and monitoring activities**
7. **Complementary subservice organization controls (CSOCs)** if carve-out method is used
8. **Complementary user entity controls (CUECs)**
9. **Changes to the system during the period** (Type II)
10. **Incidents during the period** that are relevant to the opinion (Type II)

### Description Review Checklist

- [ ] All TSC categories in scope are addressed
- [ ] System boundaries are clearly defined
- [ ] Five components (infrastructure, software, people, procedures, data) are described
- [ ] Controls are mapped to criteria
- [ ] Subservice organizations identified with method (carve-out/inclusive)
- [ ] CUECs listed
- [ ] Changes during period disclosed (Type II)
- [ ] Significant incidents disclosed (Type II)
- [ ] Description is consistent with the actual system (verified through testing)

---

## Section IV: Tests of Controls and Results

### Format for Each Control

| Element | Content |
|---------|---------|
| **Trust Service Criteria** | Criteria reference (e.g., CC6.1) |
| **Control Activity** | Description of the control |
| **Test Applied** | Nature of test (inspected, observed, reperformed, inquired) |
| **Test Description** | What the auditor did |
| **Results** | Outcome of the test |

### Results Language

#### No Exceptions
```
No exceptions noted.
```

#### Exceptions Found (Qualified)
```
For [X] of [Y] items tested, [description of the deviation]. 
The exception was due to [root cause].
[Management's response / remediation if applicable.]
```

### Type I vs Type II Differences

| Aspect | Type I | Type II |
|--------|--------|--------|
| Tests | Design effectiveness only | Design AND operating effectiveness |
| Sample sizes | 1 per control (design walk-through) | Frequency-based or statistical samples |
| Period | As of a specific date | Throughout the specified period |
| Operating effectiveness | Not tested | Tested via sampling |
| Results language | "Suitably designed" | "Suitably designed and operated effectively" |

---

## Optional Section V: Other Information

Management may include additional information such as:

- Future plans for the system
- Additional controls not tested
- Management's remediation plans for exceptions
- Additional context about the business

**Important:** The service auditor's opinion does NOT cover Section V. Include a disclaimer:
```
The information in Section V is presented by management of [Service Organization] 
to provide additional information and is not a part of the [Service Organization's] 
description of its system. The information in Section V has not been subjected to 
the procedures applied in the examination of the description of the system and of 
the suitability of the design and operating effectiveness of controls, and 
accordingly, we express no opinion on it.
```

---

## Report Assembly Checklist

- [ ] Section I: Opinion — appropriate type (unqualified/qualified/adverse)
- [ ] Section I: All required paragraphs present (scope, responsibilities, limitations, opinion, restriction)
- [ ] Section I: Correct dates and period
- [ ] Section I: Correct TSC categories listed
- [ ] Section II: All required assertions present
- [ ] Section II: Assertions consistent with Section I
- [ ] Section II: Signed by management
- [ ] Section III: Meets DC 200 description criteria
- [ ] Section III: All five system components addressed
- [ ] Section III: Boundaries clearly defined
- [ ] Section III: CUECs and CSOCs listed
- [ ] Section IV: All in-scope controls tested
- [ ] Section IV: Test descriptions match procedures performed
- [ ] Section IV: Results accurately reflect findings
- [ ] Section IV: Exceptions properly described
- [ ] Cross-reference: Controls in Section IV map to Section III
- [ ] Cross-reference: Criteria in Section IV align with scope in Section I
- [ ] Dates consistent across all sections
