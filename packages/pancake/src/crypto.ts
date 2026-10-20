import {
	createCipheriv,
	createDecipheriv,
	createHash,
	randomBytes,
} from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const VERSION = "v1";

function resolveEncryptionKey(secretOverride?: string): Buffer {
	const raw =
		secretOverride ??
		process.env.PANCAKE_TOKEN_ENCRYPTION_KEY ??
		process.env.BETTER_AUTH_SECRET ??
		"pancake-crm-local-fallback-encryption-key-32b";
	return createHash("sha256").update(raw).digest();
}

export function encryptToken(plain: string, secretOverride?: string): string {
	const trimmed = plain.trim();
	if (!trimmed) throw new Error("TOKEN_EMPTY");
	const key = resolveEncryptionKey(secretOverride);
	const iv = randomBytes(IV_BYTES);
	const cipher = createCipheriv(ALGORITHM, key, iv);
	const encrypted = Buffer.concat([
		cipher.update(trimmed, "utf8"),
		cipher.final(),
	]);
	const tag = cipher.getAuthTag();
	return `${VERSION}:${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptToken(
	payload: string,
	secretOverride?: string,
): string {
	const parts = payload.split(":");
	if (parts.length !== 4 || parts[0] !== VERSION) {
		throw new Error("INVALID_ENCRYPTED_TOKEN");
	}
	const [, ivHex, tagHex, cipherHex] = parts;
	if (!ivHex || !tagHex || cipherHex === undefined) {
		throw new Error("INVALID_ENCRYPTED_TOKEN");
	}
	const key = resolveEncryptionKey(secretOverride);
	const decipher = createDecipheriv(
		ALGORITHM,
		key,
		Buffer.from(ivHex, "hex"),
	);
	decipher.setAuthTag(Buffer.from(tagHex, "hex"));
	const decrypted = Buffer.concat([
		decipher.update(Buffer.from(cipherHex, "hex")),
		decipher.final(),
	]);
	return decrypted.toString("utf8");
}

export function maskToken(token: string | null | undefined): string {
	const trimmed = (token ?? "").trim();
	if (!trimmed) return "";
	if (trimmed.length <= 10) return "••••••••";
	return `${trimmed.slice(0, 4)}••••${trimmed.slice(-4)}`;
}

export function redactSecrets(input: string): string {
	return input
		.replace(
			/((?:page_)?access_token|api_key)=([^&\s"']+)/gi,
			(_match, param: string, val: string) => `${param}=${maskToken(val)}`,
		)
		.replace(
			/("(?:(?:page_|user_)?access_token|api_key)"\s*:\s*")([^"]+)(")/gi,
			(_match, prefix: string, val: string, suffix: string) =>
				`${prefix}${maskToken(val)}${suffix}`,
		)
		.replace(
			/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
			(jwt) => maskToken(jwt),
		);
}
