const SECRET_FIELDS = [
    "token",
    "code",
    "secret",
    "password",
    "assertion",
    "credential",
    "apikey",
    "api_key",
    "authorization",
];

const looksSecret = (field: string): boolean => {
    const name = field.toLowerCase().replace(/[^a-z]/g, "");
    return SECRET_FIELDS.some((secret) => name.indexOf(secret.replace(/[^a-z]/g, "")) !== -1);
};

export const maskSecret = (value: unknown): string => {
    if (typeof value !== "string") return `[redacted ${typeof value}]`;
    if (!value) return "[redacted empty]";
    if (value.length <= 8) return `[redacted ${value.length} chars]`;
    return `[redacted ${value.length} chars …${value.slice(-4)}]`;
};

export const scrubSecrets = (value: unknown, depth = 0): unknown => {
    if (depth > 4) return "[redacted deep]";
    if (Array.isArray(value)) return value.map((entry) => scrubSecrets(entry, depth + 1));
    if (!value || typeof value !== "object") return value;

    const source = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const field of Object.keys(source)) {
        out[field] = looksSecret(field)
            ? maskSecret(source[field])
            : scrubSecrets(source[field], depth + 1);
    }
    return out;
};

export const authLog = (message: string, ...details: unknown[]): void => {
    console.error(`[auth] ${message}`, ...details.map((detail) => scrubSecrets(detail)));
};

export default authLog;
