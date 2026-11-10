import type {ErrorObject} from 'ajv';
import {record} from './mqtt-protocol.js';
import {text, type Configuration} from './project.js';

const maximumIssues = 20;
const fields = new Set(['schema_version', 'revision', 'automations', 'sequences', 'mesh_peers', 'id', 'name', 'enabled', 'retrigger',
  'restart_policy', 'triggers', 'conditions', 'actions', 'type', 'device', 'property', 'operator', 'value', 'for_seconds', 'on_change',
  'start_only', 'at', 'timezone', 'after', 'before', 'weekdays', 'target', 'system', 'values', 'delay_seconds', 'event', 'latitude',
  'longitude', 'offset_minutes', 'scene_id', 'endpoint', 'sequence_id']);
const types = new Set(['number', 'integer', 'boolean', 'string', 'array', 'object']);
const limits = new Set(['minimum', 'maximum', 'minItems', 'maxItems', 'minLength', 'maxLength', 'minProperties', 'maxProperties']);
const reasons = new Set([...types, ...limits, 'required', 'type', 'enum', 'const', 'pattern', 'additionalProperties', 'uniqueItems',
  'not', 'discriminator', 'propertyNames', 'sequence_missing', 'sequence_nested', 'sequence_limit', 'sequence_delay',
  'sequence_duplicate', 'duplicate_id', 'timezone', 'time_window', 'remote_permission', 'yaml_syntax', 'scene_unavailable']);

interface Issue {path: string; reason: string; limit?: number}
interface Details {issues: Issue[]; truncated: boolean}

function safePath(parts: string[]): string {
  const safe: string[] = [];
  for (const part of parts) {
    if (!fields.has(part) && !/^(?:0|[1-9][0-9]{0,2})$/.test(part)) break;
    safe.push(part);
    // Keys inside device values belong to the user's configuration.
    if (part === 'value' || part === 'values') break;
  }
  return safe.length ? '/' + safe.join('/') : '';
}

function issueFrom(value: unknown): Issue | null {
  if (!record(value)) return null;
  const {path, reason, limit} = value;
  if (typeof path !== 'string' || path.length > 180 || path !== safePath(path.split('/').slice(1))
    || typeof reason !== 'string' || !reasons.has(reason)) return null;
  if (!limits.has(reason)) return {path, reason};
  return typeof limit === 'number' && Number.isSafeInteger(limit) ? {path, reason, limit} : null;
}

export function readDraftDetails(value: unknown): Details | null {
  if (!record(value) || typeof value['truncated'] !== 'boolean' || !Array.isArray(value['issues'])
    || value['issues'].length < 1 || value['issues'].length > maximumIssues) return null;
  const issues: Issue[] = [];
  for (const item of value['issues']) {
    const issue = issueFrom(item);
    if (!issue) return null;
    issues.push(issue);
  }
  return {issues, truncated: value['truncated']};
}

export function schemaDraftDetails(errors: readonly ErrorObject[]): Details {
  const issues: Issue[] = [];
  const seen = new Set<string>();
  for (const error of errors) {
    const {keyword, params} = error;
    // JSON values allow several types; failed alternative types do not describe the supplied value.
    if (keyword === 'type' && error.schemaPath.includes('/anyOf/')) continue;
    const parts = error.instancePath.split('/').slice(1);
    if (keyword === 'required' && typeof params['missingProperty'] === 'string') parts.push(params['missingProperty']);
    const reason = keyword === 'type' && types.has(params['type']) ? params['type'] : keyword === 'false schema' ? 'not' : keyword;
    const issue = issueFrom({path: safePath(parts), reason, limit: params['limit']});
    if (!issue) continue;
    const key = JSON.stringify(issue);
    if (seen.has(key)) continue;
    if (issues.length === maximumIssues) return {issues, truncated: true};
    seen.add(key);
    issues.push(issue);
  }
  return {issues, truncated: false};
}

export class DraftValidationError extends Error {
  constructor(code: 'draftSchema' | 'remoteError', readonly details: Details) { super(code); }

  feedback(configuration: Configuration | undefined) {
    return {...this.details, issues: this.details.issues.map(issue => {
      const [, field, index] = issue.path.split('/');
      const name = field === 'automations' || field === 'sequences' ? configuration?.[field][Number(index)]?.['name'] : undefined;
      return text(name, 120) ? {...issue, name} : issue;
    })};
  }
}
