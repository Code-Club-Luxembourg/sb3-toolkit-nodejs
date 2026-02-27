import { ScratchProject } from '../model';

/**
 * Load multiple `.sb3` files into `ScratchProject` instances.
 */
export async function loadProjects(paths: readonly string[]): Promise<ScratchProject[]> {
  const projects: ScratchProject[] = [];
  for (const path of paths) {
    projects.push(await ScratchProject.fromSb3File(path));
  }
  return projects;
}
