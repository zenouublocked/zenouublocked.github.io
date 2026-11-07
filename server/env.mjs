// Minimal .env loader. No dependency, no surprises: KEY=VALUE per line, `#`
// comments, optional surrounding quotes. Real environment variables always win,
// so a shell export or a host's dashboard overrides the file.
import fs from 'node:fs';
import path from 'node:path';

export function loadEnv(root) {
  const file = path.join(root, '.env');
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    return { file, loaded: 0 };
  }

  let loaded = 0;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] !== undefined) continue;
    process.env[key] = value;
    loaded += 1;
  }
  return { file, loaded };
}
