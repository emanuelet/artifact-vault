export type Bucket = 'operational' | 'understanding';

export interface Artifact {
  id: string;
  title: string;
  tags: string[];
  source: string;
  createdAt: string;
  bucket: Bucket;
  sizeBytes: number;
}

export interface Manifest {
  artifacts: Artifact[];
}
