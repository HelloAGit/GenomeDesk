# Next integrations

## Hosting this prototype

Deploy the Docker image on a service with a persistent writable volume at `/service/data`; use one application instance for this SQLite prototype. Configure `BACKEND_API_KEY`, `CORS_ORIGINS`, `NEBIUS_API_KEY`, and `NEBIUS_MODEL` as backend secrets/environment variables. Terminate TLS at the host ingress. Never use ephemeral storage if imports must survive restarts. Enforce request-body size limits at the reverse proxy as well as application limits: multipart parsing occurs before the endpoint's file-size check.

Use synthetic/approved public data while prototyping. Before handling real genomic data, implement identity-based authorisation, project ownership, audit history, retention/deletion policies, encrypted storage/backups, and approved provider data-handling arrangements. The current API does not implement per-user isolation, quotas or rate limits.

## FASTQ milestone (not implemented)

1. Add PostgreSQL models for projects, samples, jobs, artifacts and provenance.
2. Add private object storage and scoped, expiring upload URLs.
3. Run a separate queued worker using Celery/Redis and Nextflow.
4. Pin a tested nf-core/sarek release, container digests and reference resources.
5. Validate read pairing, organism, assay, reference assembly and requested tools before launch.
6. Record job status, logs, input checksums, resource use and tool versions.
7. Parse actual QC and annotation outputs; do not fabricate chart metrics.
8. Add indexed BAM/CRAM/VCF tracks and reference-consistent igv.js access.

Do not accept arbitrary shell commands or Nextflow scripts from users. Long-running genomics jobs must run outside web requests. Benchmark compute/storage costs on representative datasets before scaling. A GPU is not required for this VCF backend or for calling the hosted Nebius API.

## Evidence-backed interpretation

Add versioned annotations and retrieval from curated sources before variant-specific explanations. Preserve evidence identifiers and retrieval dates; support missing/conflicting evidence. The current assistant receives aggregate VCF statistics only and has no literature retrieval or clinical classification functionality.
