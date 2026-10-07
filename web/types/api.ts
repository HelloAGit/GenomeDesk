export interface QC {
  record_count: number;
  pass_record_count: number;
  unfiltered_record_count: number;
  mean_variant_quality: number | null;
  quality_observation_count: number;
  mean_site_depth: number | null;
  depth_observation_count: number;
  records_by_chromosome: Record<string, number>;
  limitations: string[];
}
export interface Sample {
  id: string;
  name: string;
  assembly: "GRCh37" | "GRCh38";
  created_at: string;
  sha256: string;
  size_bytes: number;
  declared_reference: string | null;
  reference_verification: string;
  summary: QC;
}
export interface Variant {
  chromosome: string;
  position: number;
  reference: string;
  alternates: string[];
  quality: number | null;
  filters: string[];
  site_depth: number | null;
}
export interface VariantPage {
  total: number;
  offset: number;
  limit: number;
  items: Variant[];
}
export interface Capabilities {
  vcf_import: boolean;
  fastq_processing: boolean;
  annotation: boolean;
  authentication: string;
  ai_configured: boolean;
  max_upload_bytes: number;
  max_records: number;
}
export interface Explanation {
  text: string;
  model: string;
  generated_at: string;
  review_required: boolean;
  source_metrics: QC;
}
