import fs from 'fs';
import path from 'path';

export interface SearchTag {
  id: string;
  label: string;
  icon: string;
  href: string;
  enabled: boolean;
  order: number;
}

const DATA_PATH = path.join(process.cwd(), 'src/data/search-tags.json');

export function readSearchTags(): SearchTag[] {
  const raw = fs.readFileSync(DATA_PATH, 'utf-8');
  return JSON.parse(raw) as SearchTag[];
}

export function writeSearchTags(tags: SearchTag[]): void {
  fs.writeFileSync(DATA_PATH, JSON.stringify(tags, null, 2), 'utf-8');
}
