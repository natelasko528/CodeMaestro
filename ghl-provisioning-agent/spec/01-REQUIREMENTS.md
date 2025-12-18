# 01 — REQUIREMENTS

## 1. Product Summary
- **App name:** GHL Autopilot
- **One-liner:** Zero-touch GoHighLevel sub-account provisioning for agencies and SaaS platforms
- **Primary user:** Agency owners, SaaS-preneurs
- **Primary outcome:** Enable instant, automated sub-account setup and configuration with minimal manual intervention

## 2. Problem Statement
GoHighLevel agencies and SaaS platform operators currently face significant friction when provisioning new sub-accounts. Manual setup processes are time-consuming (typically 15-30 minutes per account), error-prone, require technical expertise, and don't scale efficiently. This creates bottlenecks for agency growth, increases operational overhead, and reduces the user onboarding experience. GHL Autopilot solves this by automating the entire sub-account provisioning lifecycle—from OAuth authentication through account initialization, snapshot selection, and team member assignment—enabling agencies to scale their operations without proportional increases in operational burden.

## 3. Success Criteria
- **Provisioning Speed:** Complete sub-account provisioning within 5 minutes from initiation to production-ready state
- **Reliability:** Achieve 95% success rate for sub-account creation and configuration operations
- **Throughput:** Enable provisioning of 50+ sub-accounts per day without system degradation
- **Error Recovery:** Automatic rollback and user notification for failed provisioning attempts within 30 seconds
- **User Satisfaction:** Reduce manual intervention requirements to <5% of provisioning operations

## 4. Scope
### In-Scope
- OAuth 2.0 authentication and token management with GoHighLevel API
- Automated sub-account creation with zero-touch initialization
- AI-powered snapshot selection and application to new accounts
- Custom value field injection (agency branding, custom settings, workflows)
- Team member provisioning and role assignment to sub-accounts
- Real-time provisioning status monitoring and progress tracking
- Comprehensive error handling with automatic remediation where possible
- Audit logging of all provisioning operations for compliance and debugging
- Settings management for provisioning configurations
- Rate limit handling and queuing for high-volume provisioning scenarios
- Webhook event handling for external triggering of provisioning workflows

### Out of Scope
- Manual sub-account management after initial provisioning
- Advanced reporting and analytics dashboards beyond audit logs
- Multi-region GoHighLevel deployments (US-only initially)
- Custom code deployment or plugin installation during provisioning
- Direct database access or system administration capabilities
- User training or onboarding beyond provisioning automation
- Integration with payment processing or subscription management systems

## 5. User Stories (Must-have)

- **R-001: OAuth Setup and Token Management**
  As an agency owner, I want to securely authenticate with GoHighLevel via OAuth 2.0 so that the system can provision sub-accounts on my behalf.
  **Acceptance Criteria:**
  - AC-001.1: System implements OAuth 2.0 authorization code flow with GoHighLevel API
  - AC-001.2: OAuth tokens are encrypted at rest and in transit using industry-standard encryption
  - AC-001.3: Token refresh mechanism automatically updates expired tokens without user intervention
  - AC-001.4: OAuth connection status is displayed and can be revoked from the settings dashboard
  - AC-001.5: Audit log captures all token creation, refresh, and revocation events

- **R-002: Sub-Account Creation**
  As an agency owner, I want to create new sub-accounts with a single click so that I can scale my operations without manual API calls.
  **Acceptance Criteria:**
  - AC-002.1: Sub-account creation form accepts company name, primary contact, and optional settings
  - AC-002.2: System calls GoHighLevel API to create sub-account within 30 seconds
  - AC-002.3: New sub-account receives unique ID and is ready for configuration within 60 seconds
  - AC-002.4: Creation failure triggers automatic retry up to 3 times before alerting user
  - AC-002.5: Successful creation returns sub-account dashboard link for immediate access

- **R-003: AI Snapshot Selection**
  As an agency owner, I want the system to intelligently select and apply appropriate snapshots to new sub-accounts based on use case so that configuration is automated and consistent.
  **Acceptance Criteria:**
  - AC-003.1: System displays available snapshots during sub-account provisioning workflow
  - AC-003.2: AI analyzes company metadata to recommend optimal snapshot configuration
  - AC-003.3: Snapshot application completes within 2 minutes of sub-account creation
  - AC-003.4: Users can override AI recommendations and select alternative snapshots
  - AC-003.5: Snapshot application includes workflow duplication and CRM template setup

- **R-004: Custom Value Injection**
  As an agency owner, I want to inject custom values (branding, API keys, workflow variables) into new sub-accounts so that accounts are pre-configured for specific client needs.
  **Acceptance Criteria:**
  - AC-004.1: System provides interface to define custom value templates (key-value pairs)
  - AC-004.2: Custom values are securely stored and applied during sub-account initialization
  - AC-004.3: Support for 50+ common GoHighLevel custom fields and API properties
  - AC-004.4: Template variables support dynamic values based on sub-account metadata
  - AC-004.5: Audit log captures all custom value injections with before/after state

- **R-005: Team Member Provisioning and Role Assignment**
  As an agency owner, I want to automatically assign team members to new sub-accounts with appropriate roles so that team collaboration is enabled immediately upon sub-account creation.
  **Acceptance Criteria:**
  - AC-005.1: System accepts CSV or API input for team member email addresses and role assignments
  - AC-005.2: Team members are added to sub-account with appropriate permissions (admin, manager, user)
  - AC-005.3: Invitation emails are sent to team members within 5 minutes of provisioning
  - AC-005.4: System tracks team member acceptance and provides status dashboard
  - AC-005.5: Role-based access control prevents unauthorized access to sub-account resources

- **R-006: Real-Time Provisioning Monitoring**
  As an agency owner, I want to monitor the status of sub-account provisioning in real-time so that I can track progress and intervene if needed.
  **Acceptance Criteria:**
  - AC-006.1: Provisioning dashboard displays real-time status updates for each provisioning job
  - AC-006.2: Status updates are pushed to browser via WebSocket with <1 second latency
  - AC-006.3: System displays estimated time remaining and completion percentage
  - AC-006.4: Failed steps are highlighted with error details and suggested remediation
  - AC-006.5: Historical view shows all past provisioning jobs with success/failure status

- **R-007: Error Handling and Automatic Remediation**
  As a system operator, I want the provisioning system to handle errors gracefully and attempt automatic recovery so that failures don't block user workflows.
  **Acceptance Criteria:**
  - AC-007.1: System implements exponential backoff retry logic for transient API failures
  - AC-007.2: API rate limit errors trigger automatic queuing and delayed retry
  - AC-007.3: Authentication failures trigger immediate user notification and token refresh attempt
  - AC-007.4: Partial failures (e.g., sub-account created but snapshot not applied) are rolled back
  - AC-007.5: Failed provisioning attempts are logged for debugging with full error context

- **R-008: Comprehensive Audit Logging**
  As a compliance officer, I want all provisioning operations to be logged with full context so that I can audit access and changes for compliance purposes.
  **Acceptance Criteria:**
  - AC-008.1: Every provisioning operation is logged with timestamp, user, and action details
  - AC-008.2: Audit log includes all API requests/responses with sanitized sensitive data (tokens masked)
  - AC-008.3: Audit logs are immutable and retained for minimum 1 year
  - AC-008.4: System provides audit log search and filter interface for compliance review
  - AC-008.5: Audit data includes IP address, user agent, and session identifier for security analysis

- **R-009: Provisioning Settings and Configuration Management**
  As an agency owner, I want to configure default provisioning settings (templates, roles, custom fields) so that I can standardize and customize the provisioning process for my organization.
  **Acceptance Criteria:**
  - AC-009.1: Settings interface allows defining default snapshot, custom values, and team role templates
  - AC-009.2: Settings support per-team-member role definitions and provisioning preferences
  - AC-009.3: Configuration changes are versioned and rollback capability is provided
  - AC-009.4: Settings are validated before application to prevent invalid configurations
  - AC-009.5: Settings include options to enable/disable specific provisioning steps

- **R-010: Rate Limit Handling and Queue Management**
  As a system operator, I want the provisioning system to gracefully handle GoHighLevel API rate limits so that high-volume provisioning requests don't fail.
  **Acceptance Criteria:**
  - AC-010.1: System monitors API rate limit headers and implements token bucket algorithm
  - AC-010.2: Provisioning requests are automatically queued when rate limit is approaching
  - AC-010.3: Queue management system prioritizes requests based on creation time (FIFO)
  - AC-010.4: System provides visibility into queue status with ETA for processing
  - AC-010.5: Rate limit violations are logged with attempted remediation actions

## 6. Non-Functional Requirements
- **Performance:** Provisioning pipeline completes within 5 minutes; API response times <2 seconds; dashboard real-time updates <1 second latency
- **Reliability:** 99.5% system uptime; automatic failover for critical components; redundant data storage
- **Security:** OAuth tokens encrypted using AES-256; HTTPS/TLS 1.3 for all communication; GDPR compliance with data retention policies; PII masking in logs; no plaintext credential storage
- **Accessibility:** WCAG 2.1 AA compliance for web interface; keyboard navigation support; screen reader compatibility
- **Observability:** Structured logging with correlation IDs; distributed tracing for API calls; real-time metrics dashboard; alerting for provisioning failures

## 7. Constraints
- **Budget/Stack Constraints:** Free or low-cost cloud services; open-source components preferred; no enterprise SaaS dependencies
- **Hosting Constraints:** Deployed on Vercel serverless platform; <50MB deployment size; cold start latency <3 seconds
- **Compliance Constraints:** GDPR compliance for EU users; SOC 2 Type II audit readiness; PCI DSS baseline security controls (no payment processing)
- **API Constraints:** GoHighLevel API rate limits (100 req/min); dependent on GHL API availability and stability

## 8. Assumptions
- GoHighLevel API remains stable and maintains backward compatibility during development and deployment
- Agency owners have valid GoHighLevel accounts with admin/owner permissions to create sub-accounts
- OAuth tokens are treated as sensitive credentials and will not be shared across sessions
- Provisioning requests are initiated by authenticated, authorized users with explicit sub-account creation permissions
- Network connectivity to GoHighLevel API and external services (email, logging) is available and reliable
- Initial deployment targets US-based GoHighLevel deployments only

## 9. Open Questions
- Should provisioning support template versioning and rollback to previous configurations?
- Will the system support bulk provisioning via CSV import, and what are the file size and rate limits?
- Should team member invitations use email tokens or magic links, and what is the invitation expiration window?
- What is the maximum number of custom value fields that can be injected per sub-account?
- Should the system support scheduled provisioning (provision at future date/time) or only immediate provisioning?
- Will there be a webhook API for external systems to trigger provisioning workflows, and what authentication model should be used?
- What level of audit log retention is required (90 days, 1 year, 7 years)?
- Should the system support provisioning to multiple GoHighLevel agencies or only a single parent account?
