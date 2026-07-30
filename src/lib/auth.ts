import { timingSafeEqual } from "node:crypto";
import type { FastifyRequest } from "fastify";

export function hasIngestAccess(request: FastifyRequest) {
	return hasBearerToken(request, process.env.INGEST_TOKEN);
}

export function hasReadAccess(request: FastifyRequest) {
	return hasBearerToken(request, process.env.VAULT_READ_TOKEN);
}

function hasBearerToken(request: FastifyRequest, token: string | undefined) {
	const authorization = request.headers.authorization;
	if (!token || !authorization) return false;

	const provided = Buffer.from(authorization);
	const expected = Buffer.from(`Bearer ${token}`);
	return (
		provided.length === expected.length && timingSafeEqual(provided, expected)
	);
}
