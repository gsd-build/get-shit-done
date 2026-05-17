'use strict';

/**
 * GENERATED FILE — DO NOT EDIT.
 *
 * Source: sdk/src/project-root/index.ts
 * Regenerate: cd sdk && npm run gen:project-root
 *
 * Project-Root Resolution Module — resolves a project root from a starting
 * directory by walking the ancestor chain and applying four heuristics:
 *   (0) own .planning/ guard (#1362)
 *   (1) parent .planning/config.json sub_repos
 *   (2) legacy multiRepo: true + ancestor .git
 *   (3) .git heuristic with parent .planning/
 * Bounded by FIND_PROJECT_ROOT_MAX_DEPTH ancestors. Sync I/O.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { existsSync, readFileSync, statSync } = fs;
const { dirname, resolve, sep, relative, parse: parsePath } = path;
const { homedir } = os;
const FIND_PROJECT_ROOT_MAX_DEPTH = 10;

function findProjectRoot(startDir) {
    let resolvedStart;
    try {
        resolvedStart = resolve(startDir);
    }
    catch {
        return startDir;
    }
    const fsRoot = parsePath(resolvedStart).root;
    const home = homedir();
    // If startDir already contains .planning/, it IS the project root.
    try {
        const ownPlanningDir = resolvedStart + sep + '.planning';
        if (existsSync(ownPlanningDir) && statSync(ownPlanningDir).isDirectory()) {
            return startDir;
        }
    }
    catch {
        // fall through
    }
    // Walk upward, mirroring isInsideGitRepo from the CJS reference.
    function isInsideGitRepo(candidateParent) {
        let d = resolvedStart;
        while (d !== fsRoot) {
            try {
                if (existsSync(d + sep + '.git'))
                    return true;
            }
            catch {
                // ignore
            }
            if (d === candidateParent)
                break;
            const next = dirname(d);
            if (next === d)
                break;
            d = next;
        }
        return false;
    }
    let dir = resolvedStart;
    let depth = 0;
    while (dir !== fsRoot && depth < FIND_PROJECT_ROOT_MAX_DEPTH) {
        const parent = dirname(dir);
        if (parent === dir)
            break;
        if (parent === home)
            break;
        const parentPlanning = parent + sep + '.planning';
        let parentPlanningIsDir = false;
        try {
            parentPlanningIsDir = existsSync(parentPlanning) && statSync(parentPlanning).isDirectory();
        }
        catch {
            parentPlanningIsDir = false;
        }
        if (parentPlanningIsDir) {
            const configPath = parentPlanning + sep + 'config.json';
            let matched = false;
            try {
                const raw = readFileSync(configPath, 'utf-8');
                const config = JSON.parse(raw);
                const subReposValue = config.sub_repos ?? (config.planning && config.planning.sub_repos);
                const subRepos = Array.isArray(subReposValue) ? subReposValue : [];
                if (subRepos.length > 0) {
                    const relPath = relative(parent, resolvedStart);
                    const topSegment = relPath.split(sep)[0];
                    if (subRepos.includes(topSegment)) {
                        return parent;
                    }
                }
                if (config.multiRepo === true && isInsideGitRepo(parent)) {
                    matched = true;
                }
            }
            catch {
                // config.json missing or unparseable — fall through to .git heuristic.
            }
            if (matched)
                return parent;
            // Heuristic: parent has .planning/ and we're inside a git repo.
            if (isInsideGitRepo(parent)) {
                return parent;
            }
        }
        dir = parent;
        depth += 1;
    }
    return startDir;
}

module.exports = { findProjectRoot };
