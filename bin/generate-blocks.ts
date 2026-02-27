#!/usr/bin/env tsx
/**
 * Generates the typed per-block factory classes in src/builder/blocks/ from
 * the enriched opcode metadata in src/validator/opcodes.ts.
 *
 * Run via `npm run generate-blocks`. Output is committed; runtime users never
 * need to run this. Re-run whenever the opcode metadata changes.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { OPCODE_METADATA, type OpcodeMetadata } from '../src/validator/opcodes';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.resolve(HERE, '../src/builder/blocks');

const CATEGORIES: Record<string, { className: string; fileSlug: string }> = {
  motion: { className: 'Motion', fileSlug: 'motion' },
  looks: { className: 'Looks', fileSlug: 'looks' },
  sound: { className: 'Sound', fileSlug: 'sound' },
  event: { className: 'Events', fileSlug: 'events' },
  control: { className: 'Control', fileSlug: 'control' },
  sensing: { className: 'Sensing', fileSlug: 'sensing' },
  operator: { className: 'Operators', fileSlug: 'operators' },
  data: { className: 'Data', fileSlug: 'data' },
  pen: { className: 'Pen', fileSlug: 'pen' }
};

function paramName(name: string): string {
  const parts = name.toLowerCase().split('_');
  const first = parts.shift() ?? '';
  return first + parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('');
}

function fieldFile(enumName: string): string {
  // CamelCase → kebab-case
  return enumName.replace(/([A-Z])/g, (_, c, i) => (i === 0 ? c.toLowerCase() : `-${c.toLowerCase()}`));
}

interface MethodParts {
  params: Array<{ type: string; name: string; doc?: string }>;
  calls: string[];
  uses: Set<string>;
}

function buildMethodParts(opcode: string, spec: OpcodeMetadata): MethodParts {
  const inputs = spec.i ?? {};
  const fields = spec.f ?? {};
  const params: MethodParts['params'] = [];
  const calls: string[] = [];
  const uses = new Set<string>();
  const substacks: string[] = [];

  for (const [name, role] of Object.entries(inputs)) {
    if (role === 'substack') {
      substacks.push(name);
      continue;
    }
    if (role.startsWith('menu:')) {
      const parts = role.split(':');
      const menuOpcode = parts[1] ?? '';
      const menuField = parts[2] ?? '';
      const enumName = parts[3] === 'enum' ? parts[4] ?? null : null;

      const p = paramName(name);
      // Field enums are themselves string-union types, so include just `Enum | Block`
      // rather than `Enum | string | Block` (the latter is a redundant union).
      const type = enumName !== null ? `${enumName} | Block` : 'string | Block';
      params.push({ type, name: p });
      calls.push(`.input('${name}', Input.menu('${menuOpcode}', '${menuField}', ${p}))`);
      uses.add('Input');
      if (enumName !== null) uses.add(`Field:${enumName}`);
      continue;
    }

    const p = paramName(name);
    let type: string;
    switch (role) {
      case 'number':
        type = 'number | Block | Input';
        break;
      case 'text':
        type = 'string | Block | Input';
        break;
      case 'any':
        type = 'number | string | Block | Input';
        break;
      case 'boolean':
        type = 'Block';
        break;
      case 'color':
        type = 'string | Input';
        break;
      default:
        throw new Error(`Unknown input role '${role}' on ${opcode}`);
    }
    params.push({ type, name: p });
    if (role === 'color') {
      calls.push(`.input('${name}', typeof ${p} === 'string' ? Input.color(${p}) : ${p})`);
      uses.add('Input');
    } else {
      calls.push(`.input('${name}', ${p})`);
    }
    if (type.includes('Input')) {
      uses.add('Input');
    }
  }

  for (const [name, kind] of Object.entries(fields)) {
    if (kind.startsWith('enum:')) {
      const enumName = kind.slice(5);
      const p = paramName(name);
      params.push({ type: enumName, name: p });
      calls.push(`.field('${name}', ${p})`);
      uses.add(`Field:${enumName}`);
      continue;
    }
    if (kind === 'variable' || kind === 'list' || kind === 'broadcast') {
      const refType = kind.charAt(0).toUpperCase() + kind.slice(1) + 'Ref';
      params.push({ type: refType, name: kind });
      calls.push(`.field('${name}', ${kind}.name, ${kind}.id)`);
      uses.add(refType);
      continue;
    }
    const p = paramName(name);
    params.push({ type: 'string', name: p });
    calls.push(`.field('${name}', ${p})`);
  }

  if (substacks.length > 0) {
    const names = ['body', 'otherwise'];
    substacks.forEach((substack, i) => {
      const pn = names[i] ?? `branch${i}`;
      params.push({ type: 'readonly Block[]', name: pn });
      calls.push(`.input('${substack}', Block.stack(${pn}))`);
    });
  }

  return { params, calls, uses };
}

function renderMethod(opcode: string, methodName: string, parts: MethodParts): string {
  const sigParams = parts.params.map((p) => `${p.name}: ${p.type}`).join(', ');
  const callChain = parts.calls.length === 0
    ? `Block.make('${opcode}')`
    : `Block.make('${opcode}')\n      ${parts.calls.join('\n      ')}`;
  return `  ${methodName}(${sigParams}): Block {\n    return ${callChain};\n  }`;
}

function renderClass(className: string, _fileSlug: string, opcodes: Array<[string, OpcodeMetadata]>): string {
  const methods: string[] = [];
  const uses = new Set<string>();
  const valueUses = new Set<string>(); // names used at runtime (need value import)
  for (const [opcode, spec] of opcodes) {
    if (!spec.name) continue;
    const parts = buildMethodParts(opcode, spec);
    for (const u of parts.uses) uses.add(u);
    methods.push(renderMethod(opcode, spec.name, parts));
  }

  // Decide which uses need value imports vs type-only imports.
  if (uses.has('Input')) {
    // Input is used as a value in color/menu wrappers AND as a type. Be conservative.
    valueUses.add('Input');
  }

  const imports: string[] = [];
  imports.push(`import { Block } from '../block';`);
  const fieldImports = [...uses].filter((u) => u.startsWith('Field:')).sort();
  for (const f of fieldImports) {
    const enumName = f.slice('Field:'.length);
    imports.push(`import type { ${enumName} } from '../field/${fieldFile(enumName)}';`);
  }
  if (uses.has('Input')) {
    // Determine if Input is used as a value (color helper, menu helper) or only as a type.
    const usedAsValue = methods.some(
      (m) => m.includes('Input.menu(') || m.includes('Input.color(')
    );
    imports.push(usedAsValue ? `import { Input } from '../input';` : `import type { Input } from '../input';`);
  }
  const refUses = [...uses].filter((u) => u.endsWith('Ref') && !u.startsWith('Field:')).sort();
  if (refUses.length > 0) {
    imports.push(`import type { ${refUses.join(', ')} } from '../refs';`);
  }

  const header = imports.join('\n');
  const doc = `/**\n * Typed factories for Scratch "${className}" blocks.\n *\n * Generated by bin/generate-blocks.ts — do not edit by hand.\n */`;
  return `${header}\n\n${doc}\nexport const ${className} = {\n${methods.join(',\n\n')}\n};\n`;
}

const byCategory = new Map<string, { className: string; fileSlug: string; opcodes: Array<[string, OpcodeMetadata]> }>();
for (const [opcode, rawSpec] of Object.entries(OPCODE_METADATA)) {
  const spec = rawSpec as OpcodeMetadata;
  if (spec.internal || !spec.name) continue;
  const prefix = opcode.split('_')[0];
  const category = CATEGORIES[prefix];
  if (!category) {
    process.stderr.write(`No category mapping for opcode '${opcode}'\n`);
    process.exit(1);
  }
  if (!byCategory.has(category.className)) {
    byCategory.set(category.className, { className: category.className, fileSlug: category.fileSlug, opcodes: [] });
  }
  byCategory.get(category.className)!.opcodes.push([opcode, spec]);
}

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

let written = 0;
for (const { className, fileSlug, opcodes } of byCategory.values()) {
  const filePath = path.join(OUTPUT_DIR, `${fileSlug}.ts`);
  fs.writeFileSync(filePath, renderClass(className, fileSlug, opcodes));
  process.stdout.write(`Generated ${className} (${opcodes.length} blocks)\n`);
  written += 1;
}
process.stdout.write(`Done: ${written} files.\n`);
