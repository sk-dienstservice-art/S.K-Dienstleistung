import fs from 'node:fs';
import path from 'node:path';

// Bundle these dependency-free named ES modules while preserving each private scope.
export function bundleApp(root, {stripBoot = false} = {}) {
  const modules = new Map(), ordered = [];
  const importPattern = /^import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"];?\s*$/gm;
  const binding = names => names.split(',').map(n => n.trim().replace(/\s+as\s+/, ':')).join(',');
  function read(file, entry = false) {
    if (modules.has(file)) return modules.get(file).id;
    const id = '__werkpilotModule' + modules.size;
    let source = fs.readFileSync(path.join(root, 'dist', file), 'utf8');
    const module = {id, source}; modules.set(file, module);
    source = source.replace(importPattern, (_, names, reference) => {
      if (!reference.startsWith('./')) throw Error('Unsupported module: ' + reference);
      return `const {${binding(names)}}=${read(reference.slice(2))};`;
    });
    const exports = [...source.matchAll(/\bexport\s+(?:async\s+)?(?:const|let|function|class)\s+(\w+)/g)].map(m => m[1]);
    source = source.replace(/\bexport\s+/g, '');
    if (entry && stripBoot) source = source.replace(/await load\(\);[\s\S]*$/, '');
    module.source = entry ? source : `const ${id}=(()=>{\n${source}\nreturn {${exports.join(',')}};\n})();`;
    ordered.push(module);
    return id;
  }
  read('app.js', true);
  return ordered.map(module => module.source).join('\n');
}
