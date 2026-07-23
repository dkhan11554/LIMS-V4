import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // ─── Auth ───────────────────────────────────────────────
  users: defineTable({
    tokenIdentifier: v.string(),
    name: v.optional(v.string()),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    email: v.optional(v.string()),
    role: v.optional(v.string()),
    laboratoriesAccess: v.optional(v.array(v.id("laboratories"))),
    departmentId: v.optional(v.id("departments")),
    isActive: v.optional(v.boolean()),
    isDisabled: v.optional(v.boolean()),
    isArchived: v.optional(v.boolean()),
    accountStatus: v.optional(v.string()),
    employeeNumber: v.optional(v.string()),
    phone: v.optional(v.string()),
    jobTitle: v.optional(v.string()),
    designation: v.optional(v.string()),
    businessUnit: v.optional(v.string()),
    siteLocation: v.optional(v.string()),
    costCenter: v.optional(v.string()),
    employmentType: v.optional(v.string()),
    managerId: v.optional(v.id("users")),
    supervisorId: v.optional(v.id("users")),
    timezone: v.optional(v.string()),
    language: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    digitalSignatureUrl: v.optional(v.string()),
    bio: v.optional(v.string()),
    qualifications: v.optional(v.array(v.string())),
    lastLoginAt: v.optional(v.string()),
    createdBy: v.optional(v.id("users")),
    updatedBy: v.optional(v.id("users")),
  }).index("by_token", ["tokenIdentifier"]),

  // ─── Organization ────────────────────────────────────────
  companies: defineTable({
    name: v.string(),
    legalName: v.optional(v.string()),
    address: v.optional(v.string()),
    country: v.optional(v.string()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    website: v.optional(v.string()),
    logoUrl: v.optional(v.string()),
    isActive: v.boolean(),
    createdBy: v.id("users"),
  }),

  laboratories: defineTable({
    name: v.string(),
    code: v.string(),
    companyId: v.id("companies"),
    address: v.optional(v.string()),
    country: v.optional(v.string()),
    timezone: v.optional(v.string()),
    accreditationNumber: v.optional(v.string()),
    accreditationExpiry: v.optional(v.string()),
    managerId: v.optional(v.id("users")),
    isActive: v.boolean(),
    createdBy: v.id("users"),
  }).index("by_company", ["companyId"]),

  departments: defineTable({
    name: v.string(),
    code: v.string(),
    laboratoryId: v.id("laboratories"),
    managerId: v.optional(v.id("users")),
    description: v.optional(v.string()),
    isActive: v.boolean(),
    createdBy: v.id("users"),
  }).index("by_laboratory", ["laboratoryId"]),

  // ─── Customers ───────────────────────────────────────────
  customers: defineTable({
    customerCode: v.string(),
    name: v.string(),
    legalName: v.optional(v.string()),
    taxNumber: v.optional(v.string()),
    billingAddress: v.optional(v.string()),
    collectionAddress: v.optional(v.string()),
    country: v.optional(v.string()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    paymentTerms: v.optional(v.string()),
    contractStart: v.optional(v.string()),
    contractExpiry: v.optional(v.string()),
    isActive: v.boolean(),
    createdBy: v.id("users"),
    laboratoryId: v.id("laboratories"),
    notes: v.optional(v.string()),
  })
    .index("by_laboratory", ["laboratoryId"])
    .index("by_code", ["customerCode"]),

  customerContacts: defineTable({
    customerId: v.id("customers"),
    name: v.string(),
    role: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    isPrimary: v.boolean(),
    isActive: v.boolean(),
    createdBy: v.id("users"),
  }).index("by_customer", ["customerId"]),

  customerProjects: defineTable({
    customerId: v.id("customers"),
    laboratoryId: v.id("laboratories"),
    projectCode: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    status: v.union(
      v.literal("active"),
      v.literal("completed"),
      v.literal("on_hold"),
      v.literal("cancelled"),
    ),
    contactId: v.optional(v.id("customerContacts")),
    notes: v.optional(v.string()),
    createdBy: v.id("users"),
  })
    .index("by_customer", ["customerId"])
    .index("by_laboratory", ["laboratoryId"]),

  // ─── Test Catalogue ──────────────────────────────────────
  testMethods: defineTable({
    methodCode: v.string(),
    name: v.string(),
    version: v.string(),
    description: v.optional(v.string()),
    documentReference: v.optional(v.string()),
    laboratoryId: v.id("laboratories"),
    departmentId: v.optional(v.id("departments")),
    isAccredited: v.boolean(),
    isActive: v.boolean(),
    approvedBy: v.optional(v.id("users")),
    approvedAt: v.optional(v.string()),
    createdBy: v.id("users"),
  })
    .index("by_laboratory", ["laboratoryId"])
    .index("by_code", ["methodCode"]),

  tests: defineTable({
    testCode: v.string(),
    name: v.string(),
    category: v.optional(v.string()),
    methodId: v.optional(v.id("testMethods")),
    departmentId: v.optional(v.id("departments")),
    laboratoryId: v.id("laboratories"),
    unit: v.optional(v.string()),
    resultType: v.union(
      v.literal("numeric"),
      v.literal("text"),
      v.literal("pass_fail"),
      v.literal("pos_neg"),
      v.literal("selection"),
    ),
    decimalPlaces: v.optional(v.number()),
    lowerLimit: v.optional(v.number()),
    upperLimit: v.optional(v.number()),
    detectionLimit: v.optional(v.number()),
    standardTAT: v.optional(v.number()), // hours
    price: v.optional(v.number()),
    isActive: v.boolean(),
    createdBy: v.id("users"),
  })
    .index("by_laboratory", ["laboratoryId"])
    .index("by_department", ["departmentId"])
    .index("by_code", ["testCode"]),

  // ─── Samples ─────────────────────────────────────────────
  samples: defineTable({
    limsNumber: v.string(),
    customerSampleNumber: v.optional(v.string()),
    customerId: v.id("customers"),
    projectId: v.optional(v.id("customerProjects")),
    laboratoryId: v.id("laboratories"),
    sampleName: v.string(),
    sampleType: v.optional(v.string()),
    product: v.optional(v.string()),
    batchNumber: v.optional(v.string()),
    lotNumber: v.optional(v.string()),
    manufacturingDate: v.optional(v.string()),
    expiryDate: v.optional(v.string()),
    collectionDate: v.optional(v.string()),
    collectionLocation: v.optional(v.string()),
    receivedDate: v.optional(v.string()),
    priority: v.union(
      v.literal("routine"),
      v.literal("urgent"),
      v.literal("stat"),
    ),
    // Container / packaging info
    containerType: v.optional(v.string()),
    containerCount: v.optional(v.number()),
    sampleVolume: v.optional(v.string()),
    storageCondition: v.optional(v.string()),
    requestedCompletionDate: v.optional(v.string()),
    customerInstructions: v.optional(v.string()),
    internalNotes: v.optional(v.string()),
    status: v.union(
      v.literal("draft"),
      v.literal("registered"),
      v.literal("awaiting_receipt"),
      v.literal("received"),
      v.literal("accepted"),
      v.literal("rejected"),
      v.literal("assigned"),
      v.literal("preparation"),
      v.literal("testing"),
      v.literal("result_entered"),
      v.literal("pending_review"),
      v.literal("returned"),
      v.literal("pending_qa"),
      v.literal("oos_investigation"),
      v.literal("approved"),
      v.literal("coa_generated"),
      v.literal("delivered"),
      v.literal("stored"),
      v.literal("disposed"),
      v.literal("cancelled"),
    ),
    // Receipt condition inspection
    receivedBy: v.optional(v.id("users")),
    packageCondition: v.optional(v.string()),  // intact | damaged | missing
    containerCondition: v.optional(v.string()), // intact | cracked | leaked | contaminated
    sealCondition: v.optional(v.string()),       // intact | broken | absent
    temperature: v.optional(v.string()),
    temperatureAdequate: v.optional(v.boolean()),
    sampleConditionNotes: v.optional(v.string()),
    rejectionReason: v.optional(v.string()),
    createdBy: v.id("users"),
  })
    .index("by_laboratory", ["laboratoryId"])
    .index("by_customer", ["customerId"])
    .index("by_status", ["status"])
    .index("by_lims_number", ["limsNumber"]),

  sampleTests: defineTable({
    sampleId: v.id("samples"),
    testId: v.id("tests"),
    status: v.union(
      v.literal("not_assigned"),
      v.literal("assigned"),
      v.literal("in_progress"),
      v.literal("result_entered"),
      v.literal("submitted"),
      v.literal("returned"),
      v.literal("technically_approved"),
      v.literal("qa_approved"),
      v.literal("failed"),
      v.literal("oos"),
      v.literal("cancelled"),
    ),
    assignedTo: v.optional(v.id("users")),
    assignedAt: v.optional(v.string()),
    startedAt: v.optional(v.string()),
    completedAt: v.optional(v.string()),
    result: v.optional(v.string()),
    passFailStatus: v.optional(v.union(v.literal("pass"), v.literal("fail"))),
    comments: v.optional(v.string()),
    reviewedBy: v.optional(v.id("users")),
    reviewedAt: v.optional(v.string()),
    reviewComments: v.optional(v.string()),
    qaApprovedBy: v.optional(v.id("users")),
    qaApprovedAt: v.optional(v.string()),
    createdBy: v.id("users"),
  })
    .index("by_sample", ["sampleId"])
    .index("by_assigned_to", ["assignedTo"])
    .index("by_status", ["status"]),

  // ─── Chain of Custody ────────────────────────────────────
  chainOfCustody: defineTable({
    sampleId: v.id("samples"),
    action: v.string(), // registered | dispatched | received | accepted | rejected | transferred | stored | disposed
    fromName: v.optional(v.string()),
    toName: v.optional(v.string()),
    location: v.optional(v.string()),
    notes: v.optional(v.string()),
    userId: v.id("users"),
    timestamp: v.string(),
  }).index("by_sample", ["sampleId"]),

  // ─── Instruments ─────────────────────────────────────────
  instruments: defineTable({
    instrumentCode: v.string(),
    name: v.string(),
    type: v.optional(v.string()),         // analyser | balance | pH_meter | autoclave | centrifuge | other
    manufacturer: v.optional(v.string()),
    model: v.optional(v.string()),
    serialNumber: v.optional(v.string()),
    assetNumber: v.optional(v.string()),
    laboratoryId: v.id("laboratories"),
    departmentId: v.optional(v.id("departments")),
    location: v.optional(v.string()),
    status: v.union(
      v.literal("active"),
      v.literal("inactive"),
      v.literal("under_calibration"),
      v.literal("under_maintenance"),
      v.literal("decommissioned"),
    ),
    purchaseDate: v.optional(v.string()),
    warrantyExpiry: v.optional(v.string()),
    calibrationIntervalDays: v.optional(v.number()),
    lastCalibrationDate: v.optional(v.string()),
    nextCalibrationDue: v.optional(v.string()),
    linkedMethodIds: v.optional(v.array(v.id("testMethods"))),
    notes: v.optional(v.string()),
    isActive: v.boolean(),
    createdBy: v.id("users"),
  })
    .index("by_laboratory", ["laboratoryId"])
    .index("by_department", ["departmentId"])
    .index("by_code", ["instrumentCode"]),

  instrumentCalibrations: defineTable({
    instrumentId: v.id("instruments"),
    calibrationType: v.optional(v.string()), // internal | external | verification
    scheduledDate: v.string(),
    completedDate: v.optional(v.string()),
    result: v.optional(v.union(v.literal("pass"), v.literal("fail"), v.literal("conditional"))),
    certificateNumber: v.optional(v.string()),
    performedBy: v.optional(v.id("users")),
    externalProvider: v.optional(v.string()),
    nextDueDate: v.optional(v.string()),
    notes: v.optional(v.string()),
    attachmentUrl: v.optional(v.string()),
    createdBy: v.id("users"),
  })
    .index("by_instrument", ["instrumentId"])
    .index("by_scheduled_date", ["scheduledDate"]),

  instrumentMaintenance: defineTable({
    instrumentId: v.id("instruments"),
    maintenanceType: v.union(
      v.literal("preventive"),
      v.literal("corrective"),
      v.literal("breakdown"),
    ),
    description: v.string(),
    performedBy: v.optional(v.id("users")),
    externalProvider: v.optional(v.string()),
    maintenanceDate: v.string(),
    completedDate: v.optional(v.string()),
    outcome: v.optional(v.union(v.literal("resolved"), v.literal("pending"), v.literal("escalated"))),
    cost: v.optional(v.number()),
    notes: v.optional(v.string()),
    createdBy: v.id("users"),
  }).index("by_instrument", ["instrumentId"]),

  // ─── Inventory ────────────────────────────────────────────
  inventoryItems: defineTable({
    itemCode: v.string(),
    name: v.string(),
    category: v.union(
      v.literal("reagent"),
      v.literal("consumable"),
      v.literal("standard"),
      v.literal("equipment"),
      v.literal("ppe"),
      v.literal("other"),
    ),
    supplier: v.optional(v.string()),
    catalogueNumber: v.optional(v.string()),
    unit: v.string(),                     // mL, L, g, kg, pcs, box, etc.
    currentStock: v.number(),
    minStock: v.number(),
    maxStock: v.optional(v.number()),
    reorderPoint: v.optional(v.number()),
    location: v.optional(v.string()),     // storage location
    storageCondition: v.optional(v.string()), // room_temp | refrigerated | frozen
    laboratoryId: v.id("laboratories"),
    departmentId: v.optional(v.id("departments")),
    linkedInstrumentIds: v.optional(v.array(v.id("instruments"))),
    expiryDate: v.optional(v.string()),
    lotNumber: v.optional(v.string()),
    notes: v.optional(v.string()),
    isActive: v.boolean(),
    createdBy: v.id("users"),
  })
    .index("by_laboratory", ["laboratoryId"])
    .index("by_department", ["departmentId"])
    .index("by_code", ["itemCode"]),

  inventoryTransactions: defineTable({
    inventoryItemId: v.id("inventoryItems"),
    transactionType: v.union(
      v.literal("receipt"),         // stock in
      v.literal("issue"),           // stock out
      v.literal("adjustment"),      // correction
      v.literal("waste"),           // disposal
      v.literal("return"),          // returned to stock
    ),
    quantity: v.number(),           // positive = in, negative = out
    quantityBefore: v.number(),
    quantityAfter: v.number(),
    referenceNumber: v.optional(v.string()),
    reason: v.optional(v.string()),
    performedBy: v.id("users"),
    transactionDate: v.string(),
  })
    .index("by_item", ["inventoryItemId"])
    .index("by_date", ["transactionDate"]),

  // ─── Billing ─────────────────────────────────────────────

  quotations: defineTable({
    quotationNumber: v.string(),
    laboratoryId: v.id("laboratories"),
    customerId: v.id("customers"),
    projectId: v.optional(v.id("customerProjects")),
    status: v.union(
      v.literal("draft"),
      v.literal("sent"),
      v.literal("accepted"),
      v.literal("rejected"),
      v.literal("expired"),
    ),
    validUntil: v.optional(v.string()),
    lineItems: v.array(v.object({
      description: v.string(),
      testId: v.optional(v.id("tests")),
      quantity: v.number(),
      unitPrice: v.number(),
    })),
    subtotal: v.number(),
    taxRate: v.optional(v.number()),
    taxAmount: v.optional(v.number()),
    total: v.number(),
    currency: v.optional(v.string()),
    notes: v.optional(v.string()),
    termsConditions: v.optional(v.string()),
    createdBy: v.id("users"),
  })
    .index("by_laboratory", ["laboratoryId"])
    .index("by_customer", ["customerId"])
    .index("by_status", ["status"]),

  invoices: defineTable({
    invoiceNumber: v.string(),
    laboratoryId: v.id("laboratories"),
    customerId: v.id("customers"),
    projectId: v.optional(v.id("customerProjects")),
    quotationId: v.optional(v.id("quotations")),
    sampleIds: v.optional(v.array(v.id("samples"))),
    status: v.union(
      v.literal("draft"),
      v.literal("sent"),
      v.literal("partial"),
      v.literal("paid"),
      v.literal("overdue"),
      v.literal("cancelled"),
      v.literal("credited"),
    ),
    issueDate: v.string(),
    dueDate: v.optional(v.string()),
    lineItems: v.array(v.object({
      description: v.string(),
      testId: v.optional(v.id("tests")),
      sampleId: v.optional(v.id("samples")),
      quantity: v.number(),
      unitPrice: v.number(),
      amount: v.number(),
    })),
    subtotal: v.number(),
    taxRate: v.optional(v.number()),
    taxAmount: v.optional(v.number()),
    total: v.number(),
    amountPaid: v.optional(v.number()),
    currency: v.optional(v.string()),
    notes: v.optional(v.string()),
    paymentTerms: v.optional(v.string()),
    createdBy: v.id("users"),
  })
    .index("by_laboratory", ["laboratoryId"])
    .index("by_customer", ["customerId"])
    .index("by_status", ["status"]),

  payments: defineTable({
    invoiceId: v.id("invoices"),
    laboratoryId: v.id("laboratories"),
    amount: v.number(),
    currency: v.optional(v.string()),
    paymentDate: v.string(),
    paymentMethod: v.union(
      v.literal("bank_transfer"),
      v.literal("credit_card"),
      v.literal("cheque"),
      v.literal("cash"),
      v.literal("other"),
    ),
    referenceNumber: v.optional(v.string()),
    notes: v.optional(v.string()),
    recordedBy: v.id("users"),
  })
    .index("by_invoice", ["invoiceId"])
    .index("by_laboratory", ["laboratoryId"]),

  // ─── Complaints ───────────────────────────────────────────

  complaints: defineTable({
    complaintNumber: v.string(),
    laboratoryId: v.id("laboratories"),
    customerId: v.id("customers"),
    sampleId: v.optional(v.id("samples")),
    title: v.string(),
    description: v.string(),
    severity: v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
    status: v.union(
      v.literal("open"),
      v.literal("under_review"),
      v.literal("resolved"),
      v.literal("closed"),
    ),
    submittedDate: v.string(),
    submittedBy: v.id("users"),
    assignedTo: v.optional(v.id("users")),
    resolution: v.optional(v.string()),
    resolvedDate: v.optional(v.string()),
    resolvedBy: v.optional(v.id("users")),
    linkedCapaId: v.optional(v.id("capas")),
    createdBy: v.id("users"),
  })
    .index("by_laboratory", ["laboratoryId"])
    .index("by_customer", ["customerId"])
    .index("by_status", ["status"]),

  // ─── Quality Management ───────────────────────────────────

  oosInvestigations: defineTable({
    oosNumber: v.string(),
    laboratoryId: v.id("laboratories"),
    sampleId: v.optional(v.id("samples")),
    sampleTestId: v.optional(v.id("sampleTests")),
    title: v.string(),
    description: v.string(),
    detectedDate: v.string(),
    detectedBy: v.id("users"),
    status: v.union(
      v.literal("open"),
      v.literal("phase1"),
      v.literal("phase2"),
      v.literal("concluded"),
      v.literal("closed"),
    ),
    phase1Summary: v.optional(v.string()),
    phase1CompletedDate: v.optional(v.string()),
    phase1CompletedBy: v.optional(v.id("users")),
    phase2Summary: v.optional(v.string()),
    phase2CompletedDate: v.optional(v.string()),
    phase2CompletedBy: v.optional(v.id("users")),
    rootCause: v.optional(v.string()),
    rootCauseCategory: v.optional(v.string()),
    outcome: v.optional(v.union(v.literal("invalidated"), v.literal("confirmed"), v.literal("inconclusive"))),
    closedDate: v.optional(v.string()),
    closedBy: v.optional(v.id("users")),
    assignedTo: v.optional(v.id("users")),
    notes: v.optional(v.string()),
    createdBy: v.id("users"),
  })
    .index("by_laboratory", ["laboratoryId"])
    .index("by_sample", ["sampleId"])
    .index("by_status", ["status"]),

  deviations: defineTable({
    deviationNumber: v.string(),
    laboratoryId: v.id("laboratories"),
    title: v.string(),
    description: v.string(),
    deviationType: v.union(
      v.literal("equipment"),
      v.literal("procedural"),
      v.literal("environmental"),
      v.literal("material"),
      v.literal("personnel"),
      v.literal("other"),
    ),
    severity: v.union(v.literal("minor"), v.literal("major"), v.literal("critical")),
    detectedDate: v.string(),
    detectedBy: v.id("users"),
    status: v.union(
      v.literal("open"),
      v.literal("under_investigation"),
      v.literal("closed"),
    ),
    investigation: v.optional(v.string()),
    rootCause: v.optional(v.string()),
    immediateAction: v.optional(v.string()),
    closedDate: v.optional(v.string()),
    closedBy: v.optional(v.id("users")),
    assignedTo: v.optional(v.id("users")),
    linkedCapaId: v.optional(v.id("capas")),
    createdBy: v.id("users"),
  })
    .index("by_laboratory", ["laboratoryId"])
    .index("by_status", ["status"]),

  capas: defineTable({
    capaNumber: v.string(),
    laboratoryId: v.id("laboratories"),
    title: v.string(),
    description: v.string(),
    capaType: v.union(v.literal("corrective"), v.literal("preventive")),
    sourceType: v.optional(v.string()),
    sourceId: v.optional(v.string()),
    status: v.union(
      v.literal("open"),
      v.literal("in_progress"),
      v.literal("verification"),
      v.literal("closed"),
    ),
    priority: v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
    dueDate: v.optional(v.string()),
    assignedTo: v.optional(v.id("users")),
    actions: v.optional(v.string()),
    implementationDate: v.optional(v.string()),
    implementedBy: v.optional(v.id("users")),
    verificationCriteria: v.optional(v.string()),
    verificationDate: v.optional(v.string()),
    verifiedBy: v.optional(v.id("users")),
    effectivenessReview: v.optional(v.string()),
    closedDate: v.optional(v.string()),
    closedBy: v.optional(v.id("users")),
    createdBy: v.id("users"),
  })
    .index("by_laboratory", ["laboratoryId"])
    .index("by_status", ["status"]),

  changeControls: defineTable({
    changeNumber: v.string(),
    laboratoryId: v.id("laboratories"),
    title: v.string(),
    description: v.string(),
    changeType: v.union(
      v.literal("equipment"),
      v.literal("method"),
      v.literal("reagent"),
      v.literal("software"),
      v.literal("personnel"),
      v.literal("facility"),
      v.literal("procedure"),
      v.literal("other"),
    ),
    status: v.union(
      v.literal("draft"),
      v.literal("submitted"),
      v.literal("approved"),
      v.literal("rejected"),
      v.literal("implemented"),
      v.literal("closed"),
    ),
    priority: v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
    requestedBy: v.id("users"),
    requestedDate: v.string(),
    plannedDate: v.optional(v.string()),
    implementedDate: v.optional(v.string()),
    approvedBy: v.optional(v.id("users")),
    approvedDate: v.optional(v.string()),
    riskAssessment: v.optional(v.string()),
    justification: v.optional(v.string()),
    implementationPlan: v.optional(v.string()),
    verificationRequired: v.optional(v.boolean()),
    notes: v.optional(v.string()),
    createdBy: v.id("users"),
  })
    .index("by_laboratory", ["laboratoryId"])
    .index("by_status", ["status"]),

  // ─── Document Management ─────────────────────────────────
  documents: defineTable({
    laboratoryId: v.id("laboratories"),
    documentNumber: v.string(),
    title: v.string(),
    type: v.union(
      v.literal("sop"), v.literal("method"), v.literal("policy"),
      v.literal("form"), v.literal("specification"), v.literal("validation"),
      v.literal("safety"), v.literal("other"),
    ),
    version: v.string(),
    status: v.union(
      v.literal("draft"), v.literal("under_review"), v.literal("approved"),
      v.literal("effective"), v.literal("superseded"), v.literal("obsolete"),
    ),
    departmentId: v.optional(v.id("departments")),
    owner: v.optional(v.id("users")),
    reviewedBy: v.optional(v.id("users")),
    approvedBy: v.optional(v.id("users")),
    effectiveDate: v.optional(v.string()),
    reviewDate: v.optional(v.string()),
    expiryDate: v.optional(v.string()),
    fileUrl: v.optional(v.string()),
    fileStorageId: v.optional(v.id("_storage")),
    fileName: v.optional(v.string()),
    content: v.optional(v.string()),
    description: v.optional(v.string()),
    keywords: v.optional(v.array(v.string())),
    linkedMethodIds: v.optional(v.array(v.id("testMethods"))),
    isActive: v.boolean(),
    createdBy: v.id("users"),
  })
    .index("by_laboratory", ["laboratoryId"])
    .index("by_status", ["status"])
    .index("by_number", ["documentNumber"]),

  // ─── Storage Location Management ─────────────────────────
  storageLocations: defineTable({
    laboratoryId: v.id("laboratories"),
    name: v.string(),
    code: v.string(),
    locationType: v.union(
      v.literal("room"), v.literal("cabinet"), v.literal("refrigerator"),
      v.literal("freezer"), v.literal("shelf"), v.literal("rack"), v.literal("box"),
    ),
    parentId: v.optional(v.id("storageLocations")),
    temperature: v.optional(v.string()),
    humidity: v.optional(v.string()),
    capacity: v.optional(v.number()),
    currentOccupancy: v.optional(v.number()),
    barcode: v.optional(v.string()),
    notes: v.optional(v.string()),
    isActive: v.boolean(),
    createdBy: v.id("users"),
  })
    .index("by_laboratory", ["laboratoryId"])
    .index("by_parent", ["parentId"]),

  sampleStorageAssignments: defineTable({
    sampleId: v.id("samples"),
    locationId: v.id("storageLocations"),
    laboratoryId: v.id("laboratories"),
    position: v.optional(v.string()),
    checkInDate: v.string(),
    checkInBy: v.id("users"),
    checkOutDate: v.optional(v.string()),
    checkOutBy: v.optional(v.id("users")),
    retentionExpiry: v.optional(v.string()),
    status: v.union(v.literal("in_storage"), v.literal("retrieved"), v.literal("disposed")),
    notes: v.optional(v.string()),
  })
    .index("by_sample", ["sampleId"])
    .index("by_location", ["locationId"])
    .index("by_laboratory", ["laboratoryId"]),

  // ─── Supplier Management ─────────────────────────────────
  suppliers: defineTable({
    supplierCode: v.string(),
    name: v.string(),
    laboratoryId: v.id("laboratories"),
    category: v.union(
      v.literal("chemical"), v.literal("equipment"), v.literal("consumable"),
      v.literal("reference_material"), v.literal("service"), v.literal("other"),
    ),
    qualificationStatus: v.union(
      v.literal("pending"), v.literal("qualified"), v.literal("conditional"),
      v.literal("disqualified"), v.literal("under_review"),
    ),
    country: v.optional(v.string()),
    address: v.optional(v.string()),
    website: v.optional(v.string()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    contactName: v.optional(v.string()),
    qualificationDate: v.optional(v.string()),
    requalificationDate: v.optional(v.string()),
    qualificationNotes: v.optional(v.string()),
    certifications: v.optional(v.array(v.string())),
    performanceScore: v.optional(v.number()),
    isActive: v.boolean(),
    createdBy: v.id("users"),
  })
    .index("by_laboratory", ["laboratoryId"])
    .index("by_code", ["supplierCode"])
    .index("by_status", ["qualificationStatus"]),

  // ─── Training Management ──────────────────────────────────
  trainingCourses: defineTable({
    laboratoryId: v.id("laboratories"),
    courseCode: v.string(),
    title: v.string(),
    type: v.union(
      v.literal("sop"), v.literal("method"), v.literal("safety"),
      v.literal("instrument"), v.literal("regulatory"), v.literal("other"),
    ),
    description: v.optional(v.string()),
    linkedDocumentId: v.optional(v.id("documents")),
    linkedMethodId: v.optional(v.id("testMethods")),
    durationHours: v.optional(v.number()),
    validityMonths: v.optional(v.number()),
    assessmentRequired: v.boolean(),
    passingScore: v.optional(v.number()),
    isActive: v.boolean(),
    createdBy: v.id("users"),
  })
    .index("by_laboratory", ["laboratoryId"]),

  trainingAssignments: defineTable({
    courseId: v.id("trainingCourses"),
    userId: v.id("users"),
    laboratoryId: v.id("laboratories"),
    assignedBy: v.id("users"),
    assignedDate: v.string(),
    dueDate: v.optional(v.string()),
    completedDate: v.optional(v.string()),
    expiryDate: v.optional(v.string()),
    assessmentScore: v.optional(v.number()),
    status: v.union(
      v.literal("assigned"), v.literal("in_progress"), v.literal("completed"),
      v.literal("overdue"), v.literal("expired"),
    ),
    notes: v.optional(v.string()),
  })
    .index("by_course", ["courseId"])
    .index("by_user", ["userId"])
    .index("by_laboratory", ["laboratoryId"]),

  // ─── Audit Management ────────────────────────────────────
  audits: defineTable({
    laboratoryId: v.id("laboratories"),
    auditNumber: v.string(),
    title: v.string(),
    auditType: v.union(
      v.literal("internal"), v.literal("external"), v.literal("regulatory"),
      v.literal("supplier"), v.literal("customer"),
    ),
    status: v.union(
      v.literal("planned"), v.literal("in_progress"), v.literal("report_pending"),
      v.literal("closed"),
    ),
    plannedDate: v.string(),
    conductedDate: v.optional(v.string()),
    closedDate: v.optional(v.string()),
    leadAuditor: v.optional(v.id("users")),
    scope: v.optional(v.string()),
    objectives: v.optional(v.string()),
    departments: v.optional(v.array(v.id("departments"))),
    summary: v.optional(v.string()),
    createdBy: v.id("users"),
  })
    .index("by_laboratory", ["laboratoryId"])
    .index("by_status", ["status"]),

  auditFindings: defineTable({
    auditId: v.id("audits"),
    laboratoryId: v.id("laboratories"),
    findingNumber: v.string(),
    type: v.union(v.literal("major"), v.literal("minor"), v.literal("observation"), v.literal("opportunity")),
    description: v.string(),
    requirement: v.optional(v.string()),
    evidence: v.optional(v.string()),
    status: v.union(v.literal("open"), v.literal("in_progress"), v.literal("closed")),
    dueDate: v.optional(v.string()),
    responsibleId: v.optional(v.id("users")),
    linkedCapaId: v.optional(v.id("capas")),
    closedDate: v.optional(v.string()),
    closureEvidence: v.optional(v.string()),
    createdBy: v.id("users"),
  })
    .index("by_audit", ["auditId"])
    .index("by_laboratory", ["laboratoryId"]),

  // ─── System Configuration ────────────────────────────────
  systemConfig: defineTable({
    laboratoryId: v.id("laboratories"),
    key: v.string(),
    value: v.string(),
    updatedBy: v.id("users"),
    updatedAt: v.string(),
  })
    .index("by_lab_key", ["laboratoryId", "key"]),

  // ─── Instrument Integration ──────────────────────────────

  // Per-instrument file interface profile (how to parse exported files)
  instrumentInterfaces: defineTable({
    instrumentId: v.id("instruments"),
    laboratoryId: v.id("laboratories"),
    interfaceName: v.string(),
    fileFormat: v.union(v.literal("csv"), v.literal("tsv"), v.literal("txt")),
    delimiter: v.optional(v.string()),     // comma | tab | semicolon | pipe
    hasHeaderRow: v.boolean(),
    headerRowIndex: v.optional(v.number()),
    dataStartRow: v.optional(v.number()),
    useNamedColumns: v.optional(v.boolean()),
    // Index-based column mappings
    colLimsNumber: v.optional(v.number()),
    colTestCode: v.optional(v.number()),
    colResult: v.optional(v.number()),
    colUnit: v.optional(v.number()),
    colFlags: v.optional(v.number()),
    colAnalysisDate: v.optional(v.number()),
    colOperator: v.optional(v.number()),
    // Named column mappings
    colNameLimsNumber: v.optional(v.string()),
    colNameTestCode: v.optional(v.string()),
    colNameResult: v.optional(v.string()),
    colNameUnit: v.optional(v.string()),
    colNameFlags: v.optional(v.string()),
    notes: v.optional(v.string()),
    isActive: v.boolean(),
    createdBy: v.id("users"),
  })
    .index("by_instrument", ["instrumentId"])
    .index("by_laboratory", ["laboratoryId"]),

  // Each file-upload / import session
  instrumentResultBatches: defineTable({
    instrumentId: v.id("instruments"),
    interfaceId: v.id("instrumentInterfaces"),
    laboratoryId: v.id("laboratories"),
    fileName: v.string(),
    uploadedAt: v.string(),
    uploadedBy: v.id("users"),
    status: v.union(
      v.literal("pending"),
      v.literal("imported"),
      v.literal("partial"),
      v.literal("failed"),
    ),
    totalRows: v.number(),
    matchedRows: v.number(),
    unmatchedRows: v.number(),
    importedRows: v.number(),
    notes: v.optional(v.string()),
  })
    .index("by_instrument", ["instrumentId"])
    .index("by_laboratory", ["laboratoryId"]),

  // Individual parsed rows from a batch
  instrumentResultRows: defineTable({
    batchId: v.id("instrumentResultBatches"),
    laboratoryId: v.id("laboratories"),
    rawData: v.string(),
    limsNumber: v.optional(v.string()),
    testCode: v.optional(v.string()),
    result: v.optional(v.string()),
    unit: v.optional(v.string()),
    flags: v.optional(v.string()),
    analysisDate: v.optional(v.string()),
    operator: v.optional(v.string()),
    matchStatus: v.union(
      v.literal("matched"),
      v.literal("unmatched"),
      v.literal("duplicate"),
      v.literal("skipped"),
    ),
    sampleTestId: v.optional(v.id("sampleTests")),
    importedAt: v.optional(v.string()),
  })
    .index("by_batch", ["batchId"])
    .index("by_laboratory", ["laboratoryId"]),

  // QC control results for Levey-Jennings charts
  instrumentQcResults: defineTable({
    instrumentId: v.id("instruments"),
    laboratoryId: v.id("laboratories"),
    analyte: v.string(),
    controlLevel: v.string(),          // Low | Normal | High
    controlLotNumber: v.optional(v.string()),
    targetMean: v.number(),
    targetSd: v.number(),
    measuredValue: v.number(),
    runDate: v.string(),
    runNumber: v.optional(v.number()),
    operatorId: v.optional(v.id("users")),
    westgardViolations: v.optional(v.array(v.string())),
    accepted: v.boolean(),
    notes: v.optional(v.string()),
    createdBy: v.id("users"),
  })
    .index("by_instrument", ["instrumentId"])
    .index("by_instrument_analyte", ["instrumentId", "analyte"]),

  // ─── LIMS Sequence Counters ───────────────────────────────
  limsCounters: defineTable({
    laboratoryId: v.id("laboratories"),
    year: v.number(),
    lastSequence: v.number(),
  }).index("by_lab_year", ["laboratoryId", "year"]),

  // ─── Audit Trail ─────────────────────────────────────────
  auditTrail: defineTable({
    userId: v.id("users"),
    module: v.string(),
    recordId: v.string(),
    action: v.string(),
    oldValue: v.optional(v.string()),
    newValue: v.optional(v.string()),
    reason: v.optional(v.string()),
    ipAddress: v.optional(v.string()),
    timestamp: v.string(),
  })
    .index("by_record", ["module", "recordId"])
    .index("by_user", ["userId"]),

  // ─── Notifications ───────────────────────────────────────
  notifications: defineTable({
    userId: v.id("users"),
    title: v.string(),
    message: v.string(),
    type: v.string(),
    relatedModule: v.optional(v.string()),
    relatedId: v.optional(v.string()),
    isRead: v.boolean(),
    createdAt: v.string(),
  })
    .index("by_user", ["userId"])
    .index("by_user_unread", ["userId", "isRead"]),

  // ─── Revenue & Financial (ERP) ───────────────────────────────────────
  expenses: defineTable({
    laboratoryId: v.id("laboratories"),
    expenseNumber: v.string(),
    category: v.string(),       // reagents | equipment | staffing | utilities | maintenance | overhead | other
    description: v.string(),
    amount: v.number(),
    currency: v.string(),
    vendor: v.optional(v.string()),
    invoiceRef: v.optional(v.string()),
    expenseDate: v.string(),    // ISO 8601
    approvedBy: v.optional(v.id("users")),
    status: v.string(),         // pending | approved | paid | rejected
    costCentre: v.optional(v.string()),
    notes: v.optional(v.string()),
    createdBy: v.id("users"),
    createdAt: v.string(),
  })
    .index("by_laboratory", ["laboratoryId"])
    .index("by_laboratory_date", ["laboratoryId", "expenseDate"]),

  budgets: defineTable({
    laboratoryId: v.id("laboratories"),
    fiscalYear: v.number(),
    category: v.string(),
    allocatedAmount: v.number(),
    currency: v.string(),
    notes: v.optional(v.string()),
    createdBy: v.id("users"),
    createdAt: v.string(),
  })
    .index("by_laboratory", ["laboratoryId"])
    .index("by_laboratory_year", ["laboratoryId", "fiscalYear"]),

  // ─── Formula / Calculations Engine ──────────────────────────────────────
  calculationFormulas: defineTable({
    laboratoryId: v.id("laboratories"),
    name: v.string(),
    description: v.optional(v.string()),
    category: v.string(), // dilution | concentration | recovery | statistics | moisture | yield | custom
    formula: v.string(),  // e.g. "(result * dilutionFactor) / sampleWeight * 100"
    variables: v.array(v.object({
      symbol: v.string(),   // e.g. "dilutionFactor"
      label: v.string(),    // human label
      unit: v.optional(v.string()),
      defaultValue: v.optional(v.number()),
    })),
    resultUnit: v.optional(v.string()),
    decimalPlaces: v.optional(v.number()),
    isActive: v.boolean(),
    createdBy: v.id("users"),
  })
    .index("by_laboratory", ["laboratoryId"])
    .index("by_category", ["category"]),

  // sampleTests gets extra calculation fields — stored as enrichment on sampleTestCalculations
  sampleTestCalculations: defineTable({
    sampleTestId: v.id("sampleTests"),
    formulaId: v.optional(v.id("calculationFormulas")),
    formulaName: v.optional(v.string()),
    variableValues: v.optional(v.record(v.string(), v.number())),
    calculatedResult: v.optional(v.number()),
    replicates: v.optional(v.array(v.number())),
    average: v.optional(v.number()),
    stdDev: v.optional(v.number()),
    rsd: v.optional(v.number()),
    uncertainty: v.optional(v.number()),
    notes: v.optional(v.string()),
    createdBy: v.id("users"),
    updatedAt: v.string(),
  })
    .index("by_sample_test", ["sampleTestId"]),

  // ─── Retest / Repeat ────────────────────────────────────────────────────
  retestRequests: defineTable({
    sampleTestId: v.id("sampleTests"),
    sampleId: v.id("samples"),
    requestedBy: v.id("users"),
    requestedAt: v.string(),
    reason: v.string(), // reason code: oos | oot | analyst_error | instrument_fault | sample_issue | customer_request | other
    reasonDetail: v.optional(v.string()),
    rootCause: v.optional(v.string()),
    approvedBy: v.optional(v.id("users")),
    approvedAt: v.optional(v.string()),
    status: v.union(
      v.literal("pending_approval"),
      v.literal("approved"),
      v.literal("rejected"),
      v.literal("in_progress"),
      v.literal("completed"),
    ),
    originalResult: v.optional(v.string()),
    retestResult: v.optional(v.string()),
    conclusion: v.optional(v.string()),
    notes: v.optional(v.string()),
    createdBy: v.id("users"),
  })
    .index("by_sample_test", ["sampleTestId"])
    .index("by_sample", ["sampleId"])
    .index("by_status", ["status"]),

  // ─── Specification Sets ─────────────────────────────────────────────────
  specificationSets: defineTable({
    laboratoryId: v.id("laboratories"),
    name: v.string(),
    code: v.string(),
    type: v.string(), // product | customer | regulatory | pharmacopoeia | internal
    pharmacopoeiaRef: v.optional(v.string()), // USP, BP, EP, IP, JP
    customerId: v.optional(v.id("customers")),
    product: v.optional(v.string()),
    country: v.optional(v.string()),
    version: v.string(),
    effectiveDate: v.string(),
    expiryDate: v.optional(v.string()),
    status: v.union(v.literal("draft"), v.literal("approved"), v.literal("superseded"), v.literal("obsolete")),
    approvedBy: v.optional(v.id("users")),
    approvedAt: v.optional(v.string()),
    notes: v.optional(v.string()),
    createdBy: v.id("users"),
  })
    .index("by_laboratory", ["laboratoryId"])
    .index("by_customer", ["customerId"]),

  specificationParameters: defineTable({
    specSetId: v.id("specificationSets"),
    testId: v.optional(v.id("tests")),
    parameterName: v.string(),
    unit: v.optional(v.string()),
    resultType: v.string(),
    lowerLimit: v.optional(v.number()),
    upperLimit: v.optional(v.number()),
    alertLower: v.optional(v.number()),  // alert limit (warn before OOS)
    alertUpper: v.optional(v.number()),
    actionLower: v.optional(v.number()), // action limit (trigger investigation)
    actionUpper: v.optional(v.number()),
    nominalValue: v.optional(v.number()),
    tolerance: v.optional(v.number()),   // ± tolerance
    method: v.optional(v.string()),
    notes: v.optional(v.string()),
  })
    .index("by_spec_set", ["specSetId"])
    .index("by_test", ["testId"]),

  // ─── COA Records (M36 — version control, reissue) ─────────────────
  coaRecords: defineTable({
    sampleId: v.id("samples"),
    laboratoryId: v.id("laboratories"),
    limsNumber: v.string(),
    version: v.number(),              // 1, 2, 3…
    status: v.union(
      v.literal("draft"),
      v.literal("issued"),
      v.literal("reissued"),
      v.literal("cancelled"),
    ),
    watermark: v.optional(v.union(
      v.literal("DRAFT"),
      v.literal("CANCELLED"),
      v.literal("REISSUED"),
    )),
    issuedAt: v.optional(v.string()),
    issuedBy: v.id("users"),
    emailedTo: v.optional(v.string()),
    emailedAt: v.optional(v.string()),
    aiSummary: v.optional(v.string()),
    reissueReason: v.optional(v.string()),
    notes: v.optional(v.string()),
  })
    .index("by_sample", ["sampleId"])
    .index("by_laboratory", ["laboratoryId"]),

  // ─── Result Validations (M33) ──────────────────────────────────────
  resultValidations: defineTable({
    sampleTestId: v.id("sampleTests"),
    sampleId: v.id("samples"),
    laboratoryId: v.id("laboratories"),
    testId: v.id("tests"),
    measuredValue: v.number(),
    unit: v.optional(v.string()),
    // Spec check
    specSetId: v.optional(v.id("specificationSets")),
    specParameterId: v.optional(v.id("specificationParameters")),
    lowerLimit: v.optional(v.number()),
    upperLimit: v.optional(v.number()),
    specStatus: v.optional(v.union(v.literal("pass"), v.literal("fail_oos"), v.literal("warn_alert"), v.literal("warn_action"), v.literal("no_spec"))),
    // Westgard rules (for QC-material context)
    westgardViolations: v.optional(v.array(v.string())),
    westgardStatus: v.optional(v.union(v.literal("pass"), v.literal("warning"), v.literal("reject"))),
    // Trend / SPC
    trendAlerts: v.optional(v.array(v.string())),
    // Validation sign-off
    validationStatus: v.union(v.literal("pending"), v.literal("accepted"), v.literal("rejected"), v.literal("flagged")),
    validatedBy: v.optional(v.id("users")),
    validatedAt: v.optional(v.string()),
    validationNotes: v.optional(v.string()),
    // Outlier
    isOutlier: v.optional(v.boolean()),
    outlierReason: v.optional(v.string()),
    createdBy: v.id("users"),
  })
    .index("by_sample_test", ["sampleTestId"])
    .index("by_sample", ["sampleId"])
    .index("by_laboratory", ["laboratoryId"])
    .index("by_validation_status", ["validationStatus"]),

  // ─── Error Logs (admin diagnostics) ──────────────────────────────
  errorLogs: defineTable({
    errorId: v.string(),
    timestamp: v.string(),
    userId: v.optional(v.id("users")),
    userName: v.optional(v.string()),
    laboratoryId: v.optional(v.id("laboratories")),
    module: v.string(),
    screen: v.string(),
    action: v.string(),
    fieldId: v.optional(v.string()),
    category: v.string(),           // ErrorSeverity
    title: v.string(),
    detail: v.string(),
    rawMessage: v.string(),
    userAgent: v.optional(v.string()),
    url: v.optional(v.string()),
  })
    .index("by_laboratory", ["laboratoryId"])
    .index("by_category", ["category"])
    .index("by_timestamp", ["timestamp"]),
});
