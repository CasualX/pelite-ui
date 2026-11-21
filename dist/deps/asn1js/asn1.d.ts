// Subset of @lapo/asn1js 2.1.3 used by the certificate viewer.
export class ASN1 {
	static decode(bytes: Uint8Array): ASN1;
	readonly sub: ASN1[] | null;
	readonly def?: { id?: string; name?: string; mismatch?: number };
	typeName(): string;
	posEnd(): number;
	content(maxLength?: number): string | null;
}
