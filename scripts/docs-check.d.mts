// Types for scripts/docs-check.mjs so the unit tests can import it.
export declare const REQUIRED_DOCS: string[];
export declare const PHASE_SECTIONS: string[];
export declare function checkDocs(root: string): string[];
export declare function checkChangelog(changedFiles: string[]): string[];
