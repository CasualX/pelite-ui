import type { ASN1 } from './asn1.js';

// Subset of @lapo/asn1js 2.1.3 used to label certificate fields.
export class Defs {
	static searchType(name: string): object;
	static match(node: ASN1, definition: object): void;
}
