/* Pure reconciliation shared by the desktop main process and file previews. */
export function canonical(value) {
    if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
    if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
    return JSON.stringify(value);
}

export function normalizeConfiguration(value) {
    return {...value, sequences: value?.sequences ?? [], mesh_peers: value?.mesh_peers ?? [], automations: value?.automations ?? []};
}

export function mergeConfigurations(local, remote, base = null, choices = {}) {
    local = normalizeConfiguration(local); remote = normalizeConfiguration(remote);
    if (base) base = normalizeConfiguration(base);
    const conflicts = [];
    const equal = (a, b) => canonical(a) === canonical(b);
    function choose(key, kind, id, before, ours, theirs, known) {
        if (choices[key] === 'local') return ours;
        if (choices[key] === 'remote') return theirs;
        if (equal(ours, theirs)) return ours;
        if (known && equal(ours, before)) return theirs;
        if (known && equal(theirs, before)) return ours;
        if (!known && ours === null) return theirs;
        if (!known && theirs === null) return ours;
        conflicts.push({key, kind, id, name: ours?.name ?? theirs?.name ?? id, local: ours, remote: theirs, base: before});
        return ours;
    }
    const result = {...local, revision: Math.max(1, local.revision, remote.revision)};
    for (const kind of ['automations', 'sequences']) {
        const before = new Map((base?.[kind] ?? []).map(item => [item.id, item]));
        const ours = new Map(local[kind].map(item => [item.id, item]));
        const theirs = new Map(remote[kind].map(item => [item.id, item]));
        const ids = new Set([...ours.keys(), ...theirs.keys(), ...before.keys()]);
        result[kind] = [...ids].flatMap(id => {
            const value = choose(kind + ':' + id, kind, id, before.get(id) ?? null, ours.get(id) ?? null, theirs.get(id) ?? null, base !== null);
            return value === null ? [] : [structuredClone(value)];
        });
    }
    const sequences = new Set(result.sequences.map(item => item.id));
    for (const rule of result.automations) for (const action of Array.isArray(rule.actions) ? rule.actions : []) {
        if (action?.type !== 'sequence' || typeof action.sequence_id !== 'string' || sequences.has(action.sequence_id)) continue;
        const id = action.sequence_id; const key = 'sequences:' + id;
        const ours = local.sequences.find(item => item.id === id) ?? null;
        const theirs = remote.sequences.find(item => item.id === id) ?? null;
        if ((!ours && !theirs) || ['local', 'remote'].includes(choices[key]) || conflicts.some(item => item.key === key)) continue;
        conflicts.push({key, kind: 'sequences', id, name: (ours ?? theirs).name, local: ours, remote: theirs,
            base: base?.sequences.find(item => item.id === id) ?? null, dependency: true});
        result.sequences.push(structuredClone(ours ?? theirs)); sequences.add(id);
    }
    const ours = [...local.mesh_peers].sort(); const theirs = [...remote.mesh_peers].sort();
    result.mesh_peers = choose('mesh_peers', 'permissions', 'mesh_peers', base ? [...base.mesh_peers].sort() : null,
        !base && !ours.length ? null : ours, !base && !theirs.length ? null : theirs, base !== null) ?? [];
    return {configuration: result, conflicts};
}

export function createDraftFile(system, configuration, base = null, ruleIds = null) {
    configuration = structuredClone(normalizeConfiguration(configuration));
    const selected = ruleIds === null ? null : new Set(ruleIds);
    if (selected) {
        configuration.automations = configuration.automations.filter(rule => selected.has(rule.id));
        const used = new Set();
        const collect = actions => { for (const action of actions ?? []) if (action.type === 'sequence') used.add(action.sequence_id); };
        for (const rule of configuration.automations) collect(rule.actions);
        configuration.sequences = configuration.sequences.filter(sequence => used.has(sequence.id));
    }
    return {format: 'z2m-automations-draft', version: 1, system: {id: system.id, name: system.name, baseTopic: system.baseTopic},
        configuration, base: selected || !base?.configuration ? null : structuredClone(base)};
}

export function readDraftFile(value) {
    const keys = (item, expected) => item && typeof item === 'object' && !Array.isArray(item)
        && Object.keys(item).sort().join(',') === [...expected].sort().join(',');
    if (!keys(value, ['format', 'version', 'system', 'configuration', 'base']) || value.format !== 'z2m-automations-draft' || value.version !== 1
        || !keys(value.system, ['id', 'name', 'baseTopic']) || !['id', 'name', 'baseTopic'].every(key => typeof value.system[key] === 'string' && value.system[key].length > 0 && value.system[key].length <= 480)
        || !keys(value.configuration, ['schema_version', 'revision', 'automations', 'sequences', 'mesh_peers'])
        || value.configuration.schema_version !== 1 || !Number.isSafeInteger(value.configuration.revision) || value.configuration.revision < 1
        || !Array.isArray(value.configuration.automations) || value.configuration.automations.length > 100
        || !Array.isArray(value.configuration.sequences) || value.configuration.sequences.length > 32
        || !Array.isArray(value.configuration.mesh_peers) || value.configuration.mesh_peers.length > 8
        || (value.base !== null && !keys(value.base, ['revision', 'checksum', 'configuration']))) throw new Error('draftSchema');
    if (value.base !== null && (!Number.isSafeInteger(value.base.revision) || value.base.revision < 0
        || (value.base.revision === 0 ? value.base.checksum !== null : !/^[a-f0-9]{64}$/.test(value.base.checksum))
        || !value.base.configuration || typeof value.base.configuration !== 'object')) throw new Error('draftSchema');
    return value;
}

export function fileDrafts(value) {
    if (value?.format === 'z2m-automations-draft') return [readDraftFile(value)];
    if (value?.format === 'z2m-automations-workspace' && value.version === 1 && Array.isArray(value.systems) && value.systems.length <= 8) return value.systems.map(readDraftFile);
    if (value?.format === 'z2m-automations-project' && [1, 2].includes(value.version) && Array.isArray(value.systems) && value.systems.length <= 8) {
        return value.systems.map(system => readDraftFile(createDraftFile(system, system.configuration,
            system.baseline?.configuration ? system.baseline : null)));
    }
    throw new Error('draftSchema');
}
