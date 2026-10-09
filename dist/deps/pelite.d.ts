/**
 * Read-only access to a PE image backed by WebAssembly memory.
 *
 * Parsing methods return an `Error` value when the image cannot satisfy a request.
 * Dispose the file when it is no longer needed.
 */
export class PeFile {
    /**
     * Parses a PE file from a byte array.
     *
     * @param {Uint8Array} bytes The complete PE file.
     */
    constructor(bytes: Uint8Array);
    /** @private @type {number} */
    private p;
    /** Releases the PE image from WebAssembly memory. */
    dispose(): void;
    /** @returns {Result<PeDosHeader>} Parsed DOS header JSON. */
    dosHeader(): Result<PeDosHeader>;
    /** @returns {Result<PeNtHeaders>} Parsed NT headers JSON. */
    ntHeaders(): Result<PeNtHeaders>;
    /** @returns {Result<PeFileHeader>} Parsed COFF file header JSON. */
    fileHeader(): Result<PeFileHeader>;
    /** @returns {Result<PeOptionalHeader>} Parsed optional header JSON. */
    optionalHeader(): Result<PeOptionalHeader>;
    /** @returns {Result<PeSectionHeader[]>} Parsed section headers JSON. */
    sectionHeaders(): Result<PeSectionHeader[]>;
    /** @returns {Result<PeHeaders>} Parsed PE headers JSON. */
    headers(): Result<PeHeaders>;
    /**
     * Converts a virtual address to an RVA.
     *
     * @param {number | bigint} va Virtual address.
     * @returns {Result<number>} The corresponding RVA.
     */
    vaToRva(va: number | bigint): Result<number>;
    /**
     * Converts an RVA to a virtual address.
     *
     * @param {number} rva Relative virtual address.
     * @returns {Result<bigint>} The corresponding virtual address.
     */
    rvaToVa(rva: number): Result<bigint>;
    /**
     * Converts an RVA to a file offset; zero-filled data returns an Error.
     * @param {number} rva
     * @returns {Result<number>}
     */
    rvaToFileOffset(rva: number): Result<number>;
    /**
     * Converts a virtual address to a file offset; zero-filled data returns an Error.
     * @param {number | bigint} va
     * @returns {Result<number>}
     */
    vaToFileOffset(va: number | bigint): Result<number>;
    /**
     * Converts a file offset to an RVA; unmapped raw data returns an Error.
     * @param {number} offset
     * @returns {Result<number>}
     */
    fileOffsetToRva(offset: number): Result<number>;
    /**
     * Converts a file offset to a virtual address; unmapped raw data returns an Error.
     * @param {number} offset
     * @returns {Result<bigint>}
     */
    fileOffsetToVa(offset: number): Result<bigint>;
    /**
     * Disassemble instructions starting in the half-open RVA range [start, end).
     *
     * @param {number} start Start RVA.
     * @param {number | null} [end=null] End RVA; defaults to one byte after `start`.
     * @returns {Result<DisassembledInstruction[]>}
     */
    disasm(start: number, end?: number | null): Result<DisassembledInstruction[]>;
    /**
     * Interprets typed data at an RVA using the CLI read type syntax.
     *
     * Types include u8/u16/u32/u64, i8/i16/i32/i64, f32/f64, cstr, utf16lez,
     * pointers (*T), arrays ([T; N] or [T; field]), structs, and unions.
     * Fields use natural C alignment; pointers use the PE image's bitness.
     * Null pointers return null; opaque pointers (*unk, *code, *fn) return RVAs.
     * Reading code, fn, or unk directly returns an error.
     * Syntax/options errors and failed root reads return Error. Failed nested
     * reads return inline {$error, $rva} objects alongside successful values.
     * Integers return JS numbers; u64/i64 can lose precision beyond 53 bits.
     * String previews end with … when truncated and require file-backed bytes.
     *
     * @param {number} rva Relative virtual address.
     * @param {string} type Type expression.
     * @param {ReadOptions} [options]
     * @returns {Result<ReadValue>}
     * @example pefile.read(0x2000, "struct { count: u32, values: *[u16; count] }")
     */
    read(rva: number, type: string, options?: ReadOptions): Result<ReadValue>;
    /**
     * Copies exactly `bytes` bytes from the virtual image at an RVA.
     *
     * Gaps, missing file bytes, and section bytes beyond min(VirtualSize, SizeOfRawData)
     * are zero-filled. Returns an Error if the range extends beyond SizeOfImage.
     *
     * @param {number} rva Relative virtual address.
     * @param {number} bytes Number of bytes to copy.
     * @returns {Result<Uint8Array>}
     */
    hexDumpBytes(rva: number, bytes: number): Result<Uint8Array>;
    /**
     * Returns a packed mask for `bytes` bytes of the virtual image at an RVA.
     *
     * Bit i is 1 for a file-backed byte and 0 for zero-fill, even when the on-disk
     * value is zero. Byte i uses bit (i % 8) of mask byte floor(i / 8), LSB first.
     * The mask has ceil(bytes / 8) bytes; unused final bits are zero.
     * Returns an Error if the range extends beyond SizeOfImage.
     *
     * @param {number} rva Relative virtual address.
     * @param {number} bytes Number of virtual image bytes to describe.
     * @returns {Result<Uint8Array>}
     */
    hexDumpMask(rva: number, bytes: number): Result<Uint8Array>;
    /**
     * Returns a view into the PE image starting at an RVA.
     *
     * The view borrows WebAssembly memory rather than copying it and may be invalidated if that memory grows.
     *
     * @param {number} rva Relative virtual address.
     * @param {number} [min_size=0] Minimum number of bytes required.
     * @param {number} [align_of=1] Required alignment.
     * @returns {Result<Uint8Array>}
     */
    sliceBytes(rva: number, min_size?: number, align_of?: number): Result<Uint8Array>;
    /**
     * Returns a view into the PE image starting at a virtual address.
     *
     * The view borrows WebAssembly memory rather than copying it and may be invalidated if that memory grows.
     *
     * @param {number | bigint} va Virtual address.
     * @param {number} [min_size=0] Minimum number of bytes required.
     * @param {number} [align_of=1] Required alignment.
     * @returns {Result<Uint8Array>}
     */
    readBytes(va: number | bigint, min_size?: number, align_of?: number): Result<Uint8Array>;
    /** @returns {Result<PeHashes>} File fingerprints. */
    hashes(): Result<PeHashes>;
    /** @returns {Result<SectionEntropy[]>} Entropy entries in sectionHeaders() order, including empty/unreadable sections. */
    sectionEntropy(): Result<SectionEntropy[]>;
    /** @returns {Result<PeRichStructure | null>} Parsed Rich structure JSON. */
    richStructure(): Result<PeRichStructure | null>;
    /** @returns {Result<PeImportDescriptor[] | null>} Parsed imports JSON. */
    imports(): Result<PeImportDescriptor[] | null>;
    /** @returns {Result<PeExportDirectory | null>} Parsed exports JSON. */
    exports(): Result<PeExportDirectory | null>;
    /** @returns {Result<PeBaseRelocations | null>} Parsed base relocations JSON. */
    baseRelocations(): Result<PeBaseRelocations | null>;
    /** @returns {Result<PeLoadConfig | null>} Parsed load configuration JSON. */
    loadConfig(): Result<PeLoadConfig | null>;
    /** @returns {Result<PeTls | null>} Parsed TLS directory, or null if absent. */
    tls(): Result<PeTls | null>;
    /** @returns {Result<PeRuntimeFunction[] | null>} Parsed x64 exception directory JSON, or `null` for PE32. */
    exceptionsX64(): Result<PeRuntimeFunction[] | null>;
    /** @returns {Result<string | null>} Embedded PDB file name/path, or null if absent. Malformed debug data or invalid UTF-8 returns an Error. */
    pdbFileName(): Result<string | null>;
    /** @returns {Result<PeDebugDirectoryEntry[] | null>} Parsed debug directory JSON. */
    debug(): Result<PeDebugDirectoryEntry[] | null>;
    /** @returns {Result<PeSecurityDirectory | null>} Parsed Authenticode security directory JSON. */
    security(): Result<PeSecurityDirectory | null>;
    /** @returns {Result<PeResourceTreeEntry[] | null>} Parsed resource tree JSON. */
    resourcesTree(): Result<PeResourceTreeEntry[] | null>;
    /**
     * Reads resource data by its slash-separated resource path.
     *
     * @param {string} path Resource path such as `/#16/#1/#1033`.
     * @returns {Result<Uint8Array | null>} A copy of the resource bytes, or `null` if not found.
     */
    resourcesGetResource(path: string): Result<Uint8Array | null>;
    /** @returns {Result<string | null>} The manifest text, or `null` if not found. */
    resourcesManifest(): Result<string | null>;
    /** @returns {Result<PeVersionInfo | null>} Parsed version information JSON. */
    resourcesVersionInfo(): Result<PeVersionInfo | null>;
    /** @returns {Result<Array<ResourceName> | null>} Available icon names, or `null` if absent. */
    resourcesListIcons(): Result<Array<ResourceName> | null>;
    /**
     * @param {ResourceName} name Icon name or numeric resource ID.
     * @returns {Result<Uint8Array | null>} A copy of the ICO file, or `null` if not found.
     */
    resourcesGetIcon(name: ResourceName): Result<Uint8Array | null>;
    /** @returns {Result<Array<ResourceName> | null>} Available cursor names, or `null` if absent. */
    resourcesListCursors(): Result<Array<ResourceName> | null>;
    /**
     * @param {ResourceName} name Cursor name or numeric resource ID.
     * @returns {Result<Uint8Array | null>} A copy of the CUR file, or `null` if not found.
     */
    resourcesGetCursor(name: ResourceName): Result<Uint8Array | null>;
    /**
     * Executes a pattern at exactly one RVA.
     *
     * @param {number} rva Relative virtual address.
     * @param {string} pattern Pattern expression.
     * @returns {Result<number[] | null>} Captured values, or `null` when the pattern does not match.
     */
    scannerExec(rva: number, pattern: string): Result<number[] | null>;
    /**
     * Finds the first pattern match in selected sections.
     *
     * @param {string} pattern Pattern expression.
     * @param {string | number | null} [section] Section name or zero-based section index; omitted selects executable sections.
     * @returns {Result<ScannerMatch | null>}
     */
    scannerFind(pattern: string, section?: string | number | null): Result<ScannerMatch | null>;
    /**
     * Finds pattern matches in selected sections.
     *
     * @param {string} pattern Pattern expression.
     * @param {string | number | null} [section] Section name or zero-based section index; omitted selects executable sections.
     * @param {ScannerMatchOptions} [options]
     * @returns {Result<ScannerMatch[]>}
     */
    scannerMatches(pattern: string, section?: string | number | null, options?: ScannerMatchOptions): Result<ScannerMatch[]>;
    /** Releases the PE image when used with explicit resource management. */
    [Symbol.dispose](): void;
}
/**
 * A value returned by the WebAssembly module, or an error reported by it.
 */
export type Result<T> = T | Error;
export type DisassembledInstruction = {
    /**
     * The formatted section name and virtual address.
     */
    address: string;
    /**
     * The encoded instruction bytes.
     */
    bytes: number[];
    /**
     * The formatted instruction.
     */
    instruction: string;
};
export type ScannerMatch = {
    /**
     * The RVA at which the pattern matched.
     */
    rva: number;
    /**
     * The pattern's captured values.
     */
    save: number[];
};
export type ScannerMatchOptions = {
    /**
     * Maximum number of matches to return; zero means unlimited.
     */
    limit?: number | undefined;
};
export type ReadOptions = {
    /**
     * Allow scalar/pointer reads from virtual section tails.
     */
    zerofill?: boolean | undefined;
    /**
     * Maximum bytes/code units in string previews.
     */
    string_preview_length?: number | undefined;
    /**
     * Maximum element count for field-length arrays.
     */
    max_dynamic_array_length?: number | undefined;
};
export type ReadError = {
    $error: string;
    $rva: number | null;
};
export type ReadValue = number | string | null | ReadError | ReadValue[] | {
    [field: string]: ReadValue;
};
export type PeFileHeader = {
    Machine: number;
    NumberOfSections: number;
    TimeDateStamp: number;
    PointerToSymbolTable: number;
    NumberOfSymbols: number;
    SizeOfOptionalHeader: number;
    Characteristics: number;
};
export type PeOptionalHeader = {
    Magic: number;
    LinkerVersion: string;
    SizeOfCode: number;
    SizeOfInitializedData: number;
    SizeOfUninitializedData: number;
    AddressOfEntryPoint: number;
    /**
     * Present only in PE32.
     */
    BaseOfData?: number | undefined;
    BaseOfCode: number;
    ImageBase: number;
    SectionAlignment: number;
    FileAlignment: number;
    OperatingSystemVersion: string;
    ImageVersion: string;
    SubsystemVersion: string;
    Win32VersionValue: number;
    SizeOfImage: number;
    SizeOfHeaders: number;
    CheckSum: number;
    Subsystem: number;
    DllCharacteristics: number;
    SizeOfStackReserve: number;
    SizeOfStackCommit: number;
    SizeOfHeapReserve: number;
    SizeOfHeapCommit: number;
    LoaderFlags: number;
    NumberOfRvaAndSizes: number;
};
export type PeSectionHeader = {
    Name: string;
    VirtualAddress: number;
    VirtualSize: number;
    SizeOfRawData: number;
    PointerToRawData: number;
    Characteristics: number;
};
export type PeDataDirectory = {
    VirtualAddress: number;
    Size: number;
};
export type PeNtHeaders = {
    Signature: number;
    FileHeader: PeFileHeader;
    OptionalHeader: PeOptionalHeader;
};
export type PeHeaders = {
    DosHeader: PeDosHeader;
    NtHeaders: PeNtHeaders;
    SectionHeaders: PeSectionHeader[];
    DataDirectory: PeDataDirectory[];
    details: Record<string, unknown> & {
        "DataDirectory.Names": (string | null)[];
    };
};
export type PeImportedSymbol = {
    ByName: {
        name: string;
        hint: number;
    };
    ByOrdinal?: never;
} | {
    ByOrdinal: {
        ord: number;
    };
    ByName?: never;
};
export type PeImportEntry = {
    address: number;
    import: PeImportedSymbol | null;
};
export type PeImportDescriptorImage = {
    OriginalFirstThunk: number;
    TimeDateStamp: number;
    ForwarderChain: number;
    Name: number;
    FirstThunk: number;
};
export type PeImportDescriptor = {
    image: PeImportDescriptorImage;
    dll_name: string | null;
    imports: PeImportEntry[] | null;
};
export type PeExportDirectory = {
    image: Record<string, unknown>;
    dll_name: string | null;
    ordinal_base: number;
    functions: (number | null | string)[];
    names: Record<string, number>;
};
export type PeRichRecord = {
    product: number;
    build: number;
    count: number;
};
export type PeRichStructure = {
    xor_key: number;
    checksum: number;
    records: PeRichRecord[];
};
export type PeVersionInfo = {
    fixed: Record<string, number | string> | null;
    strings: Record<string, Record<string, string>>;
    langs: string[];
};
export type PeResourceData = {
    image: {
        OffsetToData: number;
        Size: number;
        CodePage: number;
        Reserved: number;
    };
    size: number;
    code_page: number;
    bytes: string | null;
};
export type PeResourceTreeEntry = {
    name: ResourceName | null;
    directory?: PeResourceTreeEntry[] | null;
    data?: PeResourceData | null;
};
export type PeDosHeader = {
    e_magic: number;
    e_cblp: number;
    e_cp: number;
    e_crlc: number;
    e_cparhdr: number;
    e_minalloc: number;
    e_maxalloc: number;
    e_ss: number;
    e_sp: number;
    e_csum: number;
    e_ip: number;
    e_cs: number;
    e_lfarlc: number;
    e_ovno: number;
    e_res: number[];
    e_oemid: number;
    e_oeminfo: number;
    e_res2: number[];
    e_lfanew: number;
};
/**
 * Relocation RVAs and types are parallel arrays.
 */
export type PeBaseRelocations = {
    rvas: number[];
    types: number[];
};
export type PeLoadConfigCodeIntegrity = {
    Flags: number;
    Catalog: number;
    CatalogOffset: number;
    Reserved: number;
};
export type PeLoadConfigImage = {
    Size: number;
    TimeDateStamp: number;
    Version: string;
    GlobalFlagsClear: number;
    GlobalFlagsSet: number;
    CriticalSectionDefaultTimeout: number;
    DeCommitFreeBlockThreshold: number;
    DeCommitTotalFreeThreshold: number;
    LockPrefixTable: number;
    MaximumAllocationSize: number;
    VirtualMemoryThreshold: number;
    ProcessAffinityMask: number;
    ProcessHeapFlags: number;
    CSDVersion: number;
    DependentLoadFlags: number;
    EditList: number;
    SecurityCookie: number;
    SEHandlerTable: number;
    SEHandlerCount: number;
    GuardCFCheckFunctionPointer: number;
    GuardCFDispatchFunctionPointer: number;
    GuardCFFunctionTable: number;
    GuardCFFunctionCount: number;
    GuardFlags: number;
    CodeIntegrity: PeLoadConfigCodeIntegrity;
    GuardAddressTakenIatEntryTable: number;
    GuardAddressTakenIatEntryCount: number;
    GuardLongJumpTargetTable: number;
    GuardLongJumpTargetCount: number;
    DynamicValueRelocTable: number;
    CHPEMetadataPointer: number;
    GuardRFFailureRoutine: number;
    GuardRFFailureRoutineFunctionPointer: number;
    DynamicValueRelocTableOffset: number;
    DynamicValueRelocTableSection: number;
    Reserved2: number;
    GuardRFVerifyStackPointerFunctionPointer: number;
    HotPatchTableOffset: number;
    Reserved3: number;
    EnclaveConfigurationPointer: number;
    VolatileMetadataPointer: number;
    GuardEHContinuationTable: number;
    GuardEHContinuationCount: number;
    GuardXFGCheckFunctionPointer: number;
    GuardXFGDispatchFunctionPointer: number;
    GuardXFGTableDispatchFunctionPointer: number;
    CastGuardOsDeterminedFailureMode: number;
    GuardMemcpyFunctionPointer: number;
    UmaFunctionPointers: number;
};
/**
 * Missing fields in older load-config revisions are zero-filled in image.
 */
export type PeLoadConfig = {
    image: PeLoadConfigImage;
    size: number;
    security_cookie: number | null;
    se_handler_table: number[] | null;
};
export type PeRuntimeFunctionImage = {
    BeginAddress: number;
    EndAddress: number;
    UnwindData: number;
};
export type PeUnwindCode = {
    CodeOffset: number;
    UnwindOpInfo: number;
};
export type PeUnwindInfo = {
    version: number;
    flags: number;
    size_of_prolog: number;
    frame_register: number;
    frame_offset: number;
    unwind_codes: PeUnwindCode[];
};
export type PeRuntimeFunction = {
    image: PeRuntimeFunctionImage;
    unwind_info: PeUnwindInfo | null;
};
export type PeDebugDirectoryImage = {
    Characteristics: number;
    TimeDateStamp: number;
    Version: string;
    Type: number;
    SizeOfData: number;
    AddressOfRawData: number;
    PointerToRawData: number;
};
export type PeCodeView20Image = {
    CvSignature: number;
    Offset: number;
    TimeDateStamp: number;
    Age: number;
};
export type PeCodeView70Image = {
    CvSignature: number;
    Signature: string;
    Age: number;
};
export type PeDebugMiscImage = {
    DataType: number;
    Length: number;
    Unicode: number;
};
export type PeCodeView = {
    format: "NB10";
    image: PeCodeView20Image;
    pdb_file_name: string;
} | {
    format: "RSDS";
    image: PeCodeView70Image;
    pdb_file_name: string;
};
/**
 * Unicode debug names retain their UTF-16 code units.
 */
export type PeDebugMisc = {
    image: PeDebugMiscImage;
    name: string | number[];
};
export type PePgoSection = {
    rva: number;
    size: number;
    name: string;
};
/**
 * These are serialized Rust results, not JavaScript Error instances.
 */
export type PePgo = {
    signature: string;
    sections: ({
        Ok: PePgoSection;
        Err?: never;
    } | {
        Err: string;
        Ok?: never;
    })[];
};
/**
 * Unsupported or unreadable debug entries have null content/type.
 */
export type PeDebugDirectoryEntry = {
    image: PeDebugDirectoryImage;
    type: string | null;
    entry: PeCodeView | PeDebugMisc | PePgo | null;
};
export type PeCertificateImage = {
    dwLength: number;
    wRevision: number;
    wCertificateType: number;
};
/**
 * certificate_data is base64-encoded.
 */
export type PeSecurityDirectory = {
    image: PeCertificateImage;
    certificate_type: number;
    certificate_data: string;
};
/**
 * A resource name or unsigned 32-bit resource ID.
 */
export type ResourceName = string | number;
/**
 * File MD5/SHA-256 and conventional import hash, encoded as lowercase hex.
 * A null imphash means imports could not be fully parsed. Absent imports hash the empty sequence.
 */
export type PeHashes = {
    md5: string;
    sha256: string;
    imphash: string | null;
};
/**
 * Parsed TLS directory. A null callback array can mean an absent pointer or unreadable data;
 * image.AddressOfCallBacks distinguishes the absent pointer (zero).
 */
export type PeTls = {
    image: Record<string, number> & {
        AddressOfCallBacks: number;
    };
    raw_data: string | null;
    slot: number | null;
    callbacks: number[] | null;
};
/**
 * Shannon entropy (0–8 bits per byte) of a section's raw data and up to 16 evenly sized samples.
 * Empty or unreadable raw data has null entropy and an empty sample array.
 */
export type SectionEntropy = {
    entropy: number | null;
    samples: number[];
};
