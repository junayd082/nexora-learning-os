import type { Locale } from './brand';

export type Role = 'student' | 'teacher' | 'admin';

export interface Profile {
  id: string;
  display_name: string;
  role: Role;
  locale: Locale;
  bio: string | null;
  is_platform_admin: boolean;
  is_demo: boolean;
  created_at: string;
}

export interface Viewer {
  id: string;
  email: string | null;
  profile: Profile;
  isEducator: boolean;
}

export interface Translation {
  locale: string;
  title: string;
  short_description: string | null;
  description: string | null;
  learning_objective: string | null;
  student_instructions: string | null;
  machine_translated: boolean;
}

export interface World {
  id: string;
  slug: string;
  name: string;
  name_es: string | null;
  description: string | null;
  description_es: string | null;
  accent: string;
  sort_order: number;
}

export interface ExperienceRow {
  id: string;
  slug: string;
  creator_id: string | null;
  creator_name: string | null;
  world_id: string | null;
  type: string;
  subject: string | null;
  grade_range: string | null;
  difficulty: string | null;
  duration_minutes: number | null;
  resource_url: string | null;
  embed_url: string | null;
  worksheet_url: string | null;
  thumbnail_url: string | null;
  tags: string[];
  skills: string[];
  visibility: 'private' | 'organization' | 'public';
  status: 'draft' | 'published' | 'archived';
  quality: string | null;
  version: string;
  default_locale: string;
  launch_count: number;
  remixed_from: string | null;
  is_demo: boolean;
  created_at: string;
  updated_at: string;
  source?: 'link' | 'file' | 'app';
  file_path?: string | null;
  file_name?: string | null;
  file_mime?: string | null;
  file_size?: number | null;
  app_id?: string | null;
  launch_mode?: 'embed' | 'newtab';
  experience_translations: Translation[];
  worlds?: Pick<World, 'slug' | 'name' | 'name_es' | 'accent'> | null;
}

/** An experience with its text resolved for one content language. */
export interface Experience extends Omit<ExperienceRow, 'experience_translations'> {
  t: Translation;
  contentLocale: string;
  available: string[];
}

export interface App {
  id: string;
  slug: string;
  name: string;
  category: string;
  url: string;
  launch_mode: 'embed' | 'newtab';
  color: string;
  description: string | null;
  description_es: string | null;
  is_builtin: boolean;
  owner_id: string | null;
  visibility: string;
}

export interface Material {
  id: string;
  class_id: string;
  parent_id: string | null;
  kind: 'folder' | 'experience' | 'assignment' | 'link' | 'file' | 'page' | 'app' | 'quiz';
  quiz_id?: string | null;
  timer_minutes?: number | null;
  timer_mode?: 'manual' | 'bell' | null;
  title: string;
  body: string | null;
  color: string | null;
  experience_id: string | null;
  assignment_id: string | null;
  app_id: string | null;
  url: string | null;
  file_path: string | null;
  file_name: string | null;
  file_mime: string | null;
  file_size: number | null;
  position: number;
  published: boolean;
  created_at: string;
  lesson_date: string | null;
  due_at: string | null;
  tag: Tag | null;
}

export type Tag = 'do_now' | 'lecture' | 'activity' | 'homework' | 'exit_ticket' | 'resource';

export interface SubmissionFile { path: string; name: string; mime: string; size: number }
