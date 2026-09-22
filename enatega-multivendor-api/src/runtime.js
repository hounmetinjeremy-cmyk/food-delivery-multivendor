// Minimal GraphQL runtime for Enatega API (no external deps)

function skipSpaces(s, i) {
  while (i < s.length && /\s/.test(s[i])) i++;
  return i;
}

function readIdent(s, i) {
  if (!(i < s.length && /[A-Za-z_]/.test(s[i]))) return null;
  let start = i;
  i++;
  while (i < s.length && /[A-Za-z0-9_]/.test(s[i])) i++;
  return s.slice(start, i);
}

function skipBalanced(s, i, open, close) {
  let depth = 0;
  do {
    if (s[i] === open) depth++;
    else if (s[i] === close) depth--;
    i++;
  } while (i < s.length && depth > 0);
  return i;
}

function parseValue(s, i, variables) {
  i = skipSpaces(s, i);
  const c = s[i];
  if (c === '{') return parseObject(s, i, variables);
  if (c === '[') return parseArray(s, i, variables);
  if (c === '"') {
    let j = i + 1;
    let out = '';
    while (j < s.length && s[j] !== '"') {
      if (s[j] === '\\') {
        j++;
        if (j < s.length) out += s[j];
      } else {
        out += s[j];
      }
      j++;
    }
    return { value: out, i: j + 1 };
  }
  if (s.startsWith('true', i)) return { value: true, i: i + 4 };
  if (s.startsWith('false', i)) return { value: false, i: i + 5 };
  if (s.startsWith('null', i)) return { value: null, i: i + 4 };
  if (c === '$') {
    const name = readIdent(s, i + 1);
    return { value: variables[name], i: i + 1 + name.length };
  }
  let j = i;
  while (j < s.length && !/\s|[,\)\]\}]/.test(s[j])) j++;
  const raw = s.slice(i, j);
  const num = Number(raw);
  return Number.isNaN(num) ? { value: raw, i: j } : { value: num, i: j };
}

function parseArray(s, i, variables) {
  i++;
  i = skipSpaces(s, i);
  const arr = [];
  while (i < s.length && s[i] !== ']') {
    const r = parseValue(s, i, variables);
    arr.push(r.value);
    i = skipSpaces(s, r.i);
    if (s[i] === ',') { i++; i = skipSpaces(s, i); }
  }
  i++;
  return { value: arr, i };
}

function parseObject(s, i, variables) {
  i++;
  i = skipSpaces(s, i);
  const obj = {};
  while (i < s.length && s[i] !== '}') {
    const key = readIdent(s, i);
    if (!key) break;
    i += key.length;
    i = skipSpaces(s, i);
    if (s[i] === ':') i++;
    i = skipSpaces(s, i);
    const r = parseValue(s, i, variables);
    obj[key] = r.value;
    i = skipSpaces(s, r.i);
    if (s[i] === ',') { i++; i = skipSpaces(s, i); }
  }
  i++;
  return { value: obj, i };
}

function parseArgs(s, i, variables) {
  i++;
  i = skipSpaces(s, i);
  const args = {};
  while (i < s.length && s[i] !== ')') {
    const key = readIdent(s, i);
    if (!key) break;
    i += key.length;
    i = skipSpaces(s, i);
    if (s[i] === ':') i++;
    i = skipSpaces(s, i);
    const r = parseValue(s, i, variables);
    args[key] = r.value;
    i = skipSpaces(s, r.i);
    if (s[i] === ',') { i++; i = skipSpaces(s, i); }
  }
  i++;
  return { value: args, i };
}

export function parseTopField(query, variables = {}) {
  const q = query.replace(/#.*/g, '').replace(/\/\*.*?\*\//gs, '');
  let i = skipSpaces(q, 0);
  let kind = 'query';
  if (q.startsWith('query', i)) {
    kind = 'query';
    i += 5;
  } else if (q.startsWith('mutation', i)) {
    kind = 'mutation';
    i += 8;
  }
  i = skipSpaces(q, i);
  const ident = readIdent(q, i);
  if (ident) {
    const afterIdent = skipSpaces(q, i + ident.length);
    if (q[afterIdent] === '(') i = skipBalanced(q, afterIdent, '(', ')');
    else i = afterIdent;
  }
  i = skipSpaces(q, i);
  if (q[i] === '{') i++;
  i = skipSpaces(q, i);
  const fieldName = readIdent(q, i);
  if (!fieldName) throw new Error('Missing operation field');
  i += fieldName.length;
  i = skipSpaces(q, i);
  let args = {};
  if (q[i] === '(') {
    const r = parseArgs(q, i, variables);
    args = r.value;
    i = r.i;
  }
  return { kind, field: fieldName, args };
}

export async function execute({ query, variables = {} }, resolvers, context) {
  const { kind, field, args } = parseTopField(query, variables);
  const resolverMap = kind === 'mutation' ? resolvers.Mutation : resolvers.Query;
  const resolver = resolverMap[field];
  if (!resolver) throw new Error(`Unknown ${kind}: ${field}`);
  const result = await resolver({}, args, context);
  return { [field]: result };
}
