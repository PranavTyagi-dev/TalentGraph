// Expected mistakes become readable HTTP errors. Express handles thrown errors centrally.
export function fail(status, message) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

export function field(value, label, max = 180, required = true) {
  if (typeof value !== 'string') fail(400, `Enter a valid ${label}.`);
  const clean = value.trim();
  if (required && !clean) fail(400, `Enter a ${label}.`);
  if (clean.length > max) fail(400, `${label} must be ${max} characters or fewer.`);
  return clean;
}

export function positiveId(value) {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1 || id > 2147483647) fail(400, 'Invalid record number.');
  return id;
}

export const pageSize = 6;

export function pageOptions(query) {
  const page = positiveId(query.page ?? 1);
  if (page > 1000000) fail(400, 'Page number is too large.');
  return { skip: (page - 1) * pageSize, take: pageSize };
}

export function contains(value) {
  return { contains: field(value ?? '', 'search', 100, false), mode: 'insensitive' };
}
