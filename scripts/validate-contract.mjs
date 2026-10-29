import * as validators from './schema-validators.mjs';
import { semanticErrors } from './contract-semantics.mjs';

/** Portable generated schema + shared semantics. No repository/development dependency. */
export function validateContract(name, value) {
  const validate = validators[name.replaceAll('-', '_')];
  if (typeof validate !== 'function') return ['unknown contract: ' + name];
  if (!validate(value)) return validate.errors.map(error => (error.instancePath || '/') + ' ' + error.message);
  return semanticErrors(name, value);
}
