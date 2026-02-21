# Yago App Platform Technical Plan

## Executive Summary
Yago is a point-of-sale (POS) platform built to support small and mid-sized retailers with unified in-store and online sales. The system must provide reliable checkout flows, accurate inventory synchronization, and insightful analytics while remaining extensible for future business needs. This document describes the target architecture, key workflows, and implementation roadmap. Notes labeled **Improvement** indicate optimizations added during this review to strengthen the original plan.

## Product Goals
- Offer intuitive checkout tools for cashiers and self-service kiosks.
- Keep inventory, pricing, and promotions synchronized across channels in near real time.
- Deliver actionable reporting dashboards for store managers and headquarters.
- Support integrations with payment providers, accounting suites, and e-commerce platforms.
- Maintain offline capability for core POS flows with graceful resynchronization.

## High-Level Architecture
- **Client Applications**: Web-based cashier console (desktop touchscreen) and optional tablet companion. Both built with React + TypeScript and packaged via Electron for kiosk deployment. Offline storage via IndexedDB and Service Workers.
- **API Gateway**: Node.js (NestJS) service exposing REST + GraphQL endpoints, handling request validation, authentication, and routing. **Improvement**: Introduce rate limiting and schema versioning at the gateway to avoid breaking dependent stores during releases.
- **Domain Microservices** (containerized with Docker, orchestrated via Kubernetes):
  - **Auth Service** (NestJS + PostgreSQL) managing users, roles, and session tokens with OAuth2 support for external partners.
  - **Catalog Service** (Node.js/NestJS + PostgreSQL) storing products, categories, prices, and promotions.
  - **Inventory Service** (Go + PostgreSQL + Redis) tracking stock levels per location; emits events when thresholds breached.
  - **Sales Service** (Go + PostgreSQL + Kafka) recording transactions, handling refunds, and calculating taxes/discounts.
  - **Payments Adapter** (Node.js + third-party SDKs) abstracting payment gateways (Stripe, Adyen, offline card terminals). **Improvement**: Wrap payment calls in a circuit breaker pattern and add idempotency keys to safeguard against duplicate charges.
  - **Reporting & Analytics** (Python/FastAPI + BigQuery) aggregating sales and inventory data; exports to BI tools.
  - **Notification Service** (Python + Redis Streams) dispatching email/SMS/webhook alerts to staff and partners.
- **Integration Layer**: Kafka topics for event-driven data exchange; Change Data Capture (CDC) into the data warehouse. **Improvement**: Add an event schema registry (Apicurio) to enforce compatibility.
- **Data Stores**:
  - PostgreSQL cluster with logical replication for OLTP workloads.
  - Redis for caching session tokens, inventory lookups, and short-lived data.
  - Kafka for asynchronous workflows.
  - BigQuery (or Snowflake) for analytics.
  - S3-compatible object storage for receipts, invoices, and exports.
- **Infrastructure**: Deployed on AWS using EKS, managed PostgreSQL (Aurora), MSK for Kafka, and CloudFront for CDN. Terraform for IaC; ArgoCD for GitOps deployment.

## Security & Compliance
- JWT access tokens with refresh tokens stored securely.
- RBAC with fine-grained permissions for cashier, manager, and admin roles.
- PCI DSS compliant handling of payment data; all card handling done via tokenization.
- **Improvement**: Adopt confidential secret storage (AWS Secrets Manager) and enforce TLS mutual authentication between internal services handling payments.

## Observability & Reliability
- Centralized logging (Elastic Stack) with correlation IDs passed through headers.
- Metrics via Prometheus + Grafana dashboards for service health.
- Tracing with OpenTelemetry exporters to Jaeger.
- Error budgets defined per service; SLO alerts integrated with PagerDuty.
- **Improvement**: Add synthetic monitoring scripts that execute critical flows (checkout, refund) every 5 minutes to detect regressions.

## Offline & Resilience Strategy
- POS clients cache product catalog, tax rules, and recent orders locally.
- Offline mode queues transactions locally with timestamp, cashier ID, and device signature.
- Background sync service retries batches with exponential backoff once connectivity returns.
- **Improvement**: Provide visual cues to cashiers about sync status and allow manual conflict resolution when inventory discrepancies occur.

## Data Model Highlights
- **Product**: id, sku, barcode, title, description, price tiers, tax class, category_id.
- **InventoryLevel**: id, product_id, location_id, on_hand, reserved, reorder_point.
- **Order**: id, order_number, location_id, register_id, cashier_id, customer_id, line_items[], subtotal, discount, total, payment snapshot, status lifecycle (`draft` → `paid` → `completed`).
- **Payment**: id, provider, amount, currency, status, metadata.
- **Customer**: id, loyalty_id, contact info, consent flags.
- **Promotion**: id, rule_type, trigger, reward, schedule.
- **Improvement**: Add `sales_channel` dimension to orders to support omnichannel analytics.

## Key Workflows
1. **Checkout Flow**
   1. Cashier scans items; POS client fetches price/discount from Catalog Service.
   2. POS client calls Sales Service to create a pending order.
   3. Payment Adapter processes payment; success triggers Sales Service to finalize order and emit `order.completed` event.
   4. Inventory Service consumes event, decrements stock, and updates thresholds.
   5. Notification Service sends receipt via email/SMS.
2. **Inventory Adjustment**
   1. Manager submits adjustment via web dashboard.
   2. Inventory Service records change and publishes `inventory.adjusted`.
   3. Catalog Service updates availability flags; Analytics pipeline consumes for reporting.
3. **Reporting Dashboard Refresh**
   1. Analytics service schedules nightly ETL from OLTP to warehouse.
   2. Precomputed aggregates stored for fast dashboard rendering.
   3. **Improvement**: Add incremental micro-batch processing every hour to keep reports fresh without full reloads.

## API Design Principles
- REST endpoints under `/api/v1` with consistent naming; GraphQL for custom dashboard queries.
- Use JSON:API conventions for pagination, filtering, and error responses.
- Async webhooks for third-party integrations.
- **Improvement**: Publish OpenAPI specs and automatically validate contracts in CI.

## DevOps Pipeline
- Monorepo with Nx managing front-end and back-end packages.
- CI: GitHub Actions running lint, unit/integration tests, and contract tests.
- CD: ArgoCD watches container registry tags; staged rollouts with canary deployments.
- Feature flags via LaunchDarkly for gradual feature exposure.
- **Improvement**: Add load testing stage (k6) before production promotion to guarantee throughput targets.

## User Experience Considerations
- Touch-friendly UI with large tappable targets and high-contrast themes.
- Accessibility compliance (WCAG 2.1 AA) for color, keyboard navigation, and screen readers.
- Configurable quick-action buttons for popular items.
- **Improvement**: Add guided onboarding checklists for new staff and contextual tooltips triggered by activity logs.

## Implementation Roadmap
1. Platform foundations: infra setup, CI/CD, authentication.
2. Core POS MVP: Catalog, Inventory, Sales, Payments, cashier UI with offline support.
3. Reporting & analytics dashboards.
4. Integrations (accounting, e-commerce).
5. Advanced features: loyalty, gift cards, AI-assisted upsell recommendations.
6. Continuous optimization based on telemetry and user feedback.

## Risks & Mitigations
- **Connectivity failures**: Provide offline queueing and device health checks.
- **Data consistency**: Apply saga patterns with compensating actions for multi-service transactions.
- **Scalability**: Horizontal autoscaling with resource quotas; load testing before major releases.
- **Security breaches**: Regular penetration tests, dependency scanning, and security incident response playbooks.
- **Change management**: Offer training materials, sandbox environments, and phased rollouts.

## Appendix: Terminology
- **POS**: Point of Sale.
- **CDC**: Change Data Capture.
- **SLO**: Service Level Objective.
- **ETL**: Extract, Transform, Load.

